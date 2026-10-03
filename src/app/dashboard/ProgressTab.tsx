'use client';
import WorkspaceSkeleton from '@/components/WorkspaceSkeleton';
import Link from 'next/link';
import { useRemote } from '@/lib/client/useRemote';
import LoadError from '@/components/LoadError';
interface Subject {
  id: string;
  subject: string;
  avgPercent: number;
  attempts: number;
}
interface Analytics {
  totals: {
    assessmentsTaken: number;
    available: number;
    gradedCount: number;
    pendingCount: number;
    avgPercent: number;
    subjectsStudied: number;
    activeDays: number;
  };
  streak: number;
  recent: {
    id: string;
    title: string;
    subject: string;
    percent: number;
    score: number;
    maxScore: number;
    submittedAt: string;
  }[];
  bySubject: Subject[];
  weakAreas: Subject[];
}
interface Leaderboard {
  leaderboard: {
    rank: number;
    name: string;
    points: number;
    avgPercent: number;
    isMe: boolean;
  }[];
  me: { rank: number } | null;
  totalRanked: number;
}
function band(percent: number) {
  return percent >= 75
    ? 'Strong'
    : percent >= 40
      ? 'Developing'
      : 'Needs practice';
}
export default function ProgressTab() {
  const {
    data: d,
    loading,
    error,
    retry,
  } = useRemote<Analytics>('/api/content/analytics');
  const ranking = useRemote<Leaderboard>('/api/content/leaderboard');
  if (loading) return <WorkspaceSkeleton label="Loading your progress…" />;
  if (error || !d)
    return (
      <LoadError message={error ?? 'Progress unavailable.'} retry={retry} />
    );
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          [
            'Average score',
            d.totals.gradedCount ? `${d.totals.avgPercent}%` : 'Not graded yet',
            'Across graded assessments',
          ],
          [
            'Submitted',
            `${d.totals.assessmentsTaken}`,
            `${d.totals.pendingCount} awaiting review`,
          ],
          [
            'Study streak',
            `${d.streak} days`,
            `${d.totals.activeDays} active days · UTC`,
          ],
          [
            'Subjects assessed',
            `${d.totals.subjectsStudied}`,
            'With graded work',
          ],
        ].map(([label, value, detail]) => (
          <div className="card" key={label}>
            <h2 className="text-sm text-slate-600">{label}</h2>
            <p className="mt-2 text-xl font-bold">{value}</p>
            <p className="mt-1 text-sm text-slate-600">{detail}</p>
          </div>
        ))}
      </div>
      {!d.totals.gradedCount && (
        <div className="card">
          <h2 className="font-bold">
            {d.totals.pendingCount
              ? 'Your work is awaiting review'
              : 'Start building your progress'}
          </h2>
          <p className="my-2 text-sm">
            Study activity appears here as you open chapters. Scores appear
            after grading.
          </p>
          <Link className="btn-ghost" href="/dashboard?tab=assess">
            Browse assessments
          </Link>
        </div>
      )}
      {d.recent.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-bold">Recent results</h2>
          <ul className="mt-3 divide-y">
            {d.recent.map((r) => (
              <li key={r.id} className="py-3">
                <Link
                  className="flex flex-wrap items-center justify-between gap-2 underline-offset-4 hover:underline"
                  href={`/dashboard/attempt/${r.id}/result`}
                >
                  <span>
                    <b>{r.title}</b>
                    <span className="block text-sm text-slate-600">
                      {r.subject} ·{' '}
                      {new Date(r.submittedAt).toLocaleDateString()}
                    </span>
                  </span>
                  <span>
                    {r.score}/{r.maxScore} · {r.percent}%
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {d.bySubject.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-bold">By subject</h2>
          <ul className="mt-3 space-y-4">
            {d.bySubject.map((s) => (
              <li key={s.id}>
                <Link
                  className="font-semibold underline"
                  href={`/dashboard/subject/${s.id}`}
                >
                  {s.subject}
                </Link>
                <p className="text-sm">
                  {s.avgPercent}% · {band(s.avgPercent)} · {s.attempts} graded
                </p>
                <progress
                  aria-label={`${s.subject} average score`}
                  className="mt-1 h-3 w-full accent-teal-700"
                  max={100}
                  value={s.avgPercent}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
      {d.weakAreas.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-bold">What to study next</h2>
          {d.weakAreas.every((s) => s.avgPercent >= 75) ? (
            <p className="mt-2">
              Your graded subjects are strong. Keep practising with new
              assessments.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {d.weakAreas
                .filter((s) => s.avgPercent < 75)
                .map((s) => (
                  <li key={s.id}>
                    <Link
                      className="btn-ghost"
                      href={`/dashboard/subject/${s.id}`}
                    >
                      Revise {s.subject} · {s.avgPercent}%
                    </Link>
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}
      {ranking.error ? (
        <LoadError message="Leaderboard unavailable." retry={ranking.retry} />
      ) : (
        ranking.data &&
        ranking.data.leaderboard.length > 0 && (
          <div className="card">
            <h2 className="text-lg font-bold">Board/class leaderboard</h2>
            <p className="mt-1 text-sm text-slate-600">
              Total marks earned across graded assessments; includes other
              schools in your board/class.{' '}
              {ranking.data.me &&
                `You are #${ranking.data.me.rank} of ${ranking.data.totalRanked}.`}
            </p>
            <ol className="mt-3 divide-y">
              {ranking.data.leaderboard.map((r) => (
                <li
                  key={r.rank}
                  className={`flex justify-between gap-3 py-3 ${r.isMe ? 'font-bold text-teal-800' : ''}`}
                >
                  <span>
                    {r.rank}. {r.name}
                    {r.isMe ? ' (you)' : ''}
                  </span>
                  <span>
                    {r.points} pts · {r.avgPercent}%
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )
      )}
    </div>
  );
}
