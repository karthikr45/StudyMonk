export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/auth';
import { ok, fail, handleError } from '@/lib/http';
import { studentProfile } from '@/lib/student';
import { getEligibleGroup, requireOwner } from '@/lib/groups';

// Owner removes a member. The owner cannot remove themselves here (they use
// "Leave", which handles ownership hand-off).
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; userId: string } },
) {
  try {
    const auth = await guard(req, { role: 'STUDENT' });
    const p = await studentProfile(auth.id);
    await getEligibleGroup(params.id, p);
    await requireOwner(params.id, auth.id);

    if (params.userId === auth.id) {
      return fail('Use "Leave group" to remove yourself', 400, 'USE_LEAVE');
    }

    await prisma.groupMember.deleteMany({
      where: { groupId: params.id, userId: params.userId },
    });
    return ok({ removed: true });
  } catch (err) {
    return handleError(err);
  }
}
