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
    const board = await prisma.board.findUnique({ where: { id: body.boardId } });
    if (!board) return fail('Board not found', 422, 'BOARD_NOT_FOUND');
    const exists = await prisma.class.findFirst({
      where: { boardId: body.boardId, name: body.name },
    });
    if (exists) return fail('Class already exists for this board', 409, 'DUPLICATE');
    const klass = await prisma.class.create({ data: body });
    return ok({ class: klass }, 201);
  } catch (err) {
    return handleError(err);
  }
}