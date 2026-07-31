export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { ok, handleError } from '@/lib/http';

// Active boards for the registration dropdown. Public bootstrap route (the
// user has no account yet); only non-sensitive catalog data is exposed.
export async function GET() {
  try {
    const boards = await prisma.board.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true },
    });
    return ok({ boards });
  } catch (err) {
    return handleError(err);
  }
}