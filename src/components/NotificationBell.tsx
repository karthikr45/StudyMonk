'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/client/api';
import { IconBell } from './icons';

interface Note {
  id: string; type: string; actorName: string; groupId: string | null; groupName: string | null; excerpt: string | null;
  read: boolean; createdAt: string;
}

export default function NotificationBell() {
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  function goto(n: Note) {
    setOpen(false);
    if (n.groupId) router.push(`/dashboard?tab=groups&group=${n.groupId}`);
  }

  async function load() {
    try {
      const d = await api.get<{ notifications: Note[]; unread: number }>('/api/notifications');
      setNotes(d.notifications); setUnread(d.unread);
    } catch { /* ignore */ }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 20000); // near real-time
    return () => clearInterval(t);
  }, []);

  // Close on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      setUnread(0);
      setNotes((n) => n.map((x) => ({ ...x, read: true })));
      await api.post('/api/notifications').catch(() => {});
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={toggle} className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50" aria-label="Notifications">
        <IconBell width={17} height={17} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{unread > 9 ? '9+' : unread}</span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded-xl border border-slate-200 bg-white shadow-lift">
          <div className="border-b border-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700">Notifications</div>
          <ul className="max-h-80 overflow-y-auto">
            {notes.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate-400">Nothing yet.</li>}
            {notes.map((n) => (
              <li key={n.id} onClick={() => goto(n)} className={`cursor-pointer px-4 py-2.5 text-sm hover:bg-slate-50 ${n.read ? '' : 'bg-brand-50/50'}`}>
                <p className="text-slate-800">
                  <b>{n.actorName}</b> {n.type === 'MENTION' ? 'mentioned you' : 'replied to you'}
                  {n.groupName && <> in <b>{n.groupName}</b></>}
                </p>
                {n.excerpt && <p className="mt-0.5 truncate text-xs text-slate-500">“{n.excerpt}”</p>}
                <p className="mt-0.5 text-[11px] text-slate-400">{new Date(n.createdAt).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
