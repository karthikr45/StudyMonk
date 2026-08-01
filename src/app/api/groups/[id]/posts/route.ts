export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, fail, handleError } from '@/lib/http';
import { requireGroupMember } from '@/lib/groups';
import { postSchema } from '@/lib/validation';

// Post a message (optionally a reply, with @mentions of members). Members only.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { auth } = await requireGroupMember(req, params.id);
    const body = postSchema.parse(await req.json());

    if (body.parentId) {
      const parent = await prisma.groupPost.findFirst({ where: { id: body.parentId, groupId: params.id } });
      if (!parent) return fail('Reply target not found', 422, 'PARENT_INVALID');
    }
    // Only real members can be tagged.
    let mentionIds: string[] = [];
    if (body.mentionIds?.length) {
      const members = await prisma.groupMember.findMany({
        where: { groupId: params.id, userId: { in: body.mentionIds } },
        select: { userId: true },
      });
      mentionIds = members.map((m) => m.userId);
    }

    const post = await prisma.groupPost.create({
      data: { groupId: params.id, authorId: auth.id, body: body.body, parentId: body.parentId ?? null, mentionIds },
      select: {
        id: true, body: true, createdAt: true, editedAt: true, parentId: true, mentionIds: true,
        author: { select: { id: true, fullName: true } },
      },
    });
    return ok({ post }, 201);
  } catch (err) {
    return handleError(err);
  }
}
