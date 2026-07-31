'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMe } from '@/lib/client/useAuth';
import Header from '@/components/Header';
import StudyTab from './StudyTab';
import GroupsTab from './GroupsTab';
import AssessmentsTab from './AssessmentsTab';
import { IconBook, IconUsers, IconFile } from '@/components/icons';

export default function Dashboard() {
  const { user, loading } = useMe();
  const router = useRouter();
  const [tab, setTab] = useState<'study' | 'assess' | 'groups'>('study');

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
    if (!loading && user?.role === 'SUPER_ADMIN') router.replace('/admin');
  }, [user, loading, router]);

  if (loading || !user) {
    return <main className="grid min-h-screen place-items-center text-sm text-slate-500">Loading…</main>;
  }

  const subtitle = user.board && user.class
    ? `${user.board.name} · ${user.class.name} · ${user.academicYear}`
    : undefined;

  const tabs = [
    { key: 'study' as const, label: 'Study', icon: IconBook },
    { key: 'assess' as const, label: 'Assessments', icon: IconFile },
    { key: 'groups' as const, label: 'Study groups', icon: IconUsers },
  ];

  return (
    <div className="min-h-screen">
      <Header user={user} subtitle={subtitle} />
      <main className="mx-auto max-w-6xl px-6 py-8 animate-fade-in">
        <div className="mb-6 flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-slate-900">Hi {user.fullName.split(' ')[0]} 👋</h1>
          {user.schoolDisplay && (
            <p className="text-sm text-slate-500">{user.schoolDisplay}</p>
          )}
        </div>

        <div className="mb-6 inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-card">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${tab === t.key ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}>
              <t.icon width={16} height={16} />{t.label}
            </button>
          ))}
        </div>

        {tab === 'study' && <StudyTab user={user} />}
        {tab === 'assess' && <AssessmentsTab />}
        {tab === 'groups' && <GroupsTab />}
      </main>
    </div>
  );
}
