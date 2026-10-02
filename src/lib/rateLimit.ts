import { createHmac } from 'crypto';
import type { NextRequest } from 'next/server';
import { prisma } from './prisma';
import { env } from './env';
import { HttpError } from './http';

/** Shared across serverless instances; raw IPs/emails/tokens are not stored. */
export async function consumeRateLimit(
  scope: string,
  identity: string,
  limit: number,
  seconds = 900,
) {
  const id = createHmac('sha256', env().JWT_ACCESS_SECRET)
    .update(`${scope}:${identity}`)
    .digest('hex');
  const expiresAt = new Date(Date.now() + seconds * 1000);
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimitBucket" ("id", "count", "expiresAt") VALUES (${id}, 1, ${expiresAt})
    ON CONFLICT ("id") DO UPDATE SET
      "count" = CASE WHEN "RateLimitBucket"."expiresAt" <= NOW() THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
      "expiresAt" = CASE WHEN "RateLimitBucket"."expiresAt" <= NOW() THEN EXCLUDED."expiresAt" ELSE "RateLimitBucket"."expiresAt" END
    RETURNING "count"`;
  if (rows[0].count > limit)
    throw new HttpError(
      'Too many requests. Try again later.',
      429,
      'RATE_LIMITED',
    );
}

export async function limitAuthRequest(req: NextRequest, action: string) {
  // Only trust a forwarding header when the hosting ingress overwrites it.
  const header =
    process.env.NETLIFY === 'true'
      ? 'x-nf-client-connection-ip'
      : process.env.TRUSTED_CLIENT_IP_HEADER;
  const identity = header ? req.headers.get(header)?.trim() : null;
  // Without a trusted ingress use a conservative shared budget, not spoofable XFF.
  await consumeRateLimit(
    `auth:${action}`,
    identity || 'shared-ingress',
    identity ? 60 : 300,
  );
}
