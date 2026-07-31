export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/auth';
import { ok, handleError } from '@/lib/http';
import { boardSchema } from '@/lib/validation';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await guard(req, { role: 'SUPER_ADMIN' });
    const body = boardSchema.partial().parse(await req.json());
    const board = await prisma.board.update({
      where: { id: params.id },
      data: body,
    });
    return ok({ board });
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
    // Soft-delete to preserve referential history (students may reference it).
    const board = await prisma.board.update({
      where: { id: params.id },
      data: { isActive: false },
    });
    return ok({ board });
  } catch (err) {
    return handleError(err);
  }
}