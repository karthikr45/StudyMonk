export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/auth';
import { ok, handleError } from '@/lib/http';
import { studentProfile } from '@/lib/student';

// Subjects for the logged-in student's own class only.
export async function GET(req: NextRequest) {
  try {
    const auth = await guard(req, { role: 'STUDENT' });
    const profile = await studentProfile(auth.id);
    const subjects = await prisma.subject.findMany({
      where: { classId: profile.classId, isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        code: true,
        _count: { select: { chapters: true } },
      },
    });
    return ok({ subjects });
  } catch (err) {
    return handleError(err);
  }
}