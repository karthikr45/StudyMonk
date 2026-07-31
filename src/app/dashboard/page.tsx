'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMe } from '@/lib/client/useAuth';
import Header from '@/components/Header';
import StudyTab from './StudyTab';
import GroupsTab from './GroupsTab';

export default function Dashboard() {
  const { user, loading } = useMe();
  const router = useRouter();
  const [tab, setTab] = useState<'study' | 'groups'>('study');

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
    if (!loading && user?.role === 'SUPER_ADMIN') router.replace('/admin');
  }, [user, loading, router]);

  if (loading || !user) {
    return <main className="p-10 text-sm text-slate-500">Loading…</main>;
  }

  const subtitle = user.board && user.class
    ? `${user.board.name} · ${user.class.name} · ${user.academicYear} · ${user.schoolDisplay}`
    : undefined;

  return (
    <div className="min-h-screen">
      <Header user={user} subtitle={subtitle} />
      <main className="mx-auto max-w-6xl px-6 py-6">
        <div className="mb-6 flex gap-2">
          <button onClick={() => setTab('study')}
            className={tab === 'study' ? 'btn' : 'btn-ghost'}>Study</button>
          <button onClick={() => setTab('groups')}
            className={tab === 'groups' ? 'btn' : 'btn-ghost'}>Study groups</button>
        </div>
        {tab === 'study' ? <StudyTab /> : <GroupsTab />}
      </main>
    </div>
  );
}
