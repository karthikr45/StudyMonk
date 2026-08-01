export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, fail, handleError } from '@/lib/http';
import { requireGroupMember } from '@/lib/groups';
import { presignDownload } from '@/lib/r2';

export async function GET(req: NextRequest, { params }: { params: { id: string; rid: string } }) {
  try {
    await requireGroupMember(req, params.id);
    const resource = await prisma.groupResource.findFirst({
      where: { id: params.rid, groupId: params.id },
      select: { storageKey: true, fileName: true },
    });
    if (!resource) return fail('File not found', 404, 'NOT_FOUND');
    const url = await presignDownload(resource.storageKey, 300);
    return ok({ url, fileName: resource.fileName });
  } catch (err) {
    return handleError(err);
  }
}
