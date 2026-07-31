'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/client/api';

interface Group {
  id: string; name: string; description: string | null; memberCount: number;
  isMember: boolean; myRole: string | null; createdBy: { id: string; fullName: string };
}
interface Member { role: string; joinedAt: string; user: { id: string; fullName: string } }
interface Post { id: string; body: string; createdAt: string; author: { id: string; fullName: string } }

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

  async function load() {
    const d = await api.get<{ groups: Group[]; scope: typeof scope }>('/api/groups');
    setGroups(d.groups);
    setScope(d.scope);
  }
  useEffect(() => { load().catch(() => {}); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/api/groups', { name, description: desc || undefined });
      setName(''); setDesc('');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create group');
    }
  }
  async function join(g: Group) { await api.post(`/api/groups/${g.id}/join`); await load(); }
  async function leave(g: Group) {
    await api.post(`/api/groups/${g.id}/leave`);
    if (open?.id === g.id) setOpen(null);
    await load();
  }
  async function openGroup(g: Group) {
    setOpen(g);
    const d = await api.get<{ members: Member[]; posts: Post[] }>(`/api/groups/${g.id}`);
    setMembers(d.members); setPosts(d.posts);
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
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="space-y-4">
        <div className="card">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Create a study group</h3>
          {scope && (
            <p className="mt-1 text-xs text-slate-500">
              Only classmates from <b>{scope.schoolDisplay}</b> ({scope.academicYear}) in your class can join.
            </p>
          )}
          <form onSubmit={create} className="mt-3 space-y-3">
            <input className="input" placeholder="Group name" value={name}
              onChange={(e) => setName(e.target.value)} required minLength={2} />
            <input className="input" placeholder="Description (optional)" value={desc}
              onChange={(e) => setDesc(e.target.value)} />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button className="btn">Create group</button>
          </form>
        </div>

        <div className="card">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Groups for your class & school</h3>
          {groups.length === 0 && <p className="text-sm text-slate-400">No groups yet. Create the first one!</p>}
          <ul className="space-y-2">
            {groups.map((g) => (
              <li key={g.id} className="rounded-md border border-slate-200 p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{g.name}</p>
                    {g.description && <p className="text-xs text-slate-500">{g.description}</p>}
                    <p className="mt-1 text-xs text-slate-400">
                      {g.memberCount} member{g.memberCount === 1 ? '' : 's'} · by {g.createdBy.fullName}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {g.isMember ? (
                      <>
                        <button className="text-sm font-medium text-brand hover:underline" onClick={() => openGroup(g)}>Open</button>
                        <button className="text-xs text-slate-400 hover:text-red-600" onClick={() => leave(g)}>Leave</button>
                      </>
                    ) : (
                      <button className="text-sm font-medium text-brand hover:underline" onClick={() => join(g)}>Join</button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Group workspace */}
      <div className="card">
        {!open && <p className="text-sm text-slate-400">Open a group to see members and the discussion.</p>}
        {open && (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-800">{open.name}</h3>
              <span className="text-xs text-slate-400">{members.length} members</span>
            </div>
            <div className="mb-3 flex flex-wrap gap-1">
              {members.map((m) => (
                <span key={m.user.id} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                  {m.user.fullName}{m.role === 'OWNER' ? ' ★' : ''}
                </span>
              ))}
            </div>
            <form onSubmit={post} className="mb-3 flex gap-2">
              <input className="input" placeholder="Share something with your group…" value={msg}
                onChange={(e) => setMsg(e.target.value)} />
              <button className="btn">Post</button>
            </form>
            <ul className="space-y-2">
              {posts.length === 0 && <p className="text-sm text-slate-400">No messages yet.</p>}
              {posts.map((p) => (
                <li key={p.id} className="rounded-md bg-slate-50 p-3">
                  <p className="text-sm text-slate-800">{p.body}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {p.author.fullName} · {new Date(p.createdAt).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
