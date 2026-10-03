export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/auth';
import { ok, handleError } from '@/lib/http';
import { studentProfile } from '@/lib/student';
import { getEligibleGroup } from '@/lib/groups';

// Join a group — allowed only when the student's school/class/year/board match.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await guard(req, { role: 'STUDENT' });
    const p = await studentProfile(auth.id);
    await getEligibleGroup(params.id, p); // enforces scope match

    const existing = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: params.id, userId: auth.id } },
    });
    if (existing?.enrollmentId === p.enrollmentId)
      return ok({ member: existing });
    const member = await prisma.groupMember.upsert({
      where: { groupId_userId: { groupId: params.id, userId: auth.id } },
      update: {
        enrollmentId: p.enrollmentId,
        role: 'MEMBER',
        joinedAt: new Date(),
      },
      create: {
        groupId: params.id,
        userId: auth.id,
        enrollmentId: p.enrollmentId,
        role: 'MEMBER',
      },
    });
    return ok({ member }, 201);
  } catch (err) {
    return handleError(err);
  }
}
