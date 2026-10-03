export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/auth';
import { ok, fail, handleError } from '@/lib/http';
import { assessmentEditSchema } from '@/lib/validation';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await guard(req, { role: 'SUPER_ADMIN' });
    const assessment = await prisma.assessment.findUnique({
      where: { id: params.id },
      include: {
        chapter: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
        questions: {
          orderBy: { order: 'asc' },
          include: {
            question: { include: { options: { orderBy: { order: 'asc' } } } },
          },
        },
      },
    });
    return ok({ assessment });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await guard(req, { role: 'SUPER_ADMIN' });
    return await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Assessment" WHERE id=${params.id} FOR UPDATE`;
      const { questionIds, ...body } = assessmentEditSchema.parse(
        await req.json(),
      );
      const changesContent =
        questionIds !== undefined ||
        Object.keys(body).some(
          (key) => key !== 'status' && key !== 'resultsPublished',
        );
      if (
        changesContent &&
        (await tx.attempt.count({ where: { assessmentId: params.id } }))
      )
        return fail(
          'This assessment has student attempts and its content is locked. Duplicate it for changes.',
          409,
          'HAS_ATTEMPTS',
        );

      const scope = await tx.assessment.findUnique({
        where: { id: params.id },
        include: { batch: true },
      });
      if (
        body.status === 'PUBLISHED' &&
        (!scope?.batchId || scope.legacyUnscoped || scope.batch?.archivedAt)
      )
        return fail(
          'Create a fresh copy for an open batch under Batches & enrollments before publishing.',
          422,
          'BATCH_REQUIRED',
        );
      // Changing the question set (or its marks) would invalidate answers already
      // recorded, so it's only allowed before anyone has attempted the assessment.
      if (questionIds) {
        const existing = await tx.assessment.findUnique({
          where: { id: params.id },
          select: { subjectId: true, _count: { select: { attempts: true } } },
        });
        if (!existing) return fail('Assessment not found', 404, 'NOT_FOUND');
        if (existing._count.attempts > 0)
          return fail(
            'Students have already attempted this assessment. Duplicate it to change its content.',
            409,
            'HAS_ATTEMPTS',
          );

        const questions = await tx.question.findMany({
          where: {
            id: { in: questionIds },
            subjectId: existing.subjectId,
            status: 'PUBLISHED',
          },
          select: { id: true, marks: true },
        });
        if (questions.length === 0)
          return fail(
            'No valid published questions selected',
            422,
            'NO_QUESTIONS',
          );
        const byId = new Map(questions.map((q) => [q.id, q]));
        const ordered = questionIds.filter((id) => byId.has(id));
        const totalMarks = ordered.reduce(
          (n, id) => n + (byId.get(id)!.marks ?? 1),
          0,
        );

        const assessment = await (async () => {
          await tx.assessmentQuestion.deleteMany({
            where: { assessmentId: params.id },
          });
          return tx.assessment.update({
            where: { id: params.id },
            data: {
              ...body,
              totalMarks,
              questions: {
                create: ordered.map((id, i) => ({
                  questionId: id,
                  order: i,
                  marks: byId.get(id)!.marks ?? 1,
                })),
              },
            },
          });
        })();
        return ok({ assessment });
      }

      const assessment = await tx.assessment.update({
        where: { id: params.id },
        data: body,
      });
      return ok({ assessment });
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await guard(req, { role: 'SUPER_ADMIN' });
    await prisma.assessment.update({
      where: { id: params.id },
      data: { status: 'ARCHIVED' },
    });
    return ok({ deleted: true });
  } catch (err) {
    return handleError(err);
  }
}
