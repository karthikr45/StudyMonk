'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMe } from '@/lib/client/useAuth';
import { api } from '@/lib/client/api';
import Header from '@/components/Header';

interface Subj { subject: string; avgPercent: number; attempts: number }
interface Assess { title: string; type: string; subject: string; avgPercent: number; attempts: number }
interface Data {
  totals: { students: number; groups: number; assessments: number; gradedAttempts: number; totalAttempts: number; overallAvg: number };
  bySubject: Subj[];
  byAssessment: Assess[];
}

function band(p: number) {
  if (p >= 75) return '#059669';
  if (p >= 40) return '#d97706';
  return '#e11d48';
}
function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-slate-900 tabular-nums">{value}</p>
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const { user, loading } = useMe();
  const router = useRouter();
  const [d, setD] = useState<Data | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
    if (!loading && user && user.role !== 'SUPER_ADMIN') router.replace('/dashboard');
  }, [user, loading, router]);
  useEffect(() => { api.get<Data>('/api/admin/analytics').then(setD).catch(() => {}); }, []);

  if (loading || !user || user.role !== 'SUPER_ADMIN') return <main className="p-10 text-sm text-slate-500">Loading…</main>;

  return (
    <div className="min-h-screen">
      <Header user={user} subtitle="Analytics" />
      <main className="mx-auto max-w-6xl px-6 py-8 animate-fade-in">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Platform analytics</h1>
            <p className="mt-1 text-sm text-slate-500">Engagement and performance across all students.</p>
          </div>
          <Link href="/admin" className="btn-ghost">← Catalog</Link>
        </div>

        {!d ? <p className="text-sm text-slate-500">Loading…</p> : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              <Tile label="Students" value={`${d.totals.students}`} />
              <Tile label="Study groups" value={`${d.totals.groups}`} />
              <Tile label="Assessments" value={`${d.totals.assessments}`} />
              <Tile label="Attempts" value={`${d.totals.totalAttempts}`} />
              <Tile label="Overall avg" value={`${d.totals.overallAvg}%`} />
            </div>

            <div className="card">
              <h3 className="section-title mb-4">Average by subject</h3>
              {d.bySubject.length === 0 ? <p className="text-sm text-slate-400">No graded attempts yet.</p> : (
                <div className="space-y-3">
                  {d.bySubject.map((s) => (
                    <div key={s.subject}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="text-slate-700">{s.subject} <span className="text-xs text-slate-400">· {s.attempts} attempts</span></span>
                        <span className="font-semibold tabular-nums" style={{ color: band(s.avgPercent) }}>{s.avgPercent}%</span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${s.avgPercent}%`, background: band(s.avgPercent) }} /></div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <h3 className="section-title mb-4">Assessment performance</h3>
              {d.byAssessment.length === 0 ? <p className="text-sm text-slate-400">No submissions yet.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                      <th className="py-2">Assessment</th><th>Subject</th><th>Attempts</th><th>Avg</th>
                    </tr></thead>
                    <tbody>
                      {d.byAssessment.map((a, i) => (
                        <tr key={i} className="border-t border-slate-100">
                          <td className="py-2.5"><span className="font-medium text-slate-800">{a.title}</span> <span className="pill">{a.type.toLowerCase()}</span></td>
                          <td className="text-slate-600">{a.subject}</td>
                          <td className="tabular-nums text-slate-600">{a.attempts}</td>
                          <td>
                            <div className="flex items-center gap-2">
                              <span className="inline-block h-2 w-16 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full" style={{ width: `${a.avgPercent}%`, background: band(a.avgPercent) }} /></span>
                              <span className="tabular-nums font-semibold" style={{ color: band(a.avgPercent) }}>{a.avgPercent}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
