'use client';

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
    <Suspense fallback={<p className="p-6">Loading dashboard…</p>}>
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
      <main className="grid min-h-screen place-items-center text-sm text-slate-500">
        Loading…
      </main>
    );
  }

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
      <main className="mx-auto max-w-6xl px-6 py-8 animate-fade-in">
        <div className="mb-6 flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-slate-900">
            Hi {user.fullName.split(' ')[0]} 👋
          </h1>
          {user.schoolDisplay && (
            <p className="text-sm text-slate-500">{user.schoolDisplay}</p>
          )}
        </div>

        <div
          role="tablist"
          aria-label="Student dashboard"
          className="mb-6 grid grid-cols-2 gap-1 sm:inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-card"
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
