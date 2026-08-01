'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMe } from '@/lib/client/useAuth';
import { api } from '@/lib/client/api';
import { IconBook, IconUsers, IconShield, IconChevron, IconFile } from '@/components/icons';
import BrandMark from '@/components/BrandMark';

interface BoardCard { id: string; name: string; code: string; classCount: number; subjectCount: number; studentCount: number }
interface ClassCard { id: string; name: string; level: number; boardName: string; subjectCount: number; studentCount: number }
interface SubjectCard { id: string; name: string; boardName: string; className: string; chapterCount: number; studentCount: number }
interface Overview {
  boards: BoardCard[]; classes: ClassCard[]; subjects: SubjectCard[];
  totals: { boards: number; classes: number; subjects: number; students: number };
}

const accents = [
  'from-brand-600 to-brand-800',
  'from-brand-500 to-brand-700',
  'from-brand-500 to-accent-500',
  'from-accent-500 to-accent-600',
  'from-brand-400 to-brand-600',
  'from-brand-700 to-brand-500',
];

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <p className="text-3xl font-extrabold text-slate-900">{value}</p>
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
    </div>
  );
}

export default function Home() {
  const { user, loading } = useMe();
  const router = useRouter();
  const [data, setData] = useState<Overview | null>(null);

  useEffect(() => {
    if (!loading && user) {
      router.replace(user.role === 'SUPER_ADMIN' ? '/admin' : '/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    api.get<Overview>('/api/catalog/overview').then(setData).catch(() => setData(null));
  }, []);

  const hasContent = data && (data.boards.length > 0 || data.subjects.length > 0);

  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* animated atmosphere */}
      <div className="orb -top-40 left-1/2 h-[34rem] w-[34rem] -translate-x-1/2 animate-float bg-brand-200/50" />
      <div className="orb right-[-6rem] top-40 h-96 w-96 animate-float bg-accent-500/12" style={{ animationDelay: '1.5s' }} />
      <div className="orb left-[-6rem] top-72 h-80 w-80 animate-float bg-brand-300/30" style={{ animationDelay: '3s' }} />
      <div className="pointer-events-none absolute inset-0 hero-grid" />

      {/* Nav */}
      <nav className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <BrandMark size={38} className="shadow-lift" />
          <span className="font-display text-lg font-bold text-slate-900">Study<span className="text-brand-600">Monk</span></span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/login" className="btn-ghost btn-sm">Sign in</Link>
          <Link href="/register" className="btn btn-sm">Get started</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative mx-auto max-w-3xl px-6 pb-6 pt-16 text-center">
        <span className="pill-brand mb-5 animate-fade-up">✨ CBSE · After-school learning</span>
        <h1 className="animate-fade-up font-display text-4xl font-extrabold leading-[1.08] tracking-tight text-slate-900 sm:text-6xl" style={{ animationDelay: '80ms' }}>
          Study your NCERT content,<br className="hidden sm:block" /> <span className="text-gradient-animated">together.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl animate-fade-up text-lg text-slate-600" style={{ animationDelay: '160ms' }}>
          Read your class content after school and learn as a group with classmates
          from your own school. Everything below is live from your school&apos;s catalog.
        </p>
        <div className="mt-8 flex animate-fade-up flex-col items-center justify-center gap-3 sm:flex-row" style={{ animationDelay: '240ms' }}>
          <Link href="/register" className="btn w-full px-6 py-3 text-base sm:w-auto">Create student account</Link>
          <Link href="/login" className="btn-ghost w-full px-6 py-3 text-base sm:w-auto">I already have an account</Link>
        </div>
      </section>

      {/* Live stats */}
      {hasContent && (
        <section className="relative mx-auto mt-6 max-w-3xl px-6">
          <div className="card grid grid-cols-2 gap-6 py-6 sm:grid-cols-4">
            <Stat value={data!.totals.students} label="Students" />
            <Stat value={data!.totals.boards} label="Boards" />
            <Stat value={data!.totals.classes} label="Classes" />
            <Stat value={data!.totals.subjects} label="Subjects" />
          </div>
        </section>
      )}

      {/* Boards */}
      {data && data.boards.length > 0 && (
        <section className="relative mx-auto mt-16 max-w-6xl px-6">
          <h2 className="mb-4 text-xl font-bold text-slate-900">Boards</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.boards.map((b, i) => (
              <div key={b.id} className="card">
                <div className="flex items-center gap-3">
                  <span className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${accents[i % accents.length]} text-white shadow-sm`}>
                    <IconBook width={22} height={22} />
                  </span>
                  <div>
                    <p className="text-lg font-bold text-slate-900">{b.name}</p>
                    <p className="text-xs uppercase tracking-wide text-slate-400">{b.code}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-4 text-sm text-slate-500">
                  <span>{b.classCount} classes</span>
                  <span>{b.subjectCount} subjects</span>
                  <span className="flex items-center gap-1 text-brand-600"><IconUsers width={15} height={15} />{b.studentCount}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Classes */}
      {data && data.classes.length > 0 && (
        <section className="relative mx-auto mt-14 max-w-6xl px-6">
          <h2 className="mb-4 text-xl font-bold text-slate-900">Classes</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {data.classes.map((c, i) => (
              <div key={c.id} className="card">
                <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${accents[i % accents.length]} text-sm font-bold text-white shadow-sm`}>
                  {c.level}
                </span>
                <p className="mt-3 text-base font-bold text-slate-900">{c.name}</p>
                <p className="text-xs text-slate-400">{c.boardName}</p>
                <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
                  <span>{c.subjectCount} subjects</span>
                  <span className="flex items-center gap-1 text-brand-600"><IconUsers width={15} height={15} />{c.studentCount}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Subjects — one premium card each */}
      {data && data.subjects.length > 0 && (
        <section className="relative mx-auto mt-14 max-w-6xl px-6">
          <h2 className="mb-4 text-xl font-bold text-slate-900">Subjects</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.subjects.map((s, i) => (
              <Link key={s.id} href="/register"
                className="group card transition hover:-translate-y-0.5 hover:shadow-lift">
                <div className="flex items-start justify-between">
                  <span className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${accents[i % accents.length]} text-white shadow-sm`}>
                    <IconBook width={20} height={20} />
                  </span>
                  <IconChevron className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500" />
                </div>
                <h3 className="mt-4 text-base font-bold text-slate-900">{s.name}</h3>
                <p className="text-xs text-slate-400">{s.boardName} · {s.className}</p>
                <div className="mt-3 flex items-center gap-4 text-sm text-slate-500">
                  <span className="flex items-center gap-1.5"><IconFile width={15} height={15} className="text-slate-400" />{s.chapterCount} chapters</span>
                  <span className="flex items-center gap-1.5 text-brand-600"><IconUsers width={15} height={15} />{s.studentCount} students</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Empty state when no catalog yet */}
      {data && !hasContent && (
        <section className="relative mx-auto mt-10 max-w-xl px-6">
          <div className="card grid place-items-center py-14 text-center">
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-500"><IconBook width={24} height={24} /></span>
            <p className="text-sm font-medium text-slate-700">No content published yet</p>
            <p className="mt-1 text-sm text-slate-400">Boards, classes and subjects will appear here once the admin adds them.</p>
          </div>
        </section>
      )}

      {/* Features */}
      <section className="relative mx-auto mt-20 grid max-w-5xl gap-5 px-6 pb-24 sm:grid-cols-3">
        {[
          { icon: IconBook, title: 'NCERT by class', body: 'Content organised board → class → subject → chapter, exactly for your class.' },
          { icon: IconUsers, title: 'Study groups', body: 'Team up with classmates from your school, class and academic year.' },
          { icon: IconShield, title: 'Secure by design', body: 'Two-level API security, encrypted passwords and role-based access.' },
        ].map((f) => (
          <div key={f.title} className="card">
            <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><f.icon width={20} height={20} /></span>
            <h3 className="text-sm font-semibold text-slate-900">{f.title}</h3>
            <p className="mt-1 text-sm text-slate-600">{f.body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
