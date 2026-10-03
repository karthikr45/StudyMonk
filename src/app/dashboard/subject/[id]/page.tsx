'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useRemote } from '@/lib/client/useRemote';
import LoadError from '@/components/LoadError';
import { api } from '@/lib/client/api';
import { useMe } from '@/lib/client/useAuth';
import Header from '@/components/Header';
import {
  IconBook,
  IconUsers,
  IconFile,
  IconDownload,
  IconChevron,
} from '@/components/icons';

interface Subject {
  id: string;
  name: string;
  code: string;
  studentCount: number;
  chapterCount: number;
}
interface Chapter {
  id: string;
  name: string;
  orderIndex: number;
  materialCount: number;
  studentCount: number;
}
interface Material {
  id: string;
  title: string;
  description: string | null;
  type: string;
  fileName: string;
  fileSize: number;
  contentType: string;
}

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function SubjectPage() {
  const { user, loading } = useMe();
  const learningKey = `${user?.id}-${user?.enrollments?.find((e) => e.status === 'ACTIVE')?.id ?? 'none'}`;
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const {
    data,
    loading: contentLoading,
    error: contentError,
    retry,
  } = useRemote<{ subject: Subject; chapters: Chapter[] }>(
    `/api/content/subjects/${params.id}`,
  );
  const subject = data?.subject;
  const chapters = data?.chapters ?? [];
  const [openId, setOpenId] = useState<string | null>(null);
  const [materials, setMaterials] = useState<Record<string, Material[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [completed, setCompleted] = useState<string[]>([]);
  const [bookmarked, setBookmarked] = useState<string[]>([]);
  useEffect(() => {
    if (!user || !subject) return;
    try {
      localStorage.setItem(
        `sm-recent-${learningKey}`,
        JSON.stringify({ id: subject.id, name: subject.name }),
      );
      setCompleted(
        JSON.parse(localStorage.getItem(`sm-complete-${learningKey}`) || '[]'),
      );
      setBookmarked(
        JSON.parse(localStorage.getItem(`sm-bookmarks-${learningKey}`) || '[]'),
      );
    } catch {
      /* Optional device preferences. */
    }
  }, [user, subject, learningKey]);
  function togglePreference(kind: 'complete' | 'bookmarks', id: string) {
    const values = kind === 'complete' ? completed : bookmarked;
    const next = values.includes(id)
      ? values.filter((value) => value !== id)
      : [...values, id];
    if (kind === 'complete') setCompleted(next);
    else setBookmarked(next);
    try {
      localStorage.setItem(`sm-${kind}-${learningKey}`, JSON.stringify(next));
    } catch {
      setError('Your browser could not save this preference.');
    }
  }

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
    if (!loading && user?.role === 'SUPER_ADMIN') router.replace('/admin');
  }, [user, loading, router]);

  async function loadMaterials(c: Chapter) {
    setError(null);
    try {
      const d = await api.get<{ materials: Material[] }>(
        `/api/content/materials?chapterId=${c.id}`,
      );
      setMaterials((m) => ({ ...m, [c.id]: d.materials }));
    } catch {
      setError(
        'Could not load materials. Close and reopen this chapter to retry.',
      );
    }
  }
  async function toggle(c: Chapter) {
    if (openId === c.id) {
      setOpenId(null);
      return;
    }
    setOpenId(c.id);
    void api
      .post(`/api/content/chapters/${c.id}/activity`)
      .catch(() =>
        setError(
          'Your study activity could not be recorded. Check your connection.',
        ),
      );
    if (!materials[c.id]) await loadMaterials(c);
  }
  async function download(m: Material) {
    setError(null);
    // Open synchronously to avoid popup blockers after awaiting the signed URL.
    const target = window.open('about:blank', '_blank');
    if (target) target.opener = null;
    try {
      const d = await api.get<{ url: string }>(
        `/api/content/materials/${m.id}/download`,
      );
      if (target) target.location.href = d.url;
      else
        setError(
          'Your browser blocked the new tab. Allow popups for this site and try Open again.',
        );
    } catch {
      target?.close();
      setError('Could not open this material. Please try again.');
    }
  }

  if (loading || !user)
    return (
      <main className="grid min-h-screen place-items-center text-sm text-slate-500">
        Loading…
      </main>
    );

  const subtitle =
    user.board && user.class
      ? `${user.board.name} · ${user.class.name}`
      : undefined;

  return (
    <div className="min-h-screen">
      <Header user={user} subtitle={subtitle} />
      <main className="mx-auto max-w-4xl px-6 py-8 animate-fade-in">
        <Link
          href="/dashboard"
          className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-600"
        >
          <IconChevron width={15} height={15} className="rotate-180" /> Back to
          subjects
        </Link>

        {contentLoading && <p role="status">Loading chapters…</p>}
        {contentError && <LoadError message={contentError} retry={retry} />}
        {error && (
          <p role="alert" className="card text-red-700">
            {error}
          </p>
        )}

        {subject && (
          <>
            <div className="card mb-6 flex items-center gap-4">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lift">
                <IconBook width={26} height={26} />
              </span>
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-slate-900">
                  {subject.name}
                </h1>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <IconBook width={15} height={15} />
                    {subject.chapterCount} chapters
                  </span>
                  <span className="flex items-center gap-1.5">
                    <IconUsers width={15} height={15} />
                    {subject.studentCount} students enrolled
                  </span>
                </div>
              </div>
            </div>

            <h2 className="mb-3 text-lg font-bold text-slate-900">Chapters</h2>
            <label className="label" htmlFor="chapter-search">
              Find a chapter
            </label>
            <input
              id="chapter-search"
              className="input mb-3"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <p className="mb-3 text-sm text-slate-600">
              Bookmarks and completion are saved on this device.
            </p>
            {chapters.length === 0 && (
              <p className="card text-sm text-slate-400">
                No chapters published yet.
              </p>
            )}
            <ul className="space-y-3">
              {chapters
                .filter((c) =>
                  c.name.toLowerCase().includes(query.toLowerCase()),
                )
                .map((c) => (
                  <li key={c.id} className="card !p-0 overflow-hidden">
                    <button
                      aria-expanded={openId === c.id}
                      aria-controls={`chapter-${c.id}`}
                      onClick={() => toggle(c)}
                      className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-slate-50"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-sm font-bold text-brand-600">
                          {c.orderIndex}
                        </span>
                        <div>
                          <p className="font-semibold text-slate-900">
                            {c.name}
                            {completed.includes(c.id) ? ' · Completed' : ''}
                            {bookmarked.includes(c.id) ? ' · Bookmarked' : ''}
                          </p>
                          <p className="mt-0.5 flex items-center gap-3 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <IconFile width={13} height={13} />
                              {c.materialCount} file
                              {c.materialCount === 1 ? '' : 's'}
                            </span>
                            <span className="flex items-center gap-1">
                              <IconUsers width={13} height={13} />
                              {c.studentCount} enrolled
                            </span>
                          </p>
                        </div>
                      </div>
                      <IconChevron
                        className={`shrink-0 text-slate-300 transition ${openId === c.id ? 'rotate-90' : ''}`}
                      />
                    </button>

                    {openId === c.id && (
                      <div
                        id={`chapter-${c.id}`}
                        className="border-t border-slate-100 bg-slate-50/50 px-5 py-4"
                      >
                        <div className="mb-3 flex flex-wrap gap-2">
                          <button
                            className="btn-ghost btn-sm"
                            aria-pressed={completed.includes(c.id)}
                            onClick={() => togglePreference('complete', c.id)}
                          >
                            {completed.includes(c.id)
                              ? 'Mark incomplete'
                              : 'Mark completed'}
                          </button>
                          <button
                            className="btn-ghost btn-sm"
                            aria-pressed={bookmarked.includes(c.id)}
                            onClick={() => togglePreference('bookmarks', c.id)}
                          >
                            {bookmarked.includes(c.id)
                              ? 'Remove bookmark'
                              : 'Bookmark'}
                          </button>
                        </div>
                        {!materials[c.id] && !error && (
                          <p className="text-sm text-slate-400">
                            Loading materials…
                          </p>
                        )}
                        {materials[c.id]?.length === 0 && (
                          <p className="text-sm text-slate-400">
                            No materials in this chapter yet.
                          </p>
                        )}
                        <ul className="space-y-2">
                          {materials[c.id]?.map((m) => (
                            <li
                              key={m.id}
                              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3"
                            >
                              <div className="flex min-w-0 items-center gap-2.5">
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                                  <IconFile width={17} height={17} />
                                </span>
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-slate-800">
                                    {m.title}
                                  </p>
                                  <p className="truncate text-xs text-slate-400">
                                    {m.type} · {fmtSize(m.fileSize)}
                                  </p>
                                </div>
                              </div>
                              <button
                                className="btn-ghost btn-sm shrink-0"
                                onClick={() => download(m)}
                              >
                                <IconDownload width={15} height={15} />
                                Open
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </li>
                ))}
            </ul>
          </>
        )}
      </main>
    </div>
  );
}
