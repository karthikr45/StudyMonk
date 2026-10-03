'use client';
import WorkspaceSkeleton from '@/components/WorkspaceSkeleton';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRemote } from '@/lib/client/useRemote';
import LoadError from '@/components/LoadError';
import { IconFile, IconUsers } from '@/components/icons';

interface Item {
  id: string;
  type: string;
  title: string;
  description: string | null;
  subject: { name: string };
  chapter: { name: string } | null;
  questionCount: number;
  totalMarks: number;
  timeLimitSec: number | null;
  resultsPublished: boolean;
  scheduledFor?: string | null;
  dueAt?: string | null;
  myAttempt: {
    id: string;
    status: string;
    score: number | null;
    maxScore: number | null;
  } | null;
}

const typeColor: Record<string, string> = {
  QUIZ: 'from-accent-500 to-accent-600',
  ASSIGNMENT: 'from-brand-500 to-brand-700',
  DAILY: 'from-brand-600 to-brand-800',
  EXAM: 'from-brand-500 to-accent-500',
};

export default function AssessmentsTab() {
  const router = useRouter();
  const { data, loading, error, retry } = useRemote<{ assessments: Item[] }>(
    '/api/content/assessments',
  );
  const items = data?.assessments ?? [];
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  if (error) return <LoadError message={error} retry={retry} />;
  function action(a: Item) {
    const at = a.myAttempt;
    if (at && at.status !== 'IN_PROGRESS')
      router.push(`/dashboard/attempt/${at.id}/result`);
    else {
      if (
        !at &&
        !window.confirm(
          `${a.title}\n${a.questionCount} questions · ${a.totalMarks} marks${a.timeLimitSec ? ` · ${Math.ceil(a.timeLimitSec / 60)} minutes` : ''}\nYou have one attempt. Answers save automatically while connected. The timer continues if you leave. Start now?`,
        )
      )
        return;
      router.push(`/dashboard/assessment/${a.id}`);
    }
  }
  function label(a: Item) {
    const at = a.myAttempt;
    if (!at) return 'Start';
    if (at.status === 'IN_PROGRESS') return 'Resume';
    return at.status === 'NEEDS_REVIEW' && !a.resultsPublished
      ? 'View submission'
      : 'View result';
  }

  if (loading) return <WorkspaceSkeleton label="Loading assessments…" />;
  if (items.length === 0)
    return (
      <div className="card grid place-items-center py-16 text-center">
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-500">
          <IconFile width={24} height={24} />
        </span>
        <p className="text-sm font-medium text-slate-700">No assessments yet</p>
        <p className="mt-1 text-sm text-slate-400">
          Quizzes, assignments and exams from your teacher appear here.
        </p>
      </div>
    );

  return (
    <div>
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          Search title or subject
          <input
            className="input mt-1"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label className="text-sm">
          Status
          <select
            className="input mt-1"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">All assessments</option>
            <option value="new">Not started</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="NEEDS_REVIEW">Awaiting review</option>
            <option value="GRADED">Graded</option>
          </select>
        </label>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items
          .filter(
            (a) =>
              `${a.title} ${a.subject.name}`
                .toLowerCase()
                .includes(query.toLowerCase()) &&
              (status === 'all' ||
                (status === 'new'
                  ? !a.myAttempt
                  : a.myAttempt?.status === status)),
          )
          .map((a) => (
            <div key={a.id} className="card flex flex-col">
              <div className="flex items-start justify-between">
                <span
                  className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${typeColor[a.type] ?? typeColor.QUIZ} text-white shadow-sm`}
                >
                  <IconFile width={20} height={20} />
                </span>
                <span className="pill">{a.type.toLowerCase()}</span>
              </div>
              <h3 className="mt-3 text-base font-bold text-slate-900">
                {a.title}
              </h3>
              <p className="text-xs text-slate-400">
                {a.subject.name}
                {a.chapter ? ` · ${a.chapter.name}` : ' · whole subject'}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                <span>{a.questionCount} questions</span>
                <span>{a.totalMarks} marks</span>
                {a.timeLimitSec && (
                  <span>{Math.round(a.timeLimitSec / 60)} min</span>
                )}
              </div>
              {a.myAttempt && a.myAttempt.status !== 'IN_PROGRESS' && (
                <p className="mt-2 text-sm font-semibold text-slate-700">
                  {a.myAttempt.status === 'NEEDS_REVIEW' && !a.resultsPublished
                    ? 'Submitted · awaiting result'
                    : `Score: ${a.myAttempt.score ?? '—'} / ${a.myAttempt.maxScore ?? a.totalMarks}`}
                </p>
              )}
              {a.dueAt && (
                <p className="mt-2 text-sm">
                  Due {new Date(a.dueAt).toLocaleString()}
                </p>
              )}
              {a.scheduledFor && new Date(a.scheduledFor) > new Date() && (
                <p className="mt-2 text-sm">
                  Opens {new Date(a.scheduledFor).toLocaleString()}
                </p>
              )}
              <button
                disabled={
                  !a.myAttempt &&
                  ((!!a.dueAt && new Date(a.dueAt) <= new Date()) ||
                    (!!a.scheduledFor && new Date(a.scheduledFor) > new Date()))
                }
                className="btn mt-4"
                onClick={() => action(a)}
              >
                {label(a)}
              </button>
            </div>
          ))}
      </div>
    </div>
  );
}
