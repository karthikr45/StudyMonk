export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/auth';
import { ok, handleError } from '@/lib/http';
import { studentProfile } from '@/lib/student';

// Subjects for the logged-in student's own class. "students using it" = active
// students enrolled in this board+class (they all have access to the subject).
export async function GET(req: NextRequest) {
  try {
    const auth = await guard(req, { role: 'STUDENT' });
    const profile = await studentProfile(auth.id);

    const [subjects, classStudentCount] = await Promise.all([
      prisma.subject.findMany({
        where: { classId: profile.classId, isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, code: true, _count: { select: { chapters: true } } },
      }),
      prisma.user.count({
        where: { role: 'STUDENT', isActive: true, boardId: profile.boardId, classId: profile.classId },
      }),
    ]);

    const withCounts = subjects.map((s) => ({
      id: s.id,
      name: s.name,
      code: s.code,
      chapterCount: s._count.chapters,
      studentCount: classStudentCount,
    }));

    return ok({ subjects: withCounts, classStudentCount });
  } catch (err) {
    return handleError(err);
  }
}
