'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/client/api';

interface Row {
  id: string; title: string; type: string; status: string; resultsPublished: boolean;
  totalMarks: number; timeLimitSec: number | null;
  subjectName: string; className: string; boardName: string; chapterName: string | null;
  questionCount: number; attemptCount: number; needsReview: number;
}
interface Totals {
  assessments: number; published: number; drafts: number; questions: number;
  draftQuestions: number; attempts: number; needsReview: number;
}

const A_TYPE_LABELS: Record<string, string> = {
  QUIZ: 'Quiz', ASSIGNMENT: 'Assignment', DAILY: 'Daily activity', EXAM: 'Board exam',
};

function Stat({ value, label, tone }: { value: number; label: string; tone?: 'amber' | 'brand' }) {
  const color = tone === 'amber' ? 'text-amber-600' : tone === 'brand' ? 'text-brand-600' : 'text-slate-900';
  return (
    <div className="text-center">
      <p className={`text-2xl font-extrabold ${color}`}>{value}</p>
      <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">{label}</p>
    </div>
  );
}

export default function AssessmentOverview() {
  const [rows, setRows] = useState<Row[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [typeF, setTypeF] = useState('');
  const [statusF, setStatusF] = useState('');

  useEffect(() => {
    api.get<{ totals: Totals; assessments: Row[] }>('/api/admin/overview')
      .then((d) => { setRows(d.assessments); setTotals(d.totals); })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => rows.filter((r) => {
    if (typeF && r.type !== typeF) return false;
    if (statusF === 'PUBLISHED' && r.status !== 'PUBLISHED') return false;
    if (statusF === 'DRAFT' && r.status === 'PUBLISHED') return false;
    if (statusF === 'REVIEW' && r.needsReview === 0) return false;
    if (q) {
      const hay = `${r.title} ${r.subjectName} ${r.className} ${r.boardName} ${r.chapterName ?? ''}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  }), [rows, q, typeF, statusF]);

  if (loading) return <p className="text-sm text-slate-500">Loading overview…</p>;

  return (
    <div className="space-y-4">
      {/* Totals */}
      {totals && (
        <div className="card grid grid-cols-3 gap-4 py-5 sm:grid-cols-6">
          <Stat value={totals.assessments} label="Assessments" />
          <Stat value={totals.published} label="Published" tone="brand" />
          <Stat value={totals.drafts} label="Drafts" />
          <Stat value={totals.questions} label="Questions" />
          <Stat value={totals.attempts} label="Submissions" />
          <Stat value={totals.needsReview} label="To grade" tone="amber" />
        </div>
      )}

      {/* Grading queue call-out */}
      {totals && (totals.needsReview > 0 || totals.draftQuestions > 0) && (
        <div className="flex flex-wrap gap-2">
          {totals.needsReview > 0 && (
            <button onClick={() => setStatusF('REVIEW')}
              className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100">
              ✍️ {totals.needsReview} written answer{totals.needsReview === 1 ? '' : 's'} waiting to be graded → filter below
            </button>
          )}
          {totals.draftQuestions > 0 && (
            <span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600">
              📝 {totals.draftQuestions} draft question{totals.draftQuestions === 1 ? '' : 's'} awaiting approval
            </span>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <input className="input max-w-xs" placeholder="Search title, subject, class…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input w-40" value={typeF} onChange={(e) => setTypeF(e.target.value)}>
          <option value="">All types</option>
          {Object.entries(A_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="input w-40" value={statusF} onChange={(e) => setStatusF(e.target.value)}>
          <option value="">All statuses</option>
          <option value="PUBLISHED">Published</option>
          <option value="DRAFT">Draft / unpublished</option>
          <option value="REVIEW">Needs grading</option>
        </select>
        {(q || typeF || statusF) && <button className="btn-ghost btn-sm" onClick={() => { setQ(''); setTypeF(''); setStatusF(''); }}>Clear</button>}
      </div>

      {/* All assessments — directly visible, no picker */}
      {filtered.length === 0 ? (
        <p className="card text-sm text-slate-400">
          {rows.length === 0 ? 'No assessments yet. Build one below.' : 'Nothing matches your filters.'}
        </p>
      ) : (
        <div className="card !p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5 font-semibold">Assessment</th>
                  <th className="px-3 py-2.5 font-semibold">Type</th>
                  <th className="px-3 py-2.5 font-semibold">Status</th>
                  <th className="px-3 py-2.5 text-center font-semibold">Qs</th>
                  <th className="px-3 py-2.5 text-center font-semibold">Attempts</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Results</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800">{r.title}</p>
                      <p className="text-xs text-slate-400">{r.boardName} · {r.className} · {r.subjectName}{r.chapterName ? ` · ${r.chapterName}` : ''}</p>
                    </td>
                    <td className="px-3 py-3"><span className="pill">{A_TYPE_LABELS[r.type] ?? r.type}</span></td>
                    <td className="px-3 py-3">
                      <span className={r.status === 'PUBLISHED' ? 'pill-brand' : 'pill'}>{r.status.toLowerCase()}</span>
                      {r.needsReview > 0 && <span className="pill ml-1" style={{ color: '#b7791f', background: '#fef3c7' }}>{r.needsReview} to grade</span>}
                      {r.resultsPublished && <span className="pill ml-1">results out</span>}
                    </td>
                    <td className="px-3 py-3 text-center text-slate-600">{r.questionCount}</td>
                    <td className="px-3 py-3 text-center text-slate-600">{r.attemptCount}</td>
                    <td className="px-3 py-3 text-right">
                      <Link href={`/admin/assessments/${r.id}/results`} className="btn-ghost btn-sm">Results →</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
