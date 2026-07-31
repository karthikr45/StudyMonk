export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, fail, handleError } from '@/lib/http';
import { hashRefreshToken } from '@/lib/jwt';
import {
  rotateSession,
  setRefreshCookie,
  setAccessCookie,
  REFRESH_COOKIE_NAME,
} from '@/lib/session';

// Exchange a valid refresh cookie for a new access token (with rotation).
// Public bootstrap route: the refresh cookie itself is the credential.
export async function POST(req: NextRequest) {
  try {
    const raw = req.cookies.get(REFRESH_COOKIE_NAME)?.value;
    if (!raw) return fail('No refresh token', 401, 'NO_REFRESH');

    const session = await prisma.session.findUnique({
      where: { refreshTokenHash: hashRefreshToken(raw) },
      include: { user: true },
    });

    if (
      !session ||
      session.revokedAt ||
      session.expiresAt < new Date() ||
      !session.user.isActive
    ) {
      return fail('Refresh token is invalid or expired', 401, 'REFRESH_INVALID');
    }

    const { accessToken, refreshToken } = await rotateSession(session.id, {
      userId: session.user.id,
      email: session.user.email,
      role: session.user.role,
      userAgent: req.headers.get('user-agent'),
      ipAddress: req.headers.get('x-forwarded-for'),
    });

    const res = ok({
      accessToken,
      user: {
        id: session.user.id,
        email: session.user.email,
        fullName: session.user.fullName,
        role: session.user.role,
      },
    });
    setRefreshCookie(res, refreshToken);
    setAccessCookie(res, accessToken);
    return res;
  } catch (err) {
    return handleError(err);
  }
}