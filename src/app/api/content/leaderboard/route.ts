export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/auth';
import { ok, handleError } from '@/lib/http';
import { studentProfile } from '@/lib/student';

// Class leaderboard: students in the caller's class ranked by total points
// (sum of awarded marks) across graded assessments. Includes the caller's rank.
export async function GET(req: NextRequest) {
  try {
    const auth = await guard(req, { role: 'STUDENT' });
    const p = await studentProfile(auth.id);

    const attempts = await prisma.attempt.findMany({
      where: { status: 'GRADED', score: { not: null }, student: { classId: p.classId, isActive: true } },
      select: { studentId: true, score: true, maxScore: true, student: { select: { fullName: true } } },
    });

    const map = new Map<string, { name: string; points: number; earned: number; possible: number; attempts: number }>();
    for (const a of attempts) {
      const cur = map.get(a.studentId) ?? { name: a.student.fullName, points: 0, earned: 0, possible: 0, attempts: 0 };
      cur.points += a.score ?? 0;
      cur.earned += a.score ?? 0;
      cur.possible += a.maxScore ?? 0;
      cur.attempts += 1;
      map.set(a.studentId, cur);
    }

    const ranked = [...map.entries()]
      .map(([id, v]) => ({
        id,
        name: v.name,
        points: Math.round(v.points),
        avgPercent: v.possible ? Math.round((v.earned / v.possible) * 100) : 0,
        attempts: v.attempts,
      }))
      .sort((a, b) => b.points - a.points || b.avgPercent - a.avgPercent)
      .map((r, i) => ({ ...r, rank: i + 1 }));

    const me = ranked.find((r) => r.id === auth.id) ?? null;

    return ok({
      leaderboard: ranked.slice(0, 15).map((r) => ({ rank: r.rank, name: r.name, points: r.points, avgPercent: r.avgPercent, isMe: r.id === auth.id })),
      me: me ? { rank: me.rank, points: me.points, avgPercent: me.avgPercent } : null,
      totalRanked: ranked.length,
    });
  } catch (err) {
    return handleError(err);
  }
}
