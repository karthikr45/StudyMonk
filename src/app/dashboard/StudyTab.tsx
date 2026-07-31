'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/client/api';

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

export default function StudyTab() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ subjects: Subject[] }>('/api/content/subjects')
      .then((d) => setSubjects(d.subjects))
      .finally(() => setLoading(false));
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
    return <p className="text-sm text-slate-500">No subjects published for your class yet.</p>;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {/* Subjects */}
      <div className="card">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Subjects</h3>
        <ul className="space-y-1">
          {subjects.map((s) => (
            <li key={s.id}>
              <button onClick={() => openSubject(s)}
                className={`w-full rounded-md px-3 py-2 text-left text-sm ${subject?.id === s.id ? 'bg-brand-light text-brand-dark' : 'hover:bg-slate-50'}`}>
                {s.name}
                <span className="ml-1 text-xs text-slate-400">({s._count.chapters})</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Chapters */}
      <div className="card">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Chapters</h3>
        {!subject && <p className="text-sm text-slate-400">Select a subject.</p>}
        {subject && chapters.length === 0 && <p className="text-sm text-slate-400">No chapters yet.</p>}
        <ul className="space-y-1">
          {chapters.map((c) => (
            <li key={c.id}>
              <button onClick={() => openChapter(c)}
                className={`w-full rounded-md px-3 py-2 text-left text-sm ${chapter?.id === c.id ? 'bg-brand-light text-brand-dark' : 'hover:bg-slate-50'}`}>
                {c.name}
                <span className="ml-1 text-xs text-slate-400">({c._count.materials})</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Materials */}
      <div className="card">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Materials</h3>
        {!chapter && <p className="text-sm text-slate-400">Select a chapter.</p>}
        {chapter && materials.length === 0 && <p className="text-sm text-slate-400">No materials yet.</p>}
        <ul className="space-y-2">
          {materials.map((m) => (
            <li key={m.id} className="rounded-md border border-slate-200 p-3">
              <p className="text-sm font-medium text-slate-800">{m.title}</p>
              {m.description && <p className="mt-0.5 text-xs text-slate-500">{m.description}</p>}
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-slate-400">{m.type} · {fmtSize(m.fileSize)}</span>
                <button className="text-sm font-medium text-brand hover:underline" onClick={() => download(m)}>
                  Open
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
