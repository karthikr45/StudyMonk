export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/auth';
import { ok, fail, handleError } from '@/lib/http';
import { gradeAnswerSchema } from '@/lib/validation';

// Teacher override for subjective answers. Recomputes the attempt total and,
// if nothing is left unreviewed, marks the attempt GRADED.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await guard(req, { role: 'SUPER_ADMIN' });
    const body = gradeAnswerSchema.parse(await req.json());

    const attempt = await prisma.attempt.findUnique({
      where: { id: params.id },
      include: { answers: { include: { question: { select: { marks: true } } } } },
    });
    if (!attempt) return fail('Attempt not found', 404, 'NOT_FOUND');

    await prisma.$transaction(
      body.answers.map((a) =>
        prisma.attemptAnswer.update({
          where: { id: a.answerId },
          data: {
            awardedMarks: a.awardedMarks,
            feedback: a.feedback,
            gradedBy: 'TEACHER',
            isCorrect: a.awardedMarks > 0,
          },
        }),
      ),
    );

    // Recompute totals from fresh data.
    const answers = await prisma.attemptAnswer.findMany({ where: { attemptId: attempt.id } });
    const score = answers.reduce((n, a) => n + a.awardedMarks, 0);
    const anyUngraded = answers.some((a) => a.gradedBy === null);

    const updated = await prisma.attempt.update({
      where: { id: attempt.id },
      data: {
        score,
        status: anyUngraded ? 'NEEDS_REVIEW' : 'GRADED',
        gradedAt: anyUngraded ? null : new Date(),
      },
    });

    if (body.publishResults) {
      await prisma.assessment.update({
        where: { id: attempt.assessmentId },
        data: { resultsPublished: true },
      });
    }

    return ok({ attempt: updated });
  } catch (err) {
    return handleError(err);
  }
}
