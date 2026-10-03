export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/auth';
import { ok, handleError } from '@/lib/http';
export async function GET(req: NextRequest) {
  try {
    const user = await guard(req, { role: 'STUDENT' });
    const enrollments = await prisma.enrollment.findMany({
      where: { studentId: user.id },
      include: { batch: true },
      orderBy: { startedAt: 'desc' },
    });
    const attempts = await prisma.attempt.findMany({
      where: { studentId: user.id, status: { not: 'IN_PROGRESS' } },
      select: {
        id: true,
        enrollmentId: true,
        status: true,
        submittedAt: true,
        assessment: { select: { title: true, type: true } },
      },
      orderBy: { submittedAt: 'desc' },
    });
    const readable = enrollments.filter(
      (e) =>
        ['COMPLETED', 'GRADUATED'].includes(e.status) ||
        (e.status === 'ACTIVE' && e.batch.archivedAt),
    );
    const groups = await prisma.studyGroup.findMany({
      where: {
        batchId: { in: readable.map((e) => e.batchId) },
        members: {
          some: {
            userId: user.id,
            enrollmentId: { in: readable.map((e) => e.id) },
          },
        },
      },
      select: { id: true, name: true, batch: { select: { label: true } } },
    });
    return ok({ enrollments, attempts, groups });
  } catch (e) {
    return handleError(e);
  }
}
