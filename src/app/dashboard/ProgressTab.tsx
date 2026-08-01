'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/client/api';
import { IconFile, IconBook, IconUsers } from '@/components/icons';

interface Recent { title: string; subject: string; percent: number; score: number; maxScore: number; submittedAt: string }
interface Subj { subject: string; avgPercent: number; attempts: number }
interface Analytics {
  totals: { assessmentsTaken: number; available: number; avgPercent: number; subjectsStudied: number; activeDays: number };
  streak: number;
  recent: Recent[];
  bySubject: Subj[];
  weakAreas: Subj[];
}

// Performance band → status colour (value is always shown, never colour-alone).
function band(p: number) {
  if (p >= 75) return { c: '#059669', bg: '#ecfdf5', label: 'Strong' };
  if (p >= 40) return { c: '#d97706', bg: '#fffbeb', label: 'Fair' };
  return { c: '#e11d48', bg: '#fff1f2', label: 'Needs work' };
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-slate-900 tabular-nums">{value}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

export default function ProgressTab() {
  const [d, setD] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Analytics>('/api/content/analytics').then(setD).finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-slate-500">Loading your progress…</p>;
  if (!d || d.totals.assessmentsTaken === 0)
    return (
      <div className="card grid place-items-center py-16 text-center">
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-500"><IconFile width={24} height={24} /></span>
        <p className="text-sm font-medium text-slate-700">No progress yet</p>
        <p className="mt-1 text-sm text-slate-400">Take a quiz or assignment and your analytics will appear here.</p>
      </div>
    );

  const maxRecent = Math.max(...d.recent.map((r) => r.percent), 1);

  return (
    <div className="space-y-6">
      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile label="Average score" value={`${d.totals.avgPercent}%`} sub="across graded work" />
        <Tile label="Assessments" value={`${d.totals.assessmentsTaken}`} sub={`of ${d.totals.available} available`} />
        <Tile label="Study streak" value={`${d.streak}🔥`} sub={`${d.totals.activeDays} active days`} />
        <Tile label="Subjects" value={`${d.totals.subjectsStudied}`} sub="attempted" />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Scores over time */}
        <div className="card">
          <h3 className="section-title mb-4"><span className="text-brand-500"><IconFile /></span>Recent scores</h3>
          {d.recent.length === 0 ? <p className="text-sm text-slate-400">No graded attempts yet.</p> : (
            <div className="relative">
              {/* 40% pass reference line */}
              <div className="flex items-end gap-2" style={{ height: 160 }}>
                {d.recent.map((r, i) => {
                  const h = Math.max((r.percent / 100) * 150, 4);
                  const b = band(r.percent);
                  return (
                    <div key={i} className="flex flex-1 flex-col items-center justify-end" title={`${r.title} — ${r.percent}% (${r.score}/${r.maxScore})`}>
                      <span className="mb-1 text-[10px] font-semibold tabular-nums text-slate-500">{r.percent}</span>
                      <div className="w-full rounded-t" style={{ height: h, background: b.c, minWidth: 8 }} />
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 border-t border-dashed border-slate-200 pt-1 text-[11px] text-slate-400">most recent {d.recent.length} attempts · hover a bar for detail</div>
            </div>
          )}
        </div>

        {/* By subject */}
        <div className="card">
          <h3 className="section-title mb-4"><span className="text-brand-500"><IconBook /></span>Average by subject</h3>
          <div className="space-y-3">
            {d.bySubject.map((s) => {
              const b = band(s.avgPercent);
              return (
                <div key={s.subject}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-slate-700">{s.subject} <span className="text-xs text-slate-400">· {s.attempts} taken</span></span>
                    <span className="font-semibold tabular-nums" style={{ color: b.c }}>{s.avgPercent}%</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full" style={{ width: `${s.avgPercent}%`, background: b.c }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Weak areas */}
      <div className="card">
        <h3 className="section-title mb-3"><span className="text-brand-500"><IconUsers /></span>Focus areas</h3>
        {d.weakAreas.every((w) => w.avgPercent >= 75) ? (
          <p className="text-sm text-emerald-600">You&apos;re strong across the board — keep it up! 🎉</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {d.weakAreas.map((w) => {
              const b = band(w.avgPercent);
              return (
                <div key={w.subject} className="rounded-xl border p-3" style={{ borderColor: b.c + '40', background: b.bg }}>
                  <p className="text-sm font-semibold text-slate-800">{w.subject}</p>
                  <p className="text-xs" style={{ color: b.c }}>{b.label} · avg {w.avgPercent}%</p>
                  <p className="mt-1 text-xs text-slate-500">Revise this subject and retake practice quizzes.</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
