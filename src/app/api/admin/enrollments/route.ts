export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/auth';
import { ok, handleError } from '@/lib/http';
import { transitionEnrollment, transitionInput } from '@/lib/enrollments';
import { writeAttempt } from '@/lib/attemptWrites';
import { z } from 'zod';
export async function GET(req: NextRequest) {
  try {
    await guard(req, { role: 'SUPER_ADMIN' });
    return ok({
      students: await prisma.user.findMany({
        where: { role: 'STUDENT', isActive: true },
        orderBy: { fullName: 'asc' },
        select: {
          id: true,
          fullName: true,
          email: true,
          schoolDisplay: true,
          academicYear: true,
          enrollments: {
            include: { batch: true },
            orderBy: { startedAt: 'desc' },
          },
          _count: {
            select: { attempts: { where: { status: 'IN_PROGRESS' } } },
          },
        },
      }),
      legacyAssessments: await prisma.assessment.findMany({
        where: { legacyUnscoped: true },
        select: {
          id: true,
          title: true,
          subjectId: true,
          _count: { select: { attempts: true } },
        },
      }),
      unmappedGroups: await prisma.studyGroup.findMany({
        where: { batchId: null },
        select: { id: true, name: true, schoolName: true, academicYear: true },
      }),
      audit: await prisma.enrollmentAudit.findMany({
        take: 50,
        orderBy: { createdAt: 'desc' },
      }),
    });
  } catch (e) {
    return handleError(e);
  }
}
export async function POST(req: NextRequest) {
  try {
    const admin = await guard(req, { role: 'SUPER_ADMIN' });
    return ok({
      enrollment: await transitionEnrollment(
        admin.id,
        transitionInput.parse(await req.json()),
      ),
    });
  } catch (e) {
    return handleError(e);
  }
}
// Explicitly close unfinished work using only answers already saved on the server.
export async function PATCH(req: NextRequest) {
  try {
    const admin = await guard(req, { role: 'SUPER_ADMIN' });
    const { studentId } = z
      .object({ studentId: z.string().min(1) })
      .parse(await req.json());
    const attempts = await prisma.attempt.findMany({
      where: { studentId, status: 'IN_PROGRESS' },
    });
    for (const a of attempts)
      await writeAttempt(
        a.id,
        studentId,
        { revision: a.answerRevision, answers: [] },
        true,
        true,
      );
    await prisma.enrollmentAudit.create({
      data: {
        actorId: admin.id,
        studentId,
        action: 'FINALIZE_OPEN_ATTEMPTS',
        details: { attemptIds: attempts.map((a) => a.id) },
      },
    });
    return ok({ finalized: attempts.length });
  } catch (e) {
    return handleError(e);
  }
}
