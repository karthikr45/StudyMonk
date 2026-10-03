export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/auth';
import { ok, handleError } from '@/lib/http';

// The caller's recent notifications + unread count.
export async function GET(req: NextRequest) {
  try {
    const auth = await guard(req);
    const memberships = await prisma.groupMember.findMany({
      where: {
        userId: auth.id,
        enrollment: { status: 'ACTIVE', batch: { archivedAt: null } },
      },
      select: { groupId: true },
    });
    const visible = {
      userId: auth.id,
      OR: [
        { groupId: null },
        { groupId: { in: memberships.map((m) => m.groupId) } },
      ],
    };
    const [notifications, unread] = await Promise.all([
      prisma.notification.findMany({
        where: visible,
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      prisma.notification.count({ where: { ...visible, read: false } }),
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
    const body = z
      .union([
        z.object({ id: z.string().min(1) }),
        z.object({ all: z.literal(true) }),
      ])
      .parse(await req.json());
    await prisma.notification.updateMany({
      where: {
        userId: auth.id,
        read: false,
        ...('id' in body ? { id: body.id } : {}),
      },
      data: { read: true },
    });
    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
