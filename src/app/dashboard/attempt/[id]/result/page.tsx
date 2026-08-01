'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMe } from '@/lib/client/useAuth';
import { api, ApiError } from '@/lib/client/api';
import Header from '@/components/Header';
import MathText from '@/components/MathText';

interface RQ {
  id: string; type: string; prompt: string; marks: number;
  yourOptionIds: string[]; yourText: string | null; yourNumeric: number | null;
  awardedMarks: number | null; isCorrect: boolean | null; feedback: string | null;
  options: { id: string; text: string; isCorrect?: boolean }[];
  explanation: string | null; modelAnswer: string | null;
}
interface Result {
  assessment: { title: string; type: string; totalMarks: number } | null;
  attempt: { status: string; score: number | null; maxScore: number | null };
  released: boolean;
  questions: RQ[];
}

export default function AttemptResultPage() {
  const { user, loading } = useMe();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
    if (!loading && user?.role === 'SUPER_ADMIN') router.replace('/admin');
  }, [user, loading, router]);

  useEffect(() => {
    if (!params?.id) return;
    api.get<Result>(`/api/content/attempts/${params.id}/result`)
      .then(setData).catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load result'));
  }, [params?.id]);

  if (loading || !user) return <main className="grid min-h-screen place-items-center text-sm text-slate-500">Loading…</main>;

  const pct = data?.attempt.score != null && data.attempt.maxScore
    ? Math.round((data.attempt.score / data.attempt.maxScore) * 100) : null;

  return (
    <div className="min-h-screen">
      <Header user={user} subtitle={data?.assessment?.title ?? 'Result'} />
      <main className="mx-auto max-w-3xl px-6 py-8 animate-fade-in">
        <Link href="/dashboard" className="mb-4 inline-block text-sm text-slate-500 hover:text-brand-600">← Back to dashboard</Link>
        {error && <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

        {data && (
          <>
            <div className="card mb-6 flex items-center justify-between">
              <div>
                <span className="pill">{data.assessment?.type.toLowerCase()}</span>
                <h1 className="mt-1 text-xl font-bold text-slate-900">{data.assessment?.title}</h1>
              </div>
              <div className="text-right">
                {data.released && data.attempt.score != null ? (
                  <>
                    <p className="font-mono text-3xl font-extrabold text-slate-900">{data.attempt.score}<span className="text-lg text-slate-400">/{data.attempt.maxScore}</span></p>
                    {pct !== null && <p className={`text-sm font-semibold ${pct >= 40 ? 'text-emerald-600' : 'text-rose-600'}`}>{pct}%</p>}
                  </>
                ) : (
                  <span className="pill">Submitted · awaiting teacher review</span>
                )}
              </div>
            </div>

            {!data.released && (
              <p className="card mb-4 text-sm text-slate-500">Your answers are submitted. Scores will appear once your teacher publishes results.</p>
            )}

            {data.released && (
              <ol className="space-y-4">
                {data.questions.map((q, i) => {
                  const correct = q.isCorrect === true;
                  return (
                    <li key={q.id} className="card">
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <p className="font-semibold text-slate-900">{i + 1}. <MathText>{q.prompt}</MathText></p>
                        <span className={`pill shrink-0 ${correct ? '!bg-emerald-50 !text-emerald-600' : q.isCorrect === false ? '!bg-rose-50 !text-rose-600' : ''}`}>
                          {q.awardedMarks ?? 0}/{q.marks}
                        </span>
                      </div>

                      {(q.type === 'MCQ' || q.type === 'TRUE_FALSE') && (
                        <div className="grid gap-1.5">
                          {q.options.map((o) => {
                            const mine = q.yourOptionIds.includes(o.id);
                            const good = o.isCorrect;
                            return (
                              <div key={o.id} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${good ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : mine ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-slate-200 text-slate-600'}`}>
                                <span>{good ? '✓' : mine ? '✗' : '•'}</span><MathText>{o.text}</MathText>{mine && <span className="ml-auto text-xs">your answer</span>}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {q.type === 'NUMERIC' && <p className="text-sm text-slate-600">Your answer: <b>{q.yourNumeric ?? '—'}</b></p>}
                      {(q.type === 'SHORT' || q.type === 'LONG') && (
                        <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                          {q.type === 'LONG' && q.yourText
                            ? <div className="prose-answer" dangerouslySetInnerHTML={{ __html: q.yourText }} />
                            : <p className="whitespace-pre-wrap">{q.yourText || '— no answer —'}</p>}
                          {q.modelAnswer && <p className="mt-2 text-xs text-slate-500"><b>Model answer:</b> <MathText>{q.modelAnswer}</MathText></p>}
                        </div>
                      )}
                      {q.feedback && <p className="mt-2 text-xs text-slate-500"><b>Feedback:</b> {q.feedback}</p>}
                      {q.explanation && <p className="mt-2 text-xs text-slate-500">💡 {q.explanation}</p>}
                    </li>
                  );
                })}
              </ol>
            )}
          </>
        )}
      </main>
    </div>
  );
}
