export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/auth';
import { ok, fail, handleError } from '@/lib/http';
import { studentProfile } from '@/lib/student';

// Elaborated subject page: the subject plus its chapters, each with a material
// count and how many students are using it. Scoped to the student's own class.
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await guard(req, { role: 'STUDENT' });
    const profile = await studentProfile(auth.id);

    const subject = await prisma.subject.findFirst({
      where: { id: params.id, classId: profile.classId, isActive: true },
      select: { id: true, name: true, code: true },
    });
    if (!subject) return fail('Subject not available for your class', 403, 'FORBIDDEN');

    const chapters = await prisma.chapter.findMany({
      where: { subjectId: subject.id, isActive: true },
      orderBy: { orderIndex: 'asc' },
      select: {
        id: true,
        name: true,
        orderIndex: true,
        _count: {
          select: {
            materials: { where: { isActive: true } },
            views: true, // views are unique per (student, chapter) → distinct students
          },
        },
      },
    });

    const shaped = chapters.map((c) => ({
      id: c.id,
      name: c.name,
      orderIndex: c.orderIndex,
      materialCount: c._count.materials,
      studentCount: c._count.views,
    }));

    // Distinct students using the subject overall.
    const distinct = await prisma.chapterView.findMany({
      where: { chapter: { subjectId: subject.id } },
      distinct: ['userId'],
      select: { userId: true },
    });

    return ok({
      subject: { ...subject, studentCount: distinct.length, chapterCount: chapters.length },
      chapters: shaped,
    });
  } catch (err) {
    return handleError(err);
  }
}
