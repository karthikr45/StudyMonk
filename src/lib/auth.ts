import { NextRequest } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { env } from './env';
import { verifyAccessToken, AccessTokenClaims } from './jwt';
import { HttpError } from './http';
import { prisma } from './prisma';

/**
 * TWO-LEVEL API SECURITY
 * ----------------------
 * Level 1 (trusted-client gateway): a request must prove it comes from a
 *   trusted client. Native / offline / programmatic clients do this with the
 *   `x-api-key` header (API_GATEWAY_KEY). The first-party web browser does it
 *   with a secure httpOnly session cookie (`sm_access`) that never exposes a
 *   secret to JavaScript.
 * Level 2 (user identity): a valid, unexpired JWT access token — supplied as a
 *   Bearer header (native clients) or the same httpOnly cookie (browser) —
 *   backed by an active account and, where required, a specific role.
 *
 * A protected request must clear BOTH levels.
 */

export const ACCESS_COOKIE = 'sm_access';

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function hasValidApiKey(req: NextRequest): boolean {
  const provided = req.headers.get('x-api-key');
  return !!provided && safeEqual(provided, env().API_GATEWAY_KEY);
}

/** Extract the access token from the Bearer header or the session cookie. */
function extractAccessToken(req: NextRequest): string | null {
  const header = req.headers.get('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme === 'Bearer' && token) return token;
  return req.cookies.get(ACCESS_COOKIE)?.value ?? null;
}

/** Level 1 — throws 401 unless the request is from a trusted client. */
export async function requireGateway(req: NextRequest): Promise<void> {
  if (hasValidApiKey(req)) return; // native/programmatic client
  // First-party browser: a validly-signed session cookie satisfies the gateway.
  const cookie = req.cookies.get(ACCESS_COOKIE)?.value;
  if (cookie && (await verifyAccessToken(cookie))) return;
  throw new HttpError('Client is not authorized (gateway)', 401, 'GATEWAY_DENIED');
}

export interface AuthUser extends AccessTokenClaims {
  id: string;
}

/** Level 2 — verify the user token and confirm the account is active. */
export async function requireUser(req: NextRequest): Promise<AuthUser> {
  const token = extractAccessToken(req);
  if (!token) throw new HttpError('Authentication required', 401, 'TOKEN_MISSING');
  const claims = await verifyAccessToken(token);
  if (!claims) throw new HttpError('Invalid or expired token', 401, 'TOKEN_INVALID');

  const user = await prisma.user.findUnique({
    where: { id: claims.sub },
    select: { id: true, isActive: true, role: true, email: true },
  });
  if (!user || !user.isActive) {
    throw new HttpError('Account is not active', 401, 'ACCOUNT_INACTIVE');
  }
  return { id: user.id, sub: user.id, role: user.role, email: user.email };
}

/**
 * Enforce BOTH levels (and optionally a role). Use at the top of every
 * protected route handler.
 */
export async function guard(
  req: NextRequest,
  opts?: { role?: 'SUPER_ADMIN' | 'STUDENT' },
): Promise<AuthUser> {
  await requireGateway(req); // Level 1
  const user = await requireUser(req); // Level 2
  if (opts?.role && user.role !== opts.role) {
    throw new HttpError('Insufficient permissions', 403, 'FORBIDDEN');
  }
  return user;
}
