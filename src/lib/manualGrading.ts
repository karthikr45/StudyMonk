import { prisma } from './prisma';
import { HttpError } from './http';
import { gradeAnswerSchema } from './validation';
import type { z } from 'zod';

export async function gradeAttempt(
  id: string,
  body: z.infer<typeof gradeAnswerSchema>,
) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Attempt" WHERE id = ${id} FOR UPDATE`;
    const attempt = await tx.attempt.findUnique({
      where: { id },
      include: { answers: true, assessment: { include: { questions: true } } },
    });
    if (!attempt) throw new HttpError('Attempt not found', 404, 'NOT_FOUND');
    if (attempt.status === 'IN_PROGRESS')
      throw new HttpError(
        'Submit the attempt before grading',
        409,
        'NOT_SUBMITTED',
      );
    const answers = new Map(attempt.answers.map((a) => [a.id, a]));
    const marks = new Map(
      attempt.assessment.questions.map((q) => [q.questionId, q.marks]),
    );
    const seen = new Set<string>();
    for (const item of body.answers) {
      const answer = answers.get(item.answerId);
      if (!answer || seen.has(item.answerId))
        throw new HttpError(
          'Invalid or duplicate answer for this attempt',
          422,
          'INVALID_ANSWER',
        );
      seen.add(item.answerId);
      if (item.awardedMarks > (marks.get(answer.questionId) ?? 0))
        throw new HttpError(
          'Awarded marks exceed the question maximum',
          422,
          'INVALID_MARKS',
        );
    }
    for (const item of body.answers)
      await tx.attemptAnswer.update({
        where: { id: item.answerId },
        data: {
          awardedMarks: item.awardedMarks,
          feedback: item.feedback,
          gradedBy: 'TEACHER',
          isCorrect: item.awardedMarks > 0,
        },
      });
    const fresh = await tx.attemptAnswer.findMany({ where: { attemptId: id } });
    const unresolved = fresh.some(
      (a) =>
        a.gradedBy === null ||
        (a.gradedBy === 'AI' && (a.confidence ?? 0) < 0.7),
    );
    const updated = await tx.attempt.update({
      where: { id },
      data: {
        score: fresh.reduce((n, a) => n + a.awardedMarks, 0),
        status: unresolved ? 'NEEDS_REVIEW' : 'GRADED',
        gradedAt: unresolved ? null : new Date(),
      },
    });
    if (body.publishResults)
      await tx.assessment.update({
        where: { id: attempt.assessmentId },
        data: { resultsPublished: true },
      });
    return updated;
  });
}
