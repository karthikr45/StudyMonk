export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, handleError } from '@/lib/http';
import { requireGroupMember, notifyGroupMembers } from '@/lib/groups';
import { cardSetSchema } from '@/lib/validation';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireGroupMember(req, params.id);
    const sets = await prisma.groupCardSet.findMany({
      where: { groupId: params.id },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, fullName: true } },
        cards: { orderBy: { order: 'asc' }, select: { id: true, front: true, back: true } },
      },
    });
    return ok({ sets });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { auth, group } = await requireGroupMember(req, params.id);
    const body = cardSetSchema.parse(await req.json());
    const set = await prisma.groupCardSet.create({
      data: {
        groupId: params.id, createdById: auth.id, title: body.title,
        cards: { create: body.cards.map((c, i) => ({ front: c.front, back: c.back, order: i })) },
      },
      include: { cards: { orderBy: { order: 'asc' } } },
    });
    await notifyGroupMembers({ groupId: params.id, groupName: group.name, actorId: auth.id, type: 'CARD', tab: 'cards', excerpt: body.title });
    return ok({ set }, 201);
  } catch (err) {
    return handleError(err);
  }
}
