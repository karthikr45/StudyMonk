export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, fail, handleError } from '@/lib/http';

// Active classes for a given board — used in the registration form.
// Public bootstrap route (registration happens before login).
export async function GET(req: NextRequest) {
  try {
    const boardId = req.nextUrl.searchParams.get('boardId');
    if (!boardId) return fail('boardId is required', 400, 'BOARD_ID_REQUIRED');
    const classes = await prisma.class.findMany({
      where: { boardId, isActive: true },
      orderBy: { level: 'asc' },
      select: { id: true, name: true, level: true },
    });
    return ok({ classes });
  } catch (err) {
    return handleError(err);
  }
}