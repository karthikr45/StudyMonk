'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMe } from '@/lib/client/useAuth';

export default function Home() {
  const { user, loading } = useMe();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace(user.role === 'SUPER_ADMIN' ? '/admin' : '/dashboard');
    }
  }, [user, loading, router]);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center">
      <h1 className="text-4xl font-bold tracking-tight text-slate-900">StudyMonk</h1>
      <p className="mt-3 max-w-xl text-slate-600">
        CBSE study platform for after-school learning. Read your NCERT content by
        board and class, and study together with classmates from your school in
        combined study groups.
      </p>
      <div className="mt-8 flex gap-3">
        <Link href="/login" className="btn">
          Sign in
        </Link>
        <Link href="/register" className="btn-ghost">
          Create student account
        </Link>
      </div>
    </main>
  );
}
