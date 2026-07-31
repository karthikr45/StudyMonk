'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/client/api';

interface Board { id: string; name: string; code: string }
interface Klass { id: string; name: string; level: number }

export default function RegisterPage() {
  const router = useRouter();
  const [boards, setBoards] = useState<Board[]>([]);
  const [classes, setClasses] = useState<Klass[]>([]);
  const [form, setForm] = useState({
    fullName: '', email: '', password: '',
    boardId: '', classId: '', academicYear: '', schoolName: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<{ boards: Board[] }>('/api/catalog/boards')
      .then((d) => setBoards(d.boards))
      .catch(() => setError('Could not load boards. Ask your admin to set them up.'));
  }, []);

  useEffect(() => {
    if (!form.boardId) { setClasses([]); return; }
    api.get<{ classes: Klass[] }>(`/api/catalog/classes?boardId=${form.boardId}`)
      .then((d) => setClasses(d.classes))
      .catch(() => setClasses([]));
  }, [form.boardId]);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.post('/api/auth/register', form);
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Registration failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-10">
      <div className="card">
        <h1 className="text-2xl font-semibold">Create student account</h1>
        <p className="mt-1 text-sm text-slate-500">
          Choose your board and class to see the right study content.
        </p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="label">Full name</label>
            <input className="input" value={form.fullName}
              onChange={(e) => set('fullName', e.target.value)} required />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" value={form.email}
                onChange={(e) => set('email', e.target.value)} required autoComplete="email" />
            </div>
            <div>
              <label className="label">Password</label>
              <input type="password" className="input" value={form.password}
                onChange={(e) => set('password', e.target.value)} required minLength={8}
                autoComplete="new-password" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Board</label>
              <select className="input" value={form.boardId}
                onChange={(e) => { set('boardId', e.target.value); set('classId', ''); }} required>
                <option value="">Select board</option>
                {boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Class</label>
              <select className="input" value={form.classId}
                onChange={(e) => set('classId', e.target.value)} required disabled={!form.boardId}>
                <option value="">Select class</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Academic year</label>
              <input className="input" placeholder="2025-2026" value={form.academicYear}
                onChange={(e) => set('academicYear', e.target.value)} required
                pattern="\d{4}-\d{4}" />
            </div>
            <div>
              <label className="label">School name</label>
              <input className="input" value={form.schoolName}
                onChange={(e) => set('schoolName', e.target.value)} required />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn w-full" disabled={busy}>
            {busy ? 'Creating…' : 'Create account'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-brand hover:underline">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
