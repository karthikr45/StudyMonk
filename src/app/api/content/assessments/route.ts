export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/auth';
import { ok, handleError } from '@/lib/http';
import { studentProfile } from '@/lib/student';

// Published assessments available to the student (own class), with their own
// attempt status if any. Optional filters: type, subjectId, chapterId.
export async function GET(req: NextRequest) {
  try {
    const auth = await guard(req, { role: 'STUDENT' });
    const p = await studentProfile(auth.id);
    const sp = req.nextUrl.searchParams;
    const type = sp.get('type') ?? undefined;
    const subjectId = sp.get('subjectId') ?? undefined;
    const chapterId = sp.get('chapterId') ?? undefined;

    const assessments = await prisma.assessment.findMany({
      where: {
        status: 'PUBLISHED',
        subject: { classId: p.classId, isActive: true },
        ...(type ? { type: type as any } : {}),
        ...(subjectId ? { subjectId } : {}),
        ...(chapterId ? { chapterId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        subject: { select: { id: true, name: true } },
        chapter: { select: { id: true, name: true } },
        _count: { select: { questions: true } },
        attempts: { where: { studentId: auth.id }, select: { id: true, status: true, score: true, maxScore: true } },
      },
    });

    const shaped = assessments.map((a) => ({
      id: a.id,
      type: a.type,
      title: a.title,
      description: a.description,
      subject: a.subject,
      chapter: a.chapter,
      questionCount: a._count.questions,
      totalMarks: a.totalMarks,
      timeLimitSec: a.timeLimitSec,
      resultsPublished: a.resultsPublished,
      myAttempt: a.attempts[0] ?? null,
    }));
    return ok({ assessments: shaped });
  } catch (err) {
    return handleError(err);
  }
}
