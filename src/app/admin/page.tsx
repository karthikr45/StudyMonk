'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMe } from '@/lib/client/useAuth';
import { useRemote } from '@/lib/client/useRemote';
import LoadError from '@/components/LoadError';
import Header from '@/components/Header';
import CatalogManager from './CatalogManager';
interface Overview {
  totals: {
    assessments: number;
    published: number;
    drafts: number;
    questions: number;
    draftQuestions: number;
    attempts: number;
    needsReview: number;
  };
  assessments: {
    id: string;
    title: string;
    subjectName: string;
    className: string;
    needsReview: number;
    status: string;
  }[];
}
function AdminSummary() {
  const { data, loading, error, retry } = useRemote<Overview>(
    '/api/admin/overview',
  );
  if (error) return <LoadError message={error} retry={retry} />;
  if (loading || !data)
    return (
      <div className="card" role="status">
        Bringing your workspace up to date…
      </div>
    );
  const t = data.totals;
  const queue = data.assessments
    .filter((a) => a.needsReview > 0)
    .sort((a, b) => b.needsReview - a.needsReview);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          [
            'Published assessments',
            t.published,
            '/admin/assessments',
            'Ready for students',
          ],
          [
            'Submitted attempts',
            t.attempts,
            '/admin/analytics',
            'Learning in action',
          ],
          [
            'Attempts to review',
            t.needsReview,
            '/admin/assessments?status=REVIEW',
            'Your next priority',
          ],
          [
            'Question bank',
            t.questions,
            '/admin/assessments#builder',
            `${t.draftQuestions} awaiting approval`,
          ],
        ].map(([label, value, href, sub], i) => (
          <Link
            key={label}
            href={String(href)}
            className={`admin-stat ${i === 2 ? 'priority' : ''}`}
          >
            <span className="text-xs font-semibold text-slate-600">
              {label}
            </span>
            <strong className="my-3 block text-4xl tracking-tight">
              {value}
            </strong>
            <span className="text-xs text-slate-600">
              {sub} <span className="float-right">↗</span>
            </span>
          </Link>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <section className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">
              Your attention makes a difference
            </h2>
            <span className="pill-brand shrink-0">Review queue</span>
          </div>
          {queue.length === 0 ? (
            <div className="rounded-xl bg-emerald-50 p-6">
              <span className="text-2xl" aria-hidden="true">
                ✓
              </span>
              <h3 className="mt-2 font-semibold">All caught up.</h3>
              <p className="mt-1 text-sm text-slate-600">
                No submitted attempts are waiting for review.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {queue.slice(0, 4).map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/admin/assessments/${a.id}/results`}
                    className="flex items-center justify-between gap-3 rounded-xl py-4 hover:bg-slate-50"
                  >
                    <div>
                      <p className="font-semibold">{a.title}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {a.subjectName} · {a.className}
                      </p>
                    </div>
                    <span className="pill-brand shrink-0">
                      Review {a.needsReview} →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {queue.length > 4 && (
            <Link
              className="mt-3 inline-block text-sm font-semibold text-brand-600"
              href="/admin/assessments?status=REVIEW"
            >
              View all {queue.length} assessments →
            </Link>
          )}
        </section>
        <section className="admin-launchpad">
          <span className="eyebrow">MAKE SOMETHING GREAT</span>
          <h2 className="mt-3 text-2xl font-bold">
            What will they learn next?
          </h2>
          <p className="my-4 text-sm text-teal-100">
            Turn a good lesson into their next lightbulb moment.
          </p>
          <div className="grid gap-2">
            <Link className="btn-ghost" href="/admin/assessments#builder">
              Build an assessment ↗
            </Link>
            <a className="btn-ghost" href="#catalog">
              Add learning materials ↗
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
export default function AdminPage() {
  const { user, loading } = useMe();
  const router = useRouter();
  useEffect(() => {
    if (!loading && !user) router.replace('/login');
    if (!loading && user && user.role !== 'SUPER_ADMIN')
      router.replace('/dashboard');
  }, [user, loading, router]);
  if (loading || !user || user.role !== 'SUPER_ADMIN')
    return (
      <main className="p-10" role="status">
        Loading workspace…
      </main>
    );
  return (
    <div className="min-h-screen">
      <Header user={user} subtitle="Admin studio" />
      <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow text-brand-600">THE BIG PICTURE</p>
            <h1 className="mt-2 text-3xl sm:text-4xl font-bold">
              Behind every breakthrough.
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Welcome back, {user.fullName.split(' ')[0]}. Let’s make learning
              happen.
            </p>
          </div>
          <Link href="/admin/assessments#builder" className="btn">
            + Create an assessment
          </Link>
        </div>
        <AdminSummary />
        <section id="catalog" className="mt-9 scroll-mt-28">
          <div className="mb-5">
            <p className="eyebrow text-brand-600">CONTENT STUDIO</p>
            <h2 className="mt-2 text-2xl font-bold">
              Build their learning world.
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Choose a board, class and subject, then add chapters and
              materials.
            </p>
          </div>
          <CatalogManager />
        </section>
      </main>
    </div>
  );
}
