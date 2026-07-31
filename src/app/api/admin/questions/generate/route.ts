export const dynamic = 'force-dynamic';
export const maxDuration = 300; // allow long local-model generations

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/auth';
import { ok, fail, handleError } from '@/lib/http';
import { generateSchema } from '@/lib/validation';
import { aiProvider, GenType } from '@/lib/ai/provider';
import { chapterSourceText } from '@/lib/ai/chapterText';

// Generate DRAFT questions with the configured open-source model. They are
// stored as DRAFT (source AI) and must be approved before students see them.
export async function POST(req: NextRequest) {
  try {
    const admin = await guard(req, { role: 'SUPER_ADMIN' });
    const provider = aiProvider();
    if (!provider.enabled) return fail('AI is not configured. Set AI_PROVIDER in your environment.', 400, 'AI_DISABLED');

    const body = generateSchema.parse(await req.json());

    const subject = await prisma.subject.findUnique({
      where: { id: body.subjectId },
      include: { class: { include: { board: true } } },
    });
    if (!subject) return fail('Subject not found', 422, 'SUBJECT_NOT_FOUND');

    let chapterName = 'General';
    let sourceText = '';
    if (body.chapterId) {
      const chapter = await prisma.chapter.findFirst({
        where: { id: body.chapterId, subjectId: body.subjectId },
      });
      if (!chapter) return fail('Chapter is not in this subject', 422, 'CHAPTER_INVALID');
      chapterName = chapter.name;
      sourceText = await chapterSourceText(chapter.id);
    }

    let generated;
    try {
      generated = await provider.generateQuestions({
        board: subject.class.board.name,
        klass: subject.class.name,
        subject: subject.name,
        chapter: chapterName,
        sourceText: sourceText || undefined,
        counts: body.counts as Partial<Record<GenType, number>>,
        difficulty: body.difficulty,
      });
    } catch (e) {
      console.error('AI generation failed', e);
      return fail(`Generation failed: ${(e as Error).message}`, 502, 'AI_ERROR');
    }

    // Persist as DRAFT questions.
    const created = [];
    for (const g of generated) {
      const isObjective = g.type === 'MCQ' || g.type === 'TRUE_FALSE';
      const q = await prisma.question.create({
        data: {
          subjectId: body.subjectId,
          chapterId: body.chapterId ?? null,
          type: g.type,
          difficulty: g.difficulty ?? body.difficulty,
          marks: g.marks || 1,
          prompt: g.prompt,
          explanation: g.explanation,
          modelAnswer: g.modelAnswer,
          numericAnswer: g.numericAnswer,
          source: 'AI',
          status: 'DRAFT',
          createdById: admin.id,
          options: isObjective && g.options
            ? { create: g.options.map((o, i) => ({ text: o.text, isCorrect: o.isCorrect, order: i })) }
            : undefined,
        },
        include: { options: { orderBy: { order: 'asc' } } },
      });
      created.push(q);
    }

    return ok({ created: created.length, questions: created }, 201);
  } catch (err) {
    return handleError(err);
  }
}
