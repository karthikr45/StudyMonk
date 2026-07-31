'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/client/api';
import { IconBook, IconFile, IconDownload, IconChevron } from '@/components/icons';

interface Subject { id: string; name: string; code: string; _count: { chapters: number } }
interface Chapter { id: string; name: string; orderIndex: number; _count: { materials: number } }
interface Material {
  id: string; title: string; description: string | null; type: string;
  fileName: string; fileSize: number; contentType: string;
}

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card flex flex-col">
      <div className="section-title mb-3"><span className="text-brand-500"><IconBook /></span>{title}</div>
      {children}
    </div>
  );
}

function Row({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: string }) {
  return (
    <button className={`row ${active ? 'row-active' : ''}`} onClick={onClick}>
      <span>{label}</span>
      <span className="flex items-center gap-2"><span className="pill">{count}</span><IconChevron width={15} height={15} className="text-slate-300" /></span>
    </button>
  );
}

export default function StudyTab() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ subjects: Subject[] }>('/api/content/subjects')
      .then((d) => setSubjects(d.subjects)).finally(() => setLoading(false));
  }, []);

  async function openSubject(s: Subject) {
    setSubject(s); setChapter(null); setMaterials([]);
    const d = await api.get<{ chapters: Chapter[] }>(`/api/content/chapters?subjectId=${s.id}`);
    setChapters(d.chapters);
  }
  async function openChapter(c: Chapter) {
    setChapter(c);
    const d = await api.get<{ materials: Material[] }>(`/api/content/materials?chapterId=${c.id}`);
    setMaterials(d.materials);
  }
  async function download(m: Material) {
    const d = await api.get<{ url: string }>(`/api/content/materials/${m.id}/download`);
    window.open(d.url, '_blank', 'noopener');
  }

  if (loading) return <p className="text-sm text-slate-500">Loading subjects…</p>;
  if (subjects.length === 0)
    return (
      <div className="card grid place-items-center py-16 text-center">
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-500"><IconBook width={24} height={24} /></span>
        <p className="text-sm font-medium text-slate-700">No content published for your class yet</p>
        <p className="mt-1 text-sm text-slate-400">Check back once your admin adds subjects and materials.</p>
      </div>
    );

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
      <Panel title="Subjects">
        <ul className="space-y-1">
          {subjects.map((s) => (
            <li key={s.id}><Row active={subject?.id === s.id} onClick={() => openSubject(s)} label={s.name} count={`${s._count.chapters}`} /></li>
          ))}
        </ul>
      </Panel>

      <Panel title="Chapters">
        {!subject && <p className="text-sm text-slate-400">Select a subject.</p>}
        {subject && chapters.length === 0 && <p className="text-sm text-slate-400">No chapters yet.</p>}
        <ul className="space-y-1">
          {chapters.map((c) => (
            <li key={c.id}><Row active={chapter?.id === c.id} onClick={() => openChapter(c)} label={`${c.orderIndex}. ${c.name}`} count={`${c._count.materials}`} /></li>
          ))}
        </ul>
      </Panel>

      <div className="card flex flex-col">
        <div className="section-title mb-3"><span className="text-brand-500"><IconFile /></span>Materials</div>
        {!chapter && <p className="text-sm text-slate-400">Select a chapter.</p>}
        {chapter && materials.length === 0 && <p className="text-sm text-slate-400">No materials yet.</p>}
        <ul className="space-y-2">
          {materials.map((m) => (
            <li key={m.id} className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-start gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><IconFile width={17} height={17} /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800">{m.title}</p>
                  {m.description && <p className="mt-0.5 text-xs text-slate-500">{m.description}</p>}
                  <div className="mt-2 flex items-center justify-between">
                    <span className="pill">{m.type} · {fmtSize(m.fileSize)}</span>
                    <button className="btn-ghost btn-sm" onClick={() => download(m)}><IconDownload width={15} height={15} />Open</button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
