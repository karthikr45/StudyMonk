export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, handleError } from '@/lib/http';
import { requireGroupMember } from '@/lib/groups';

// Unread notification counts for this group, per section — drives the "new"
// dots on the Chat / Files / Cards / Polls tabs.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { auth } = await requireGroupMember(req, params.id);
    const rows = await prisma.notification.groupBy({
      by: ['tab'],
      where: { userId: auth.id, groupId: params.id, read: false },
      _count: { _all: true },
    });
    const byTab: Record<string, number> = {};
    for (const r of rows) if (r.tab) byTab[r.tab] = r._count._all;
    return ok({ byTab });
  } catch (err) {
    return handleError(err);
  }
}
