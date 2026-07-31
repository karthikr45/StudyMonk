export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, fail, handleError } from '@/lib/http';
import { loginSchema } from '@/lib/validation';
import { verifyPassword } from '@/lib/password';
import { issueSession, setRefreshCookie, setAccessCookie } from '@/lib/session';

// Public bootstrap route (no gateway key needed) so any first-party browser
// can authenticate. Protect abuse at the edge (Cloudflare/WAF rate limiting).
export async function POST(req: NextRequest) {
  try {
    const body = loginSchema.parse(await req.json());

    const user = await prisma.user.findUnique({
      where: { email: body.email.toLowerCase() },
    });

    // Constant-ish response: always verify against something to reduce timing
    // signal, and give a single generic error for both cases.
    const validPassword = user
      ? await verifyPassword(body.password, user.passwordHash)
      : await verifyPassword(body.password, '$2a$12$invalidinvalidinvalidinvalidinv');

    if (!user || !validPassword || !user.isActive) {
      return fail('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    const { accessToken, refreshToken } = await issueSession({
      userId: user.id,
      email: user.email,
      role: user.role,
      userAgent: req.headers.get('user-agent'),
      ipAddress: req.headers.get('x-forwarded-for'),
    });

    const res = ok({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    });
    setRefreshCookie(res, refreshToken);
    setAccessCookie(res, accessToken);
    return res;
  } catch (err) {
    return handleError(err);
  }
}