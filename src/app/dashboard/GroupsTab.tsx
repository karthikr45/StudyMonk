'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/client/api';
import { IconUsers, IconPlus, IconChat, IconTrash } from '@/components/icons';

interface Group {
  id: string; name: string; description: string | null; memberCount: number;
  isMember: boolean; myRole: string | null; createdBy: { id: string; fullName: string };
}
interface Member { role: string; joinedAt: string; user: { id: string; fullName: string } }
interface Post { id: string; body: string; createdAt: string; author: { id: string; fullName: string } }
interface Classmate { id: string; fullName: string; email: string }

export default function GroupsTab() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [scope, setScope] = useState<{ schoolDisplay: string; academicYear: string } | null>(null);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [msg, setMsg] = useState('');
  const [eligible, setEligible] = useState<Classmate[]>([]);

  const isOwner = open?.myRole === 'OWNER';

  async function load() {
    const d = await api.get<{ groups: Group[]; scope: typeof scope }>('/api/groups');
    setGroups(d.groups); setScope(d.scope);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load().catch(() => {}); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    try { await api.post('/api/groups', { name, description: desc || undefined }); setName(''); setDesc(''); await load(); }
    catch (err) { setError(err instanceof ApiError ? err.message : 'Could not create group'); }
  }
  async function join(g: Group) { await api.post(`/api/groups/${g.id}/join`); await load(); }
  async function leave(g: Group) {
    await api.post(`/api/groups/${g.id}/leave`);
    if (open?.id === g.id) setOpen(null);
    await load();
  }
  async function refreshDetail(groupId: string, owner: boolean) {
    const d = await api.get<{ members: Member[]; posts: Post[] }>(`/api/groups/${groupId}`);
    setMembers(d.members); setPosts(d.posts);
    if (owner) {
      const e = await api.get<{ students: Classmate[] }>(`/api/groups/${groupId}/eligible`);
      setEligible(e.students);
    } else {
      setEligible([]);
    }
  }
  async function openGroup(g: Group) {
    setOpen(g);
    await refreshDetail(g.id, g.myRole === 'OWNER');
  }
  async function addMember(c: Classmate) {
    if (!open) return;
    await api.post(`/api/groups/${open.id}/members`, { userId: c.id });
    await refreshDetail(open.id, true);
    await load();
  }
  async function removeMember(m: Member) {
    if (!open) return;
    await api.del(`/api/groups/${open.id}/members/${m.user.id}`);
    await refreshDetail(open.id, true);
    await load();
  }
  async function post(e: React.FormEvent) {
    e.preventDefault();
    if (!open || !msg.trim()) return;
    await api.post(`/api/groups/${open.id}/posts`, { body: msg });
    setMsg('');
    const d = await api.get<{ members: Member[]; posts: Post[] }>(`/api/groups/${open.id}`);
    setMembers(d.members); setPosts(d.posts);
  }

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <div className="space-y-5">
        <div className="card">
          <div className="section-title mb-3"><span className="text-brand-500"><IconPlus /></span>Create a study group</div>
          {scope && (
            <p className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">
              Only classmates from <b>{scope.schoolDisplay}</b> ({scope.academicYear}) in your class can join.
            </p>
          )}
          <form onSubmit={create} className="space-y-2">
            <input className="input" placeholder="Group name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
            <input className="input" placeholder="Description (optional)" value={desc} onChange={(e) => setDesc(e.target.value)} />
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <button className="btn w-full"><IconPlus width={16} height={16} />Create group</button>
          </form>
        </div>

        <div className="card">
          <div className="section-title mb-3"><span className="text-brand-500"><IconUsers /></span>Groups for your class &amp; school</div>
          {groups.length === 0 && (
            <div className="grid place-items-center py-8 text-center">
              <span className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-500"><IconUsers width={22} height={22} /></span>
              <p className="text-sm font-medium text-slate-700">No groups yet</p>
              <p className="text-sm text-slate-400">Create the first one for your class!</p>
            </div>
          )}
          <ul className="space-y-2">
            {groups.map((g) => (
              <li key={g.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{g.name}</p>
                    {g.description && <p className="text-xs text-slate-500">{g.description}</p>}
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
                      <span className="pill">{g.memberCount} member{g.memberCount === 1 ? '' : 's'}</span>
                      by {g.createdBy.fullName}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {g.isMember ? (
                      <>
                        <button className="btn btn-sm" onClick={() => openGroup(g)}>Open</button>
                        <button className="text-xs text-slate-400 hover:text-red-600" onClick={() => leave(g)}>Leave</button>
                      </>
                    ) : (
                      <button className="btn-ghost btn-sm" onClick={() => join(g)}>Join</button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Group workspace */}
      <div className="card flex flex-col">
        {!open && (
          <div className="grid flex-1 place-items-center py-16 text-center">
            <span className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><IconChat width={22} height={22} /></span>
            <p className="text-sm text-slate-400">Open a group to see members and chat.</p>
          </div>
        )}
        {open && (
          <div className="flex h-full flex-col">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800">{open.name}</h3>
              <span className="pill">{members.length} members</span>
            </div>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {members.map((m) => (
                <span key={m.user.id} className={`${m.role === 'OWNER' ? 'pill-brand' : 'pill'} ${isOwner && m.role !== 'OWNER' ? 'pr-1' : ''}`}>
                  {m.user.fullName}{m.role === 'OWNER' ? ' ★' : ''}
                  {isOwner && m.role !== 'OWNER' && (
                    <button onClick={() => removeMember(m)} className="ml-0.5 rounded-full p-0.5 text-slate-400 hover:bg-red-100 hover:text-red-600" aria-label={`Remove ${m.user.fullName}`}>
                      <IconTrash width={12} height={12} />
                    </button>
                  )}
                </span>
              ))}
            </div>

            {/* Owner-only: add classmates */}
            {isOwner && (
              <div className="mb-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-3">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <IconUsers width={14} height={14} /> Add classmates
                </p>
                {eligible.length === 0 ? (
                  <p className="text-sm text-slate-400">
                    No other classmates from your school &amp; class have registered yet.
                  </p>
                ) : (
                  <ul className="max-h-40 space-y-1 overflow-y-auto">
                    {eligible.map((c) => (
                      <li key={c.id} className="flex items-center justify-between rounded-lg bg-white px-3 py-1.5">
                        <span className="min-w-0">
                          <span className="block truncate text-sm text-slate-700">{c.fullName}</span>
                          <span className="block truncate text-xs text-slate-400">{c.email}</span>
                        </span>
                        <button className="btn btn-sm shrink-0" onClick={() => addMember(c)}>
                          <IconPlus width={14} height={14} />Add
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <form onSubmit={post} className="mb-3 flex gap-2">
              <input className="input" placeholder="Share something with your group…" value={msg} onChange={(e) => setMsg(e.target.value)} />
              <button className="btn shrink-0">Post</button>
            </form>
            <ul className="space-y-2 overflow-y-auto">
              {posts.length === 0 && <p className="text-sm text-slate-400">No messages yet. Say hi 👋</p>}
              {posts.map((p) => (
                <li key={p.id} className="rounded-xl bg-slate-50 p-3">
                  <p className="text-sm text-slate-800">{p.body}</p>
                  <p className="mt-1 text-xs text-slate-400">{p.author.fullName} · {new Date(p.createdAt).toLocaleString()}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
