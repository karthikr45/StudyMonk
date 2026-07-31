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

    const member = await prisma.groupMember.upsert({
      where: { groupId_userId: { groupId: params.id, userId: auth.id } },
      update: {},
      create: { groupId: params.id, userId: auth.id, role: 'MEMBER' },
    });
    return ok({ member }, 201);
  } catch (err) {
    return handleError(err);
  }
}
