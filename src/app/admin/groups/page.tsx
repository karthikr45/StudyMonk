'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMe } from '@/lib/client/useAuth';
import { api } from '@/lib/client/api';
import Header from '@/components/Header';
import { IconUsers, IconChat, IconFile, IconBook } from '@/components/icons';

interface G {
  id: string; name: string; description: string | null;
  board?: string; class?: string; academicYear: string; school: string;
  createdBy: { fullName: string };
  counts: { members: number; posts: number; resources: number; cardSets: number; polls: number };
}

export default function AdminGroupsPage() {
  const { user, loading } = useMe();
  const router = useRouter();
  const [groups, setGroups] = useState<G[]>([]);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
    if (!loading && user && user.role !== 'SUPER_ADMIN') router.replace('/dashboard');
  }, [user, loading, router]);
  useEffect(() => { api.get<{ groups: G[] }>('/api/admin/groups').then((d) => setGroups(d.groups)).catch(() => {}); }, []);

  if (loading || !user || user.role !== 'SUPER_ADMIN') return <main className="p-10 text-sm text-slate-500">Loading…</main>;

  return (
    <div className="min-h-screen">
      <Header user={user} subtitle="Group monitoring" />
      <main className="mx-auto max-w-6xl px-6 py-8 animate-fade-in">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Study groups</h1>
            <p className="mt-1 text-sm text-slate-500">Monitor every student study group — members, chat, files, cards, polls.</p>
          </div>
          <Link href="/admin" className="btn-ghost">← Catalog</Link>
        </div>

        {groups.length === 0 && <p className="card text-sm text-slate-400">No study groups yet.</p>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <Link key={g.id} href={`/admin/groups/${g.id}`} className="card transition hover:-translate-y-0.5 hover:shadow-lift">
              <p className="text-base font-bold text-slate-900">{g.name}</p>
              <p className="text-xs text-slate-400">{g.board} · {g.class} · {g.academicYear}</p>
              <p className="mt-1 text-xs text-slate-500">🏫 {g.school}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                <span className="flex items-center gap-1"><IconUsers width={13} height={13} />{g.counts.members}</span>
                <span className="flex items-center gap-1"><IconChat width={13} height={13} />{g.counts.posts}</span>
                <span className="flex items-center gap-1"><IconFile width={13} height={13} />{g.counts.resources}</span>
                <span className="flex items-center gap-1"><IconBook width={13} height={13} />{g.counts.cardSets}</span>
                <span className="flex items-center gap-1">📊 {g.counts.polls}</span>
              </div>
              <p className="mt-2 text-xs text-slate-400">by {g.createdBy.fullName}</p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
