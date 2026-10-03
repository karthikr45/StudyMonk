export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/auth';
import { ok, handleError, HttpError } from '@/lib/http';
import { z } from 'zod';
export async function POST(req: NextRequest) {
  try {
    const admin = await guard(req, { role: 'SUPER_ADMIN' });
    const input = z
      .object({
        assessmentId: z.string().min(1),
        batchId: z.string().min(1),
        reason: z.string().trim().min(10).max(1000),
      })
      .parse(await req.json());
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Assessment" WHERE id=${input.assessmentId} FOR UPDATE`;
      const a = await tx.assessment.findUniqueOrThrow({
        where: { id: input.assessmentId },
        include: { subject: true, attempts: true },
      });
      const batch = await tx.batch.findUniqueOrThrow({
        where: { id: input.batchId },
      });
      if (!a.legacyUnscoped || a.batchId)
        throw new HttpError('This assessment has already been reconciled', 409);
      if (a.subject.classId !== batch.classId)
        throw new HttpError('Class does not match', 422);
      if (a.attempts.some((at) => at.status === 'IN_PROGRESS'))
        throw new HttpError(
          'Finalize legacy open attempts before reconciliation',
          409,
        );
      // Admin must confirm evidence; every participant must have exactly one approved enrollment in this batch.
      for (const attempt of a.attempts) {
        const es = await tx.enrollment.findMany({
          where: {
            studentId: attempt.studentId,
            batchId: batch.id,
            status: { notIn: ['PENDING', 'REJECTED'] },
          },
        });
        if (es.length !== 1)
          throw new HttpError(
            'Every participant needs exactly one verified enrollment in this batch. Mixed-batch records must remain quarantined.',
            422,
          );
        await tx.attempt.update({
          where: { id: attempt.id },
          data: { enrollmentId: es[0].id },
        });
      }
      await tx.assessment.update({
        where: { id: a.id },
        data: { batchId: batch.id, legacyUnscoped: false, status: 'ARCHIVED' },
      });
      await tx.enrollmentAudit.create({
        data: {
          actorId: admin.id,
          action: 'RECONCILE_ASSESSMENT',
          details: { ...input },
        },
      });
    });
    return ok({ reconciled: true });
  } catch (e) {
    return handleError(e);
  }
}
