import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/auth';
import { ok, fail, handleError } from '@/lib/http';
import { studentProfile } from '@/lib/student';

// Chapters for a subject — only if the subject belongs to the student's class.
export async function GET(req: NextRequest) {
  try {
    const auth = await guard(req, { role: 'STUDENT' });
    const profile = await studentProfile(auth.id);
    const subjectId = req.nextUrl.searchParams.get('subjectId');
    if (!subjectId) return fail('subjectId is required', 400, 'SUBJECT_ID_REQUIRED');

    const subject = await prisma.subject.findFirst({
      where: { id: subjectId, classId: profile.classId, isActive: true },
      select: { id: true },
    });
    if (!subject) return fail('Subject not available for your class', 403, 'FORBIDDEN');

    const chapters = await prisma.chapter.findMany({
      where: { subjectId, isActive: true },
      orderBy: { orderIndex: 'asc' },
      select: {
        id: true,
        name: true,
        orderIndex: true,
        _count: { select: { materials: { where: { isActive: true } } } },
      },
    });
    return ok({ chapters });
  } catch (err) {
    return handleError(err);
  }
}
