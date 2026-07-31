'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/client/api';
import AuthShell from '@/components/AuthShell';

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
      .catch(() => setError('Could not load boards. Ask your admin to set them up first.'));
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
    <AuthShell
      wide
      title="Create your student account"
      subtitle="Pick your board and class to see the right study content."
      footer={
        <>
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-brand-600 hover:underline">Sign in</Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="label">Full name</label>
          <input className="input" value={form.fullName}
            onChange={(e) => set('fullName', e.target.value)} required placeholder="Aarav Sharma" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Email</label>
            <input type="email" className="input" value={form.email}
              onChange={(e) => set('email', e.target.value)} required autoComplete="email" placeholder="you@example.com" />
          </div>
          <div>
            <label className="label">Password</label>
            <input type="password" className="input" value={form.password}
              onChange={(e) => set('password', e.target.value)} required minLength={8}
              autoComplete="new-password" placeholder="Min 8 characters" />
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
              onChange={(e) => set('academicYear', e.target.value)} required pattern="\d{4}-\d{4}" />
          </div>
          <div>
            <label className="label">School name</label>
            <input className="input" value={form.schoolName}
              onChange={(e) => set('schoolName', e.target.value)} required placeholder="Delhi Public School" />
          </div>
        </div>
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        <button className="btn w-full" disabled={busy}>
          {busy ? 'Creating…' : 'Create account'}
        </button>
      </form>
    </AuthShell>
  );
}
