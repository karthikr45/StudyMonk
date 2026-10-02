export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, fail, handleError } from '@/lib/http';
import { requireGroupMember } from '@/lib/groups';
import { votePollSchema } from '@/lib/validation';

// Cast (or change) your vote on a group poll/quiz. One vote per member.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; pid: string } },
) {
  try {
    const { auth } = await requireGroupMember(req, params.id);
    const { optionId } = votePollSchema.parse(await req.json());

    const option = await prisma.groupPollOption.findFirst({
      where: { id: optionId, pollId: params.pid, poll: { groupId: params.id } },
      select: { id: true, poll: { select: { type: true } } },
    });
    if (!option) return fail('Invalid option', 422, 'OPTION_INVALID');

    if (option.poll.type === 'QUIZ') {
      const created = await prisma.groupPollVote.createMany({
        data: [{ pollId: params.pid, optionId, userId: auth.id }],
        skipDuplicates: true,
      });
      if (!created.count)
        return fail(
          'Your quiz answer has already been submitted.',
          409,
          'ALREADY_VOTED',
        );
      return ok({ voted: true });
    }
    await prisma.groupPollVote.upsert({
      where: { pollId_userId: { pollId: params.pid, userId: auth.id } },
      update: { optionId },
      create: { pollId: params.pid, optionId, userId: auth.id },
    });
    return ok({ voted: true });
  } catch (err) {
    return handleError(err);
  }
}
