import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

/**
 * Defense-in-depth for Level-1 (trusted-client gateway). Every protected /api
 * route also enforces this itself; the middleware guarantees the whole surface
 * is gated even if a handler forgets.
 *
 * A request passes Level-1 if it presents a valid `x-api-key` (native/
 * programmatic clients) OR carries a validly-signed session cookie (the
 * first-party browser). Public bootstrap routes are exempt so an
 * unauthenticated browser can reach them.
 */
const ACCESS_COOKIE = 'sm_access';

// Prefixes reachable without any credential.
const PUBLIC_PREFIXES = [
  '/api/health',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/auth/logout',
  '/api/catalog/',
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname === p.replace(/\/$/, '') || pathname.startsWith(p),
  );
}

// Constant-time compare (edge-runtime safe).
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function deny() {
  return NextResponse.json(
    { success: false, error: { message: 'Client is not authorized (gateway)', code: 'GATEWAY_DENIED' } },
    { status: 401 },
  );
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  // Native / programmatic client: API key.
  const expected = process.env.API_GATEWAY_KEY ?? '';
  const provided = req.headers.get('x-api-key') ?? '';
  if (expected && provided && safeEqual(provided, expected)) {
    return NextResponse.next();
  }

  // First-party browser: validly-signed session cookie.
  const cookie = req.cookies.get(ACCESS_COOKIE)?.value;
  if (cookie && process.env.JWT_ACCESS_SECRET) {
    try {
      await jwtVerify(cookie, new TextEncoder().encode(process.env.JWT_ACCESS_SECRET), {
        issuer: 'studymonk',
        audience: 'studymonk-api',
      });
      return NextResponse.next();
    } catch {
      // fall through to deny
    }
  }

  return deny();
}

export const config = {
  matcher: ['/api/:path*'],
};
