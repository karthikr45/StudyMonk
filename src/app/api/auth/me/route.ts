export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/auth';
import { ok, handleError } from '@/lib/http';

// Returns the authenticated user's full profile (both levels enforced).
export async function GET(req: NextRequest) {
  try {
    const auth = await guard(req);
    const user = await prisma.user.findUnique({
      where: { id: auth.id },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        academicYear: true,
        schoolDisplay: true,
        board: { select: { id: true, name: true, code: true } },
        class: { select: { id: true, name: true, level: true } },
      },
    });
    return ok({ user });
  } catch (err) {
    return handleError(err);
  }
}