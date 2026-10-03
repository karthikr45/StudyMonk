export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/auth';
import { ok, fail, handleError } from '@/lib/http';
import { classSchema } from '@/lib/validation';

export async function GET(req: NextRequest) {
  try {
    await guard(req, { role: 'SUPER_ADMIN' });
    const boardId = req.nextUrl.searchParams.get('boardId') ?? undefined;
    const classes = await prisma.class.findMany({
      where: boardId ? { boardId } : undefined,
      orderBy: [{ boardId: 'asc' }, { level: 'asc' }],
      include: {
        board: { select: { id: true, name: true } },
        _count: { select: { subjects: true } },
      },
    });
    return ok({ classes });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    await guard(req, { role: 'SUPER_ADMIN' });
    const body = classSchema.parse(await req.json());
    return await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Board" WHERE id=${body.boardId} FOR UPDATE`;
      const board = await tx.board.findUnique({ where: { id: body.boardId } });
      if (!board || !board.isActive)
        return fail('Board not found', 422, 'BOARD_NOT_FOUND');
      const exists = await tx.class.findFirst({
        where: {
          boardId: body.boardId,
          OR: [{ name: body.name }, { level: body.level }],
        },
      });
      if (exists)
        return fail('Class already exists for this board', 409, 'DUPLICATE');
      const klass = await tx.class.create({ data: body });
      return ok({ class: klass }, 201);
    });
  } catch (err) {
    return handleError(err);
  }
}
