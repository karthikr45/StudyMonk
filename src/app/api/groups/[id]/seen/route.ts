export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, handleError } from '@/lib/http';
import { requireGroupMember } from '@/lib/groups';
import { z } from 'zod';

const schema = z.object({ tab: z.string().min(1).max(20) });

// Mark this group's notifications for one section as read (student opened it).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { auth } = await requireGroupMember(req, params.id);
    const { tab } = schema.parse(await req.json());
    await prisma.notification.updateMany({
      where: { userId: auth.id, groupId: params.id, tab, read: false },
      data: { read: true },
    });
    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
