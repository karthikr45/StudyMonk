'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/client/api';
import { IconUsers, IconPlus, IconChat } from '@/components/icons';
import GroupWorkspace from './GroupWorkspace';

interface Group {
  id: string; name: string; description: string | null; memberCount: number;
  isMember: boolean; myRole: string | null; createdBy: { id: string; fullName: string };
}

export default function GroupsTab({ meId, initialGroupId, initialTab }: { meId: string; initialGroupId?: string | null; initialTab?: string | null }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [scope, setScope] = useState<{ schoolDisplay: string; academicYear: string } | null>(null);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Group | null>(null);
  const onErr = (e: unknown) => e && setError(e instanceof ApiError ? e.message : String(e));

  async function load() {
    const d = await api.get<{ groups: Group[]; scope: typeof scope }>('/api/groups');
    setGroups(d.groups); setScope(d.scope);
    if (open) setOpen(d.groups.find((g) => g.id === open.id) ?? null);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load().catch(() => {}); }, []);

  // Auto-open a deep-linked group (from a notification) once it's a member match.
  useEffect(() => {
    if (initialGroupId && !open) {
      const g = groups.find((x) => x.id === initialGroupId && x.isMember);
      if (g) setOpen(g);
    }
  }, [groups, initialGroupId, open]);

  async function create(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    try { await api.post('/api/groups', { name, description: desc || undefined }); setName(''); setDesc(''); await load(); }
    catch (err) { onErr(err); }
  }
  async function join(g: Group) { try { await api.post(`/api/groups/${g.id}/join`); await load(); } catch (e) { onErr(e); } }
  async function leave(g: Group) {
    try { await api.post(`/api/groups/${g.id}/leave`); if (open?.id === g.id) setOpen(null); await load(); } catch (e) { onErr(e); }
  }

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <div className="space-y-5">
        {error && (
          <div className="flex items-start justify-between gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-sm text-red-700">
            <span>{error}</span><button onClick={() => setError(null)}>✕</button>
          </div>
        )}
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
              <li key={g.id} className={`rounded-xl border p-3 ${open?.id === g.id ? 'border-brand-300 bg-brand-50/40' : 'border-slate-200'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{g.name}</p>
                    {g.description && <p className="text-xs text-slate-500">{g.description}</p>}
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400"><span className="pill">{g.memberCount} member{g.memberCount === 1 ? '' : 's'}</span> by {g.createdBy.fullName}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {g.isMember ? (
                      <>
                        <button className="btn btn-sm" onClick={() => setOpen(g)}>Open</button>
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

      {open
        ? <GroupWorkspace group={open} meId={meId} initialTab={initialTab} onErr={onErr} />
        : (
          <div className="card grid place-items-center py-16 text-center">
            <span className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><IconChat width={22} height={22} /></span>
            <p className="text-sm text-slate-400">Open a group to chat, share files, make cards, quizzes and polls.</p>
          </div>
        )}
    </div>
  );
}
