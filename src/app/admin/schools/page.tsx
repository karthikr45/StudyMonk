'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMe } from '@/lib/client/useAuth';
import { useRemote } from '@/lib/client/useRemote';
import { api } from '@/lib/client/api';
import Header from '@/components/Header';
import LoadError from '@/components/LoadError';
function SchoolManager() {
  const { data, loading, error, retry } = useRemote<{
    schools: { id: string; name: string; isActive: boolean }[];
  }>('/api/admin/schools');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [message, setMessage] = useState('');
  const [saveError, setSaveError] = useState('');
  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setSaveError('');
    setMessage('');
    try {
      const result = await api.post<{ school: { name: string } }>(
        '/api/admin/schools',
        { name },
      );
      setName('');
      setMessage(
        `${result.school.name} added. It is now available at student signup.`,
      );
      retry();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Could not add school');
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
      <section className="card">
        <h2 className="text-lg font-bold">Add a school</h2>
        <p className="mt-2 mb-5 text-sm text-slate-600">
          Students choose from this list when creating an account.
        </p>
        <form onSubmit={add} className="space-y-4">
          <div>
            <label htmlFor="school-name" className="label">
              School name
            </label>
            <input
              id="school-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              maxLength={160}
              disabled={busy}
              placeholder="Enter the official school name"
            />
          </div>
          <button className="btn" disabled={busy || name.trim().length < 2}>
            {busy ? 'Adding…' : '+ Add school'}
          </button>
        </form>
        {message && (
          <p role="status" className="mt-4 text-sm text-emerald-700">
            {message}
          </p>
        )}
        {saveError && (
          <p role="alert" className="mt-4 text-sm text-red-700">
            {saveError}
          </p>
        )}
      </section>
      <section className="card">
        <h2 className="mb-4 text-lg font-bold">School directory</h2>
        {loading && <p role="status">Loading schools…</p>}
        {error && <LoadError message={error} retry={retry} />}
        {data &&
          (data.schools.length ? (
            <ul className="divide-y divide-slate-100">
              {data.schools.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 py-4"
                >
                  <span className="font-semibold">{s.name}</span>
                  <span className="pill-brand">
                    {s.isActive ? 'Available at signup' : 'Inactive'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-600">
              No schools yet. Add your first school.
            </p>
          ))}
      </section>
    </div>
  );
}
export default function SchoolsPage() {
  const { user, loading } = useMe();
  const router = useRouter();
  useEffect(() => {
    if (!loading && !user) router.replace('/login');
    else if (!loading && user?.role !== 'SUPER_ADMIN')
      router.replace('/dashboard');
  }, [loading, user, router]);
  if (loading || !user || user.role !== 'SUPER_ADMIN')
    return (
      <main className="p-8" role="status">
        Loading…
      </main>
    );
  return (
    <>
      <Header user={user} subtitle="School management" />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <h1 className="text-3xl font-bold">Your school community.</h1>
        <p className="mt-2 mb-7 text-slate-600">
          Manage the schools students can select at signup.
        </p>
        <SchoolManager />
      </main>
    </>
  );
}
