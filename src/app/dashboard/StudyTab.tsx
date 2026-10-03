'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRemote } from '@/lib/client/useRemote';
import WorkspaceSkeleton from '@/components/WorkspaceSkeleton';
import LoadError from '@/components/LoadError';
import NextSteps from './NextSteps';
import FocusTimer from './FocusTimer';
import { MeUser } from '@/lib/client/useAuth';
import { IconBook, IconUsers, IconChevron } from '@/components/icons';

interface Subject {
  id: string;
  name: string;
  code: string;
  chapterCount: number;
  studentCount: number;
}

const accents = [
  'from-brand-600 to-brand-800',
  'from-brand-500 to-brand-700',
  'from-brand-500 to-accent-500',
  'from-accent-500 to-accent-600',
  'from-brand-400 to-brand-600',
  'from-brand-700 to-brand-500',
];

export default function StudyTab({ user }: { user: MeUser }) {
  const { data, loading, error, retry } = useRemote<{
    subjects: Subject[];
    classStudentCount: number;
  }>('/api/content/subjects');
  const [query, setQuery] = useState('');
  const subjects = data?.subjects ?? [];
  const classCount = data?.classStudentCount ?? 0;
  if (error) return <LoadError message={error} retry={retry} />;
  if (loading) return <WorkspaceSkeleton label="Loading your subjects…" />;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <NextSteps
          userId={`${user.id}-${user.enrollments.find((e) => e.status === 'ACTIVE')?.id ?? 'none'}`}
        />
        <FocusTimer key={user.id} userId={user.id} />
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-600">
        <span className="pill-brand">
          {user.board?.name} · {user.class?.name}
        </span>
        <span>{subjects.length} subjects to explore</span>
        <span>{classCount} students in your batch</span>
      </div>
      {/* Subjects */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Your subjects</h2>
          <span className="pill">
            {subjects.length} subject{subjects.length === 1 ? '' : 's'}
          </span>
        </div>

        <label className="label" htmlFor="subject-search">
          Find a subject
        </label>
        <input
          id="subject-search"
          className="input mb-3"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search subjects"
        />
        {subjects.length > 0 &&
          !subjects.some((s) =>
            s.name.toLowerCase().includes(query.toLowerCase()),
          ) && <p role="status">No subjects match your search.</p>}
        {subjects.length === 0 ? (
          <div className="card grid place-items-center py-16 text-center">
            <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-2xl bg-brand-50 text-brand-500">
              <IconBook width={24} height={24} />
            </span>
            <p className="text-sm font-medium text-slate-700">
              No subjects published for your class yet
            </p>
            <p className="mt-1 text-sm text-slate-400">
              They&apos;ll appear here once your admin adds them.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {subjects
              .filter((s) => s.name.toLowerCase().includes(query.toLowerCase()))
              .map((s, i) => (
                <Link
                  key={s.id}
                  href={`/dashboard/subject/${s.id}`}
                  style={{ animationDelay: `${Math.min(i, 5) * 55}ms` }}
                  className={`group subject-tile subject-tone-${i % 4}`}
                >
                  <div className="flex items-start justify-between">
                    <span
                      className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${accents[i % accents.length]} text-white shadow-sm`}
                    >
                      <IconBook width={20} height={20} />
                    </span>
                    <IconChevron className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500" />
                  </div>
                  <h3 className="mt-7 text-xl font-bold text-slate-900">
                    {s.name}
                  </h3>
                  <div className="mt-3 flex items-center gap-4 text-sm text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <IconBook
                        width={15}
                        height={15}
                        className="text-slate-400"
                      />
                      {s.chapterCount} chapter{s.chapterCount === 1 ? '' : 's'}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <IconUsers
                        width={15}
                        height={15}
                        className="text-slate-400"
                      />
                      {s.studentCount} enrolled
                    </span>
                  </div>
                  <div className="mt-5 border-t border-black/10 pt-3 text-sm font-semibold">
                    Explore subject{' '}
                    <span className="float-right transition group-hover:translate-x-1">
                      ↗
                    </span>
                  </div>
                </Link>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
