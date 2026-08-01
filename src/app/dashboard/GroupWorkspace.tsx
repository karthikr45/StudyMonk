'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/client/api';
import { IconChat, IconFile, IconBook, IconUsers, IconPlus, IconDownload, IconTrash } from '@/components/icons';

interface Member { role: string; user: { id: string; fullName: string } }
interface Post { id: string; body: string; createdAt: string; editedAt: string | null; parentId: string | null; mentionIds: string[]; author: { id: string; fullName: string } }
interface Classmate { id: string; fullName: string; email: string }

export default function GroupWorkspace({ group, meId, onErr }: {
  group: { id: string; name: string; myRole: string | null }; meId: string; onErr: (e: unknown) => void;
}) {
  const [tab, setTab] = useState<'chat' | 'files' | 'cards' | 'polls'>('chat');
  const [members, setMembers] = useState<Member[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [tick, setTick] = useState(0);
  const isOwner = group.myRole === 'OWNER';

  async function loadDetail() {
    const d = await api.get<{ members: Member[]; posts: Post[] }>(`/api/groups/${group.id}`);
    setMembers(d.members); setPosts(d.posts);
  }
  // Live refresh every 5s (near real-time chat, members, polls).
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 5000); return () => clearInterval(t); }, []);
  useEffect(() => { loadDetail().catch(() => {}); /* eslint-disable-next-line */ }, [group.id, tick]);

  const tabs = [
    { k: 'chat' as const, label: 'Chat', icon: IconChat },
    { k: 'files' as const, label: 'Files', icon: IconFile },
    { k: 'cards' as const, label: 'Cards', icon: IconBook },
    { k: 'polls' as const, label: 'Polls', icon: IconUsers },
  ];

  return (
    <div className="card flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-bold text-slate-800">{group.name}</h3>
        <span className="pill">{members.length} members</span>
      </div>

      {isOwner && <MembersManager groupId={group.id} members={members} onChange={loadDetail} onErr={onErr} />}

      <div className="mb-3 inline-flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
        {tabs.map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${tab === t.k ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-white'}`}>
            <t.icon width={14} height={14} />{t.label}
          </button>
        ))}
      </div>

      {tab === 'chat' && <Chat groupId={group.id} meId={meId} members={members} posts={posts} reload={loadDetail} onErr={onErr} />}
      {tab === 'files' && <Files groupId={group.id} onErr={onErr} />}
      {tab === 'cards' && <Cards groupId={group.id} meId={meId} onErr={onErr} />}
      {tab === 'polls' && <Polls groupId={group.id} tick={tick} onErr={onErr} />}
    </div>
  );
}

/* ------------------------------- Members ---------------------------------- */
function MembersManager({ groupId, members, onChange, onErr }: { groupId: string; members: Member[]; onChange: () => void; onErr: (e: unknown) => void }) {
  const [eligible, setEligible] = useState<Classmate[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => { if (open) api.get<{ students: Classmate[] }>(`/api/groups/${groupId}/eligible`).then((d) => setEligible(d.students)).catch(onErr); /* eslint-disable-next-line */ }, [open, members.length]);
  async function add(id: string) { try { await api.post(`/api/groups/${groupId}/members`, { userId: id }); await onChange(); } catch (e) { onErr(e); } }
  async function remove(id: string) { try { await api.del(`/api/groups/${groupId}/members/${id}`); await onChange(); } catch (e) { onErr(e); } }
  return (
    <div className="mb-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-2.5">
      <button className="text-xs font-semibold text-brand-600" onClick={() => setOpen((o) => !o)}>{open ? '▾' : '▸'} Manage members</button>
      {open && (
        <div className="mt-2 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {members.map((m) => (
              <span key={m.user.id} className={m.role === 'OWNER' ? 'pill-brand' : 'pill'}>{m.user.fullName}{m.role === 'OWNER' ? ' ★' : ''}
                {m.role !== 'OWNER' && <button onClick={() => remove(m.user.id)} className="ml-1 text-slate-400 hover:text-red-600">✕</button>}
              </span>
            ))}
          </div>
          {eligible.length > 0 && (
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase text-slate-400">Add classmates</p>
              {eligible.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-lg bg-white px-2 py-1 text-sm">
                  <span className="truncate">{c.fullName}</span>
                  <button className="btn btn-sm" onClick={() => add(c.id)}><IconPlus width={13} height={13} />Add</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* --------------------------------- Chat ----------------------------------- */
function Chat({ groupId, meId, members, posts, reload, onErr }: {
  groupId: string; meId: string; members: Member[]; posts: Post[]; reload: () => Promise<void>; onErr: (e: unknown) => void;
}) {
  const [msg, setMsg] = useState('');
  const [mentions, setMentions] = useState<string[]>([]);
  const [replyTo, setReplyTo] = useState<Post | null>(null);
  const [editing, setEditing] = useState<Post | null>(null);
  const nameById = Object.fromEntries(members.map((m) => [m.user.id, m.user.fullName]));

  function addMention(id: string) {
    if (mentions.includes(id)) return;
    setMentions((m) => [...m, id]);
    setMsg((t) => `${t}@${nameById[id]} `);
  }
  async function send(e: React.FormEvent) {
    e.preventDefault(); if (!msg.trim()) return;
    try {
      if (editing) await api.patch(`/api/groups/${groupId}/posts/${editing.id}`, { body: msg, mentionIds: mentions });
      else await api.post(`/api/groups/${groupId}/posts`, { body: msg, parentId: replyTo?.id, mentionIds: mentions });
      setMsg(''); setMentions([]); setReplyTo(null); setEditing(null);
      await reload();
    } catch (e) { onErr(e); }
  }
  async function del(p: Post) { try { await api.del(`/api/groups/${groupId}/posts/${p.id}`); await reload(); } catch (e) { onErr(e); } }
  function startEdit(p: Post) { setEditing(p); setReplyTo(null); setMsg(p.body); setMentions(p.mentionIds); }
  const byId = Object.fromEntries(posts.map((p) => [p.id, p]));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ul className="mb-3 flex-1 space-y-2 overflow-y-auto pr-1" style={{ maxHeight: 360 }}>
        {posts.length === 0 && <p className="text-sm text-slate-400">No messages yet. Say hi 👋</p>}
        {posts.map((p) => {
          const parent = p.parentId ? byId[p.parentId] : null;
          const mine = p.author.id === meId;
          return (
            <li key={p.id} className="rounded-xl bg-slate-50 p-3">
              {parent && <p className="mb-1 border-l-2 border-slate-300 pl-2 text-xs text-slate-400">↳ {parent.author.fullName}: {parent.body.slice(0, 60)}</p>}
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm text-slate-800">{p.body}</p>
                <div className="flex shrink-0 gap-1.5 text-xs">
                  <button className="text-slate-400 hover:text-brand-600" onClick={() => { setReplyTo(p); setEditing(null); }}>Reply</button>
                  {mine && <button className="text-slate-400 hover:text-brand-600" onClick={() => startEdit(p)}>Edit</button>}
                  {mine && <button className="text-slate-400 hover:text-red-600" onClick={() => del(p)}>Delete</button>}
                </div>
              </div>
              {p.mentionIds.length > 0 && <p className="mt-1 text-xs text-brand-600">{p.mentionIds.map((id) => `@${nameById[id] ?? 'member'}`).join(' ')}</p>}
              <p className="mt-1 text-xs text-slate-400">{p.author.fullName} · {new Date(p.createdAt).toLocaleString()}{p.editedAt ? ' · edited' : ''}</p>
            </li>
          );
        })}
      </ul>

      {(replyTo || editing) && (
        <div className="mb-1 flex items-center justify-between rounded-lg bg-brand-50 px-3 py-1 text-xs text-brand-700">
          <span>{editing ? 'Editing your message' : `Replying to ${replyTo?.author.fullName}`}</span>
          <button onClick={() => { setReplyTo(null); setEditing(null); setMsg(''); setMentions([]); }}>✕</button>
        </div>
      )}
      <form onSubmit={send} className="space-y-2">
        <div className="flex flex-wrap gap-1">
          {members.filter((m) => m.user.id !== meId).map((m) => (
            <button type="button" key={m.user.id} className="pill hover:bg-brand-50" onClick={() => addMention(m.user.id)}>@{m.user.fullName.split(' ')[0]}</button>
          ))}
        </div>
        <div className="flex gap-2">
          <input className="input" placeholder="Message… use @ to tag" value={msg} onChange={(e) => setMsg(e.target.value)} />
          <button className="btn shrink-0">{editing ? 'Save' : 'Send'}</button>
        </div>
      </form>
    </div>
  );
}

/* --------------------------------- Files ---------------------------------- */
function Files({ groupId, onErr }: { groupId: string; onErr: (e: unknown) => void }) {
  interface R { id: string; title: string; fileName: string; fileSize: number; uploader: { fullName: string } }
  const [items, setItems] = useState<R[]>([]);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  async function load() { const d = await api.get<{ resources: R[] }>(`/api/groups/${groupId}/resources`); setItems(d.resources); }
  useEffect(() => { load().catch(onErr); /* eslint-disable-next-line */ }, [groupId]);
  async function upload(e: React.FormEvent) {
    e.preventDefault(); if (!file) return; setBusy(true);
    try {
      const { uploadUrl, storageKey } = await api.post<{ uploadUrl: string; storageKey: string }>(`/api/groups/${groupId}/resources/upload-url`, { fileName: file.name, contentType: file.type || 'application/octet-stream', fileSize: file.size });
      const put = await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type || 'application/octet-stream' } });
      if (!put.ok) throw new Error('Upload failed');
      await api.post(`/api/groups/${groupId}/resources`, { title: title || file.name, storageKey, fileName: file.name, fileSize: file.size, contentType: file.type || 'application/octet-stream' });
      setTitle(''); setFile(null); await load();
    } catch (e) { onErr(e); } finally { setBusy(false); }
  }
  async function download(r: R) { const d = await api.get<{ url: string }>(`/api/groups/${groupId}/resources/${r.id}/download`); window.open(d.url, '_blank', 'noopener'); }
  return (
    <div className="flex-1">
      <form onSubmit={upload} className="mb-3 space-y-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-3">
        <input className="input" placeholder="File title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className="block w-full text-sm" type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
        <button className="btn w-full" disabled={busy}>{busy ? 'Uploading…' : 'Share file'}</button>
      </form>
      <ul className="space-y-2">
        {items.length === 0 && <li className="text-sm text-slate-400">No files shared yet.</li>}
        {items.map((r) => (
          <li key={r.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-2.5">
            <div className="flex min-w-0 items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><IconFile width={15} height={15} /></span>
              <div className="min-w-0"><p className="truncate text-sm font-medium text-slate-800">{r.title}</p><p className="truncate text-xs text-slate-400">{r.uploader.fullName}</p></div></div>
            <button className="btn-ghost btn-sm shrink-0" onClick={() => download(r)}><IconDownload width={14} height={14} /></button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* --------------------------------- Cards ---------------------------------- */
function Cards({ groupId, meId, onErr }: { groupId: string; meId: string; onErr: (e: unknown) => void }) {
  interface Set { id: string; title: string; createdById: string; createdBy: { fullName: string }; cards: { id: string; front: string; back: string }[] }
  const [sets, setSets] = useState<Set[]>([]);
  const [title, setTitle] = useState('');
  const [cards, setCards] = useState([{ front: '', back: '' }]);
  const [flip, setFlip] = useState<Record<string, boolean>>({});
  async function load() { const d = await api.get<{ sets: Set[] }>(`/api/groups/${groupId}/cards`); setSets(d.sets); }
  useEffect(() => { load().catch(onErr); /* eslint-disable-next-line */ }, [groupId]);
  async function create(e: React.FormEvent) {
    e.preventDefault();
    const valid = cards.filter((c) => c.front.trim() && c.back.trim());
    if (!title.trim() || valid.length === 0) return;
    try { await api.post(`/api/groups/${groupId}/cards`, { title, cards: valid }); setTitle(''); setCards([{ front: '', back: '' }]); await load(); } catch (e) { onErr(e); }
  }
  async function del(id: string) { try { await api.del(`/api/groups/${groupId}/cards/${id}`); await load(); } catch (e) { onErr(e); } }
  return (
    <div className="flex-1">
      <form onSubmit={create} className="mb-3 space-y-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-3">
        <input className="input" placeholder="Deck title e.g. Real Numbers formulas" value={title} onChange={(e) => setTitle(e.target.value)} required />
        {cards.map((c, i) => (
          <div key={i} className="flex gap-2">
            <input className="input" placeholder="Front (question)" value={c.front} onChange={(e) => setCards((cs) => cs.map((x, j) => j === i ? { ...x, front: e.target.value } : x))} />
            <input className="input" placeholder="Back (answer)" value={c.back} onChange={(e) => setCards((cs) => cs.map((x, j) => j === i ? { ...x, back: e.target.value } : x))} />
          </div>
        ))}
        <div className="flex justify-between">
          <button type="button" className="text-xs font-medium text-brand-600" onClick={() => setCards((c) => [...c, { front: '', back: '' }])}>+ Add card</button>
          <button className="btn btn-sm">Create deck</button>
        </div>
      </form>
      <ul className="space-y-3">
        {sets.length === 0 && <li className="text-sm text-slate-400">No card decks yet.</li>}
        {sets.map((s) => (
          <li key={s.id} className="rounded-xl border border-slate-200 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800">{s.title} <span className="pill">{s.cards.length}</span></p>
              {s.createdById === meId && <button className="text-slate-300 hover:text-red-600" onClick={() => del(s.id)}><IconTrash width={14} height={14} /></button>}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {s.cards.map((c) => (
                <button key={c.id} onClick={() => setFlip((f) => ({ ...f, [c.id]: !f[c.id] }))}
                  className="min-h-[64px] rounded-lg border border-slate-200 bg-slate-50 p-2 text-center text-xs text-slate-700 hover:border-brand-300">
                  {flip[c.id] ? <span className="font-semibold text-brand-700">{c.back}</span> : c.front}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-400">by {s.createdBy.fullName} · tap a card to flip</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* --------------------------------- Polls ---------------------------------- */
function Polls({ groupId, tick, onErr }: { groupId: string; tick: number; onErr: (e: unknown) => void }) {
  interface Opt { id: string; text: string; votes: number; isCorrect?: boolean }
  interface P { id: string; type: string; question: string; totalVotes: number; myVote: string | null; createdBy: { fullName: string }; options: Opt[] }
  const [polls, setPolls] = useState<P[]>([]);
  const [type, setType] = useState<'POLL' | 'QUIZ'>('POLL');
  const [question, setQuestion] = useState('');
  const [opts, setOpts] = useState([{ text: '', isCorrect: false }, { text: '', isCorrect: false }]);
  async function load() { const d = await api.get<{ polls: P[] }>(`/api/groups/${groupId}/polls`); setPolls(d.polls); }
  useEffect(() => { load().catch(() => {}); /* eslint-disable-next-line */ }, [groupId, tick]);
  async function create(e: React.FormEvent) {
    e.preventDefault();
    const valid = opts.filter((o) => o.text.trim());
    if (!question.trim() || valid.length < 2) return;
    try { await api.post(`/api/groups/${groupId}/polls`, { type, question, options: valid }); setQuestion(''); setOpts([{ text: '', isCorrect: false }, { text: '', isCorrect: false }]); await load(); } catch (e) { onErr(e); }
  }
  async function vote(pid: string, oid: string) { try { await api.post(`/api/groups/${groupId}/polls/${pid}/vote`, { optionId: oid }); await load(); } catch (e) { onErr(e); } }
  return (
    <div className="flex-1">
      <form onSubmit={create} className="mb-3 space-y-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-3">
        <div className="flex gap-2">
          <select className="input w-28" value={type} onChange={(e) => setType(e.target.value as any)}><option value="POLL">Poll</option><option value="QUIZ">Quiz</option></select>
          <input className="input" placeholder="Question" value={question} onChange={(e) => setQuestion(e.target.value)} required />
        </div>
        {opts.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            {type === 'QUIZ' && <input type="radio" name="correct" checked={o.isCorrect} onChange={() => setOpts((os) => os.map((x, j) => ({ ...x, isCorrect: j === i })))} title="Correct" />}
            <input className="input" placeholder={`Option ${i + 1}`} value={o.text} onChange={(e) => setOpts((os) => os.map((x, j) => j === i ? { ...x, text: e.target.value } : x))} />
          </div>
        ))}
        <div className="flex justify-between">
          <button type="button" className="text-xs font-medium text-brand-600" onClick={() => setOpts((o) => [...o, { text: '', isCorrect: false }])}>+ Option</button>
          <button className="btn btn-sm">Create {type.toLowerCase()}</button>
        </div>
      </form>
      <ul className="space-y-3">
        {polls.length === 0 && <li className="text-sm text-slate-400">No polls or quizzes yet.</li>}
        {polls.map((p) => {
          const voted = p.myVote !== null;
          return (
            <li key={p.id} className="rounded-xl border border-slate-200 p-3">
              <p className="text-sm font-semibold text-slate-800">{p.question} <span className="pill">{p.type.toLowerCase()}</span></p>
              <div className="mt-2 space-y-1.5">
                {p.options.map((o) => {
                  const pct = p.totalVotes ? Math.round((o.votes / p.totalVotes) * 100) : 0;
                  const mine = p.myVote === o.id;
                  return (
                    <button key={o.id} onClick={() => vote(p.id, o.id)} className={`relative block w-full overflow-hidden rounded-lg border px-3 py-2 text-left text-sm ${mine ? 'border-brand-500' : 'border-slate-200'} ${o.isCorrect ? 'bg-emerald-50' : ''}`}>
                      {voted && <span className="absolute inset-y-0 left-0 bg-brand-50" style={{ width: `${pct}%` }} />}
                      <span className="relative flex justify-between"><span>{o.text}{o.isCorrect ? ' ✓' : ''}{mine ? ' • your vote' : ''}</span>{voted && <span className="text-xs text-slate-500">{pct}%</span>}</span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-slate-400">{p.totalVotes} votes · by {p.createdBy.fullName}{p.type === 'QUIZ' && !voted ? ' · vote to see the answer' : ''}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
