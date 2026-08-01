'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMe } from '@/lib/client/useAuth';
import Header from '@/components/Header';
import AssessmentManager from './AssessmentManager';
import AssessmentOverview from './AssessmentOverview';

export default function AdminAssessmentsPage() {
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
      <Header user={user} subtitle="Assessments" />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Assessments</h1>
            <p className="mt-1 text-sm text-slate-500">
              Everything you&apos;ve created — with live status, submissions and what needs grading.
            </p>
          </div>
          <Link href="/admin" className="btn-ghost shrink-0">← Catalog</Link>
        </div>

        {/* Everything at a glance — no picker needed */}
        <AssessmentOverview />

        {/* Create / edit — scoped to a subject's question bank */}
        <div className="mt-10 mb-4 border-t border-slate-200 pt-8">
          <h2 className="text-lg font-bold text-slate-900">Build &amp; edit</h2>
          <p className="mt-1 text-sm text-slate-500">
            Pick a subject to manage its question bank and assemble quizzes, assignments,
            daily activities and board exams. Objective questions auto-grade instantly.
          </p>
        </div>
        <AssessmentManager />
      </main>
    </div>
  );
}
