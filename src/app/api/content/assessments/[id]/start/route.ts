export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/auth';
import { ok, fail, handleError } from '@/lib/http';
import { studentProfile } from '@/lib/student';
import { studentAssessment, shapeQuestionForStudent } from '@/lib/assessment';

// Start (or resume) an attempt. Returns questions with NO answer data.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await guard(req, { role: 'STUDENT' });
    const p = await studentProfile(auth.id);
    const a = await studentAssessment(params.id, p);

    const existing = await prisma.attempt.findUnique({
      where: { assessmentId_studentId: { assessmentId: a.id, studentId: auth.id } },
      include: { answers: true },
    });
    if (existing && existing.status !== 'IN_PROGRESS') {
      return fail('You have already submitted this assessment', 409, 'ALREADY_SUBMITTED');
    }

    const attempt =
      existing ??
      (await prisma.attempt.create({
        data: { assessmentId: a.id, studentId: auth.id, maxScore: a.totalMarks },
        include: { answers: true },
      }));

    const savedAnswers = Object.fromEntries(
      attempt.answers.map((ans) => [
        ans.questionId,
        { selectedOptionIds: ans.selectedOptionIds, textAnswer: ans.textAnswer, numericAnswer: ans.numericAnswer },
      ]),
    );

    return ok({
      attemptId: attempt.id,
      assessment: {
        id: a.id,
        type: a.type,
        title: a.title,
        description: a.description,
        timeLimitSec: a.timeLimitSec,
        totalMarks: a.totalMarks,
        startedAt: attempt.startedAt,
      },
      questions: a.questions.map(shapeQuestionForStudent),
      savedAnswers,
    });
  } catch (err) {
    return handleError(err);
  }
}
