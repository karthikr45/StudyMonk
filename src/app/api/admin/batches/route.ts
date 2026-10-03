export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/auth';
import { ok, handleError, HttpError } from '@/lib/http';
import { batchInput, ensureBatch } from '@/lib/enrollments';
import { z } from 'zod';
export async function GET(req: NextRequest) {
  try {
    await guard(req, { role: 'SUPER_ADMIN' });
    return ok({
      batches: await prisma.batch.findMany({
        orderBy: [{ academicYear: 'desc' }, { label: 'asc' }],
        include: {
          _count: {
            select: { enrollments: true, groups: true, assessments: true },
          },
        },
      }),
    });
  } catch (e) {
    return handleError(e);
  }
}
export async function POST(req: NextRequest) {
  try {
    const admin = await guard(req, { role: 'SUPER_ADMIN' });
    const input = batchInput.parse(await req.json());
    const batch = await prisma.$transaction(async (tx) => {
      const b = await ensureBatch(tx, input);
      await tx.enrollmentAudit.create({
        data: {
          actorId: admin.id,
          action: 'CREATE_BATCH',
          details: { batchId: b.id },
        },
      });
      return b;
    });
    return ok({ batch }, 201);
  } catch (e) {
    return handleError(e);
  }
}
export async function PATCH(req: NextRequest) {
  try {
    const admin = await guard(req, { role: 'SUPER_ADMIN' });
    const { id } = z.object({ id: z.string().min(1) }).parse(await req.json());
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Batch" WHERE id=${id} FOR UPDATE`;
      if (
        await tx.enrollment.count({
          where: { batchId: id, status: { in: ['ACTIVE', 'PENDING'] } },
        })
      )
        throw new HttpError(
          'Process active and pending enrollments before archiving this batch',
          409,
        );
      await tx.batch.update({
        where: { id },
        data: { archivedAt: new Date() },
      });
      await tx.enrollmentAudit.create({
        data: {
          actorId: admin.id,
          action: 'ARCHIVE_BATCH',
          details: { batchId: id },
        },
      });
    });
    return ok({ archived: true });
  } catch (e) {
    return handleError(e);
  }
}
