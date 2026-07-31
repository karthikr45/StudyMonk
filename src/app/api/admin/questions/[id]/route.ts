export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/auth';
import { ok, handleError } from '@/lib/http';
import { z } from 'zod';

const patchSchema = z.object({
  prompt: z.string().min(3).max(4000).optional(),
  explanation: z.string().max(4000).nullable().optional(),
  marks: z.coerce.number().int().min(1).max(100).optional(),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
  modelAnswer: z.string().max(8000).nullable().optional(),
  rubric: z.string().max(4000).nullable().optional(),
  numericAnswer: z.coerce.number().nullable().optional(),
  numericTolerance: z.coerce.number().min(0).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(), // approve = PUBLISHED
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await guard(req, { role: 'SUPER_ADMIN' });
    const body = patchSchema.parse(await req.json());
    const question = await prisma.question.update({
      where: { id: params.id },
      data: body,
      include: { options: { orderBy: { order: 'asc' } } },
    });
    return ok({ question });
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
    await prisma.question.delete({ where: { id: params.id } });
    return ok({ deleted: true });
  } catch (err) {
    return handleError(err);
  }
}
