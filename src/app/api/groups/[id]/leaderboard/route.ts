export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, handleError } from '@/lib/http';
import { requireGroupMember } from '@/lib/groups';

// Leaderboard among group members, by total points across graded assessments.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { auth } = await requireGroupMember(req, params.id);

    const members = await prisma.groupMember.findMany({
      where: { groupId: params.id },
      select: { userId: true, user: { select: { fullName: true } } },
    });
    const ids = members.map((m) => m.userId);
    const nameById = Object.fromEntries(members.map((m) => [m.userId, m.user.fullName]));

    const attempts = await prisma.attempt.findMany({
      where: { status: 'GRADED', score: { not: null }, studentId: { in: ids } },
      select: { studentId: true, score: true, maxScore: true },
    });

    const map = new Map<string, { points: number; earned: number; possible: number }>();
    for (const a of attempts) {
      const cur = map.get(a.studentId) ?? { points: 0, earned: 0, possible: 0 };
      cur.points += a.score ?? 0; cur.earned += a.score ?? 0; cur.possible += a.maxScore ?? 0;
      map.set(a.studentId, cur);
    }

    const ranked = ids
      .map((id) => {
        const v = map.get(id) ?? { points: 0, earned: 0, possible: 0 };
        return { id, name: nameById[id], points: Math.round(v.points), avgPercent: v.possible ? Math.round((v.earned / v.possible) * 100) : 0 };
      })
      .sort((a, b) => b.points - a.points || b.avgPercent - a.avgPercent)
      .map((r, i) => ({ rank: i + 1, name: r.name, points: r.points, avgPercent: r.avgPercent, isMe: r.id === auth.id }));

    return ok({ leaderboard: ranked });
  } catch (err) {
    return handleError(err);
  }
}
