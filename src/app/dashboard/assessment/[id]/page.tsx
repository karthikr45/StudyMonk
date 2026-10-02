'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMe } from '@/lib/client/useAuth';
import { api, ApiError } from '@/lib/client/api';
import Header from '@/components/Header';
import { remainingSeconds } from '@/lib/assessmentTiming';
import RichEditor from '@/components/RichEditor';
import MathText from '@/components/MathText';

interface Q {
  id: string;
  type: string;
  prompt: string;
  marks: number;
  options: { id: string; text: string }[];
}
interface Ans {
  selectedOptionIds?: string[];
  textAnswer?: string;
  numericAnswer?: number | null;
}
interface Started {
  attemptId: string;
  revision: number;
  deadlineAt: string | null;
  serverNow: string;
  assessment: {
    id: string;
    type: string;
    title: string;
    description: string | null;
    timeLimitSec: number | null;
    totalMarks: number;
  };
  questions: Q[];
  savedAnswers: Record<string, Ans>;
}

export default function RunnerPage() {
  const params = useParams<{ id: string }>();
  return <Runner key={params.id} />;
}

function Runner() {
  const { user, loading } = useMe();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<Started | null>(null);
  const [answers, setAnswers] = useState<Record<string, Ans>>({});
  const answerRef = useRef<Record<string, Ans>>({});
  const revision = useRef(0);
  const editNumber = useRef(0);
  const savedNumber = useRef(0);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const draftKey = useRef('');
  const offset = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<
    'saved' | 'dirty' | 'saving' | 'failed'
  >('saved');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [recovery, setRecovery] = useState<Record<string, Ans> | null>(null);
  const submitting = useRef(false);
  const autoSubmitted = useRef(false);
  const dirty = useRef(false);
  const remaining = data?.deadlineAt
    ? remainingSeconds(data.deadlineAt, now + offset.current)
    : null;
  const expired = remaining === 0;

  function persist() {
    try {
      sessionStorage.setItem(
        draftKey.current,
        JSON.stringify({
          revision: revision.current,
          answers: answerRef.current,
        }),
      );
    } catch {
      /* The save status still reports the server state. */
    }
  }
  useEffect(() => {
    if (!loading && !user) router.replace('/login');
    if (!loading && user?.role === 'SUPER_ADMIN') router.replace('/admin');
  }, [user, loading, router]);

  useEffect(() => {
    if (!params?.id || !user || user.role !== 'STUDENT') return;
    let active = true;
    api
      .post<Started>(`/api/content/assessments/${params.id}/start`)
      .then((d) => {
        if (!active) return;
        revision.current = d.revision;
        offset.current = Date.parse(d.serverNow) - Date.now();
        draftKey.current = `sm-attempt-${user.id}-${d.attemptId}`;
        const saved = Object.fromEntries(
          Object.entries(d.savedAnswers ?? {}).map(([key, value]) => [
            key,
            { ...value, textAnswer: value.textAnswer ?? '' },
          ]),
        );
        answerRef.current = saved;
        setAnswers(saved);
        setData(d);
        try {
          const draft = JSON.parse(
            sessionStorage.getItem(draftKey.current) || 'null',
          );
          if (
            draft?.answers &&
            typeof draft.answers === 'object' &&
            JSON.stringify(draft.answers) !== JSON.stringify(saved)
          )
            setRecovery(draft.answers);
        } catch {
          /* Invalid local draft: keep the server copy. */
        }
      })
      .catch(
        (e) =>
          active &&
          setError(
            e instanceof Error ? e.message : 'Could not start assessment.',
          ),
      );
    return () => {
      active = false;
    };
  }, [params?.id, user]);

  // Warn on browser navigation and links within the app while edits are unsaved.
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty.current && !submitting.current) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    const beforeLink = (event: MouseEvent) => {
      if (
        dirty.current &&
        !submitting.current &&
        (event.target as Element).closest('a[href]:not([href^="#"])') &&
        !window.confirm(
          'Your latest answers are not saved to the server. Leave this page? A recovery draft is kept in this tab when browser storage is available.',
        )
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', beforeLink, true);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('click', beforeLink, true);
    };
  }, []);

  const save = useCallback(() => {
    if (!data || submitting.current || !dirty.current) return;
    const snapshot = answerRef.current;
    const number = editNumber.current;
    const operation = queue.current
      .catch(() => {})
      .then(async () => {
        if (submitting.current || number <= savedNumber.current) return;
        setSaveState('saving');
        const result = await api.post<{ revision: number }>(
          `/api/content/attempts/${data.attemptId}/answer`,
          {
            revision: revision.current,
            answers: data.questions.map((q) => ({
              questionId: q.id,
              ...snapshot[q.id],
            })),
          },
        );
        revision.current = result.revision;
        savedNumber.current = number;
        dirty.current = editNumber.current !== number;
        setSaveState(dirty.current ? 'dirty' : 'saved');
        persist();
      });
    queue.current = operation;
    operation.catch((e) => {
      dirty.current = true;
      setSaveState('failed');
      setError(e instanceof Error ? e.message : 'Save failed. Please retry.');
    });
  }, [data]);

  useEffect(() => {
    if (!data || expired || recovery) return;
    const timer = setTimeout(save, 1000);
    return () => clearTimeout(timer);
  }, [answers, data, expired, recovery, save]);
  useEffect(() => {
    const online = () => save();
    window.addEventListener('online', online);
    return () => window.removeEventListener('online', online);
  }, [save]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const submit = useCallback(
    async (automatic = false) => {
      if (!data || submitting.current) return;
      if (!automatic) {
        const unanswered = data.questions.filter((q) => {
          const a = answerRef.current[q.id];
          return (
            !a?.selectedOptionIds?.length &&
            a?.numericAnswer == null &&
            !a?.textAnswer?.replace(/<[^>]*>/g, '').trim()
          );
        }).length;
        if (
          !window.confirm(
            `Submit this attempt? ${unanswered} unanswered question${unanswered === 1 ? '' : 's'}. You cannot edit or retake this assessment after submitting.`,
          )
        )
          return;
      }
      submitting.current = true;
      setBusy(true);
      setError(null);
      try {
        await queue.current.catch(() => {});
        const result = await api.post<{ deadlinePassed: boolean }>(
          `/api/content/attempts/${data.attemptId}/submit`,
          {
            revision: revision.current,
            answers: data.questions.map((q) => ({
              questionId: q.id,
              ...answerRef.current[q.id],
            })),
          },
        );
        dirty.current = false;
        try {
          sessionStorage.removeItem(draftKey.current);
        } catch {}
        router.replace(
          `/dashboard/attempt/${data.attemptId}/result${result.deadlinePassed ? '?expired=1' : ''}`,
        );
      } catch (e) {
        submitting.current = false;
        setBusy(false);
        setError(
          e instanceof Error
            ? e.message
            : 'Submission failed. Your draft is retained. Try again.',
        );
      }
    },
    [data, router],
  );
  useEffect(() => {
    if (expired && !autoSubmitted.current) {
      autoSubmitted.current = true;
      void submit(true);
    }
  }, [expired, submit]);

  function set(qid: string, patch: Ans) {
    if (expired || submitting.current) return;
    const next = {
      ...answerRef.current,
      [qid]: { ...answerRef.current[qid], ...patch },
    };
    answerRef.current = next;
    editNumber.current++;
    dirty.current = true;
    setAnswers(next);
    setSaveState('dirty');
    persist();
  }
  function restoreDraft() {
    if (!recovery || expired) return;
    answerRef.current = recovery;
    editNumber.current++;
    dirty.current = true;
    setAnswers(recovery);
    setSaveState('dirty');
    setRecovery(null);
    persist();
  }
  const answered =
    data?.questions.filter((q) => {
      const a = answers[q.id];
      return (
        a?.selectedOptionIds?.length ||
        a?.numericAnswer != null ||
        a?.textAnswer?.replace(/<[^>]*>/g, '').trim()
      );
    }).length ?? 0;

  if (loading || !user)
    return (
      <main className="grid min-h-screen place-items-center text-sm text-slate-500">
        Loading…
      </main>
    );

  const mm =
    remaining !== null
      ? String(Math.floor(remaining / 60)).padStart(2, '0')
      : '';
  const ss = remaining !== null ? String(remaining % 60).padStart(2, '0') : '';

  return (
    <div className="min-h-screen">
      <Header user={user} subtitle={data?.assessment.title} />
      <main className="mx-auto max-w-3xl px-6 py-8 animate-fade-in">
        <Link
          href="/dashboard?tab=assess"
          className="mb-4 inline-block text-sm text-slate-500 hover:text-brand-600"
        >
          ← Back
        </Link>
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
            {error}{' '}
            <Link
              href="/dashboard?tab=assess"
              className="font-semibold underline"
            >
              Go back
            </Link>
          </div>
        )}

        {!data && !error && <p role="status">Loading your assessment…</p>}
        {data && (
          <>
            <div className="sticky top-[70px] z-10 mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-3 shadow-sm">
              <div>
                <span className="pill">
                  {data.assessment.type.toLowerCase()}
                </span>
                <h1 className="mt-1 text-xl font-bold text-slate-900">
                  {data.assessment.title}
                </h1>
                <p className="text-sm text-slate-500">
                  {answered}/{data.questions.length} answered ·{' '}
                  {data.assessment.totalMarks} marks
                </p>
              </div>
              {remaining !== null && (
                <span
                  className={`rounded-lg px-3 py-1.5 font-mono text-sm font-bold ${remaining < 60 ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'}`}
                >
                  ⏱ {mm}:{ss}
                </span>
              )}
            </div>

            {recovery && !expired && (
              <div role="alert" className="card mb-4">
                <p>
                  A different recovery draft exists in this tab. Review it
                  before replacing the server-saved answers.
                </p>
                <details className="my-2">
                  <summary>Review recovery draft</summary>
                  <pre className="overflow-auto whitespace-pre-wrap text-xs">
                    {JSON.stringify(recovery, null, 2)}
                  </pre>
                </details>
                <button className="btn mr-2" onClick={restoreDraft}>
                  Use recovery draft
                </button>
                <button
                  className="btn-ghost"
                  onClick={() => {
                    setRecovery(null);
                    persist();
                  }}
                >
                  Keep server answers
                </button>
              </div>
            )}
            {expired && (
              <p role="alert" className="card mb-3">
                Time is up. Only answers saved before the deadline will be
                graded.{' '}
                {error && (
                  <button className="btn" onClick={() => submit(true)}>
                    Retry submission
                  </button>
                )}
              </p>
            )}
            <p className="mb-3 text-sm" role="status" aria-live="polite">
              {saveState === 'saved'
                ? 'All answers saved'
                : saveState === 'saving'
                  ? 'Saving answers…'
                  : saveState === 'failed'
                    ? 'Save failed — latest edits are not saved to the server.'
                    : 'Unsaved changes'}{' '}
              {saveState === 'failed' && !expired && (
                <button
                  className="underline"
                  onClick={() => {
                    setError(null);
                    save();
                  }}
                >
                  Retry save
                </button>
              )}
            </p>
            <nav aria-label="Questions" className="mb-4 flex flex-wrap gap-2">
              {data.questions.map((q, i) => (
                <a
                  className="btn-ghost btn-sm"
                  href={`#question-${q.id}`}
                  key={q.id}
                >
                  Question {i + 1}
                </a>
              ))}
            </nav>
            <fieldset disabled={expired || busy || !!recovery}>
              <legend className="sr-only">Assessment answers</legend>
              <ol className="space-y-4">
                {data.questions.map((q, i) => (
                  <li
                    key={q.id}
                    id={`question-${q.id}`}
                    className="card scroll-mt-48"
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <p className="font-semibold text-slate-900">
                        {i + 1}. <MathText>{q.prompt}</MathText>
                      </p>
                      <span className="pill shrink-0">{q.marks}m</span>
                    </div>

                    {(q.type === 'MCQ' || q.type === 'TRUE_FALSE') && (
                      <div className="grid gap-2">
                        {q.options.map((o) => {
                          const sel = answers[
                            q.id
                          ]?.selectedOptionIds?.includes(o.id);
                          return (
                            <label
                              key={o.id}
                              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm ${sel ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'}`}
                            >
                              <input
                                type="radio"
                                name={q.id}
                                checked={!!sel}
                                onChange={() =>
                                  set(q.id, { selectedOptionIds: [o.id] })
                                }
                              />
                              <MathText>{o.text}</MathText>
                            </label>
                          );
                        })}
                      </div>
                    )}
                    {q.type === 'NUMERIC' && (
                      <input
                        aria-label={`Answer to question ${i + 1}`}
                        className="input"
                        type="number"
                        step="any"
                        placeholder="Your answer"
                        value={answers[q.id]?.numericAnswer ?? ''}
                        onChange={(e) =>
                          set(q.id, {
                            numericAnswer:
                              e.target.value === ''
                                ? null
                                : Number(e.target.value),
                          })
                        }
                      />
                    )}
                    {q.type === 'SHORT' && (
                      <textarea
                        aria-label={`Answer to question ${i + 1}`}
                        rows={3}
                        className="input"
                        placeholder="Your answer"
                        value={answers[q.id]?.textAnswer ?? ''}
                        onChange={(e) =>
                          set(q.id, { textAnswer: e.target.value })
                        }
                      />
                    )}
                    {q.type === 'LONG' && (
                      <RichEditor
                        disabled={expired || busy || !!recovery}
                        key={`${q.id}-${recovery ? 'recover' : 'edit'}`}
                        value={answers[q.id]?.textAnswer ?? ''}
                        onChange={(html) => set(q.id, { textAnswer: html })}
                      />
                    )}
                  </li>
                ))}
              </ol>
            </fieldset>

            <div className="mt-6 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                {answered} answered · {(data?.questions.length ?? 0) - answered}{' '}
                unanswered
              </span>
              <button
                className="btn"
                disabled={busy || expired || !!recovery}
                onClick={() => submit()}
              >
                {busy ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
