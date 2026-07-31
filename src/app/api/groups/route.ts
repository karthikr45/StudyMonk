import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/auth';
import { ok, handleError } from '@/lib/http';
import { studentProfile } from '@/lib/student';
import { createGroupSchema } from '@/lib/validation';

// List every group whose matching key equals the student's own
// (board + class + academic year + school). These are the groups the student
// is eligible to see and join, plus a flag for the ones they belong to.
export async function GET(req: NextRequest) {
  try {
    const auth = await guard(req, { role: 'STUDENT' });
    const p = await studentProfile(auth.id);

    const groups = await prisma.studyGroup.findMany({
      where: {
        isActive: true,
        boardId: p.boardId,
        classId: p.classId,
        academicYear: p.academicYear,
        schoolName: p.schoolName,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, fullName: true } },
        members: { where: { userId: auth.id }, select: { id: true, role: true } },
        _count: { select: { members: true } },
      },
    });

    const shaped = groups.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      memberCount: g._count.members,
      createdBy: g.createdBy,
      isMember: g.members.length > 0,
      myRole: g.members[0]?.role ?? null,
      createdAt: g.createdAt,
    }));
    return ok({ groups: shaped, scope: { schoolDisplay: p.schoolDisplay, academicYear: p.academicYear } });
  } catch (err) {
    return handleError(err);
  }
}

// Create a group; the creator becomes OWNER and first member. The matching key
// is copied from the creator's profile so only peers can ever join.
export async function POST(req: NextRequest) {
  try {
    const auth = await guard(req, { role: 'STUDENT' });
    const p = await studentProfile(auth.id);
    const body = createGroupSchema.parse(await req.json());

    const group = await prisma.studyGroup.create({
      data: {
        name: body.name,
        description: body.description,
        boardId: p.boardId,
        classId: p.classId,
        academicYear: p.academicYear,
        schoolName: p.schoolName,
        createdById: auth.id,
        members: { create: { userId: auth.id, role: 'OWNER' } },
      },
    });
    return ok({ group }, 201);
  } catch (err) {
    return handleError(err);
  }
}
