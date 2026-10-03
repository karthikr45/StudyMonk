export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/auth';
import { ok, handleError, HttpError } from '@/lib/http';
import { z } from 'zod';
export async function POST(req: NextRequest) {
  try {
    const admin = await guard(req, { role: 'SUPER_ADMIN' });
    const { assessmentId, batchId } = z
      .object({ assessmentId: z.string().min(1), batchId: z.string().min(1) })
      .parse(await req.json());
    const assessment = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Batch" WHERE id=${batchId} FOR UPDATE`;
      const b = await tx.batch.findFirst({
        where: { id: batchId, archivedAt: null },
      });
      if (!b) throw new HttpError('Choose an open batch', 422);
      await tx.$queryRaw`SELECT id FROM "Assessment" WHERE id=${assessmentId} FOR UPDATE`;
      const source = await tx.assessment.findUniqueOrThrow({
        where: { id: assessmentId },
        include: { subject: true, questions: { orderBy: { order: 'asc' } } },
      });
      if (source.subject.classId !== b.classId)
        throw new HttpError(
          'Assessment subject must belong to the destination class',
          422,
        );
      if (!source.questions.length)
        throw new HttpError('Assessment has no questions', 422);
      const a = await tx.assessment.create({
        data: {
          batchId,
          title: source.title,
          type: source.type,
          subjectId: source.subjectId,
          chapterId: source.chapterId,
          description: source.description,
          timeLimitSec: source.timeLimitSec,
          totalMarks: source.totalMarks,
          createdById: admin.id,
          status: 'DRAFT',
          questions: {
            create: source.questions.map((q) => ({
              questionId: q.questionId,
              marks: q.marks,
              order: q.order,
            })),
          },
        },
      });
      await tx.enrollmentAudit.create({
        data: {
          actorId: admin.id,
          action: 'COPY_ASSESSMENT_TO_BATCH',
          details: { sourceId: source.id, assessmentId: a.id, batchId },
        },
      });
      return a;
    });
    return ok({ assessment }, 201);
  } catch (e) {
    return handleError(e);
  }
}
