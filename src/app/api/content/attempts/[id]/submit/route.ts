export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/auth';
import { ok, fail, handleError } from '@/lib/http';
import { ownAttempt } from '@/lib/assessment';
import { submitAnswersSchema } from '@/lib/validation';
import { gradeAnswer } from '@/lib/grading';

// Save final answers, auto-grade objective questions, compute the score.
// Subjective questions are left for review (attempt = NEEDS_REVIEW).
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
    const body = submitAnswersSchema.parse(await req.json().catch(() => ({ answers: [] })));

    // Load the assessment's questions (with correct answers + per-assessment marks).
    const items = await prisma.assessmentQuestion.findMany({
      where: { assessmentId: attempt.assessmentId },
      include: { question: { include: { options: true } } },
    });
    const valid = new Set(items.map((i) => i.questionId));
    const incoming = new Map(
      body.answers.filter((a) => valid.has(a.questionId)).map((a) => [a.questionId, a]),
    );

    let score = 0;
    let needsReview = false;

    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        const a = incoming.get(item.questionId);
        // Merge incoming with any autosaved answer.
        const saved = await tx.attemptAnswer.findUnique({
          where: { attemptId_questionId: { attemptId: attempt.id, questionId: item.questionId } },
        });
        const selectedOptionIds = a?.selectedOptionIds ?? saved?.selectedOptionIds ?? [];
        const textAnswer = a?.textAnswer ?? saved?.textAnswer ?? null;
        const numericAnswer = a?.numericAnswer ?? saved?.numericAnswer ?? null;

        const grade = gradeAnswer(
          {
            id: item.questionId,
            type: item.question.type,
            marks: item.marks,
            numericAnswer: item.question.numericAnswer,
            numericTolerance: item.question.numericTolerance,
            options: item.question.options.map((o) => ({ id: o.id, isCorrect: o.isCorrect })),
          },
          { selectedOptionIds, textAnswer, numericAnswer },
        );
        if (!grade.autoGradable) needsReview = true;
        score += grade.awardedMarks;

        await tx.attemptAnswer.upsert({
          where: { attemptId_questionId: { attemptId: attempt.id, questionId: item.questionId } },
          update: {
            selectedOptionIds, textAnswer, numericAnswer,
            awardedMarks: grade.awardedMarks, isCorrect: grade.isCorrect, gradedBy: grade.gradedBy,
          },
          create: {
            attemptId: attempt.id, questionId: item.questionId,
            selectedOptionIds, textAnswer, numericAnswer,
            awardedMarks: grade.awardedMarks, isCorrect: grade.isCorrect, gradedBy: grade.gradedBy,
          },
        });
      }

      await tx.attempt.update({
        where: { id: attempt.id },
        data: {
          status: needsReview ? 'NEEDS_REVIEW' : 'GRADED',
          score,
          submittedAt: new Date(),
          gradedAt: needsReview ? null : new Date(),
        },
      });
    });

    return ok({
      submitted: true,
      autoGraded: !needsReview,
      score,
      maxScore: attempt.maxScore,
      needsReview,
    });
  } catch (err) {
    return handleError(err);
  }
}
