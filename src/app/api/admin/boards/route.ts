import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/auth';
import { ok, fail, handleError } from '@/lib/http';
import { boardSchema } from '@/lib/validation';

export async function GET(req: NextRequest) {
  try {
    await guard(req, { role: 'SUPER_ADMIN' });
    const boards = await prisma.board.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { classes: true, users: true } } },
    });
    return ok({ boards });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    await guard(req, { role: 'SUPER_ADMIN' });
    const body = boardSchema.parse(await req.json());
    const exists = await prisma.board.findFirst({
      where: { OR: [{ name: body.name }, { code: body.code }] },
    });
    if (exists) return fail('Board name or code already exists', 409, 'DUPLICATE');
    const board = await prisma.board.create({ data: body });
    return ok({ board }, 201);
  } catch (err) {
    return handleError(err);
  }
}
