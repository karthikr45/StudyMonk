import { prisma } from './prisma';
import { HttpError } from './http';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { availableAcademicYears } from './academicYears';

export const batchInput = z.object({
  schoolId: z.string().min(1),
  boardId: z.string().min(1),
  classId: z.string().min(1),
  academicYear: z.string().regex(/^\d{4}-\d{4}$/),
  section: z.string().trim().max(30).default(''),
});
export async function ensureBatch(
  tx: Prisma.TransactionClient,
  input: z.infer<typeof batchInput>,
) {
  const year = Number(input.academicYear.slice(0, 4));
  const current = Number(availableAcademicYears()[0].slice(0, 4));
  if (
    input.academicYear !== `${year}-${year + 1}` ||
    year < 2000 ||
    year > current + 1
  )
    throw new HttpError(
      'Choose a consecutive academic year through next year',
      422,
    );
  const school = await tx.school.findFirst({
    where: { id: input.schoolId, isActive: true },
  });
  const klass = await tx.class.findFirst({
    where: {
      id: input.classId,
      boardId: input.boardId,
      isActive: true,
      board: { isActive: true },
    },
  });
  if (!school || !klass)
    throw new HttpError('Invalid school, board or class', 422);
  const key = { ...input, section: input.section.toUpperCase() };
  const batch = await tx.batch.upsert({
    where: { schoolId_boardId_classId_academicYear_section: key },
    update: {},
    create: {
      ...key,
      label: `${school.name} · ${klass.name} · ${input.academicYear}${key.section ? ` · ${key.section}` : ''}`,
    },
  });
  await tx.$queryRaw`SELECT id FROM "Batch" WHERE id=${batch.id} FOR UPDATE`;
  const latest = await tx.batch.findUniqueOrThrow({ where: { id: batch.id } });
  if (latest.archivedAt) throw new HttpError('This batch is archived', 409);
  return batch;
}
export const transitionInput = z.object({
  studentId: z.string().min(1),
  enrollmentId: z.string().optional(),
  action: z.enum([
    'APPROVE',
    'REJECT',
    'ENROLL',
    'PROMOTE',
    'REPEAT',
    'TRANSFER',
    'GRADUATE',
    'WITHDRAW',
  ]),
  targetBatchId: z.string().optional(),
  reason: z.string().trim().min(3).max(500),
});
export async function transitionEnrollment(
  actorId: string,
  input: z.infer<typeof transitionInput>,
) {
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${input.studentId} FOR UPDATE`;
      const user = await tx.user.findUnique({ where: { id: input.studentId } });
      if (!user || user.role !== 'STUDENT' || !user.isActive)
        throw new HttpError('Student not found', 404);
      const active = await tx.enrollment.findFirst({
        where: { studentId: user.id, status: 'ACTIVE' },
        include: { batch: true },
      });
      if (input.action === 'APPROVE' || input.action === 'REJECT') {
        const pending = await tx.enrollment.findFirst({
          where: {
            id: input.enrollmentId,
            studentId: user.id,
            status: 'PENDING',
          },
          include: { batch: true },
        });
        if (!pending || !input.enrollmentId)
          throw new HttpError(
            'Request was already processed or is missing',
            409,
          );
        await tx.$queryRaw`SELECT id FROM "Batch" WHERE id=${pending.batchId} FOR UPDATE`;
        const approvalBatch = await tx.batch.findUniqueOrThrow({
          where: { id: pending.batchId },
          include: { school: true },
        });
        if (
          input.action === 'APPROVE' &&
          (active || approvalBatch.archivedAt || !approvalBatch.school.isActive)
        )
          throw new HttpError(
            'Student already has an active enrollment or batch is archived',
            409,
          );
        const updated = await tx.enrollment.update({
          where: { id: pending.id },
          data: {
            status: input.action === 'APPROVE' ? 'ACTIVE' : 'REJECTED',
            approvedById: actorId,
            endedAt: input.action === 'REJECT' ? new Date() : null,
          },
        });
        if (input.action === 'APPROVE')
          await syncProfile(tx, user.id, pending.batchId);
        await audit(tx, actorId, input, { enrollmentId: updated.id });
        return updated;
      }
      if (
        input.action !== 'ENROLL' &&
        (!active || active.id !== input.enrollmentId)
      )
        throw new HttpError(
          'Active enrollment changed. Refresh before continuing.',
          409,
        );
      if (input.action === 'ENROLL' && active)
        throw new HttpError(
          'Use promotion or transfer for an enrolled student',
          409,
        );
      if (
        await tx.attempt.count({
          where: { studentId: user.id, status: 'IN_PROGRESS' },
        })
      )
        throw new HttpError(
          'Finalize open attempts before changing enrollment',
          409,
          'OPEN_ATTEMPTS',
        );
      const endsOnly =
        input.action === 'GRADUATE' || input.action === 'WITHDRAW';
      if (input.targetBatchId)
        await tx.$queryRaw`SELECT id FROM "Batch" WHERE id=${input.targetBatchId} FOR UPDATE`;
      const target = endsOnly
        ? null
        : await tx.batch.findFirst({
            where: { id: input.targetBatchId ?? '', archivedAt: null },
          });
      if (!endsOnly && !target)
        throw new HttpError('Select an open destination batch', 422);
      if (target && active) {
        if (target.id === active.batchId)
          throw new HttpError('Choose a different batch', 422);
        const oldClass = await tx.class.findUniqueOrThrow({
          where: { id: active.batch.classId },
        });
        const nextClass = await tx.class.findUniqueOrThrow({
          where: { id: target.classId },
        });
        const yearDelta =
          Number(target.academicYear.slice(0, 4)) -
          Number(active.batch.academicYear.slice(0, 4));
        if (
          ['PROMOTE', 'REPEAT'].includes(input.action) &&
          (target.schoolId !== active.batch.schoolId ||
            target.boardId !== active.batch.boardId ||
            yearDelta !== 1 ||
            nextClass.level !==
              oldClass.level + (input.action === 'PROMOTE' ? 1 : 0))
        )
          throw new HttpError(
            'Promotion/repeat requires the same school and board, next academic year, and the corresponding class',
            422,
          );
        if (input.action === 'TRANSFER' && yearDelta !== 0)
          throw new HttpError(
            'Transfer within the same academic year; promote/repeat separately',
            422,
          );
      }
      if (active)
        await tx.enrollment.update({
          where: { id: active.id },
          data: {
            status:
              input.action === 'TRANSFER'
                ? 'TRANSFERRED'
                : input.action === 'GRADUATE'
                  ? 'GRADUATED'
                  : input.action === 'WITHDRAW'
                    ? 'WITHDRAWN'
                    : 'COMPLETED',
            endedAt: new Date(),
          },
        });
      await tx.enrollment.updateMany({
        where: { studentId: user.id, status: 'PENDING' },
        data: { status: 'REJECTED', endedAt: new Date() },
      });
      const created = target
        ? await tx.enrollment.create({
            data: {
              studentId: user.id,
              batchId: target.id,
              status: 'ACTIVE',
              approvedById: actorId,
            },
          })
        : null;
      if (target) await syncProfile(tx, user.id, target.id);
      await audit(tx, actorId, input, {
        fromEnrollmentId: active?.id ?? null,
        toEnrollmentId: created?.id ?? null,
      });
      return created;
    },
    { timeout: 15000 },
  );
}
async function syncProfile(
  tx: Prisma.TransactionClient,
  userId: string,
  batchId: string,
) {
  const b = await tx.batch.findUniqueOrThrow({
    where: { id: batchId },
    include: { school: true },
  });
  await tx.user.update({
    where: { id: userId },
    data: {
      schoolId: b.schoolId,
      schoolName: b.school.normalizedName,
      schoolDisplay: b.school.name,
      boardId: b.boardId,
      classId: b.classId,
      academicYear: b.academicYear,
    },
  });
}
async function audit(
  tx: Prisma.TransactionClient,
  actorId: string,
  input: z.infer<typeof transitionInput>,
  details: Record<string, string | null>,
) {
  await tx.enrollmentAudit.create({
    data: {
      actorId,
      studentId: input.studentId,
      action: input.action,
      details: { ...details, reason: input.reason },
    },
  });
}
