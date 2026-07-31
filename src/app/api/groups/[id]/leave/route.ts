export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/auth';
import { ok, fail, handleError } from '@/lib/http';

// Leave a group. If the last OWNER leaves, ownership passes to the oldest
// remaining member so the group is never left without an owner.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await guard(req, { role: 'STUDENT' });

    const member = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: params.id, userId: auth.id } },
    });
    if (!member) return fail('You are not a member of this group', 403, 'NOT_MEMBER');

    await prisma.$transaction(async (tx) => {
      await tx.groupMember.delete({
        where: { groupId_userId: { groupId: params.id, userId: auth.id } },
      });

      if (member.role === 'OWNER') {
        const owners = await tx.groupMember.count({
          where: { groupId: params.id, role: 'OWNER' },
        });
        if (owners === 0) {
          const next = await tx.groupMember.findFirst({
            where: { groupId: params.id },
            orderBy: { joinedAt: 'asc' },
          });
          if (next) {
            await tx.groupMember.update({
              where: { id: next.id },
              data: { role: 'OWNER' },
            });
          } else {
            // No members left — deactivate the empty group.
            await tx.studyGroup.update({
              where: { id: params.id },
              data: { isActive: false },
            });
          }
        }
      }
    });

    return ok({ left: true });
  } catch (err) {
    return handleError(err);
  }
}