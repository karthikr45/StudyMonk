'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMe } from '@/lib/client/useAuth';
import { api } from '@/lib/client/api';
import { useRemote } from '@/lib/client/useRemote';
import Header from '@/components/Header';
import LoadError from '@/components/LoadError';
interface History {
  enrollments: { id: string; status: string; batch: { label: string } }[];
  attempts: {
    id: string;
    enrollmentId: string | null;
    status: string;
    assessment: { title: string; type: string };
  }[];
  groups: { id: string; name: string; batch: { label: string } }[];
}
function Archive({ id }: { id: string }) {
  const [error, setError] = useState('');
  const [before, setBefore] = useState('');
  const r = useRemote<{
    name: string;
    posts: {
      id: string;
      body: string;
      createdAt: string;
      author: { fullName: string };
    }[];
    nextCursor: string | null;
    resources: { id: string; title: string; fileName: string }[];
  }>(
    `/api/content/history/groups/${id}${before ? `?before=${encodeURIComponent(before)}` : ''}`,
  );
  return (
    <section className="card mt-4">
      <h3 className="font-bold">
        {r.data?.name ?? 'Archived conversation'} · Read only
      </h3>
      {r.loading && <p>Loading…</p>}
      {r.error && <LoadError message={r.error} retry={r.retry} />}
      <ul className="my-3 space-y-3">
        {r.data?.posts.map((p) => (
          <li key={p.id} className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs text-slate-500">
              {p.author.fullName} · {new Date(p.createdAt).toLocaleString()}
            </p>
            <p className="whitespace-pre-wrap break-words">{p.body}</p>
          </li>
        ))}
      </ul>
      <h4 className="font-semibold">Shared files</h4>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {r.data?.resources.map((file) => (
        <button
          key={file.id}
          className="btn-ghost m-1"
          onClick={async () => {
            const popup = window.open('about:blank', '_blank');
            if (popup) popup.opener = null;
            try {
              const result = await api.get<{ url: string }>(
                `/api/content/history/groups/${id}?resource=${encodeURIComponent(file.id)}`,
              );
              if (popup) popup.location.href = result.url;
              else setError('Allow popups to open this file.');
            } catch (e) {
              popup?.close();
              setError(e instanceof Error ? e.message : 'Download failed');
            }
          }}
        >
          {file.title} ↗
        </button>
      ))}
      {r.data?.nextCursor && (
        <button
          className="btn-ghost"
          onClick={() => setBefore(r.data!.nextCursor!)}
        >
          Older messages
        </button>
      )}
    </section>
  );
}
export default function HistoryPage() {
  const { user, loading } = useMe();
  const router = useRouter();
  const r = useRemote<History>('/api/content/history');
  const [group, setGroup] = useState('');
  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);
  if (!user) return <p className="p-8">Loading…</p>;
  return (
    <>
      <Header user={user} subtitle="My learning history" />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Link className="btn-ghost" href="/dashboard">
          ← Current workspace
        </Link>
        <h1 className="my-5 text-3xl font-bold">
          Your learning, year by year.
        </h1>
        {r.loading && <p>Loading history…</p>}
        {r.error && <LoadError message={r.error} retry={r.retry} />}
        <div className="space-y-5">
          {[
            ...(r.data?.enrollments ?? []),
            {
              id: 'unassigned',
              status: 'Needs admin review',
              batch: { label: 'Earlier records · batch not yet verified' },
            },
          ].map((e) => {
            const attempts =
              r.data?.attempts.filter(
                (a) => (a.enrollmentId ?? 'unassigned') === e.id,
              ) ?? [];
            if (e.id === 'unassigned' && !attempts.length) return null;
            return (
              <section className="card" key={e.id}>
                <h2 className="font-bold">{e.batch.label}</h2>
                <span className="pill mt-2">{e.status}</span>
                <ul className="mt-4 divide-y">
                  {attempts.map((a) => (
                    <li key={a.id} className="py-3">
                      <Link
                        className="text-brand-600 underline"
                        href={`/dashboard/attempt/${a.id}/result`}
                      >
                        {a.assessment.title} →
                      </Link>
                      <span className="ml-3 text-xs">{a.status}</span>
                    </li>
                  ))}
                </ul>
                {!attempts.length && (
                  <p className="mt-3 text-sm text-slate-500">
                    No submitted assessments in this enrollment.
                  </p>
                )}
              </section>
            );
          })}
        </div>
        <h2 className="mt-8 mb-3 text-xl font-bold">
          Archived group conversations
        </h2>
        <p className="mb-4 text-sm text-slate-600">
          Only original members with a completed or graduated enrollment can
          read their archive. Transfers and withdrawals do not retain access to
          former school chats.
        </p>
        {r.data?.groups.map((g) => (
          <button
            key={g.id}
            className="btn-ghost mb-2 mr-2"
            onClick={() => setGroup(g.id)}
          >
            {g.name} · {g.batch.label}
          </button>
        ))}
        {group && <Archive key={group} id={group} />}
      </main>
    </>
  );
}
