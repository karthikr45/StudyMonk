'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMe } from '@/lib/client/useAuth';
import { IconLogo, IconBook, IconUsers, IconShield } from '@/components/icons';

const features = [
  { icon: IconBook, title: 'NCERT content by class', body: 'Read the exact study material for your board and class, organised subject → chapter.' },
  { icon: IconUsers, title: 'Study groups', body: 'Team up with classmates from your school, class and academic year — with a shared discussion feed.' },
  { icon: IconShield, title: 'Secure by design', body: 'Two-level API security, encrypted passwords and role-based access built in.' },
];

export default function Home() {
  const { user, loading } = useMe();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace(user.role === 'SUPER_ADMIN' ? '/admin' : '/dashboard');
    }
  }, [user, loading, router]);

  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* soft background accents */}
      <div className="pointer-events-none absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-brand-100 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-40 h-72 w-72 rounded-full bg-indigo-50 blur-3xl" />

      <nav className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-lift">
            <IconLogo />
          </span>
          <span className="text-lg font-bold text-slate-900">StudyMonk</span>
        </div>
        <Link href="/login" className="btn-ghost btn-sm">Sign in</Link>
      </nav>

      <section className="relative mx-auto max-w-3xl px-6 pb-8 pt-16 text-center animate-fade-in">
        <span className="pill-brand mb-5">CBSE · After-school learning</span>
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
          Study your NCERT content,<br className="hidden sm:block" /> together.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-slate-600">
          A focused CBSE study space for students. Read your class content offline
          after school, and learn as a group with classmates from your own school.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/register" className="btn w-full sm:w-auto">Create student account</Link>
          <Link href="/login" className="btn-ghost w-full sm:w-auto">I already have an account</Link>
        </div>
      </section>

      <section className="relative mx-auto mt-16 grid max-w-5xl gap-5 px-6 pb-20 sm:grid-cols-3">
        {features.map((f) => (
          <div key={f.title} className="card">
            <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <f.icon width={20} height={20} />
            </span>
            <h3 className="text-sm font-semibold text-slate-900">{f.title}</h3>
            <p className="mt-1 text-sm text-slate-600">{f.body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
