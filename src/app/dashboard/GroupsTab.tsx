'use client';

import { useCallback, useState } from 'react';
import { api, ApiError } from '@/lib/client/api';
import { IconUsers, IconPlus, IconChat } from '@/components/icons';
import { useRemote } from '@/lib/client/useRemote';
import LoadError from '@/components/LoadError';
import GroupWorkspace from './GroupWorkspace';

interface Group {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  isMember: boolean;
  myRole: string | null;
  createdBy: { id: string; fullName: string };
}

export default function GroupsTab({
  meId,
  initialGroupId,
  initialTab,
  onSelect,
}: {
  meId: string;
  initialGroupId?: string | null;
  initialTab?: string | null;
  onSelect: (id: string | null, tab: string | null) => void;
}) {
  const {
    data,
    loading,
    error: loadError,
    retry,
  } = useRemote<{
    groups: Group[];
    scope: { schoolDisplay: string; academicYear: string };
  }>('/api/groups');
  const groups = data?.groups ?? [];
  const scope = data?.scope;
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState('');
  const open =
    groups.find((g) => g.id === initialGroupId && g.isMember) ?? null;
  const onErr = useCallback((e: unknown) => {
    if (e) setError(e instanceof Error ? e.message : String(e));
  }, []);
  const load = async () => retry();
  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.post('/api/groups', { name, description: desc || undefined });
      setName('');
      setDesc('');
      await load();
    } catch (err) {
      onErr(err);
    } finally {
      setBusy(false);
    }
  }
  async function join(g: Group) {
    if (busy) return;
    setBusy(true);
    try {
      await api.post(`/api/groups/${g.id}/join`);
      await load();
    } catch (e) {
      onErr(e);
    } finally {
      setBusy(false);
    }
  }
  async function leave(g: Group) {
    if (
      busy ||
      !window.confirm(
        g.myRole === 'OWNER'
          ? 'Leave this group? Ownership passes to another member; an empty group is closed.'
          : 'Leave this study group?',
      )
    )
      return;
    setBusy(true);
    try {
      await api.post(`/api/groups/${g.id}/leave`);
      if (open?.id === g.id) onSelect(null, null);
      await load();
    } catch (e) {
      onErr(e);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p role="status">Loading your groups…</p>;
  if (loadError) return <LoadError message={loadError} retry={retry} />;
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[310px_minmax(0,1fr)]">
      <div className={`space-y-5 ${open ? 'hidden md:block' : ''}`}>
        {error && (
          <div className="flex items-start justify-between gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-sm text-red-700">
            <span>{error}</span>
            <button aria-label="Dismiss error" onClick={() => setError(null)}>
              ✕
            </button>
          </div>
        )}
        <button
          className="btn-ghost"
          aria-expanded={creating}
          onClick={() => setCreating(!creating)}
        >
          + Create a study group
        </button>
        {creating && (
          <div className="card">
            <h2 className="section-title mb-3">Create a study group</h2>
            {scope && (
              <p className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">
                Only classmates from <b>{scope.schoolDisplay}</b> (
                {scope.academicYear}) in your class can join.
              </p>
            )}
            <form onSubmit={create} className="space-y-2">
              <input
                className="input"
                aria-label="Group name"
                placeholder="Group name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
              />
              <input
                className="input"
                aria-label="Description (optional)"
                placeholder="Description (optional)"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
              />
              <button disabled={busy} className="btn w-full">
                <IconPlus width={16} height={16} />
                Create group
              </button>
            </form>
          </div>
        )}

        <div className="card">
          <div className="section-title mb-3">
            <span className="text-brand-500">
              <IconUsers />
            </span>
            Your study circles
          </div>
          {groups.length === 0 && (
            <div className="grid place-items-center py-8 text-center">
              <span className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-500">
                <IconUsers width={22} height={22} />
              </span>
              <p className="text-sm font-medium text-slate-700">
                No groups yet
              </p>
              <p className="text-sm text-slate-400">
                Create the first one for your class!
              </p>
            </div>
          )}
          <label className="sr-only" htmlFor="group-search">
            Find a group
          </label>
          <input
            id="group-search"
            className="input mb-4"
            type="search"
            placeholder="Find your circle…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {groups.length > 0 &&
            !groups.some((g) =>
              g.name.toLowerCase().includes(query.toLowerCase()),
            ) && (
              <p role="status" className="text-sm text-slate-500">
                No matching groups.
              </p>
            )}
          <ul className="space-y-2">
            {groups
              .filter((g) => g.name.toLowerCase().includes(query.toLowerCase()))
              .map((g) => (
                <li
                  key={g.id}
                  className={`rounded-xl border p-3 ${open?.id === g.id ? 'border-brand-300 bg-brand-50/40' : 'border-slate-200'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800">
                        {g.name}
                      </p>
                      {g.description && (
                        <p className="text-xs text-slate-500">
                          {g.description}
                        </p>
                      )}
                      <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
                        <span className="pill">
                          {g.memberCount} member{g.memberCount === 1 ? '' : 's'}
                        </span>{' '}
                        by {g.createdBy.fullName}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {g.isMember ? (
                        <>
                          <button
                            className="btn btn-sm"
                            onClick={() => onSelect(g.id, 'chat')}
                          >
                            {open?.id === g.id ? 'Active' : 'Open →'}
                          </button>
                          <button
                            className="text-xs text-slate-400 hover:text-red-600"
                            disabled={busy}
                            onClick={() => leave(g)}
                          >
                            Leave
                          </button>
                        </>
                      ) : (
                        <button
                          className="btn-ghost btn-sm"
                          disabled={busy}
                          onClick={() => join(g)}
                        >
                          Join
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
          </ul>
        </div>
      </div>

      {open ? (
        <div className="min-w-0">
          <button
            className="btn-ghost mb-3 md:hidden"
            onClick={() => onSelect(null, null)}
          >
            ← All groups
          </button>
          {error && (
            <p role="alert" className="mb-3 text-red-700">
              {error}
            </p>
          )}
          <GroupWorkspace
            key={open.id}
            group={open}
            meId={meId}
            initialTab={initialTab}
            onTab={(section) => onSelect(open.id, section)}
            onErr={onErr}
          />
        </div>
      ) : (
        <div className="card grid place-items-center py-16 text-center">
          <span className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <IconChat width={22} height={22} />
          </span>
          <p className="text-sm text-slate-400">
            Open a group to chat, share files, make cards, quizzes and polls.
          </p>
        </div>
      )}
    </div>
  );
}
