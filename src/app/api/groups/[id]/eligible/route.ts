export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/auth';
import { ok, handleError } from '@/lib/http';
import { studentProfile } from '@/lib/student';
import { getEligibleGroup, requireOwner } from '@/lib/groups';

// Classmates the owner can add: same board + class + academic year + school,
// active, and not already a member of this group.
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await guard(req, { role: 'STUDENT' });
    const p = await studentProfile(auth.id);
    const group = await getEligibleGroup(params.id, p);
    await requireOwner(params.id, auth.id);

    const existing = await prisma.groupMember.findMany({
      where: { groupId: params.id },
      select: { userId: true },
    });
    const memberIds = existing.map((m) => m.userId);

    const students = await prisma.user.findMany({
      where: {
        role: 'STUDENT',
        isActive: true,
        boardId: group.boardId,
        classId: group.classId,
        academicYear: group.academicYear,
        schoolName: group.schoolName,
        id: { notIn: memberIds },
      },
      orderBy: { fullName: 'asc' },
      select: { id: true, fullName: true, email: true },
    });
    return ok({ students });
  } catch (err) {
    return handleError(err);
  }
}
