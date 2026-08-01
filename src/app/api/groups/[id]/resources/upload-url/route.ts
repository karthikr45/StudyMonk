export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { ok, handleError } from '@/lib/http';
import { requireGroupMember } from '@/lib/groups';
import { groupResourcePresignSchema } from '@/lib/validation';
import { buildStorageKey, presignUpload } from '@/lib/r2';

// Presigned PUT URL for a member to upload a study file directly to R2.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireGroupMember(req, params.id);
    const body = groupResourcePresignSchema.parse(await req.json());
    const storageKey = buildStorageKey(`groups/${params.id}`, body.fileName);
    const uploadUrl = await presignUpload(storageKey, body.contentType);
    return ok({ uploadUrl, storageKey });
  } catch (err) {
    return handleError(err);
  }
}
