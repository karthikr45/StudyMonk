export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/auth';
import { ok, handleError } from '@/lib/http';

// All study groups, for Super Admin monitoring.
export async function GET(req: NextRequest) {
  try {
    await guard(req, { role: 'SUPER_ADMIN' });
    const groups = await prisma.studyGroup.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, fullName: true } },
        board: { select: { name: true } },
        class: { select: { name: true } },
        _count: { select: { members: true, posts: true, resources: true, cardSets: true, polls: true } },
      },
    });
    const shaped = groups.map((g) => ({
      id: g.id, name: g.name, description: g.description,
      board: g.board?.name, class: g.class?.name, academicYear: g.academicYear, school: g.schoolName,
      createdBy: g.createdBy, counts: g._count, createdAt: g.createdAt,
    }));
    return ok({ groups: shaped });
  } catch (err) {
    return handleError(err);
  }
}
