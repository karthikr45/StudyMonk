'use client';

import Link from 'next/link';
import WorkspaceSkeleton from '@/components/WorkspaceSkeleton';
import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMe } from '@/lib/client/useAuth';
import Header from '@/components/Header';
import StudyTab from './StudyTab';
import GroupsTab from './GroupsTab';
import AssessmentsTab from './AssessmentsTab';
import ProgressTab from './ProgressTab';
import { IconBook, IconUsers, IconFile, IconShield } from '@/components/icons';

export default function Dashboard() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl p-6">
          <WorkspaceSkeleton />
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
function DashboardContent() {
  const { user, loading } = useMe();
  const router = useRouter();
  const search = useSearchParams();
  const selected = search.get('tab');
  const tab = ['study', 'assess', 'progress', 'groups'].includes(selected ?? '')
    ? selected!
    : 'study';
  const deepGroup = search.get('group');
  const deepTab = search.get('gtab');
  function navigate(values: Record<string, string | null>) {
    const next = new URLSearchParams(search.toString());
    Object.entries(values).forEach(([key, value]) =>
      value ? next.set(key, value) : next.delete(key),
    );
    router.push(`/dashboard?${next}`, { scroll: false });
  }

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
    if (!loading && user?.role === 'SUPER_ADMIN') router.replace('/admin');
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <main className="mx-auto max-w-7xl p-6">
        <WorkspaceSkeleton />
      </main>
    );
  }

  if (
    !user.enrollments?.some((e) => e.status === 'ACTIVE' && !e.batch.archivedAt)
  )
    return (
      <>
        <Header user={user} subtitle="Enrollment" />
        <main className="mx-auto max-w-2xl px-4 py-12">
          <section className="card">
            <h1 className="text-2xl font-bold">
              Your next chapter starts here.
            </h1>
            <p className="my-4 text-slate-600">
              Your school enrollment needs admin approval, or your previous
              enrollment has ended. Contact your school admin to confirm your
              batch. Your submitted work stays in learning history.
            </p>
            <Link className="btn" href="/dashboard/history">
              My learning history →
            </Link>
            <button
              className="btn-ghost ml-3"
              onClick={() => window.location.reload()}
            >
              Check approval
            </button>
          </section>
        </main>
      </>
    );

  const subtitle =
    user.board && user.class
      ? `${user.board.name} · ${user.class.name} · ${user.academicYear}`
      : undefined;

  const tabs = [
    { key: 'study' as const, label: 'Study', icon: IconBook },
    { key: 'assess' as const, label: 'Assessments', icon: IconFile },
    { key: 'progress' as const, label: 'Progress', icon: IconShield },
    { key: 'groups' as const, label: 'Study groups', icon: IconUsers },
  ];

  return (
    <div className="min-h-screen">
      <Header user={user} subtitle={subtitle} />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6 animate-fade-in">
        <div className="dashboard-greeting">
          <Link className="history-link" href="/dashboard/history">
            Learning history ↗
          </Link>
          <p className="eyebrow mb-3 text-brand-600">YOUR SPACE TO GROW</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">
            {tab === 'groups'
              ? 'Better together.'
              : tab === 'assess'
                ? 'Show what you know.'
                : tab === 'progress'
                  ? 'Look how far you’ve come.'
                  : `Make today count, ${user.fullName.split(' ')[0]}.`}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {tab === 'groups'
              ? 'Your people. Shared notes. Big ideas.'
              : tab === 'assess'
                ? 'A little practice today. More confidence tomorrow.'
                : tab === 'progress'
                  ? 'Every session is a step forward.'
                  : 'Pick a subject, find your focus, and take the next step.'}
          </p>
          {user.schoolDisplay && (
            <p className="text-sm text-slate-500">{user.schoolDisplay}</p>
          )}
        </div>

        <div
          role="tablist"
          aria-label="Student dashboard"
          className="workspace-tabs mb-6 grid grid-cols-2 gap-1 sm:inline-flex rounded-2xl border border-slate-200 bg-white p-1.5 shadow-card"
        >
          {tabs.map((t) => (
            <button
              key={t.key}
              role="tab"
              tabIndex={tab === t.key ? 0 : -1}
              onKeyDown={(event) => {
                const index = tabs.findIndex((item) => item.key === t.key);
                const target =
                  event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                      ? tabs.length - 1
                      : event.key === 'ArrowRight'
                        ? (index + 1) % tabs.length
                        : event.key === 'ArrowLeft'
                          ? (index + tabs.length - 1) % tabs.length
                          : null;
                if (target === null) return;
                event.preventDefault();
                document.getElementById(`tab-${tabs[target].key}`)?.focus();
                navigate({ tab: tabs[target].key, group: null, gtab: null });
              }}
              aria-selected={tab === t.key}
              aria-controls="dashboard-panel"
              id={`tab-${t.key}`}
              onClick={() => navigate({ tab: t.key, group: null, gtab: null })}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 ${tab === t.key ? 'bg-brand-gradient text-white shadow-lift' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <t.icon width={16} height={16} />
              {t.label}
            </button>
          ))}
        </div>

        <section
          key={tab}
          className="panel-enter"
          id="dashboard-panel"
          role="tabpanel"
          aria-labelledby={`tab-${tab}`}
        >
          {tab === 'study' && <StudyTab user={user} />}
          {tab === 'assess' && <AssessmentsTab />}
          {tab === 'progress' && <ProgressTab />}
          {tab === 'groups' && (
            <GroupsTab
              meId={user.id}
              initialGroupId={deepGroup}
              initialTab={deepTab}
              onSelect={(group, section) =>
                navigate({ tab: 'groups', group, gtab: section })
              }
            />
          )}
        </section>
      </main>
    </div>
  );
}
