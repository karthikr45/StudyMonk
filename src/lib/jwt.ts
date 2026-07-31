import { SignJWT, jwtVerify } from 'jose';
import { randomBytes, createHash } from 'crypto';
import { env } from './env';

export interface AccessTokenClaims {
  sub: string; // user id
  role: 'SUPER_ADMIN' | 'STUDENT';
  email: string;
}

function accessSecret() {
  return new TextEncoder().encode(env().JWT_ACCESS_SECRET);
}

export async function signAccessToken(claims: AccessTokenClaims): Promise<string> {
  const ttl = env().ACCESS_TOKEN_TTL;
  return new SignJWT({ role: claims.role, email: claims.email })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setIssuer('studymonk')
    .setAudience('studymonk-api')
    .setExpirationTime(`${ttl}s`)
    .sign(accessSecret());
}

export async function verifyAccessToken(
  token: string,
): Promise<AccessTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, accessSecret(), {
      issuer: 'studymonk',
      audience: 'studymonk-api',
    });
    if (!payload.sub || !payload.role) return null;
    return {
      sub: payload.sub as string,
      role: payload.role as AccessTokenClaims['role'],
      email: (payload.email as string) ?? '',
    };
  } catch {
    return null;
  }
}

// ---- Refresh tokens ---------------------------------------------------------
// Opaque random tokens. We store only a SHA-256 hash in the DB so a database
// leak cannot be used to mint sessions.

export function generateRefreshToken(): string {
  return randomBytes(48).toString('base64url');
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
