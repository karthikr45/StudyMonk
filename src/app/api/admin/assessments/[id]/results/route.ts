export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/auth';
import { ok, handleError } from '@/lib/http';

// All attempts for an assessment, with per-answer detail for grading review.
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await guard(req, { role: 'SUPER_ADMIN' });
    const attempts = await prisma.attempt.findMany({
      where: { assessmentId: params.id },
      orderBy: { submittedAt: 'desc' },
      include: {
        student: { select: { id: true, fullName: true, email: true } },
        answers: {
          include: {
            question: {
              select: { id: true, type: true, prompt: true, marks: true, modelAnswer: true },
            },
          },
        },
      },
    });
    return ok({ attempts });
  } catch (err) {
    return handleError(err);
  }
}
