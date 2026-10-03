'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

export default function QuickNavigate({ admin }: { admin: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const routes = admin
    ? [
        ['Overview', '/admin', 'Your workspace and review queue'],
        [
          'Enrollments',
          '/admin/enrollments',
          'Approve students, manage batches and transfers',
        ],
        ['Schools', '/admin/schools', 'Manage the school directory'],
        ['Assessments', '/admin/assessments', 'Build, publish and review work'],
        ['Analytics', '/admin/analytics', 'Understand student progress'],
        ['Study groups', '/admin/groups', 'Manage your learning communities'],
      ]
    : [
        [
          'Study',
          '/dashboard?tab=study',
          'Subjects, learning materials and focus timer',
        ],
        [
          'Assessments',
          '/dashboard?tab=assess',
          'Practice, assignments and exams',
        ],
        ['Progress', '/dashboard?tab=progress', 'See your learning progress'],
        [
          'Study groups',
          '/dashboard?tab=groups',
          'Chat, share notes and learn together',
        ],
        [
          'Learning history',
          '/dashboard/history',
          'Your previous years and submitted work',
        ],
      ];
  function open() {
    setQuery('');
    dialog.current?.showModal();
    input.current?.focus();
  }
  useEffect(() => {
    function key(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (dialog.current?.open) dialog.current.close();
        else open();
      }
    }
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  const matches = routes.filter((route) =>
    `${route[0]} ${route[2]}`
      .toLowerCase()
      .includes(query.toLowerCase().trim()),
  );
  return (
    <>
      <button
        type="button"
        className="quick-trigger"
        onClick={open}
        aria-label="Open quick navigation"
      >
        <span aria-hidden="true">⌕</span>
        <span className="hidden md:inline">Quick jump</span>
        <kbd className="hidden lg:inline">⌘ / Ctrl K</kbd>
      </button>
      <dialog
        ref={dialog}
        className="command-dialog"
        aria-labelledby="quick-title"
        onClick={(e) => {
          if (e.target === dialog.current) dialog.current.close();
        }}
      >
        <div className="p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id="quick-title" className="text-lg font-bold">
              Where to next?
            </h2>
            <button
              className="btn-ghost btn-sm"
              onClick={() => dialog.current?.close()}
              aria-label="Close quick navigation"
            >
              Esc ×
            </button>
          </div>
          <input
            ref={input}
            className="input"
            type="search"
            aria-label="Find a page"
            placeholder="Search your workspace…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <nav aria-label="Quick navigation" className="mt-3 space-y-1">
            {matches.map(([name, href, description]) => (
              <Link
                key={href}
                href={href}
                onClick={() => dialog.current?.close()}
                className="command-result"
              >
                <span>
                  <strong className="block text-sm">{name}</strong>
                  <span className="mt-1 block text-xs text-slate-500">
                    {description}
                  </span>
                </span>
                <span aria-hidden="true">↗</span>
              </Link>
            ))}
            {!matches.length && (
              <p className="p-5 text-sm text-slate-500" role="status">
                No pages match. Try “study” or “assessments”.
              </p>
            )}
          </nav>
          <p className="mt-4 text-xs text-slate-500">
            Tab to move · Enter to open · Escape to close
          </p>
        </div>
      </dialog>
    </>
  );
}
