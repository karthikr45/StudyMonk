export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/auth';
import { ok, handleError } from '@/lib/http';
import { classSchema } from '@/lib/validation';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await guard(req, { role: 'SUPER_ADMIN' });
    const body = classSchema.omit({ boardId: true }).partial().parse(await req.json());
    const klass = await prisma.class.update({ where: { id: params.id }, data: body });
    return ok({ class: klass });
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
    const klass = await prisma.class.update({
      where: { id: params.id },
      data: { isActive: false },
    });
    return ok({ class: klass });
  } catch (err) {
    return handleError(err);
  }
}