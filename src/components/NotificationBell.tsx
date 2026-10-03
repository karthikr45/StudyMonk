'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/client/api';
import { IconBell } from './icons';

interface Note {
  id: string;
  type: string;
  actorName: string;
  groupId: string | null;
  groupName: string | null;
  tab: string | null;
  excerpt: string | null;
  read: boolean;
  createdAt: string;
}

const verb: Record<string, string> = {
  MENTION: 'mentioned you',
  REPLY: 'replied to you',
  FILE: 'shared a file',
  CARD: 'shared a card deck',
  POLL: 'posted a poll',
};

export default function NotificationBell() {
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const ref = useRef<HTMLDivElement>(null);

  function goto(n: Note) {
    setOpen(false);
    void api
      .post('/api/notifications', { id: n.id })
      .then(load)
      .catch(() => setError(true));
    if (n.groupId)
      router.push(
        `/dashboard?tab=groups&group=${n.groupId}${n.tab ? `&gtab=${n.tab}` : ''}`,
      );
  }

  async function load() {
    try {
      const d = await api.get<{ notifications: Note[]; unread: number }>(
        '/api/notifications',
      );
      setNotes(d.notifications);
      setUnread(d.unread);
      setError(false);
    } catch {
      setError(true);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 20000); // near real-time
    return () => clearInterval(t);
  }, []);

  // Close on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function toggle() {
    setOpen((value) => !value);
  }
  return (
    <div className="relative" ref={ref}>
      <button
        ref={buttonRef}
        aria-expanded={open}
        aria-controls="notification-list"
        onClick={toggle}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
        aria-label="Notifications"
      >
        <IconBell width={17} height={17} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          id="notification-list"
          className="fixed inset-x-3 top-16 z-30 sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 mt-2 sm:w-80 rounded-xl border border-slate-200 bg-white shadow-lift"
        >
          <div className="border-b border-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700">
            Notifications
          </div>
          {error && (
            <p role="alert" className="p-3 text-sm text-red-700">
              Could not update notifications.{' '}
              <button className="underline" onClick={load}>
                Retry
              </button>
            </p>
          )}
          {unread > 0 && (
            <button
              className="px-4 py-2 text-sm underline"
              onClick={() =>
                api
                  .post('/api/notifications', { all: true })
                  .then(load)
                  .catch(() => setError(true))
              }
            >
              Mark all as read
            </button>
          )}
          <ul className="max-h-80 overflow-y-auto">
            {notes.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-slate-400">
                Nothing yet.
              </li>
            )}
            {notes.map((n) => (
              <li key={n.id}>
                <button
                  onClick={() => goto(n)}
                  className={`block w-full text-left cursor-pointer px-4 py-2.5 text-sm hover:bg-slate-50 ${n.read ? '' : 'bg-brand-50/50'}`}
                >
                  <p className="text-slate-800">
                    <b>{n.actorName}</b> {verb[n.type] ?? 'sent an update'}
                    {n.groupName && (
                      <>
                        {' '}
                        in <b>{n.groupName}</b>
                      </>
                    )}
                  </p>
                  {n.excerpt && (
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      “{n.excerpt}”
                    </p>
                  )}
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {new Date(n.createdAt).toLocaleString()}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
