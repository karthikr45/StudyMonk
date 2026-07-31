export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, handleError } from '@/lib/http';
import { hashRefreshToken } from '@/lib/jwt';
import {
  clearRefreshCookie,
  clearAccessCookie,
  REFRESH_COOKIE_NAME,
} from '@/lib/session';

export async function POST(req: NextRequest) {
  try {
    const raw = req.cookies.get(REFRESH_COOKIE_NAME)?.value;
    if (raw) {
      await prisma.session.updateMany({
        where: { refreshTokenHash: hashRefreshToken(raw), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    const res = ok({ loggedOut: true });
    clearRefreshCookie(res);
    clearAccessCookie(res);
    return res;
  } catch (err) {
    return handleError(err);
  }
}