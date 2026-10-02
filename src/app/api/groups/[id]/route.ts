export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/auth';
import { ok, handleError } from '@/lib/http';
import { studentProfile } from '@/lib/student';
import { getEligibleGroup, requireMembership } from '@/lib/groups';

// Group detail with members and the discussion feed. Members only.
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await guard(req, { role: 'STUDENT' });
    const p = await studentProfile(auth.id);
    await getEligibleGroup(params.id, p);
    await requireMembership(params.id, auth.id);

    const before = req.nextUrl.searchParams.get('before');
    if (
      before &&
      !(await prisma.groupPost.findFirst({
        where: { id: before, groupId: params.id },
      }))
    )
      return ok({ posts: [], nextCursor: null });
    const [group, members, posts] = await Promise.all([
      prisma.studyGroup.findUnique({
        where: { id: params.id },
        select: { id: true, name: true, description: true, createdAt: true },
      }),
      prisma.groupMember.findMany({
        where: { groupId: params.id },
        orderBy: { joinedAt: 'asc' },
        select: {
          role: true,
          joinedAt: true,
          user: { select: { id: true, fullName: true } },
        },
      }),
      prisma.groupPost.findMany({
        where: { groupId: params.id },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 51,
        ...(before ? { cursor: { id: before }, skip: 1 } : {}),
        select: {
          id: true,
          body: true,
          createdAt: true,
          editedAt: true,
          parentId: true,
          mentionIds: true,
          author: { select: { id: true, fullName: true } },
        },
      }),
    ]);

    return ok({
      group,
      members,
      posts: posts.slice(0, 50).reverse(),
      nextCursor: posts.length > 50 ? posts[49].id : null,
    });
  } catch (err) {
    return handleError(err);
  }
}
