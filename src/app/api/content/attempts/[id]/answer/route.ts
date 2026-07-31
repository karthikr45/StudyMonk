export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/auth';
import { ok, fail, handleError } from '@/lib/http';
import { ownAttempt } from '@/lib/assessment';
import { submitAnswersSchema } from '@/lib/validation';
import { sanitizeAnswer } from '@/lib/sanitize';

// Autosave answers while the attempt is in progress. No grading here.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await guard(req, { role: 'STUDENT' });
    const attempt = await ownAttempt(params.id, auth.id);
    if (attempt.status !== 'IN_PROGRESS') {
      return fail('This attempt is already submitted', 409, 'NOT_IN_PROGRESS');
    }
    const body = submitAnswersSchema.parse(await req.json());

    // Only accept answers for questions that belong to this assessment.
    const valid = new Set(
      (
        await prisma.assessmentQuestion.findMany({
          where: { assessmentId: attempt.assessmentId },
          select: { questionId: true },
        })
      ).map((q) => q.questionId),
    );

    await prisma.$transaction(
      body.answers
        .filter((a) => valid.has(a.questionId))
        .map((a) =>
          prisma.attemptAnswer.upsert({
            where: { attemptId_questionId: { attemptId: attempt.id, questionId: a.questionId } },
            update: {
              selectedOptionIds: a.selectedOptionIds ?? [],
              textAnswer: sanitizeAnswer(a.textAnswer),
              numericAnswer: a.numericAnswer ?? null,
            },
            create: {
              attemptId: attempt.id,
              questionId: a.questionId,
              selectedOptionIds: a.selectedOptionIds ?? [],
              textAnswer: sanitizeAnswer(a.textAnswer),
              numericAnswer: a.numericAnswer ?? null,
            },
          }),
        ),
    );
    return ok({ saved: true });
  } catch (err) {
    return handleError(err);
  }
}
