'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/client/api';
import { useMe } from '@/lib/client/useAuth';
import Header from '@/components/Header';
import { IconBook, IconUsers, IconFile, IconDownload, IconChevron } from '@/components/icons';

interface Subject { id: string; name: string; code: string; studentCount: number; chapterCount: number }
interface Chapter { id: string; name: string; orderIndex: number; materialCount: number; studentCount: number }
interface Material {
  id: string; title: string; description: string | null; type: string;
  fileName: string; fileSize: number; contentType: string;
}

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function SubjectPage() {
  const { user, loading } = useMe();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [subject, setSubject] = useState<Subject | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [materials, setMaterials] = useState<Record<string, Material[]>>({});
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
    if (!loading && user?.role === 'SUPER_ADMIN') router.replace('/admin');
  }, [user, loading, router]);

  useEffect(() => {
    if (!params?.id) return;
    api.get<{ subject: Subject; chapters: Chapter[] }>(`/api/content/subjects/${params.id}`)
      .then((d) => { setSubject(d.subject); setChapters(d.chapters); })
      .catch(() => setNotFound(true));
  }, [params?.id]);

  async function toggle(c: Chapter) {
    if (openId === c.id) { setOpenId(null); return; }
    setOpenId(c.id);
    if (!materials[c.id]) {
      const d = await api.get<{ materials: Material[] }>(`/api/content/materials?chapterId=${c.id}`);
      setMaterials((m) => ({ ...m, [c.id]: d.materials }));
    }
  }
  async function download(m: Material) {
    const d = await api.get<{ url: string }>(`/api/content/materials/${m.id}/download`);
    window.open(d.url, '_blank', 'noopener');
  }

  if (loading || !user) return <main className="grid min-h-screen place-items-center text-sm text-slate-500">Loading…</main>;

  const subtitle = user.board && user.class ? `${user.board.name} · ${user.class.name}` : undefined;

  return (
    <div className="min-h-screen">
      <Header user={user} subtitle={subtitle} />
      <main className="mx-auto max-w-4xl px-6 py-8 animate-fade-in">
        <Link href="/dashboard" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-600">
          <IconChevron width={15} height={15} className="rotate-180" /> Back to subjects
        </Link>

        {notFound && <p className="card text-sm text-slate-500">This subject isn&apos;t available for your class.</p>}

        {subject && (
          <>
            <div className="card mb-6 flex items-center gap-4">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-lift">
                <IconBook width={26} height={26} />
              </span>
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-slate-900">{subject.name}</h1>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                  <span className="flex items-center gap-1.5"><IconBook width={15} height={15} />{subject.chapterCount} chapters</span>
                  <span className="flex items-center gap-1.5"><IconUsers width={15} height={15} />{subject.studentCount} students studying</span>
                </div>
              </div>
            </div>

            <h2 className="mb-3 text-lg font-bold text-slate-900">Chapters</h2>
            {chapters.length === 0 && <p className="card text-sm text-slate-400">No chapters published yet.</p>}
            <ul className="space-y-3">
              {chapters.map((c) => (
                <li key={c.id} className="card !p-0 overflow-hidden">
                  <button onClick={() => toggle(c)} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-slate-50">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-sm font-bold text-brand-600">{c.orderIndex}</span>
                      <div>
                        <p className="font-semibold text-slate-900">{c.name}</p>
                        <p className="mt-0.5 flex items-center gap-3 text-xs text-slate-500">
                          <span className="flex items-center gap-1"><IconFile width={13} height={13} />{c.materialCount} file{c.materialCount === 1 ? '' : 's'}</span>
                          <span className="flex items-center gap-1"><IconUsers width={13} height={13} />{c.studentCount} studying</span>
                        </p>
                      </div>
                    </div>
                    <IconChevron className={`shrink-0 text-slate-300 transition ${openId === c.id ? 'rotate-90' : ''}`} />
                  </button>

                  {openId === c.id && (
                    <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-4">
                      {!materials[c.id] && <p className="text-sm text-slate-400">Loading materials…</p>}
                      {materials[c.id]?.length === 0 && <p className="text-sm text-slate-400">No materials in this chapter yet.</p>}
                      <ul className="space-y-2">
                        {materials[c.id]?.map((m) => (
                          <li key={m.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
                            <div className="flex min-w-0 items-center gap-2.5">
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><IconFile width={17} height={17} /></span>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-800">{m.title}</p>
                                <p className="truncate text-xs text-slate-400">{m.type} · {fmtSize(m.fileSize)}</p>
                              </div>
                            </div>
                            <button className="btn-ghost btn-sm shrink-0" onClick={() => download(m)}>
                              <IconDownload width={15} height={15} />Open
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
