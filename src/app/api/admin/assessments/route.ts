export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/auth';
import { ok, fail, handleError } from '@/lib/http';
import { assessmentSchema } from '@/lib/validation';

export async function GET(req: NextRequest) {
  try {
    await guard(req, { role: 'SUPER_ADMIN' });
    const subjectId = req.nextUrl.searchParams.get('subjectId') ?? undefined;
    if (!subjectId) return fail('subjectId is required', 400, 'SUBJECT_ID_REQUIRED');
    const assessments = await prisma.assessment.findMany({
      where: { subjectId },
      orderBy: { createdAt: 'desc' },
      include: {
        chapter: { select: { id: true, name: true } },
        _count: { select: { questions: true, attempts: true } },
      },
    });
    return ok({ assessments });
  } catch (err) {
    return handleError(err);
  }
}

// Create an assessment from questions already in the bank.
export async function POST(req: NextRequest) {
  try {
    const admin = await guard(req, { role: 'SUPER_ADMIN' });
    const body = assessmentSchema.parse(await req.json());

    const subject = await prisma.subject.findUnique({ where: { id: body.subjectId } });
    if (!subject) return fail('Subject not found', 422, 'SUBJECT_NOT_FOUND');

    // Only questions from this subject that are published can be attached.
    const questions = await prisma.question.findMany({
      where: { id: { in: body.questionIds }, subjectId: body.subjectId, status: 'PUBLISHED' },
      select: { id: true, marks: true },
    });
    if (questions.length === 0) return fail('No valid published questions selected', 422, 'NO_QUESTIONS');

    const byId = new Map(questions.map((q) => [q.id, q]));
    const ordered = body.questionIds.filter((id) => byId.has(id));
    const totalMarks = ordered.reduce((n, id) => n + (byId.get(id)!.marks ?? 1), 0);

    const assessment = await prisma.assessment.create({
      data: {
        type: body.type,
        subjectId: body.subjectId,
        chapterId: body.chapterId ?? null,
        title: body.title,
        description: body.description,
        timeLimitSec: body.timeLimitSec ?? null,
        totalMarks,
        status: 'DRAFT',
        createdById: admin.id,
        questions: {
          create: ordered.map((id, i) => ({ questionId: id, order: i, marks: byId.get(id)!.marks ?? 1 })),
        },
      },
      include: { _count: { select: { questions: true } } },
    });
    return ok({ assessment }, 201);
  } catch (err) {
    return handleError(err);
  }
}
