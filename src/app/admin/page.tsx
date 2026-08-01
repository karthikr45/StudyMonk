'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMe } from '@/lib/client/useAuth';
import { api } from '@/lib/client/api';
import Header from '@/components/Header';
import CatalogManager from './CatalogManager';

interface Totals {
  assessments: number; published: number; drafts: number; questions: number;
  draftQuestions: number; attempts: number; needsReview: number;
}

function AdminSummary() {
  const [t, setT] = useState<Totals | null>(null);
  useEffect(() => { api.get<{ totals: Totals }>('/api/admin/overview').then((d) => setT(d.totals)).catch(() => {}); }, []);
  if (!t) return null;
  const chips: { label: string; value: number; tone?: string }[] = [
    { label: 'Assessments', value: t.assessments },
    { label: 'Published', value: t.published },
    { label: 'Questions', value: t.questions },
    { label: 'Submissions', value: t.attempts },
  ];
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3">
      {chips.map((c) => (
        <div key={c.label} className="rounded-xl border border-slate-200 bg-white px-4 py-2">
          <span className="text-lg font-extrabold text-slate-900">{c.value}</span>
          <span className="ml-2 text-xs font-medium uppercase tracking-wide text-slate-500">{c.label}</span>
        </div>
      ))}
      {t.needsReview > 0 && (
        <Link href="/admin/assessments" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100">
          ✍️ {t.needsReview} answer{t.needsReview === 1 ? '' : 's'} to grade →
        </Link>
      )}
      {t.draftQuestions > 0 && (
        <Link href="/admin/assessments" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
          📝 {t.draftQuestions} draft question{t.draftQuestions === 1 ? '' : 's'} to approve →
        </Link>
      )}
    </div>
  );
}

export default function AdminPage() {
  const { user, loading } = useMe();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
    if (!loading && user && user.role !== 'SUPER_ADMIN') router.replace('/dashboard');
  }, [user, loading, router]);

  if (loading || !user || user.role !== 'SUPER_ADMIN') {
    return <main className="p-10 text-sm text-slate-500">Loading…</main>;
  }

  return (
    <div className="min-h-screen">
      <Header user={user} subtitle="Content Management" />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Content catalog</h1>
            <p className="mt-1 text-sm text-slate-500">
              Build the study catalog: add a board, then drill in to add classes, subjects,
              chapters and upload NCERT materials. Students see content for their own class.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Link href="/admin/analytics" className="btn-ghost">Analytics →</Link>
            <Link href="/admin/groups" className="btn-ghost">Groups →</Link>
            <Link href="/admin/assessments" className="btn">Assessments →</Link>
          </div>
        </div>
        <AdminSummary />
        <CatalogManager />
      </main>
    </div>
  );
}
