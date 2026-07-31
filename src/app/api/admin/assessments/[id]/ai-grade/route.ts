export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/auth';
import { ok, fail, handleError } from '@/lib/http';
import { aiProvider } from '@/lib/ai/provider';

const CONFIDENCE_THRESHOLD = 0.7;

// Grade all ungraded subjective (SHORT/LONG) answers for an assessment using
// the open-source model. Low-confidence answers keep the attempt in
// NEEDS_REVIEW so a teacher checks them.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await guard(req, { role: 'SUPER_ADMIN' });
    const provider = aiProvider();
    if (!provider.enabled) return fail('AI is not configured.', 400, 'AI_DISABLED');

    // Per-assessment marks for each question.
    const items = await prisma.assessmentQuestion.findMany({
      where: { assessmentId: params.id },
      include: { question: { select: { id: true, type: true, prompt: true, modelAnswer: true, rubric: true } } },
    });
    const marksById = new Map(items.map((i) => [i.questionId, i.marks]));

    const pending = await prisma.attemptAnswer.findMany({
      where: {
        attempt: { assessmentId: params.id },
        gradedBy: null,
        question: { type: { in: ['SHORT', 'LONG'] } },
      },
      include: { question: { select: { id: true, type: true, prompt: true, modelAnswer: true, rubric: true } } },
    });

    let graded = 0;
    const affected = new Set<string>();
    for (const ans of pending) {
      const maxMarks = marksById.get(ans.questionId) ?? 1;
      try {
        const r = await provider.gradeAnswer({
          prompt: ans.question.prompt,
          modelAnswer: ans.question.modelAnswer,
          rubric: ans.question.rubric,
          studentAnswer: ans.textAnswer ?? '',
          maxMarks,
        });
        await prisma.attemptAnswer.update({
          where: { id: ans.id },
          data: {
            awardedMarks: r.marks,
            feedback: r.feedback,
            confidence: r.confidence,
            gradedBy: 'AI',
            isCorrect: r.marks >= maxMarks / 2,
          },
        });
        graded++;
        affected.add(ans.attemptId);
      } catch (e) {
        console.error('AI grade failed for answer', ans.id, e);
      }
    }

    // Recompute affected attempts. Low-confidence AI answers keep NEEDS_REVIEW.
    for (const attemptId of affected) {
      const answers = await prisma.attemptAnswer.findMany({ where: { attemptId } });
      const score = answers.reduce((n, a) => n + a.awardedMarks, 0);
      const unresolved = answers.some(
        (a) => a.gradedBy === null || (a.gradedBy === 'AI' && (a.confidence ?? 0) < CONFIDENCE_THRESHOLD),
      );
      await prisma.attempt.update({
        where: { id: attemptId },
        data: { score, status: unresolved ? 'NEEDS_REVIEW' : 'GRADED', gradedAt: unresolved ? null : new Date() },
      });
    }

    return ok({ graded, attempts: affected.size });
  } catch (err) {
    return handleError(err);
  }
}
