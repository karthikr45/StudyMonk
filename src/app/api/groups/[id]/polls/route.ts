export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, fail, handleError } from '@/lib/http';
import { requireGroupMember } from '@/lib/groups';
import { groupPollSchema } from '@/lib/validation';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { auth } = await requireGroupMember(req, params.id);
    const polls = await prisma.groupPoll.findMany({
      where: { groupId: params.id },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, fullName: true } },
        options: { orderBy: { order: 'asc' }, include: { _count: { select: { votes: true } } } },
        votes: { select: { userId: true, optionId: true } },
      },
    });

    const shaped = polls.map((p) => {
      const myVote = p.votes.find((v) => v.userId === auth.id)?.optionId ?? null;
      const voted = myVote !== null;
      const total = p.votes.length;
      return {
        id: p.id,
        type: p.type,
        question: p.question,
        createdBy: p.createdBy,
        totalVotes: total,
        myVote,
        options: p.options.map((o) => ({
          id: o.id,
          text: o.text,
          votes: o._count.votes,
          // reveal correct answer only after this member has voted
          isCorrect: p.type === 'QUIZ' && voted ? o.isCorrect : undefined,
        })),
      };
    });
    return ok({ polls: shaped });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { auth } = await requireGroupMember(req, params.id);
    const body = groupPollSchema.parse(await req.json());
    if (body.type === 'QUIZ' && !body.options.some((o) => o.isCorrect)) {
      return fail('Mark the correct option for a quiz', 422, 'NO_CORRECT');
    }
    const poll = await prisma.groupPoll.create({
      data: {
        groupId: params.id, createdById: auth.id, type: body.type, question: body.question,
        options: { create: body.options.map((o, i) => ({ text: o.text, isCorrect: body.type === 'QUIZ' ? !!o.isCorrect : false, order: i })) },
      },
      include: { options: true },
    });
    return ok({ poll }, 201);
  } catch (err) {
    return handleError(err);
  }
}
