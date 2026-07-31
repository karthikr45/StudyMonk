export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/auth';
import { ok, fail, handleError } from '@/lib/http';
import { questionSchema } from '@/lib/validation';

// List questions in the bank for a subject (optionally a chapter).
export async function GET(req: NextRequest) {
  try {
    await guard(req, { role: 'SUPER_ADMIN' });
    const subjectId = req.nextUrl.searchParams.get('subjectId') ?? undefined;
    const chapterId = req.nextUrl.searchParams.get('chapterId') ?? undefined;
    if (!subjectId) return fail('subjectId is required', 400, 'SUBJECT_ID_REQUIRED');

    const questions = await prisma.question.findMany({
      where: { subjectId, ...(chapterId ? { chapterId } : {}) },
      orderBy: { createdAt: 'desc' },
      include: { options: { orderBy: { order: 'asc' } }, chapter: { select: { id: true, name: true } } },
    });
    return ok({ questions });
  } catch (err) {
    return handleError(err);
  }
}

// Create a question (with options for objective types).
export async function POST(req: NextRequest) {
  try {
    const admin = await guard(req, { role: 'SUPER_ADMIN' });
    const body = questionSchema.parse(await req.json());

    const subject = await prisma.subject.findUnique({ where: { id: body.subjectId } });
    if (!subject) return fail('Subject not found', 422, 'SUBJECT_NOT_FOUND');
    if (body.chapterId) {
      const chapter = await prisma.chapter.findFirst({
        where: { id: body.chapterId, subjectId: body.subjectId },
      });
      if (!chapter) return fail('Chapter is not in this subject', 422, 'CHAPTER_INVALID');
    }

    const question = await prisma.question.create({
      data: {
        subjectId: body.subjectId,
        chapterId: body.chapterId ?? null,
        type: body.type,
        difficulty: body.difficulty ?? 'MEDIUM',
        marks: body.marks,
        prompt: body.prompt,
        explanation: body.explanation,
        modelAnswer: body.modelAnswer,
        rubric: body.rubric,
        numericAnswer: body.numericAnswer,
        numericTolerance: body.numericTolerance ?? 0,
        source: 'MANUAL',
        status: body.status ?? 'PUBLISHED',
        createdById: admin.id,
        options: body.options
          ? { create: body.options.map((o, i) => ({ text: o.text, isCorrect: o.isCorrect, order: o.order ?? i })) }
          : undefined,
      },
      include: { options: { orderBy: { order: 'asc' } } },
    });
    return ok({ question }, 201);
  } catch (err) {
    return handleError(err);
  }
}
