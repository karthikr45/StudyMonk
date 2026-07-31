export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/auth';
import { ok, handleError } from '@/lib/http';
import { studentProfile } from '@/lib/student';
import { getEligibleGroup, requireMembership } from '@/lib/groups';
import { postSchema } from '@/lib/validation';

// Post a message to the group's discussion feed. Members only.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await guard(req, { role: 'STUDENT' });
    const p = await studentProfile(auth.id);
    await getEligibleGroup(params.id, p);
    await requireMembership(params.id, auth.id);

    const body = postSchema.parse(await req.json());
    const post = await prisma.groupPost.create({
      data: { groupId: params.id, authorId: auth.id, body: body.body },
      select: {
        id: true,
        body: true,
        createdAt: true,
        author: { select: { id: true, fullName: true } },
      },
    });
    return ok({ post }, 201);
  } catch (err) {
    return handleError(err);
  }
}