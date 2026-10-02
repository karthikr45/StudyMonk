import { NextResponse } from 'next/server';
import { prisma } from './prisma';
import { env } from './env';
import { HttpError } from './http';
import { signAccessToken, generateRefreshToken, hashRefreshToken } from './jwt';
import type { Role, Prisma } from '@prisma/client';

import { ACCESS_COOKIE } from './auth';

const REFRESH_COOKIE = 'sm_refresh';

interface IssueInput {
  userId: string;
  email: string;
  role: Role;
  userAgent?: string | null;
  ipAddress?: string | null;
}

/**
 * Create a DB-backed refresh session and mint an access token. Returns the
 * access token plus the raw refresh token (to be set as an httpOnly cookie).
 */
export async function issueSession(
  input: IssueInput,
  db: Prisma.TransactionClient = prisma,
) {
  const refreshToken = generateRefreshToken();
  const refreshTokenHash = hashRefreshToken(refreshToken);
  const expiresAt = new Date(Date.now() + env().REFRESH_TOKEN_TTL * 1000);

  await db.session.create({
    data: {
      userId: input.userId,
      refreshTokenHash,
      userAgent: input.userAgent ?? null,
      ipAddress: input.ipAddress ?? null,
      expiresAt,
    },
  });

  const accessToken = await signAccessToken({
    sub: input.userId,
    role: input.role,
    email: input.email,
  });

  return { accessToken, refreshToken, expiresAt };
}

/** Rotate: revoke the old session row and create a fresh one. */
export async function rotateSession(oldSessionId: string, input: IssueInput) {
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.session.updateMany({
      where: {
        id: oldSessionId,
        userId: input.userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        user: { isActive: true },
      },
      data: { revokedAt: new Date() },
    });
    if (claimed.count !== 1)
      throw new HttpError(
        'Refresh token is invalid or expired',
        401,
        'REFRESH_INVALID',
      );
    return issueSession(input, tx);
  });
}

export function setRefreshCookie(res: NextResponse, token: string) {
  res.cookies.set(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env().NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: env().REFRESH_TOKEN_TTL,
  });
}

export function clearRefreshCookie(res: NextResponse) {
  res.cookies.set(REFRESH_COOKIE, '', {
    httpOnly: true,
    secure: env().NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: 0,
  });
}

/**
 * The access token is ALSO delivered to the browser as an httpOnly cookie so
 * the web client never has to hold a token (or the API key) in JavaScript.
 * Native clients ignore this and use the token from the JSON body instead.
 */
export function setAccessCookie(res: NextResponse, token: string) {
  res.cookies.set(ACCESS_COOKIE, token, {
    httpOnly: true,
    secure: env().NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: env().ACCESS_TOKEN_TTL,
  });
}

export function clearAccessCookie(res: NextResponse) {
  res.cookies.set(ACCESS_COOKIE, '', {
    httpOnly: true,
    secure: env().NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export const REFRESH_COOKIE_NAME = REFRESH_COOKIE;
