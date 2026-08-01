export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/auth';
import { ok, fail, handleError } from '@/lib/http';

// Full read-only view of a group for Super Admin monitoring.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await guard(req, { role: 'SUPER_ADMIN' });
    const group = await prisma.studyGroup.findUnique({
      where: { id: params.id },
      include: {
        board: { select: { name: true } },
        class: { select: { name: true } },
        members: { orderBy: { joinedAt: 'asc' }, include: { user: { select: { id: true, fullName: true } } } },
        posts: {
          orderBy: { createdAt: 'asc' },
          include: { author: { select: { id: true, fullName: true } } },
        },
        resources: { orderBy: { createdAt: 'desc' }, include: { uploader: { select: { fullName: true } } } },
        cardSets: {
          orderBy: { createdAt: 'desc' },
          include: { createdBy: { select: { fullName: true } }, cards: { select: { front: true, back: true } } },
        },
        polls: {
          orderBy: { createdAt: 'desc' },
          include: {
            createdBy: { select: { fullName: true } },
            options: { include: { _count: { select: { votes: true } } } },
          },
        },
      },
    });
    if (!group) return fail('Group not found', 404, 'NOT_FOUND');
    return ok({ group });
  } catch (err) {
    return handleError(err);
  }
}
