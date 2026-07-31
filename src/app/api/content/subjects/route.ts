export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/auth';
import { ok, handleError } from '@/lib/http';
import { studentProfile } from '@/lib/student';

// Subjects for the logged-in student's own class, each with:
//  - chapterCount   : number of chapters
//  - studentCount   : distinct students who have opened a chapter in it ("using it")
// Plus classStudentCount: students enrolled in this board+class.
export async function GET(req: NextRequest) {
  try {
    const auth = await guard(req, { role: 'STUDENT' });
    const profile = await studentProfile(auth.id);

    const subjects = await prisma.subject.findMany({
      where: { classId: profile.classId, isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true, _count: { select: { chapters: true } } },
    });

    const withCounts = await Promise.all(
      subjects.map(async (s) => {
        const distinct = await prisma.chapterView.findMany({
          where: { chapter: { subjectId: s.id } },
          distinct: ['userId'],
          select: { userId: true },
        });
        return {
          id: s.id,
          name: s.name,
          code: s.code,
          chapterCount: s._count.chapters,
          studentCount: distinct.length,
        };
      }),
    );

    const classStudentCount = await prisma.user.count({
      where: { role: 'STUDENT', isActive: true, boardId: profile.boardId, classId: profile.classId },
    });

    return ok({
      subjects: withCounts,
      classStudentCount,
      board: { id: profile.boardId },
    });
  } catch (err) {
    return handleError(err);
  }
}
