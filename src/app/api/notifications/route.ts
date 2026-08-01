export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/auth';
import { ok, handleError } from '@/lib/http';

// The caller's recent notifications + unread count.
export async function GET(req: NextRequest) {
  try {
    const auth = await guard(req);
    const [notifications, unread] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: auth.id },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      prisma.notification.count({ where: { userId: auth.id, read: false } }),
    ]);
    return ok({ notifications, unread });
  } catch (err) {
    return handleError(err);
  }
}

// Mark all as read.
export async function POST(req: NextRequest) {
  try {
    const auth = await guard(req);
    await prisma.notification.updateMany({ where: { userId: auth.id, read: false }, data: { read: true } });
    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
