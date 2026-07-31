'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/client/api';
import { uploadMaterial } from '@/lib/client/upload';

interface Board { id: string; name: string; code: string; isActive: boolean; _count: { classes: number; users: number } }
interface Klass { id: string; name: string; level: number; board: { name: string }; _count: { subjects: number } }
interface Subject { id: string; name: string; code: string; _count: { chapters: number } }
interface Chapter { id: string; name: string; orderIndex: number; _count: { materials: number } }
interface Material { id: string; title: string; type: string; fileName: string; fileSize: number }

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      {children}
    </div>
  );
}

export default function CatalogManager() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [classes, setClasses] = useState<Klass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);

  const [board, setBoard] = useState<Board | null>(null);
  const [klass, setKlass] = useState<Klass | null>(null);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [error, setError] = useState<string | null>(null);

  // form state
  const [bName, setBName] = useState(''); const [bCode, setBCode] = useState('');
  const [cName, setCName] = useState(''); const [cLevel, setCLevel] = useState('');
  const [sName, setSName] = useState(''); const [sCode, setSCode] = useState('');
  const [chName, setChName] = useState(''); const [chOrder, setChOrder] = useState('');
  const [mTitle, setMTitle] = useState(''); const [mDesc, setMDesc] = useState('');
  const [mFile, setMFile] = useState<File | null>(null); const [uploading, setUploading] = useState(false);

  function err(e: unknown) { setError(e instanceof ApiError ? e.message : String(e)); }

  async function loadBoards() {
    const d = await api.get<{ boards: Board[] }>('/api/admin/boards'); setBoards(d.boards);
  }
  useEffect(() => { loadBoards().catch(err); }, []);

  async function selectBoard(b: Board) {
    setBoard(b); setKlass(null); setSubject(null); setChapter(null);
    setSubjects([]); setChapters([]); setMaterials([]);
    const d = await api.get<{ classes: Klass[] }>(`/api/admin/classes?boardId=${b.id}`); setClasses(d.classes);
  }
  async function selectClass(c: Klass) {
    setKlass(c); setSubject(null); setChapter(null); setChapters([]); setMaterials([]);
    const d = await api.get<{ subjects: Subject[] }>(`/api/admin/subjects?classId=${c.id}`); setSubjects(d.subjects);
  }
  async function selectSubject(s: Subject) {
    setSubject(s); setChapter(null); setMaterials([]);
    const d = await api.get<{ chapters: Chapter[] }>(`/api/admin/chapters?subjectId=${s.id}`); setChapters(d.chapters);
  }
  async function selectChapter(c: Chapter) {
    setChapter(c);
    const d = await api.get<{ materials: Material[] }>(`/api/admin/materials?chapterId=${c.id}`); setMaterials(d.materials);
  }

  async function addBoard(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    try { await api.post('/api/admin/boards', { name: bName, code: bCode }); setBName(''); setBCode(''); await loadBoards(); }
    catch (e) { err(e); }
  }
  async function addClass(e: React.FormEvent) {
    e.preventDefault(); setError(null); if (!board) return;
    try { await api.post('/api/admin/classes', { boardId: board.id, name: cName, level: Number(cLevel) }); setCName(''); setCLevel(''); await selectBoard(board); }
    catch (e) { err(e); }
  }
  async function addSubject(e: React.FormEvent) {
    e.preventDefault(); setError(null); if (!klass) return;
    try { await api.post('/api/admin/subjects', { classId: klass.id, name: sName, code: sCode }); setSName(''); setSCode(''); await selectClass(klass); }
    catch (e) { err(e); }
  }
  async function addChapter(e: React.FormEvent) {
    e.preventDefault(); setError(null); if (!subject) return;
    try { await api.post('/api/admin/chapters', { subjectId: subject.id, name: chName, orderIndex: chOrder ? Number(chOrder) : undefined }); setChName(''); setChOrder(''); await selectSubject(subject); }
    catch (e) { err(e); }
  }
  async function addMaterial(e: React.FormEvent) {
    e.preventDefault(); setError(null); if (!chapter || !mFile) return;
    setUploading(true);
    try { await uploadMaterial(chapter.id, mFile, mTitle, mDesc); setMTitle(''); setMDesc(''); setMFile(null); await selectChapter(chapter); }
    catch (e) { err(e); }
    finally { setUploading(false); }
  }
  async function delMaterial(m: Material) {
    if (!chapter) return;
    try { await api.del(`/api/admin/materials/${m.id}`); await selectChapter(chapter); } catch (e) { err(e); }
  }

  const listItem = 'w-full rounded-md px-3 py-2 text-left text-sm hover:bg-slate-50';
  const active = 'bg-brand-light text-brand-dark';

  return (
    <div className="space-y-4">
      {error && <div className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Boards */}
        <Section title="Boards">
          <form onSubmit={addBoard} className="mb-3 space-y-2">
            <input className="input" placeholder="Name e.g. CBSE" value={bName} onChange={(e) => setBName(e.target.value)} required />
            <input className="input" placeholder="Code e.g. cbse" value={bCode} onChange={(e) => setBCode(e.target.value)} required />
            <button className="btn w-full">Add board</button>
          </form>
          <ul className="space-y-1">
            {boards.map((b) => (
              <li key={b.id}>
                <button className={`${listItem} ${board?.id === b.id ? active : ''}`} onClick={() => selectBoard(b)}>
                  {b.name} <span className="text-xs text-slate-400">({b._count.classes} classes)</span>
                  {!b.isActive && <span className="ml-1 text-xs text-red-400">inactive</span>}
                </button>
              </li>
            ))}
          </ul>
        </Section>

        {/* Classes */}
        <Section title={board ? `Classes · ${board.name}` : 'Classes'}>
          {!board && <p className="text-sm text-slate-400">Select a board.</p>}
          {board && (
            <>
              <form onSubmit={addClass} className="mb-3 space-y-2">
                <input className="input" placeholder="Name e.g. Class 10" value={cName} onChange={(e) => setCName(e.target.value)} required />
                <input className="input" type="number" placeholder="Level e.g. 10" value={cLevel} onChange={(e) => setCLevel(e.target.value)} required />
                <button className="btn w-full">Add class</button>
              </form>
              <ul className="space-y-1">
                {classes.map((c) => (
                  <li key={c.id}>
                    <button className={`${listItem} ${klass?.id === c.id ? active : ''}`} onClick={() => selectClass(c)}>
                      {c.name} <span className="text-xs text-slate-400">({c._count.subjects} subjects)</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Section>

        {/* Subjects */}
        <Section title={klass ? `Subjects · ${klass.name}` : 'Subjects'}>
          {!klass && <p className="text-sm text-slate-400">Select a class.</p>}
          {klass && (
            <>
              <form onSubmit={addSubject} className="mb-3 space-y-2">
                <input className="input" placeholder="Name e.g. Mathematics" value={sName} onChange={(e) => setSName(e.target.value)} required />
                <input className="input" placeholder="Code e.g. math" value={sCode} onChange={(e) => setSCode(e.target.value)} required />
                <button className="btn w-full">Add subject</button>
              </form>
              <ul className="space-y-1">
                {subjects.map((s) => (
                  <li key={s.id}>
                    <button className={`${listItem} ${subject?.id === s.id ? active : ''}`} onClick={() => selectSubject(s)}>
                      {s.name} <span className="text-xs text-slate-400">({s._count.chapters} chapters)</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Section>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Chapters */}
        <Section title={subject ? `Chapters · ${subject.name}` : 'Chapters'}>
          {!subject && <p className="text-sm text-slate-400">Select a subject.</p>}
          {subject && (
            <>
              <form onSubmit={addChapter} className="mb-3 flex gap-2">
                <input className="input" placeholder="Chapter name" value={chName} onChange={(e) => setChName(e.target.value)} required />
                <input className="input w-24" type="number" placeholder="Order" value={chOrder} onChange={(e) => setChOrder(e.target.value)} />
                <button className="btn">Add</button>
              </form>
              <ul className="space-y-1">
                {chapters.map((c) => (
                  <li key={c.id}>
                    <button className={`${listItem} ${chapter?.id === c.id ? active : ''}`} onClick={() => selectChapter(c)}>
                      {c.orderIndex}. {c.name} <span className="text-xs text-slate-400">({c._count.materials} files)</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Section>

        {/* Materials */}
        <Section title={chapter ? `Materials · ${chapter.name}` : 'Materials'}>
          {!chapter && <p className="text-sm text-slate-400">Select a chapter.</p>}
          {chapter && (
            <>
              <form onSubmit={addMaterial} className="mb-3 space-y-2">
                <input className="input" placeholder="Title e.g. NCERT Chapter PDF" value={mTitle} onChange={(e) => setMTitle(e.target.value)} required />
                <input className="input" placeholder="Description (optional)" value={mDesc} onChange={(e) => setMDesc(e.target.value)} />
                <input className="block w-full text-sm" type="file" onChange={(e) => setMFile(e.target.files?.[0] ?? null)} required />
                <button className="btn w-full" disabled={uploading}>{uploading ? 'Uploading…' : 'Upload material'}</button>
              </form>
              <ul className="space-y-2">
                {materials.map((m) => (
                  <li key={m.id} className="flex items-center justify-between rounded-md border border-slate-200 p-2">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{m.title}</p>
                      <p className="text-xs text-slate-400">{m.type} · {m.fileName}</p>
                    </div>
                    <button className="text-xs text-slate-400 hover:text-red-600" onClick={() => delMaterial(m)}>Delete</button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Section>
      </div>
    </div>
  );
}
