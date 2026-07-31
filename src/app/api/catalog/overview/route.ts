export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { ok, handleError } from '@/lib/http';

// Public showcase for the landing page: active boards → classes → subjects,
// with how many students are enrolled (using) each. Aggregate, non-sensitive
// data only — no user details are exposed. All values come from the database.
export async function GET() {
  try {
    const activeStudent = { where: { isActive: true, role: 'STUDENT' as const } };

    const boards = await prisma.board.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        code: true,
        _count: { select: { users: activeStudent, classes: { where: { isActive: true } } } },
        classes: {
          where: { isActive: true },
          orderBy: { level: 'asc' },
          select: {
            id: true,
            name: true,
            level: true,
            _count: { select: { users: activeStudent, subjects: { where: { isActive: true } } } },
            subjects: {
              where: { isActive: true },
              orderBy: { name: 'asc' },
              select: {
                id: true,
                name: true,
                code: true,
                _count: { select: { chapters: { where: { isActive: true } } } },
              },
            },
          },
        },
      },
    });

    const boardCards = boards.map((b) => ({
      id: b.id,
      name: b.name,
      code: b.code,
      classCount: b._count.classes,
      subjectCount: b.classes.reduce((n, c) => n + c._count.subjects, 0),
      studentCount: b._count.users,
    }));

    const classCards = boards.flatMap((b) =>
      b.classes.map((c) => ({
        id: c.id,
        name: c.name,
        level: c.level,
        boardName: b.name,
        subjectCount: c._count.subjects,
        studentCount: c._count.users,
      })),
    );

    const subjectCards = boards.flatMap((b) =>
      b.classes.flatMap((c) =>
        c.subjects.map((s) => ({
          id: s.id,
          name: s.name,
          code: s.code,
          boardName: b.name,
          className: c.name,
          chapterCount: s._count.chapters,
          studentCount: c._count.users, // students enrolled in this class use the subject
        })),
      ),
    );

    const totals = {
      boards: boardCards.length,
      classes: classCards.length,
      subjects: subjectCards.length,
      students: boardCards.reduce((n, b) => n + b.studentCount, 0),
    };

    return ok({ boards: boardCards, classes: classCards, subjects: subjectCards, totals });
  } catch (err) {
    return handleError(err);
  }
}
