'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMe } from '@/lib/client/useAuth';
import Header from '@/components/Header';
import CatalogManager from './CatalogManager';

export default function AdminPage() {
  const { user, loading } = useMe();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
    if (!loading && user && user.role !== 'SUPER_ADMIN') router.replace('/dashboard');
  }, [user, loading, router]);

  if (loading || !user || user.role !== 'SUPER_ADMIN') {
    return <main className="p-10 text-sm text-slate-500">Loading…</main>;
  }

  return (
    <div className="min-h-screen">
      <Header user={user} subtitle="Super Admin — Content Management" />
      <main className="mx-auto max-w-6xl px-6 py-6">
        <CatalogManager />
      </main>
    </div>
  );
}
