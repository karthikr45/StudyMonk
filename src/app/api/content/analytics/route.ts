export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { studentProfile } from '@/lib/student';
import { guard } from '@/lib/auth';
import { ok, handleError } from '@/lib/http';

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Personal learning analytics for the logged-in student.
export async function GET(req: NextRequest) {
  try {
    const auth = await guard(req, { role: 'STUDENT' });
    const p = await studentProfile(auth.id);

    // Graded attempts with scores.
    const attempts = await prisma.attempt.findMany({
      where: {
        studentId: auth.id,
        enrollmentId: p.enrollmentId,
        status: 'GRADED',
        score: { not: null },
        maxScore: { gt: 0 },
      },
      orderBy: { submittedAt: 'asc' },
      include: {
        assessment: {
          select: {
            title: true,
            type: true,
            subject: { select: { id: true, name: true } },
          },
        },
      },
    });

    const recent = attempts.slice(-12).map((a) => ({
      id: a.id,
      title: a.assessment.title,
      type: a.assessment.type,
      subject: a.assessment.subject.name,
      score: a.score!,
      maxScore: a.maxScore!,
      percent: Math.round((a.score! / a.maxScore!) * 100),
      submittedAt: a.submittedAt,
    }));

    // Per-subject averages.
    const bySubjectMap = new Map<
      string,
      { id: string; name: string; total: number; count: number }
    >();
    for (const a of attempts) {
      const s = a.assessment.subject;
      const cur = bySubjectMap.get(s.id) ?? {
        id: s.id,
        name: s.name,
        total: 0,
        count: 0,
      };
      cur.total += (a.score! / a.maxScore!) * 100;
      cur.count += 1;
      bySubjectMap.set(s.id, cur);
    }
    const bySubject = [...bySubjectMap.values()]
      .map((v) => ({
        id: v.id,
        subject: v.name,
        avgPercent: Math.round(v.total / v.count),
        attempts: v.count,
      }))
      .sort((a, b) => b.avgPercent - a.avgPercent);

    const weakAreas = [...bySubject]
      .sort((a, b) => a.avgPercent - b.avgPercent)
      .slice(0, 3);

    const avgPercent = attempts.length
      ? Math.round(
          attempts.reduce((n, a) => n + (a.score! / a.maxScore!) * 100, 0) /
            attempts.length,
        )
      : 0;

    const [studyDays, submitted] = await Promise.all([
      prisma.enrollmentActivity.findMany({
        where: { enrollmentId: p.enrollmentId },
        select: { day: true },
      }),
      prisma.attempt.findMany({
        where: {
          studentId: auth.id,
          enrollmentId: p.enrollmentId,
          submittedAt: { not: null },
        },
        select: { submittedAt: true },
      }),
    ]);
    const days = new Set(studyDays.map((d) => d.day));
    submitted.forEach((a) => a.submittedAt && days.add(dayKey(a.submittedAt)));

    let streak = 0;
    const cursor = new Date();
    // Allow the streak to count if active today or yesterday.
    if (!days.has(dayKey(cursor))) cursor.setUTCDate(cursor.getUTCDate() - 1);
    while (days.has(dayKey(cursor))) {
      streak += 1;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }

    // How many published assessments are available vs taken.
    const profile = await prisma.user.findUnique({
      where: { id: auth.id },
      select: { classId: true },
    });
    const available = profile?.classId
      ? await prisma.assessment.count({
          where: {
            batchId: p.batchId,
            status: 'PUBLISHED',
            subject: { classId: profile.classId },
          },
        })
      : 0;
    const taken = await prisma.attempt.count({
      where: {
        studentId: auth.id,
        enrollmentId: p.enrollmentId,
        status: { in: ['GRADED', 'NEEDS_REVIEW', 'SUBMITTED'] },
      },
    });

    return ok({
      totals: {
        assessmentsTaken: taken,
        gradedCount: attempts.length,
        pendingCount: taken - attempts.length,
        available,
        avgPercent,
        subjectsStudied: bySubject.length,
        activeDays: days.size,
      },
      streak,
      recent,
      bySubject,
      weakAreas,
    });
  } catch (err) {
    return handleError(err);
  }
}
