'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/client/api';
import { uploadMaterial } from '@/lib/client/upload';
import {
  IconBook, IconPlus, IconUpload, IconTrash, IconChevron, IconFile,
} from '@/components/icons';

interface Board { id: string; name: string; code: string; isActive: boolean; _count: { classes: number; users: number } }
interface Klass { id: string; name: string; level: number; board: { name: string }; _count: { subjects: number } }
interface Subject { id: string; name: string; code: string; _count: { chapters: number } }
interface Chapter { id: string; name: string; orderIndex: number; _count: { materials: number } }
interface Material { id: string; title: string; type: string; fileName: string; fileSize: number }

function Column({ title, icon, hint, children }: { title: string; icon: React.ReactNode; hint?: string; children: React.ReactNode }) {
  return (
    <div className="card flex flex-col">
      <div className="section-title mb-3">
        <span className="text-brand-500">{icon}</span>
        {title}
      </div>
      {hint && <p className="mb-3 text-sm text-slate-400">{hint}</p>}
      {children}
    </div>
  );
}

function Row({ active, onClick, label, count, muted }: { active: boolean; onClick: () => void; label: React.ReactNode; count?: string; muted?: boolean }) {
  return (
    <button className={`row ${active ? 'row-active' : ''}`} onClick={onClick}>
      <span className={muted ? 'text-slate-400' : ''}>{label}</span>
      <span className="flex items-center gap-2">
        {count && <span className="pill">{count}</span>}
        <IconChevron width={15} height={15} className="text-slate-300" />
      </span>
    </button>
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

  const [bName, setBName] = useState('');
  const [cName, setCName] = useState(''); const [cLevel, setCLevel] = useState('');
  const [sName, setSName] = useState('');
  const [chName, setChName] = useState(''); const [chOrder, setChOrder] = useState('');
  const [mTitle, setMTitle] = useState(''); const [mDesc, setMDesc] = useState('');
  const [mFile, setMFile] = useState<File | null>(null); const [uploading, setUploading] = useState(false);

  function err(e: unknown) { setError(e instanceof ApiError ? e.message : String(e)); }

  async function loadBoards() { const d = await api.get<{ boards: Board[] }>('/api/admin/boards'); setBoards(d.boards); }
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
    try { await api.post('/api/admin/boards', { name: bName, code: bName }); setBName(''); await loadBoards(); } catch (e) { err(e); }
  }
  async function addClass(e: React.FormEvent) {
    e.preventDefault(); setError(null); if (!board) return;
    try { await api.post('/api/admin/classes', { boardId: board.id, name: cName, level: Number(cLevel) }); setCName(''); setCLevel(''); await selectBoard(board); } catch (e) { err(e); }
  }
  async function addSubject(e: React.FormEvent) {
    e.preventDefault(); setError(null); if (!klass) return;
    try { await api.post('/api/admin/subjects', { classId: klass.id, name: sName, code: sName }); setSName(''); await selectClass(klass); } catch (e) { err(e); }
  }
  async function addChapter(e: React.FormEvent) {
    e.preventDefault(); setError(null); if (!subject) return;
    try { await api.post('/api/admin/chapters', { subjectId: subject.id, name: chName, orderIndex: chOrder ? Number(chOrder) : undefined }); setChName(''); setChOrder(''); await selectSubject(subject); } catch (e) { err(e); }
  }
  async function addMaterial(e: React.FormEvent) {
    e.preventDefault(); setError(null); if (!chapter || !mFile) return;
    setUploading(true);
    try { await uploadMaterial(chapter.id, mFile, mTitle, mDesc); setMTitle(''); setMDesc(''); setMFile(null); await selectChapter(chapter); }
    catch (e) { err(e); } finally { setUploading(false); }
  }
  async function delMaterial(m: Material) {
    if (!chapter) return;
    try { await api.del(`/api/admin/materials/${m.id}`); await selectChapter(chapter); } catch (e) { err(e); }
  }

  const crumbs = [board?.name, klass?.name, subject?.name, chapter?.name].filter(Boolean) as string[];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex flex-wrap items-center gap-1.5 text-sm text-slate-500">
        <span className="font-medium text-slate-700">Catalog</span>
        {crumbs.map((c) => (
          <span key={c} className="flex items-center gap-1.5">
            <IconChevron width={13} height={13} className="text-slate-300" />
            <span className="text-slate-700">{c}</span>
          </span>
        ))}
      </div>

      {error && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Column title="Boards" icon={<IconBook />}>
          <form onSubmit={addBoard} className="mb-4 flex gap-2">
            <input className="input" placeholder="Board name e.g. CBSE" value={bName} onChange={(e) => setBName(e.target.value)} required />
            <button className="btn btn-sm shrink-0" aria-label="Add board"><IconPlus width={15} height={15} /></button>
          </form>
          <ul className="space-y-1">
            {boards.length === 0 && <li className="px-1 text-sm text-slate-400">No boards yet. Add one above.</li>}
            {boards.map((b) => (
              <li key={b.id}>
                <Row active={board?.id === b.id} onClick={() => selectBoard(b)}
                  label={<>{b.name}{!b.isActive && <span className="ml-1 text-xs text-red-400">inactive</span>}</>}
                  count={`${b._count.classes}`} />
              </li>
            ))}
          </ul>
        </Column>

        <Column title="Classes" icon={<IconBook />} hint={!board ? 'Select a board first.' : undefined}>
          {board && (
            <>
              <form onSubmit={addClass} className="mb-4 flex gap-2">
                <input className="input" placeholder="e.g. Class 10" value={cName} onChange={(e) => setCName(e.target.value)} required />
                <input className="input w-20 shrink-0" type="number" placeholder="Lvl" value={cLevel} onChange={(e) => setCLevel(e.target.value)} required />
                <button className="btn btn-sm shrink-0" aria-label="Add class"><IconPlus width={15} height={15} /></button>
              </form>
              <ul className="space-y-1">
                {classes.length === 0 && <li className="px-1 text-sm text-slate-400">No classes yet.</li>}
                {classes.map((c) => (
                  <li key={c.id}><Row active={klass?.id === c.id} onClick={() => selectClass(c)} label={c.name} count={`${c._count.subjects}`} /></li>
                ))}
              </ul>
            </>
          )}
        </Column>

        <Column title="Subjects" icon={<IconBook />} hint={!klass ? 'Select a class first.' : undefined}>
          {klass && (
            <>
              <form onSubmit={addSubject} className="mb-4 flex gap-2">
                <input className="input" placeholder="e.g. Mathematics" value={sName} onChange={(e) => setSName(e.target.value)} required />
                <button className="btn btn-sm shrink-0" aria-label="Add subject"><IconPlus width={15} height={15} /></button>
              </form>
              <ul className="space-y-1">
                {subjects.length === 0 && <li className="px-1 text-sm text-slate-400">No subjects yet.</li>}
                {subjects.map((s) => (
                  <li key={s.id}><Row active={subject?.id === s.id} onClick={() => selectSubject(s)} label={s.name} count={`${s._count.chapters}`} /></li>
                ))}
              </ul>
            </>
          )}
        </Column>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Column title="Chapters" icon={<IconBook />} hint={!subject ? 'Select a subject first.' : undefined}>
          {subject && (
            <>
              <form onSubmit={addChapter} className="mb-4 flex gap-2">
                <input className="input" placeholder="Chapter name" value={chName} onChange={(e) => setChName(e.target.value)} required />
                <input className="input w-20 shrink-0" type="number" placeholder="Ord" value={chOrder} onChange={(e) => setChOrder(e.target.value)} />
                <button className="btn btn-sm shrink-0" aria-label="Add chapter"><IconPlus width={15} height={15} /></button>
              </form>
              <ul className="space-y-1">
                {chapters.length === 0 && <li className="px-1 text-sm text-slate-400">No chapters yet.</li>}
                {chapters.map((c) => (
                  <li key={c.id}><Row active={chapter?.id === c.id} onClick={() => selectChapter(c)} label={`${c.orderIndex}. ${c.name}`} count={`${c._count.materials} files`} /></li>
                ))}
              </ul>
            </>
          )}
        </Column>

        <Column title="Materials" icon={<IconFile />} hint={!chapter ? 'Select a chapter to upload NCERT content.' : undefined}>
          {chapter && (
            <>
              <form onSubmit={addMaterial} className="mb-4 space-y-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-3">
                <input className="input" placeholder="Title e.g. NCERT Chapter PDF" value={mTitle} onChange={(e) => setMTitle(e.target.value)} required />
                <input className="input" placeholder="Description (optional)" value={mDesc} onChange={(e) => setMDesc(e.target.value)} />
                <input className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-700" type="file" onChange={(e) => setMFile(e.target.files?.[0] ?? null)} required />
                <button className="btn w-full" disabled={uploading}>
                  <IconUpload width={16} height={16} />{uploading ? 'Uploading…' : 'Upload material'}
                </button>
              </form>
              <ul className="space-y-2">
                {materials.length === 0 && <li className="px-1 text-sm text-slate-400">No materials yet.</li>}
                {materials.map((m) => (
                  <li key={m.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><IconFile width={16} height={16} /></span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800">{m.title}</p>
                        <p className="truncate text-xs text-slate-400">{m.type} · {m.fileName}</p>
                      </div>
                    </div>
                    <button className="shrink-0 rounded-md p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-600" onClick={() => delMaterial(m)} aria-label="Delete"><IconTrash width={16} height={16} /></button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Column>
      </div>
    </div>
  );
}
