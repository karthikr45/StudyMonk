'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/client/api';
import { IconFile, IconUsers } from '@/components/icons';

interface Item {
  id: string; type: string; title: string; description: string | null;
  subject: { name: string }; chapter: { name: string } | null;
  questionCount: number; totalMarks: number; timeLimitSec: number | null;
  resultsPublished: boolean;
  myAttempt: { id: string; status: string; score: number | null; maxScore: number | null } | null;
}

const typeColor: Record<string, string> = {
  QUIZ: 'from-amber-500 to-orange-500', ASSIGNMENT: 'from-emerald-500 to-teal-500',
  DAILY: 'from-indigo-500 to-violet-500', EXAM: 'from-rose-500 to-pink-500',
};

export default function AssessmentsTab() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ assessments: Item[] }>('/api/content/assessments')
      .then((d) => setItems(d.assessments)).finally(() => setLoading(false));
  }, []);

  function action(a: Item) {
    const at = a.myAttempt;
    if (at && at.status !== 'IN_PROGRESS') router.push(`/dashboard/attempt/${at.id}/result`);
    else router.push(`/dashboard/assessment/${a.id}`);
  }
  function label(a: Item) {
    const at = a.myAttempt;
    if (!at) return 'Start';
    if (at.status === 'IN_PROGRESS') return 'Resume';
    return 'View result';
  }

  if (loading) return <p className="text-sm text-slate-500">Loading assessments…</p>;
  if (items.length === 0)
    return (
      <div className="card grid place-items-center py-16 text-center">
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-500"><IconFile width={24} height={24} /></span>
        <p className="text-sm font-medium text-slate-700">No assessments yet</p>
        <p className="mt-1 text-sm text-slate-400">Quizzes, assignments and exams from your teacher appear here.</p>
      </div>
    );

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((a) => (
        <div key={a.id} className="card flex flex-col">
          <div className="flex items-start justify-between">
            <span className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${typeColor[a.type] ?? typeColor.QUIZ} text-white shadow-sm`}>
              <IconFile width={20} height={20} />
            </span>
            <span className="pill">{a.type.toLowerCase()}</span>
          </div>
          <h3 className="mt-3 text-base font-bold text-slate-900">{a.title}</h3>
          <p className="text-xs text-slate-400">{a.subject.name}{a.chapter ? ` · ${a.chapter.name}` : ' · whole subject'}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-500">
            <span>{a.questionCount} questions</span>
            <span>{a.totalMarks} marks</span>
            {a.timeLimitSec && <span>{Math.round(a.timeLimitSec / 60)} min</span>}
          </div>
          {a.myAttempt && a.myAttempt.status !== 'IN_PROGRESS' && (
            <p className="mt-2 text-sm font-semibold text-slate-700">
              {a.myAttempt.status === 'NEEDS_REVIEW' && !a.resultsPublished
                ? 'Submitted · awaiting result'
                : `Score: ${a.myAttempt.score ?? '—'} / ${a.myAttempt.maxScore ?? a.totalMarks}`}
            </p>
          )}
          <button className="btn mt-4" onClick={() => action(a)}>{label(a)}</button>
        </div>
      ))}
    </div>
  );
}
