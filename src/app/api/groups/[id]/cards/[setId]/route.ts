export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, fail, handleError } from '@/lib/http';
import { requireGroupMember } from '@/lib/groups';

// Delete a card set (creator only).
export async function DELETE(req: NextRequest, { params }: { params: { id: string; setId: string } }) {
  try {
    const { auth } = await requireGroupMember(req, params.id);
    const set = await prisma.groupCardSet.findFirst({ where: { id: params.setId, groupId: params.id } });
    if (!set) return fail('Card set not found', 404, 'NOT_FOUND');
    if (set.createdById !== auth.id) return fail('Only the creator can delete this set', 403, 'NOT_AUTHOR');
    await prisma.groupCardSet.delete({ where: { id: params.setId } });
    return ok({ deleted: true });
  } catch (err) {
    return handleError(err);
  }
}
