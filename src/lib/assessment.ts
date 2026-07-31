import { prisma } from './prisma';
import { HttpError } from './http';
import type { StudentProfile } from './student';

/** Load a published assessment the student is allowed to take (own class). */
export async function studentAssessment(assessmentId: string, p: StudentProfile) {
  const a = await prisma.assessment.findFirst({
    where: {
      id: assessmentId,
      status: 'PUBLISHED',
      subject: { classId: p.classId, isActive: true },
    },
    include: {
      subject: { select: { id: true, name: true } },
      chapter: { select: { id: true, name: true } },
      questions: {
        orderBy: { order: 'asc' },
        include: { question: { include: { options: { orderBy: { order: 'asc' } } } } },
      },
    },
  });
  if (!a) throw new HttpError('Assessment not available for your class', 403, 'FORBIDDEN');
  return a;
}

/** Strip everything that would reveal the answer before sending to a student. */
export function shapeQuestionForStudent(item: {
  marks: number;
  question: {
    id: string;
    type: string;
    prompt: string;
    options: { id: string; text: string; order: number }[];
  };
}) {
  const q = item.question;
  return {
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    marks: item.marks,
    options: q.type === 'MCQ' || q.type === 'TRUE_FALSE'
      ? q.options.map((o) => ({ id: o.id, text: o.text }))
      : [],
  };
}

/** Fetch the caller's own attempt or throw. */
export async function ownAttempt(attemptId: string, userId: string) {
  const attempt = await prisma.attempt.findUnique({ where: { id: attemptId } });
  if (!attempt || attempt.studentId !== userId) {
    throw new HttpError('Attempt not found', 404, 'NOT_FOUND');
  }
  return attempt;
}
