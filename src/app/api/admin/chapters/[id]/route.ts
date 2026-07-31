export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/auth';
import { ok, handleError } from '@/lib/http';
import { chapterSchema } from '@/lib/validation';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await guard(req, { role: 'SUPER_ADMIN' });
    const body = chapterSchema.omit({ subjectId: true }).partial().parse(await req.json());
    const chapter = await prisma.chapter.update({ where: { id: params.id }, data: body });
    return ok({ chapter });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await guard(req, { role: 'SUPER_ADMIN' });
    const chapter = await prisma.chapter.update({
      where: { id: params.id },
      data: { isActive: false },
    });
    return ok({ chapter });
  } catch (err) {
    return handleError(err);
  }
}