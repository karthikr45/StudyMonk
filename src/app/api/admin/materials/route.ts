export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/auth';
import { ok, fail, handleError } from '@/lib/http';
import { materialSchema } from '@/lib/validation';

export async function GET(req: NextRequest) {
  try {
    await guard(req, { role: 'SUPER_ADMIN' });
    const chapterId = req.nextUrl.searchParams.get('chapterId') ?? undefined;
    const materials = await prisma.studyMaterial.findMany({
      where: chapterId ? { chapterId } : undefined,
      orderBy: { createdAt: 'desc' },
    });
    return ok({ materials });
  } catch (err) {
    return handleError(err);
  }
}

// Step 2 of upload: record the object that was just PUT to R2.
export async function POST(req: NextRequest) {
  try {
    const admin = await guard(req, { role: 'SUPER_ADMIN' });
    const body = materialSchema.parse(await req.json());

    const chapter = await prisma.chapter.findUnique({ where: { id: body.chapterId } });
    if (!chapter) return fail('Chapter not found', 422, 'CHAPTER_NOT_FOUND');

    const material = await prisma.studyMaterial.create({
      data: {
        chapterId: body.chapterId,
        title: body.title,
        description: body.description,
        type: body.type ?? 'PDF',
        storageKey: body.storageKey,
        fileName: body.fileName,
        fileSize: body.fileSize,
        contentType: body.contentType,
        uploadedById: admin.id,
      },
    });
    return ok({ material }, 201);
  } catch (err) {
    return handleError(err);
  }
}