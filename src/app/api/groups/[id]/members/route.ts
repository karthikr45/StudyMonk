export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/auth';
import { ok, fail, handleError } from '@/lib/http';
import { studentProfile } from '@/lib/student';
import { getEligibleGroup, requireOwner } from '@/lib/groups';
import { addMemberSchema } from '@/lib/validation';

// Owner adds a classmate to the group. The target must match the group's
// board + class + academic year + school (same rule as self-join).
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await guard(req, { role: 'STUDENT' });
    const p = await studentProfile(auth.id);
    const group = await getEligibleGroup(params.id, p);
    await requireOwner(params.id, auth.id);

    const { userId } = addMemberSchema.parse(await req.json());

    const target = await prisma.user.findFirst({
      where: {
        id: userId,
        role: 'STUDENT',
        isActive: true,
        boardId: group.boardId,
        classId: group.classId,
        academicYear: group.academicYear,
        schoolName: group.schoolName,
      },
      select: { id: true },
    });
    if (!target) {
      return fail('That student is not eligible for this group', 422, 'NOT_ELIGIBLE');
    }

    const member = await prisma.groupMember.upsert({
      where: { groupId_userId: { groupId: params.id, userId } },
      update: {},
      create: { groupId: params.id, userId, role: 'MEMBER' },
    });
    return ok({ member }, 201);
  } catch (err) {
    return handleError(err);
  }
}
