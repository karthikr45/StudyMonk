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
    const { auth, group } = await requireGroupMember(req, params.id);
    const body = postSchema.parse(await req.json());

    let parentAuthorId: string | null = null;
    if (body.parentId) {
      const parent = await prisma.groupPost.findFirst({ where: { id: body.parentId, groupId: params.id } });
      if (!parent) return fail('Reply target not found', 422, 'PARENT_INVALID');
      parentAuthorId = parent.authorId;
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

    // Notify mentioned members and (if a reply) the parent author.
    const excerpt = body.body.slice(0, 120);
    const recipients = new Map<string, 'MENTION' | 'REPLY'>();
    for (const uid of mentionIds) if (uid !== auth.id) recipients.set(uid, 'MENTION');
    if (parentAuthorId && parentAuthorId !== auth.id && !recipients.has(parentAuthorId)) {
      recipients.set(parentAuthorId, 'REPLY');
    }
    if (recipients.size > 0) {
      await prisma.notification.createMany({
        data: [...recipients].map(([userId, type]) => ({
          userId, type, actorName: post.author.fullName, groupId: params.id, groupName: group.name, excerpt,
        })),
      });
    }

    return ok({ post }, 201);
  } catch (err) {
    return handleError(err);
  }
}
