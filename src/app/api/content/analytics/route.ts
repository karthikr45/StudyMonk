export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/auth';
import { ok, handleError } from '@/lib/http';

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Personal learning analytics for the logged-in student.
export async function GET(req: NextRequest) {
  try {
    const auth = await guard(req, { role: 'STUDENT' });

    // Graded attempts with scores.
    const attempts = await prisma.attempt.findMany({
      where: { studentId: auth.id, status: 'GRADED', score: { not: null }, maxScore: { gt: 0 } },
      orderBy: { submittedAt: 'asc' },
      include: { assessment: { select: { title: true, type: true, subject: { select: { id: true, name: true } } } } },
    });

    const recent = attempts.slice(-12).map((a) => ({
      title: a.assessment.title,
      type: a.assessment.type,
      subject: a.assessment.subject.name,
      score: a.score!,
      maxScore: a.maxScore!,
      percent: Math.round((a.score! / a.maxScore!) * 100),
      submittedAt: a.submittedAt,
    }));

    // Per-subject averages.
    const bySubjectMap = new Map<string, { name: string; total: number; count: number }>();
    for (const a of attempts) {
      const s = a.assessment.subject;
      const cur = bySubjectMap.get(s.id) ?? { name: s.name, total: 0, count: 0 };
      cur.total += (a.score! / a.maxScore!) * 100;
      cur.count += 1;
      bySubjectMap.set(s.id, cur);
    }
    const bySubject = [...bySubjectMap.values()]
      .map((v) => ({ subject: v.name, avgPercent: Math.round(v.total / v.count), attempts: v.count }))
      .sort((a, b) => b.avgPercent - a.avgPercent);

    const weakAreas = [...bySubject].sort((a, b) => a.avgPercent - b.avgPercent).slice(0, 3);

    const avgPercent = attempts.length
      ? Math.round(attempts.reduce((n, a) => n + (a.score! / a.maxScore!) * 100, 0) / attempts.length)
      : 0;

    // Activity streak from attempts + chapter opens.
    const views = await prisma.chapterView.findMany({
      where: { userId: auth.id },
      select: { createdAt: true },
    });
    const days = new Set<string>();
    attempts.forEach((a) => a.submittedAt && days.add(dayKey(a.submittedAt)));
    views.forEach((v) => days.add(dayKey(v.createdAt)));

    let streak = 0;
    const cursor = new Date();
    // Allow the streak to count if active today or yesterday.
    if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
    while (days.has(dayKey(cursor))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    // How many published assessments are available vs taken.
    const profile = await prisma.user.findUnique({ where: { id: auth.id }, select: { classId: true } });
    const available = profile?.classId
      ? await prisma.assessment.count({ where: { status: 'PUBLISHED', subject: { classId: profile.classId } } })
      : 0;
    const taken = await prisma.attempt.count({ where: { studentId: auth.id, status: { in: ['GRADED', 'NEEDS_REVIEW', 'SUBMITTED'] } } });

    return ok({
      totals: { assessmentsTaken: taken, available, avgPercent, subjectsStudied: bySubject.length, activeDays: days.size },
      streak,
      recent,
      bySubject,
      weakAreas,
    });
  } catch (err) {
    return handleError(err);
  }
}
