export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, fail, handleError } from '@/lib/http';
import { requireGroupMember } from '@/lib/groups';
import { editPostSchema } from '@/lib/validation';

// Edit your own message.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; postId: string } },
) {
  try {
    const { auth } = await requireGroupMember(req, params.id);
    const post = await prisma.groupPost.findFirst({ where: { id: params.postId, groupId: params.id } });
    if (!post) return fail('Message not found', 404, 'NOT_FOUND');
    if (post.authorId !== auth.id) return fail('You can only edit your own message', 403, 'NOT_AUTHOR');

    const body = editPostSchema.parse(await req.json());
    let mentionIds = post.mentionIds;
    if (body.mentionIds) {
      const members = await prisma.groupMember.findMany({
        where: { groupId: params.id, userId: { in: body.mentionIds } },
        select: { userId: true },
      });
      mentionIds = members.map((m) => m.userId);
    }

    const updated = await prisma.groupPost.update({
      where: { id: params.postId },
      data: { body: body.body, mentionIds, editedAt: new Date() },
      select: {
        id: true, body: true, createdAt: true, editedAt: true, parentId: true, mentionIds: true,
        author: { select: { id: true, fullName: true } },
      },
    });
    return ok({ post: updated });
  } catch (err) {
    return handleError(err);
  }
}

// Delete your own message.
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; postId: string } },
) {
  try {
    const { auth } = await requireGroupMember(req, params.id);
    const post = await prisma.groupPost.findFirst({ where: { id: params.postId, groupId: params.id } });
    if (!post) return fail('Message not found', 404, 'NOT_FOUND');
    if (post.authorId !== auth.id) return fail('You can only delete your own message', 403, 'NOT_AUTHOR');
    await prisma.groupPost.delete({ where: { id: params.postId } });
    return ok({ deleted: true });
  } catch (err) {
    return handleError(err);
  }
}
