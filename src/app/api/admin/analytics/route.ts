export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/auth';
import { ok, handleError } from '@/lib/http';

// Platform-wide analytics for the Super Admin.
export async function GET(req: NextRequest) {
  try {
    await guard(req, { role: 'SUPER_ADMIN' });

    const [students, groups, assessments, gradedAttempts, totalAttempts] = await Promise.all([
      prisma.user.count({ where: { role: 'STUDENT', isActive: true } }),
      prisma.studyGroup.count({ where: { isActive: true } }),
      prisma.assessment.count({ where: { status: 'PUBLISHED' } }),
      prisma.attempt.findMany({
        where: { status: 'GRADED', score: { not: null }, maxScore: { gt: 0 } },
        include: { assessment: { select: { id: true, title: true, type: true, subject: { select: { id: true, name: true } } } } },
      }),
      prisma.attempt.count(),
    ]);

    const overallAvg = gradedAttempts.length
      ? Math.round(gradedAttempts.reduce((n, a) => n + (a.score! / a.maxScore!) * 100, 0) / gradedAttempts.length)
      : 0;

    // Per-subject averages.
    const subjMap = new Map<string, { name: string; total: number; count: number }>();
    for (const a of gradedAttempts) {
      const s = a.assessment.subject;
      const cur = subjMap.get(s.id) ?? { name: s.name, total: 0, count: 0 };
      cur.total += (a.score! / a.maxScore!) * 100; cur.count += 1; subjMap.set(s.id, cur);
    }
    const bySubject = [...subjMap.values()]
      .map((v) => ({ subject: v.name, avgPercent: Math.round(v.total / v.count), attempts: v.count }))
      .sort((a, b) => b.avgPercent - a.avgPercent);

    // Per-assessment performance.
    const asMap = new Map<string, { title: string; type: string; subject: string; total: number; count: number }>();
    for (const a of gradedAttempts) {
      const key = a.assessment.id;
      const cur = asMap.get(key) ?? { title: a.assessment.title, type: a.assessment.type, subject: a.assessment.subject.name, total: 0, count: 0 };
      cur.total += (a.score! / a.maxScore!) * 100; cur.count += 1; asMap.set(key, cur);
    }
    const byAssessment = [...asMap.values()]
      .map((v) => ({ title: v.title, type: v.type, subject: v.subject, avgPercent: Math.round(v.total / v.count), attempts: v.count }))
      .sort((a, b) => b.attempts - a.attempts)
      .slice(0, 12);

    return ok({
      totals: { students, groups, assessments, gradedAttempts: gradedAttempts.length, totalAttempts, overallAvg },
      bySubject,
      byAssessment,
    });
  } catch (err) {
    return handleError(err);
  }
}
