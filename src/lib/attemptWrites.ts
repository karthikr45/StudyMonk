import { prisma } from './prisma';
import { HttpError } from './http';
import { hasExpired } from './assessmentTiming';
import { gradeAnswer } from './grading';
import { sanitizeAnswer } from './sanitize';
import { submitAnswersSchema } from './validation';
import type { z } from 'zod';

/** Serialize saves and submission on the same attempt, including across tabs. */
export async function writeAttempt(
  id: string,
  userId: string,
  body: z.infer<typeof submitAnswersSchema>,
  submit: boolean,
  adminFinalize = false,
) {
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Attempt" WHERE id = ${id} AND "studentId" = ${userId} FOR UPDATE`;
      const attempt = await tx.attempt.findUnique({ where: { id } });
      if (!attempt || attempt.studentId !== userId)
        throw new HttpError('Attempt not found', 404, 'NOT_FOUND');
      if (attempt.status !== 'IN_PROGRESS') {
        if (submit)
          return {
            submitted: true,
            revision: attempt.answerRevision,
            deadlinePassed: false,
          };
        throw new HttpError(
          'Already submitted. Open your result.',
          409,
          'NOT_IN_PROGRESS',
        );
      }
      if (
        !adminFinalize &&
        !(
          attempt.enrollmentId &&
          (await tx.enrollment.findFirst({
            where: {
              id: attempt.enrollmentId,
              studentId: userId,
              status: 'ACTIVE',
              batch: { archivedAt: null },
            },
          }))
        )
      )
        throw new HttpError(
          'This enrollment is no longer active',
          403,
          'ENROLLMENT_CLOSED',
        );
      const expired = adminFinalize || hasExpired(attempt.deadlineAt);
      if (expired && !submit)
        throw new HttpError(
          'Time is up. Submit your saved answers.',
          409,
          'DEADLINE_PASSED',
        );
      // After expiry, finalization uses only server-saved answers, never late edits.
      if (!expired && attempt.answerRevision !== body.revision) {
        throw new HttpError(
          'This attempt changed in another tab, or a save was not acknowledged. Reload to review the saved version before continuing.',
          409,
          'REVISION_CONFLICT',
        );
      }
      const items = await tx.assessmentQuestion.findMany({
        where: { assessmentId: attempt.assessmentId },
        include: { question: { include: { options: true } } },
      });
      const valid = new Set(items.map((item) => item.questionId));
      if (!expired) {
        for (const answer of body.answers) {
          if (!valid.has(answer.questionId)) continue;
          const values = {
            selectedOptionIds: answer.selectedOptionIds ?? [],
            textAnswer: sanitizeAnswer(answer.textAnswer),
            numericAnswer: answer.numericAnswer ?? null,
          };
          await tx.attemptAnswer.upsert({
            where: {
              attemptId_questionId: {
                attemptId: id,
                questionId: answer.questionId,
              },
            },
            update: values,
            create: { attemptId: id, questionId: answer.questionId, ...values },
          });
        }
      }
      let score = 0;
      let needsReview = false;
      if (submit) {
        const saved = new Map(
          (await tx.attemptAnswer.findMany({ where: { attemptId: id } })).map(
            (a) => [a.questionId, a],
          ),
        );
        for (const item of items) {
          const answer = saved.get(item.questionId);
          const grade = gradeAnswer(
            { ...item.question, marks: item.marks },
            answer ?? {},
          );
          needsReview ||= !grade.autoGradable;
          score += grade.awardedMarks;
          const values = {
            awardedMarks: grade.awardedMarks,
            isCorrect: grade.isCorrect,
            gradedBy: grade.gradedBy,
          };
          await tx.attemptAnswer.upsert({
            where: {
              attemptId_questionId: {
                attemptId: id,
                questionId: item.questionId,
              },
            },
            update: values,
            create: {
              attemptId: id,
              questionId: item.questionId,
              selectedOptionIds: [],
              ...values,
            },
          });
        }
      }
      const updated = await tx.attempt.update({
        where: { id },
        data: {
          answerRevision: { increment: 1 },
          ...(submit
            ? {
                score,
                status: needsReview ? 'NEEDS_REVIEW' : 'GRADED',
                submittedAt: new Date(),
                gradedAt: needsReview ? null : new Date(),
              }
            : {}),
        },
      });
      return {
        saved: true,
        submitted: submit,
        revision: updated.answerRevision,
        deadlinePassed: expired,
        needsReview,
      };
    },
    { timeout: 20000 },
  );
}
