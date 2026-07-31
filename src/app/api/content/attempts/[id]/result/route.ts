export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/auth';
import { ok, fail, handleError } from '@/lib/http';
import { ownAttempt } from '@/lib/assessment';

// Result for the student's own attempt. Correct answers and explanations are
// revealed only once the attempt is fully graded or the admin has published
// results.
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await guard(req, { role: 'STUDENT' });
    const attempt = await ownAttempt(params.id, auth.id);
    if (attempt.status === 'IN_PROGRESS') {
      return fail('This attempt has not been submitted yet', 409, 'NOT_SUBMITTED');
    }

    const assessment = await prisma.assessment.findUnique({
      where: { id: attempt.assessmentId },
      select: { id: true, title: true, type: true, totalMarks: true, resultsPublished: true },
    });
    const released = attempt.status === 'GRADED' || !!assessment?.resultsPublished;

    const items = await prisma.assessmentQuestion.findMany({
      where: { assessmentId: attempt.assessmentId },
      orderBy: { order: 'asc' },
      include: { question: { include: { options: { orderBy: { order: 'asc' } } } } },
    });
    const answers = new Map(
      (await prisma.attemptAnswer.findMany({ where: { attemptId: attempt.id } })).map((a) => [a.questionId, a]),
    );

    const questions = items.map((it) => {
      const q = it.question;
      const ans = answers.get(q.id);
      return {
        id: q.id,
        type: q.type,
        prompt: q.prompt,
        marks: it.marks,
        yourOptionIds: ans?.selectedOptionIds ?? [],
        yourText: ans?.textAnswer ?? null,
        yourNumeric: ans?.numericAnswer ?? null,
        awardedMarks: released ? ans?.awardedMarks ?? 0 : null,
        isCorrect: released ? ans?.isCorrect ?? null : null,
        feedback: released ? ans?.feedback ?? null : null,
        options: q.options.map((o) => ({ id: o.id, text: o.text, isCorrect: released ? o.isCorrect : undefined })),
        explanation: released ? q.explanation : null,
        modelAnswer: released ? q.modelAnswer : null,
      };
    });

    return ok({
      assessment,
      attempt: {
        status: attempt.status,
        score: released ? attempt.score : null,
        maxScore: attempt.maxScore,
        submittedAt: attempt.submittedAt,
      },
      released,
      questions,
    });
  } catch (err) {
    return handleError(err);
  }
}
