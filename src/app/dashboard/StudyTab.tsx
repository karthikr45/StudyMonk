'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/client/api';
import { MeUser } from '@/lib/client/useAuth';
import { IconBook, IconUsers, IconChevron } from '@/components/icons';

interface Subject { id: string; name: string; code: string; chapterCount: number; studentCount: number }

// Colour accents cycled across subject cards for a lively, professional grid.
const accents = [
  'from-indigo-500 to-violet-500',
  'from-sky-500 to-cyan-500',
  'from-emerald-500 to-teal-500',
  'from-amber-500 to-orange-500',
  'from-rose-500 to-pink-500',
  'from-fuchsia-500 to-purple-500',
];

function StatCard({ label, value, sub, icon }: { label: string; value: string; sub?: string; icon: React.ReactNode }) {
  return (
    <div className="card flex items-center gap-4">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">{icon}</span>
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</p>
        <p className="text-lg font-bold text-slate-900">{value}</p>
        {sub && <p className="text-xs text-slate-500">{sub}</p>}
      </div>
    </div>
  );
}

export default function StudyTab({ user }: { user: MeUser }) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classCount, setClassCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ subjects: Subject[]; classStudentCount: number }>('/api/content/subjects')
      .then((d) => { setSubjects(d.subjects); setClassCount(d.classStudentCount); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-slate-500">Loading your subjects…</p>;

  return (
    <div className="space-y-6">
      {/* Context: Board + Class */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Board" value={user.board?.name ?? '—'} sub={user.board?.code?.toUpperCase()} icon={<IconBook width={22} height={22} />} />
        <StatCard label="Class" value={user.class?.name ?? '—'} sub={`Academic year ${user.academicYear ?? ''}`} icon={<IconBook width={22} height={22} />} />
        <StatCard label="Classmates" value={`${classCount}`} sub="students in your class" icon={<IconUsers width={22} height={22} />} />
      </div>

      {/* Subjects */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Your subjects</h2>
          <span className="pill">{subjects.length} subject{subjects.length === 1 ? '' : 's'}</span>
        </div>

        {subjects.length === 0 ? (
          <div className="card grid place-items-center py-16 text-center">
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-500"><IconBook width={24} height={24} /></span>
            <p className="text-sm font-medium text-slate-700">No subjects published for your class yet</p>
            <p className="mt-1 text-sm text-slate-400">They&apos;ll appear here once your admin adds them.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {subjects.map((s, i) => (
              <Link key={s.id} href={`/dashboard/subject/${s.id}`}
                className="group card transition hover:-translate-y-0.5 hover:shadow-lift">
                <div className="flex items-start justify-between">
                  <span className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${accents[i % accents.length]} text-white shadow-sm`}>
                    <IconBook width={20} height={20} />
                  </span>
                  <IconChevron className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500" />
                </div>
                <h3 className="mt-4 text-base font-bold text-slate-900">{s.name}</h3>
                <div className="mt-3 flex items-center gap-4 text-sm text-slate-500">
                  <span className="flex items-center gap-1.5"><IconBook width={15} height={15} className="text-slate-400" />{s.chapterCount} chapter{s.chapterCount === 1 ? '' : 's'}</span>
                  <span className="flex items-center gap-1.5"><IconUsers width={15} height={15} className="text-slate-400" />{s.studentCount} studying</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
