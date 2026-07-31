export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/auth';
import { ok, handleError } from '@/lib/http';
import { z } from 'zod';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await guard(req, { role: 'SUPER_ADMIN' });
    const assessment = await prisma.assessment.findUnique({
      where: { id: params.id },
      include: {
        chapter: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
        questions: {
          orderBy: { order: 'asc' },
          include: { question: { include: { options: { orderBy: { order: 'asc' } } } } },
        },
      },
    });
    return ok({ assessment });
  } catch (err) {
    return handleError(err);
  }
}

const patchSchema = z.object({
  title: z.string().min(2).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  timeLimitSec: z.coerce.number().int().min(30).nullable().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(), // publish assessment
  resultsPublished: z.boolean().optional(), // release results to students
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await guard(req, { role: 'SUPER_ADMIN' });
    const body = patchSchema.parse(await req.json());
    const assessment = await prisma.assessment.update({ where: { id: params.id }, data: body });
    return ok({ assessment });
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
    await prisma.assessment.delete({ where: { id: params.id } });
    return ok({ deleted: true });
  } catch (err) {
    return handleError(err);
  }
}
