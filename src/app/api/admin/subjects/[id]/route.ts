import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/auth';
import { ok, handleError } from '@/lib/http';
import { subjectSchema } from '@/lib/validation';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await guard(req, { role: 'SUPER_ADMIN' });
    const body = subjectSchema.omit({ classId: true }).partial().parse(await req.json());
    const subject = await prisma.subject.update({ where: { id: params.id }, data: body });
    return ok({ subject });
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
    const subject = await prisma.subject.update({
      where: { id: params.id },
      data: { isActive: false },
    });
    return ok({ subject });
  } catch (err) {
    return handleError(err);
  }
}
