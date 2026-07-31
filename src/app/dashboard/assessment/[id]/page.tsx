'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMe } from '@/lib/client/useAuth';
import { api, ApiError } from '@/lib/client/api';
import Header from '@/components/Header';
import RichEditor from '@/components/RichEditor';

interface Q { id: string; type: string; prompt: string; marks: number; options: { id: string; text: string }[] }
interface Ans { selectedOptionIds?: string[]; textAnswer?: string; numericAnswer?: number | null }
interface Started {
  attemptId: string;
  assessment: { id: string; type: string; title: string; description: string | null; timeLimitSec: number | null; totalMarks: number };
  questions: Q[];
  savedAnswers: Record<string, Ans>;
}

export default function RunnerPage() {
  const { user, loading } = useMe();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<Started | null>(null);
  const [answers, setAnswers] = useState<Record<string, Ans>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const submittedRef = useRef(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
    if (!loading && user?.role === 'SUPER_ADMIN') router.replace('/admin');
  }, [user, loading, router]);

  useEffect(() => {
    if (!params?.id) return;
    api.post<Started>(`/api/content/assessments/${params.id}/start`)
      .then((d) => {
        setData(d); setAnswers(d.savedAnswers ?? {});
        if (d.assessment.timeLimitSec) setRemaining(d.assessment.timeLimitSec);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not start'));
  }, [params?.id]);

  const submit = useCallback(async () => {
    if (!data || submittedRef.current) return;
    submittedRef.current = true;
    setBusy(true);
    try {
      const payload = { answers: data.questions.map((q) => ({ questionId: q.id, ...answers[q.id] })) };
      await api.post(`/api/content/attempts/${data.attemptId}/submit`, payload);
      router.replace(`/dashboard/attempt/${data.attemptId}/result`);
    } catch (e) {
      submittedRef.current = false;
      setError(e instanceof ApiError ? e.message : 'Could not submit');
      setBusy(false);
    }
  }, [data, answers, router]);

  // Countdown timer → auto-submit at zero.
  useEffect(() => {
    if (remaining === null) return;
    if (remaining <= 0) { submit(); return; }
    const t = setTimeout(() => setRemaining((r) => (r === null ? null : r - 1)), 1000);
    return () => clearTimeout(t);
  }, [remaining, submit]);

  // Debounced autosave.
  useEffect(() => {
    if (!data) return;
    const t = setTimeout(() => {
      const payload = { answers: data.questions.map((q) => ({ questionId: q.id, ...answers[q.id] })) };
      api.post(`/api/content/attempts/${data.attemptId}/answer`, payload)
        .then(() => setSavedAt(new Date().toLocaleTimeString())).catch(() => {});
    }, 1500);
    return () => clearTimeout(t);
  }, [answers, data]);

  function set(qid: string, patch: Ans) { setAnswers((a) => ({ ...a, [qid]: { ...a[qid], ...patch } })); }

  if (loading || !user) return <main className="grid min-h-screen place-items-center text-sm text-slate-500">Loading…</main>;

  const mm = remaining !== null ? String(Math.floor(remaining / 60)).padStart(2, '0') : '';
  const ss = remaining !== null ? String(remaining % 60).padStart(2, '0') : '';

  return (
    <div className="min-h-screen">
      <Header user={user} subtitle={data?.assessment.title} />
      <main className="mx-auto max-w-3xl px-6 py-8 animate-fade-in">
        <Link href="/dashboard" className="mb-4 inline-block text-sm text-slate-500 hover:text-brand-600">← Back</Link>
        {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error} <Link href="/dashboard" className="font-semibold underline">Go back</Link></div>}

        {data && (
          <>
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <span className="pill">{data.assessment.type.toLowerCase()}</span>
                <h1 className="mt-1 text-xl font-bold text-slate-900">{data.assessment.title}</h1>
                <p className="text-sm text-slate-500">{data.questions.length} questions · {data.assessment.totalMarks} marks</p>
              </div>
              {remaining !== null && (
                <span className={`rounded-lg px-3 py-1.5 font-mono text-sm font-bold ${remaining < 60 ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'}`}>⏱ {mm}:{ss}</span>
              )}
            </div>

            <ol className="space-y-4">
              {data.questions.map((q, i) => (
                <li key={q.id} className="card">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <p className="font-semibold text-slate-900">{i + 1}. {q.prompt}</p>
                    <span className="pill shrink-0">{q.marks}m</span>
                  </div>

                  {(q.type === 'MCQ' || q.type === 'TRUE_FALSE') && (
                    <div className="grid gap-2">
                      {q.options.map((o) => {
                        const sel = answers[q.id]?.selectedOptionIds?.includes(o.id);
                        return (
                          <label key={o.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm ${sel ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                            <input type="radio" name={q.id} checked={!!sel} onChange={() => set(q.id, { selectedOptionIds: [o.id] })} />
                            {o.text}
                          </label>
                        );
                      })}
                    </div>
                  )}
                  {q.type === 'NUMERIC' && (
                    <input className="input" type="number" step="any" placeholder="Your answer"
                      value={answers[q.id]?.numericAnswer ?? ''} onChange={(e) => set(q.id, { numericAnswer: e.target.value === '' ? null : Number(e.target.value) })} />
                  )}
                  {q.type === 'SHORT' && (
                    <input className="input" placeholder="Your answer"
                      value={answers[q.id]?.textAnswer ?? ''} onChange={(e) => set(q.id, { textAnswer: e.target.value })} />
                  )}
                  {q.type === 'LONG' && (
                    <RichEditor value={answers[q.id]?.textAnswer ?? ''} onChange={(html) => set(q.id, { textAnswer: html })} />
                  )}
                </li>
              ))}
            </ol>

            <div className="mt-6 flex items-center justify-between">
              <span className="text-xs text-slate-400">{savedAt ? `Autosaved ${savedAt}` : 'Answers autosave as you go'}</span>
              <button className="btn" disabled={busy} onClick={submit}>{busy ? 'Submitting…' : 'Submit'}</button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
