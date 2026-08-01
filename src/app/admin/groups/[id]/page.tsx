'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMe } from '@/lib/client/useAuth';
import { api } from '@/lib/client/api';
import Header from '@/components/Header';

interface Detail {
  name: string; description: string | null; academicYear: string; schoolName: string;
  board: { name: string } | null; class: { name: string } | null;
  members: { role: string; user: { fullName: string } }[];
  posts: { id: string; body: string; createdAt: string; editedAt: string | null; author: { fullName: string } }[];
  resources: { id: string; title: string; fileName: string; uploader: { fullName: string } }[];
  cardSets: { id: string; title: string; createdBy: { fullName: string }; cards: { front: string; back: string }[] }[];
  polls: { id: string; type: string; question: string; createdBy: { fullName: string }; options: { text: string; isCorrect: boolean; _count: { votes: number } }[] }[];
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="card">
      <div className="section-title mb-3">{title} <span className="pill ml-1">{count}</span></div>
      {children}
    </div>
  );
}

export default function AdminGroupDetail() {
  const { user, loading } = useMe();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [g, setG] = useState<Detail | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
    if (!loading && user && user.role !== 'SUPER_ADMIN') router.replace('/dashboard');
  }, [user, loading, router]);
  useEffect(() => { if (params?.id) api.get<{ group: Detail }>(`/api/admin/groups/${params.id}`).then((d) => setG(d.group)).catch(() => {}); }, [params?.id]);

  if (loading || !user) return <main className="grid min-h-screen place-items-center text-sm text-slate-500">Loading…</main>;

  return (
    <div className="min-h-screen">
      <Header user={user} subtitle="Group monitor" />
      <main className="mx-auto max-w-4xl px-6 py-8 animate-fade-in">
        <Link href="/admin/groups" className="mb-4 inline-block text-sm text-slate-500 hover:text-brand-600">← All groups</Link>
        {g && (
          <>
            <div className="card mb-5">
              <h1 className="text-2xl font-bold text-slate-900">{g.name}</h1>
              <p className="text-sm text-slate-500">{g.board?.name} · {g.class?.name} · {g.academicYear} · {g.schoolName}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {g.members.map((m, i) => <span key={i} className={m.role === 'OWNER' ? 'pill-brand' : 'pill'}>{m.user.fullName}{m.role === 'OWNER' ? ' ★' : ''}</span>)}
              </div>
            </div>

            <div className="space-y-5">
              <Section title="Chat" count={g.posts.length}>
                <ul className="space-y-2">
                  {g.posts.length === 0 && <li className="text-sm text-slate-400">No messages.</li>}
                  {g.posts.map((p) => (
                    <li key={p.id} className="rounded-lg bg-slate-50 p-2.5">
                      <p className="text-sm text-slate-800">{p.body}</p>
                      <p className="mt-1 text-xs text-slate-400">{p.author.fullName} · {new Date(p.createdAt).toLocaleString()}{p.editedAt ? ' · edited' : ''}</p>
                    </li>
                  ))}
                </ul>
              </Section>

              <Section title="Shared files" count={g.resources.length}>
                <ul className="space-y-1.5">
                  {g.resources.length === 0 && <li className="text-sm text-slate-400">No files.</li>}
                  {g.resources.map((r) => (
                    <li key={r.id} className="flex justify-between rounded-lg border border-slate-200 p-2 text-sm">
                      <span className="truncate">{r.title} <span className="text-xs text-slate-400">({r.fileName})</span></span>
                      <span className="shrink-0 text-xs text-slate-400">{r.uploader.fullName}</span>
                    </li>
                  ))}
                </ul>
              </Section>

              <Section title="Card decks" count={g.cardSets.length}>
                <ul className="space-y-2">
                  {g.cardSets.length === 0 && <li className="text-sm text-slate-400">No decks.</li>}
                  {g.cardSets.map((s) => (
                    <li key={s.id} className="rounded-lg border border-slate-200 p-2.5">
                      <p className="text-sm font-medium text-slate-800">{s.title} <span className="pill">{s.cards.length}</span> <span className="text-xs text-slate-400">by {s.createdBy.fullName}</span></p>
                    </li>
                  ))}
                </ul>
              </Section>

              <Section title="Polls & quizzes" count={g.polls.length}>
                <ul className="space-y-2">
                  {g.polls.length === 0 && <li className="text-sm text-slate-400">None.</li>}
                  {g.polls.map((p) => (
                    <li key={p.id} className="rounded-lg border border-slate-200 p-2.5">
                      <p className="text-sm font-medium text-slate-800">{p.question} <span className="pill">{p.type.toLowerCase()}</span></p>
                      <div className="mt-1 space-y-0.5">
                        {p.options.map((o, i) => (
                          <p key={i} className="text-xs text-slate-500">{o.text}{o.isCorrect ? ' ✓' : ''} — {o._count.votes} votes</p>
                        ))}
                      </div>
                      <p className="mt-1 text-xs text-slate-400">by {p.createdBy.fullName}</p>
                    </li>
                  ))}
                </ul>
              </Section>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
