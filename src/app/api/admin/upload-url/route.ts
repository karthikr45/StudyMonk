import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/auth';
import { ok, fail, handleError } from '@/lib/http';
import { presignUploadSchema } from '@/lib/validation';
import { buildStorageKey, presignUpload } from '@/lib/r2';

// Step 1 of upload: SUPER_ADMIN asks for a presigned PUT URL to R2.
export async function POST(req: NextRequest) {
  try {
    await guard(req, { role: 'SUPER_ADMIN' });
    const body = presignUploadSchema.parse(await req.json());

    const chapter = await prisma.chapter.findUnique({
      where: { id: body.chapterId },
      select: { id: true, subjectId: true },
    });
    if (!chapter) return fail('Chapter not found', 422, 'CHAPTER_NOT_FOUND');

    const storageKey = buildStorageKey(
      `materials/${chapter.subjectId}/${chapter.id}`,
      body.fileName,
    );
    const uploadUrl = await presignUpload(storageKey, body.contentType);

    return ok({ uploadUrl, storageKey });
  } catch (err) {
    return handleError(err);
  }
}
