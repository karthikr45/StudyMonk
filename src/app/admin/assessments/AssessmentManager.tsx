'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/client/api';

interface Named { id: string; name: string }
interface Question {
  id: string; type: string; difficulty: string; marks: number; prompt: string;
  status: string; source: string; numericAnswer: number | null; modelAnswer: string | null;
  chapterId: string | null; options: { id: string; text: string; isCorrect: boolean }[];
}
interface Assessment {
  id: string; type: string; title: string; status: string; totalMarks: number;
  resultsPublished: boolean; chapter: Named | null; _count: { questions: number; attempts: number };
}

const TYPES = ['MCQ', 'TRUE_FALSE', 'NUMERIC', 'SHORT', 'LONG'] as const;
const A_TYPES = ['QUIZ', 'ASSIGNMENT', 'DAILY', 'EXAM'] as const;

// Human labels — makes it obvious that written types exist and MCQ is optional.
const TYPE_LABELS: Record<string, string> = {
  MCQ: 'Multiple choice',
  TRUE_FALSE: 'True / False',
  NUMERIC: 'Numeric answer',
  SHORT: 'Short answer (written)',
  LONG: 'Long answer (written)',
};
const A_TYPE_LABELS: Record<string, string> = {
  QUIZ: 'Quiz', ASSIGNMENT: 'Assignment', DAILY: 'Daily activity', EXAM: 'Board exam',
};

export default function AssessmentManager() {
  const [boards, setBoards] = useState<Named[]>([]);
  const [classes, setClasses] = useState<Named[]>([]);
  const [subjects, setSubjects] = useState<Named[]>([]);
  const [chapters, setChapters] = useState<Named[]>([]);
  const [boardId, setBoardId] = useState('');
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [chapterId, setChapterId] = useState(''); // '' = whole subject

  const [questions, setQuestions] = useState<Question[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const err = (e: unknown) => setError(e instanceof ApiError ? e.message : String(e));

  // ---- scope pickers ----
  useEffect(() => { api.get<{ boards: Named[] }>('/api/admin/boards').then((d) => setBoards(d.boards)).catch(err); }, []);
  useEffect(() => { api.get<{ enabled: boolean }>('/api/admin/ai-status').then((d) => setAiEnabled(d.enabled)).catch(() => {}); }, []);
  useEffect(() => {
    setClassId(''); setSubjectId(''); setSubjects([]); setChapters([]);
    if (boardId) api.get<{ classes: Named[] }>(`/api/admin/classes?boardId=${boardId}`).then((d) => setClasses(d.classes)).catch(err);
    else setClasses([]);
  }, [boardId]);
  useEffect(() => {
    setSubjectId(''); setChapters([]);
    if (classId) api.get<{ subjects: Named[] }>(`/api/admin/subjects?classId=${classId}`).then((d) => setSubjects(d.subjects)).catch(err);
    else setSubjects([]);
  }, [classId]);
  useEffect(() => {
    setChapterId('');
    if (subjectId) {
      api.get<{ chapters: Named[] }>(`/api/admin/chapters?subjectId=${subjectId}`).then((d) => setChapters(d.chapters)).catch(err);
      reloadBank(subjectId, '');
      api.get<{ assessments: Assessment[] }>(`/api/admin/assessments?subjectId=${subjectId}`).then((d) => setAssessments(d.assessments)).catch(err);
    } else { setChapters([]); setQuestions([]); setAssessments([]); }
  }, [subjectId]);

  function reloadBank(sid: string, cid: string) {
    const url = `/api/admin/questions?subjectId=${sid}${cid ? `&chapterId=${cid}` : ''}`;
    api.get<{ questions: Question[] }>(url).then((d) => setQuestions(d.questions)).catch(err);
  }
  useEffect(() => { if (subjectId) reloadBank(subjectId, chapterId); /* eslint-disable-next-line */ }, [chapterId]);

  async function reloadAssessments() {
    if (!subjectId) return;
    const d = await api.get<{ assessments: Assessment[] }>(`/api/admin/assessments?subjectId=${subjectId}`);
    setAssessments(d.assessments);
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          <span>{error}</span><button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Scope */}
      <div className="card">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div><label className="label">Board</label>
            <select className="input" value={boardId} onChange={(e) => setBoardId(e.target.value)}>
              <option value="">Select</option>{boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select></div>
          <div><label className="label">Class</label>
            <select className="input" value={classId} onChange={(e) => setClassId(e.target.value)} disabled={!boardId}>
              <option value="">Select</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></div>
          <div><label className="label">Subject</label>
            <select className="input" value={subjectId} onChange={(e) => setSubjectId(e.target.value)} disabled={!classId}>
              <option value="">Select</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select></div>
          <div><label className="label">Scope</label>
            <select className="input" value={chapterId} onChange={(e) => setChapterId(e.target.value)} disabled={!subjectId}>
              <option value="">Whole subject</option>{chapters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></div>
        </div>
      </div>

      {!subjectId && <p className="text-sm text-slate-400">Pick a subject to manage its question bank and assessments.</p>}

      {subjectId && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <QuestionBank
            subjectId={subjectId} chapterId={chapterId} questions={questions} aiEnabled={aiEnabled}
            onChange={() => reloadBank(subjectId, chapterId)} onErr={err}
          />
          <AssessmentBuilder
            subjectId={subjectId} chapterId={chapterId} questions={questions}
            assessments={assessments} onChange={reloadAssessments} onErr={err}
          />
        </div>
      )}
    </div>
  );
}

/* ------------------------------- Question bank ------------------------------ */
function QuestionBank({ subjectId, chapterId, questions, aiEnabled, onChange, onErr }: {
  subjectId: string; chapterId: string; questions: Question[]; aiEnabled: boolean; onChange: () => void; onErr: (e: unknown) => void;
}) {
  const [type, setType] = useState<(typeof TYPES)[number]>('MCQ');
  const [showGen, setShowGen] = useState(false);
  const [genCounts, setGenCounts] = useState({ MCQ: 5, SHORT: 2, LONG: 0, TRUE_FALSE: 0, NUMERIC: 0 });
  const [genDiff, setGenDiff] = useState('MEDIUM');
  const [generating, setGenerating] = useState(false);

  async function generate() {
    setGenerating(true);
    try {
      const payload: any = { subjectId, difficulty: genDiff, counts: genCounts };
      if (chapterId) payload.chapterId = chapterId;
      const d = await api.post<{ created: number }>('/api/admin/questions/generate', payload);
      setShowGen(false);
      onChange();
      onErr(null as any); // clear
      alert(`Generated ${d.created} draft questions. Review and approve them below.`);
    } catch (e) { onErr(e); } finally { setGenerating(false); }
  }
  async function approve(id: string) { try { await api.patch(`/api/admin/questions/${id}`, { status: 'PUBLISHED' }); onChange(); } catch (e) { onErr(e); } }

  const [editId, setEditId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [marks, setMarks] = useState('1');
  const [difficulty, setDifficulty] = useState('MEDIUM');
  const [options, setOptions] = useState([{ text: '', isCorrect: true }, { text: '', isCorrect: false }]);
  const [numericAnswer, setNumericAnswer] = useState('');
  const [modelAnswer, setModelAnswer] = useState('');
  const [busy, setBusy] = useState(false);

  const objective = type === 'MCQ' || type === 'TRUE_FALSE';
  const written = type === 'SHORT' || type === 'LONG';

  function setCorrect(i: number) { setOptions((o) => o.map((x, j) => ({ ...x, isCorrect: j === i }))); }

  function resetForm() {
    setEditId(null); setType('MCQ'); setPrompt(''); setMarks('1'); setDifficulty('MEDIUM');
    setNumericAnswer(''); setModelAnswer('');
    setOptions([{ text: '', isCorrect: true }, { text: '', isCorrect: false }]);
  }

  function startEdit(q: Question) {
    setEditId(q.id);
    setType(q.type as any);
    setPrompt(q.prompt);
    setMarks(String(q.marks));
    setDifficulty(q.difficulty);
    if (q.type === 'MCQ') {
      setOptions(q.options.length ? q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })) : [{ text: '', isCorrect: true }, { text: '', isCorrect: false }]);
    } else if (q.type === 'TRUE_FALSE') {
      const t = q.options.find((o) => /^true$/i.test(o.text));
      setOptions([{ text: 'True', isCorrect: t?.isCorrect ?? true }]);
    } else {
      setOptions([{ text: '', isCorrect: true }, { text: '', isCorrect: false }]);
    }
    setNumericAnswer(q.type === 'NUMERIC' && q.numericAnswer != null ? String(q.numericAnswer) : '');
    setModelAnswer(q.modelAnswer ?? '');
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      const payload: any = { subjectId, type, prompt, marks: Number(marks), difficulty };
      if (chapterId) payload.chapterId = chapterId;
      if (type === 'MCQ') payload.options = options.filter((o) => o.text.trim());
      if (type === 'TRUE_FALSE') payload.options = [
        { text: 'True', isCorrect: options[0]?.isCorrect ?? true },
        { text: 'False', isCorrect: !(options[0]?.isCorrect ?? true) },
      ];
      if (type === 'NUMERIC') payload.numericAnswer = Number(numericAnswer);
      if (type === 'SHORT' || type === 'LONG') payload.modelAnswer = modelAnswer || null;
      if (editId) await api.patch(`/api/admin/questions/${editId}`, payload);
      else await api.post('/api/admin/questions', payload);
      resetForm();
      onChange();
    } catch (e) { onErr(e); } finally { setBusy(false); }
  }
  async function del(id: string) { try { await api.del(`/api/admin/questions/${id}`); if (editId === id) resetForm(); onChange(); } catch (e) { onErr(e); } }

  return (
    <div className="card">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Question bank ({questions.length})</h3>
        {aiEnabled && <button className="btn btn-sm" onClick={() => setShowGen((s) => !s)}>🤖 Generate</button>}
      </div>

      {showGen && (
        <div className="mb-4 space-y-2 rounded-xl border border-brand-200 bg-brand-50/60 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Auto-generate from {chapterId ? 'this chapter' : 'the subject'}</p>
          <div className="grid grid-cols-3 gap-2">
            {(['MCQ', 'TRUE_FALSE', 'NUMERIC', 'SHORT', 'LONG'] as const).map((t) => (
              <label key={t} className="text-xs text-slate-600">{t.replace('_', '/')}
                <input className="input" type="number" min={0} max={20} value={(genCounts as any)[t]}
                  onChange={(e) => setGenCounts((c) => ({ ...c, [t]: Number(e.target.value) }))} />
              </label>
            ))}
            <label className="text-xs text-slate-600">Difficulty
              <select className="input" value={genDiff} onChange={(e) => setGenDiff(e.target.value)}>
                <option>EASY</option><option>MEDIUM</option><option>HARD</option>
              </select>
            </label>
          </div>
          <button className="btn w-full" disabled={generating} onClick={generate}>
            {generating ? 'Generating… (this can take a minute)' : 'Generate draft questions'}
          </button>
          <p className="text-[11px] text-slate-500">Drafts are reviewed &amp; approved before students see them.</p>
        </div>
      )}

      <form onSubmit={submit} className={`mb-4 space-y-2 rounded-xl border p-3 ${editId ? 'border-brand-300 bg-brand-50/50' : 'border-dashed border-slate-300 bg-slate-50/60'}`}>
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{editId ? 'Edit question' : 'Add a question'}</p>
          {editId && <button type="button" className="text-xs font-medium text-slate-500 hover:text-slate-800" onClick={resetForm}>Cancel</button>}
        </div>
        <div className="flex gap-2">
          <select className="input" value={type} onChange={(e) => setType(e.target.value as any)}>
            {TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
          </select>
          <select className="input w-28" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
            <option>EASY</option><option>MEDIUM</option><option>HARD</option>
          </select>
          <input className="input w-20" type="number" min={1} value={marks} onChange={(e) => setMarks(e.target.value)} title="Marks" />
        </div>
        <p className="text-[11px] text-slate-500">
          {objective ? 'Auto-graded — the student picks an answer.'
            : type === 'NUMERIC' ? 'Auto-graded — the student types a number.'
            : 'Written — the student writes their answer and submits it for you to grade. No options needed.'}
        </p>
        <textarea className="input" rows={2} placeholder={written ? 'Task / question for the student to answer in writing' : 'Question prompt'} value={prompt} onChange={(e) => setPrompt(e.target.value)} required />

        {type === 'MCQ' && (
          <div className="space-y-1.5">
            {options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="radio" name="correct" checked={o.isCorrect} onChange={() => setCorrect(i)} title="Correct" />
                <input className="input" placeholder={`Option ${i + 1}`} value={o.text}
                  onChange={(e) => setOptions((os) => os.map((x, j) => j === i ? { ...x, text: e.target.value } : x))} />
                {options.length > 2 && <button type="button" className="text-slate-400 hover:text-red-600" onClick={() => setOptions((os) => os.filter((_, j) => j !== i))}>✕</button>}
              </div>
            ))}
            {options.length < 6 && <button type="button" className="text-xs font-medium text-brand-600" onClick={() => setOptions((o) => [...o, { text: '', isCorrect: false }])}>+ Add option</button>}
          </div>
        )}
        {type === 'TRUE_FALSE' && (
          <div className="flex gap-2 text-sm">
            <label className="flex items-center gap-1.5"><input type="radio" name="tf" checked={options[0]?.isCorrect ?? true} onChange={() => setOptions([{ text: 'True', isCorrect: true }])} /> True is correct</label>
            <label className="flex items-center gap-1.5"><input type="radio" name="tf" checked={!(options[0]?.isCorrect ?? true)} onChange={() => setOptions([{ text: 'True', isCorrect: false }])} /> False is correct</label>
          </div>
        )}
        {type === 'NUMERIC' && (
          <input className="input" type="number" step="any" placeholder="Correct numeric answer" value={numericAnswer} onChange={(e) => setNumericAnswer(e.target.value)} required />
        )}
        {written && (
          <textarea className="input" rows={2} placeholder="Model answer (optional — shown to you while grading)" value={modelAnswer} onChange={(e) => setModelAnswer(e.target.value)} />
        )}
        <button className="btn w-full" disabled={busy}>{busy ? 'Saving…' : editId ? 'Save changes' : 'Add question'}</button>
      </form>

      <ul className="space-y-2">
        {questions.length === 0 && <li className="text-sm text-slate-400">No questions yet.</li>}
        {questions.map((q) => (
          <li key={q.id} className={`rounded-lg border p-2.5 ${q.status === 'DRAFT' ? 'border-amber-200 bg-amber-50/40' : 'border-slate-200'}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm text-slate-800">{q.prompt}</p>
                <p className="mt-1 flex flex-wrap gap-1.5">
                  <span className="pill">{q.type.replace('_', '/')}</span><span className="pill">{q.marks}m</span><span className="pill">{q.difficulty}</span>
                  {q.source === 'AI' && <span className="pill-brand">AI</span>}
                  {q.status === 'DRAFT' && <span className="pill" style={{ color: '#d18a24', background: '#fdf6ea' }}>draft</span>}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {q.status === 'DRAFT' && <button className="btn btn-sm" onClick={() => approve(q.id)}>Approve</button>}
                <button className="btn-ghost btn-sm" onClick={() => startEdit(q)} title="Edit">Edit</button>
                <button className="text-slate-300 hover:text-red-600" onClick={() => del(q.id)} title="Delete">✕</button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
function objectiveType(t: string) { return t === 'MCQ' || t === 'TRUE_FALSE' || t === 'NUMERIC'; }

/* ----------------------------- Assessment builder --------------------------- */
function AssessmentBuilder({ subjectId, chapterId, questions, assessments, onChange, onErr }: {
  subjectId: string; chapterId: string; questions: Question[]; assessments: Assessment[]; onChange: () => void; onErr: (e: unknown) => void;
}) {
  const [type, setType] = useState<(typeof A_TYPES)[number]>('QUIZ');
  const [title, setTitle] = useState('');
  const [minutes, setMinutes] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editLocked, setEditLocked] = useState(false); // has attempts → question set locked

  function toggle(id: string) { setPicked((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]); }

  function resetForm() { setEditId(null); setEditLocked(false); setType('QUIZ'); setTitle(''); setMinutes(''); setPicked([]); }

  async function startEdit(a: Assessment) {
    try {
      const d = await api.get<{ assessment: { type: string; title: string; timeLimitSec: number | null; questions: { questionId: string }[] } }>(`/api/admin/assessments/${a.id}`);
      setEditId(a.id);
      setEditLocked(a._count.attempts > 0);
      setType(d.assessment.type as any);
      setTitle(d.assessment.title);
      setMinutes(d.assessment.timeLimitSec ? String(Math.round(d.assessment.timeLimitSec / 60)) : '');
      setPicked(d.assessment.questions.map((q) => q.questionId));
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { onErr(e); }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!editLocked && picked.length === 0) { onErr('Select at least one question'); return; }
    setBusy(true);
    try {
      if (editId) {
        const payload: any = { type, title, timeLimitSec: minutes ? Number(minutes) * 60 : null };
        if (!editLocked) payload.questionIds = picked; // question set locked once attempted
        await api.patch(`/api/admin/assessments/${editId}`, payload);
      } else {
        const payload: any = { type, subjectId, title, questionIds: picked };
        if (chapterId) payload.chapterId = chapterId;
        if (minutes) payload.timeLimitSec = Number(minutes) * 60;
        await api.post('/api/admin/assessments', payload);
      }
      resetForm(); onChange();
    } catch (e) { onErr(e); } finally { setBusy(false); }
  }
  async function setStatus(a: Assessment, status: string) {
    try { await api.patch(`/api/admin/assessments/${a.id}`, { status }); onChange(); } catch (e) { onErr(e); }
  }
  async function del(a: Assessment) { try { await api.del(`/api/admin/assessments/${a.id}`); if (editId === a.id) resetForm(); onChange(); } catch (e) { onErr(e); } }

  return (
    <div className="card">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Assessments ({assessments.length})</h3>
      <form onSubmit={submit} className={`mb-4 space-y-2 rounded-xl border p-3 ${editId ? 'border-brand-300 bg-brand-50/50' : 'border-dashed border-slate-300 bg-slate-50/60'}`}>
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{editId ? 'Edit assessment' : 'Create an assessment'}</p>
          {editId && <button type="button" className="text-xs font-medium text-slate-500 hover:text-slate-800" onClick={resetForm}>Cancel</button>}
        </div>
        <div className="flex gap-2">
          <select className="input" value={type} onChange={(e) => setType(e.target.value as any)}>
            {A_TYPES.map((t) => <option key={t} value={t}>{A_TYPE_LABELS[t]}</option>)}
          </select>
          <input className="input w-28" type="number" min={1} placeholder="Mins" value={minutes} onChange={(e) => setMinutes(e.target.value)} title="Time limit (optional)" />
        </div>
        {type === 'ASSIGNMENT' && (
          <p className="rounded-lg bg-brand-50 px-2.5 py-1.5 text-[11px] text-brand-700">
            An assignment can be fully written — add <b>Short/Long answer</b> questions and students type &amp; submit. Multiple-choice is optional.
          </p>
        )}
        <input className="input" placeholder="Title e.g. Real Numbers — Assignment 1" value={title} onChange={(e) => setTitle(e.target.value)} required />
        {editLocked ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-700">
            Students have already attempted this — the question set is locked. You can still change the title and time limit.
          </p>
        ) : (
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2">
            {questions.length === 0 && <p className="text-xs text-slate-400">Add questions to the bank first.</p>}
            {questions.map((q) => (
              <label key={q.id} className="flex items-start gap-2 rounded p-1 text-sm hover:bg-slate-50">
                <input type="checkbox" className="mt-1" checked={picked.includes(q.id)} onChange={() => toggle(q.id)} />
                <span className="min-w-0"><span className="line-clamp-2">{q.prompt}</span>
                  <span className="text-xs text-slate-400">{TYPE_LABELS[q.type] ?? q.type} · {q.marks}m</span></span>
              </label>
            ))}
          </div>
        )}
        <button className="btn w-full" disabled={busy}>
          {busy ? 'Saving…' : editId ? 'Save changes' : `Create ${A_TYPE_LABELS[type].toLowerCase()} (${picked.length} Qs)`}
        </button>
      </form>

      <ul className="space-y-2">
        {assessments.length === 0 && <li className="text-sm text-slate-400">No assessments yet.</li>}
        {assessments.map((a) => (
          <li key={a.id} className={`rounded-lg border p-3 ${editId === a.id ? 'border-brand-300 bg-brand-50/40' : 'border-slate-200'}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-800">{a.title}</p>
                <p className="mt-1 flex flex-wrap gap-1.5">
                  <span className="pill">{A_TYPE_LABELS[a.type] ?? a.type}</span>
                  <span className="pill">{a._count.questions} Qs · {a.totalMarks}m</span>
                  <span className={a.status === 'PUBLISHED' ? 'pill-brand' : 'pill'}>{a.status.toLowerCase()}</span>
                  <span className="pill">{a._count.attempts} attempts</span>
                  {a.resultsPublished && <span className="pill">results out</span>}
                </p>
              </div>
              <button className="shrink-0 text-slate-300 hover:text-red-600" onClick={() => del(a)} title="Delete">✕</button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button className="btn-ghost btn-sm" onClick={() => startEdit(a)}>Edit</button>
              {a.status === 'PUBLISHED'
                ? <button className="btn-ghost btn-sm" onClick={() => setStatus(a, 'DRAFT')}>Unpublish</button>
                : <button className="btn btn-sm" onClick={() => setStatus(a, 'PUBLISHED')}>Publish</button>}
              <Link href={`/admin/assessments/${a.id}/results`} className="btn-ghost btn-sm">Results →</Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
