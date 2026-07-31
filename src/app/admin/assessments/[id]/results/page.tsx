'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMe } from '@/lib/client/useAuth';
import { api, ApiError } from '@/lib/client/api';
import Header from '@/components/Header';

interface Ans {
  id: string; awardedMarks: number; isCorrect: boolean | null; gradedBy: string | null; confidence: number | null;
  textAnswer: string | null; feedback: string | null;
  question: { id: string; type: string; prompt: string; marks: number; modelAnswer: string | null };
}
interface Attempt {
  id: string; status: string; score: number | null; maxScore: number | null;
  student: { id: string; fullName: string; email: string }; answers: Ans[];
}

export default function ResultsPage() {
  const { user, loading } = useMe();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [grades, setGrades] = useState<Record<string, { marks: string; feedback: string }>>({});
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
    if (!loading && user && user.role !== 'SUPER_ADMIN') router.replace('/dashboard');
  }, [user, loading, router]);
  useEffect(() => { api.get<{ enabled: boolean }>('/api/admin/ai-status').then((d) => setAiEnabled(d.enabled)).catch(() => {}); }, []);

  async function aiGrade() {
    setAiBusy(true); setError(null);
    try {
      const d = await api.post<{ graded: number }>(`/api/admin/assessments/${params.id}/ai-grade`);
      setMsg(`AI graded ${d.graded} written answer(s). Review low-confidence ones, then publish.`);
      await load();
    } catch (e) { setError(e instanceof ApiError ? e.message : String(e)); } finally { setAiBusy(false); }
  }

  async function load() {
    const d = await api.get<{ attempts: Attempt[] }>(`/api/admin/assessments/${params.id}/results`);
    setAttempts(d.attempts);
  }
  useEffect(() => { if (params?.id) load().catch((e) => setError(e instanceof ApiError ? e.message : String(e))); /* eslint-disable-next-line */ }, [params?.id]);

  async function saveGrades(att: Attempt, publish: boolean) {
    const answers = att.answers
      .filter((a) => a.gradedBy === null || grades[a.id])
      .map((a) => ({ answerId: a.id, awardedMarks: Number(grades[a.id]?.marks ?? a.awardedMarks), feedback: grades[a.id]?.feedback }));
    if (answers.length === 0 && !publish) return;
    try {
      await api.post(`/api/admin/attempts/${att.id}/grade`, { answers, publishResults: publish });
      setMsg(publish ? 'Results published to students.' : 'Grades saved.');
      await load();
    } catch (e) { setError(e instanceof ApiError ? e.message : String(e)); }
  }

  async function publishAll() {
    try { await api.patch(`/api/admin/assessments/${params.id}`, { resultsPublished: true }); setMsg('Results published to students.'); await load(); }
    catch (e) { setError(e instanceof ApiError ? e.message : String(e)); }
  }

  if (loading || !user) return <main className="grid min-h-screen place-items-center text-sm text-slate-500">Loading…</main>;

  return (
    <div className="min-h-screen">
      <Header user={user} subtitle="Assessment results" />
      <main className="mx-auto max-w-4xl px-6 py-8 animate-fade-in">
        <div className="mb-5 flex items-center justify-between">
          <Link href="/admin/assessments" className="text-sm text-slate-500 hover:text-brand-600">← Assessments</Link>
          <div className="flex gap-2">
            {aiEnabled && <button className="btn-ghost" disabled={aiBusy} onClick={aiGrade}>{aiBusy ? 'AI grading…' : '🤖 AI-grade written'}</button>}
            <button className="btn" onClick={publishAll}>Publish all results</button>
          </div>
        </div>
        {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}
        {msg && <div className="mb-4 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{msg}</div>}

        {attempts.length === 0 && <p className="card text-sm text-slate-400">No submissions yet.</p>}

        <ul className="space-y-4">
          {attempts.map((att) => {
            const reviewable = (a: Ans) => a.gradedBy === null || (a.gradedBy === 'AI' && (a.confidence ?? 1) < 0.7);
            const needsReview = att.answers.some(reviewable);
            return (
              <li key={att.id} className="card">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-800">{att.student.fullName}</p>
                    <p className="text-xs text-slate-400">{att.student.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-lg font-bold text-slate-900">{att.score ?? '—'} / {att.maxScore ?? '—'}</p>
                    <span className={needsReview ? 'pill' : 'pill-brand'}>{att.status.replace('_', ' ').toLowerCase()}</span>
                  </div>
                </div>

                {/* Subjective answers needing (or open to) grading */}
                {att.answers.filter(reviewable).map((a) => (
                  <div key={a.id} className="mb-2 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                    <p className="text-sm font-medium text-slate-800">{a.question.prompt} <span className="pill">{a.question.marks}m</span>
                      {a.gradedBy === 'AI' && <span className="pill-brand ml-1">AI · {Math.round((a.confidence ?? 0) * 100)}%</span>}
                    </p>
                    {a.question.type === 'LONG' && a.textAnswer
                      ? <div className="prose-answer mt-1" dangerouslySetInnerHTML={{ __html: a.textAnswer }} />
                      : <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{a.textAnswer || <span className="text-slate-400">— no answer —</span>}</p>}
                    {a.question.modelAnswer && <p className="mt-1 text-xs text-slate-400">Model: {a.question.modelAnswer}</p>}
                    {a.gradedBy === 'AI' && a.feedback && <p className="mt-1 text-xs text-slate-500">AI feedback: {a.feedback}</p>}
                    <div className="mt-2 flex gap-2">
                      <input className="input w-24" type="number" min={0} max={a.question.marks} placeholder={`0–${a.question.marks}`}
                        value={grades[a.id]?.marks ?? (a.gradedBy === 'AI' ? String(a.awardedMarks) : '')}
                        onChange={(e) => setGrades((g) => ({ ...g, [a.id]: { ...g[a.id], marks: e.target.value, feedback: g[a.id]?.feedback ?? '' } }))} />
                      <input className="input" placeholder="Feedback (optional)"
                        value={grades[a.id]?.feedback ?? ''} onChange={(e) => setGrades((g) => ({ ...g, [a.id]: { marks: g[a.id]?.marks ?? '', feedback: e.target.value } }))} />
                    </div>
                  </div>
                ))}

                <div className="mt-2 flex gap-2">
                  {needsReview && <button className="btn btn-sm" onClick={() => saveGrades(att, false)}>Save grades</button>}
                  <button className="btn-ghost btn-sm" onClick={() => saveGrades(att, true)}>Save &amp; publish</button>
                </div>
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}
