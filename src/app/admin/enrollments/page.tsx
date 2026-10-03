'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMe } from '@/lib/client/useAuth';
import { useRemote } from '@/lib/client/useRemote';
import { api } from '@/lib/client/api';
import Header from '@/components/Header';
import LoadError from '@/components/LoadError';
interface Batch {
  id: string;
  label: string;
  archivedAt: string | null;
  classId: string;
  academicYear: string;
}
interface Enrollment {
  id: string;
  status: string;
  batch: Batch;
}
interface Student {
  id: string;
  fullName: string;
  email: string;
  enrollments: Enrollment[];
  _count: { attempts: number };
}
interface Review {
  students: Student[];
  legacyAssessments: {
    id: string;
    title: string;
    _count: { attempts: number };
  }[];
  unmappedGroups: {
    id: string;
    name: string;
    schoolName: string;
    academicYear: string;
  }[];
  audit: {
    id: string;
    action: string;
    studentId: string | null;
    createdAt: string;
    details: unknown;
  }[];
}
function Workspace() {
  const batches = useRemote<{ batches: Batch[] }>('/api/admin/batches');
  const review = useRemote<Review>('/api/admin/enrollments');
  const schools = useRemote<{ schools: { id: string; name: string }[] }>(
    '/api/catalog/schools',
  );
  const boards = useRemote<{ boards: { id: string; name: string }[] }>(
    '/api/catalog/boards',
  );
  const years = useRemote<{ years: string[]; current: string }>(
    '/api/catalog/academic-years',
  );
  const [batch, setBatch] = useState({
    schoolId: '',
    boardId: '',
    classId: '',
    academicYear: '',
    section: '',
  });
  const classes = useRemote<{ classes: { id: string; name: string }[] }>(
    batch.boardId
      ? `/api/catalog/classes?boardId=${encodeURIComponent(batch.boardId)}`
      : null,
  );
  const [search, setSearch] = useState('');
  const [studentId, setStudentId] = useState('');
  const [action, setAction] = useState('APPROVE');
  const [targetBatchId, setTarget] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [sourceId, setSource] = useState('');
  const [assignmentBatch, setAssignmentBatch] = useState('');
  const [evidence, setEvidence] = useState('');
  const assessments = useRemote<{
    assessments: {
      id: string;
      title: string;
      subjectName: string;
      className: string;
    }[];
  }>('/api/admin/overview');
  const student = review.data?.students.find((s) => s.id === studentId);
  const active = student?.enrollments.find((e) => e.status === 'ACTIVE');
  const pending = student?.enrollments.find((e) => e.status === 'PENDING');
  async function run(work: () => Promise<unknown>, success: string) {
    if (busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await work();
      setMessage(success);
      review.retry();
      batches.retry();
      assessments.retry();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Operation failed');
    } finally {
      setBusy(false);
    }
  }
  const options = years.data
    ? [
        `${Number(years.data.current.slice(0, 4)) + 1}-${Number(years.data.current.slice(0, 4)) + 2}`,
        ...years.data.years,
      ]
    : [];
  const open = batches.data?.batches.filter((b) => !b.archivedAt) ?? [];
  return (
    <div className="space-y-7">
      {[batches, review, schools, boards, years].map((r, i) =>
        r.error ? (
          <LoadError key={i} message={r.error} retry={r.retry} />
        ) : null,
      )}
      {message && (
        <p role="status" className="card text-emerald-700">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="card text-red-700">
          {error}
        </p>
      )}
      <section className="card">
        <h2 className="text-xl font-bold">1. Create a school-year batch</h2>
        <p className="my-3 text-sm text-slate-600">
          Each school, board, class, year and optional section is separate.
          Creating next year’s batch does not promote anyone.
        </p>
        <form
          className="grid gap-3 sm:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => api.post('/api/admin/batches', batch), 'Batch is ready.');
          }}
        >
          <label className="label">
            School
            <select
              className="input"
              required
              value={batch.schoolId}
              onChange={(e) => setBatch({ ...batch, schoolId: e.target.value })}
            >
              <option value="">Choose school</option>
              {schools.data?.schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="label">
            Board
            <select
              className="input"
              required
              value={batch.boardId}
              onChange={(e) =>
                setBatch({ ...batch, boardId: e.target.value, classId: '' })
              }
            >
              <option value="">Choose board</option>
              {boards.data?.boards.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="label">
            Class
            <select
              className="input"
              required
              value={batch.classId}
              disabled={!batch.boardId || classes.loading || !!classes.error}
              onChange={(e) => setBatch({ ...batch, classId: e.target.value })}
            >
              <option value="">
                {!batch.boardId
                  ? 'Choose board first'
                  : classes.loading
                    ? 'Loading classes…'
                    : 'Choose class'}
              </option>
              {classes.data?.classes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            {batch.boardId && classes.error && (
              <span role="alert" className="text-red-600">
                Classes could not be loaded.{' '}
                <button
                  type="button"
                  className="underline"
                  onClick={classes.retry}
                >
                  Retry
                </button>
              </span>
            )}
            {batch.boardId &&
              !classes.loading &&
              !classes.error &&
              classes.data?.classes.length === 0 && (
                <span>
                  No classes configured. Add classes in the admin catalog first.
                </span>
              )}
          </label>
          <label className="label">
            Academic year
            <select
              className="input"
              required
              value={batch.academicYear}
              onChange={(e) =>
                setBatch({ ...batch, academicYear: e.target.value })
              }
            >
              <option value="">Choose year</option>
              {options.map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
          </label>
          <label className="label">
            Section (optional)
            <input
              className="input"
              maxLength={30}
              value={batch.section}
              onChange={(e) => setBatch({ ...batch, section: e.target.value })}
            />
          </label>
          <button disabled={busy} className="btn self-end">
            Create batch
          </button>
        </form>
      </section>
      <section className="card">
        <h2 className="text-xl font-bold">2. Review or move a student</h2>
        <p className="my-3 text-sm text-slate-600">
          Verify school membership before approval. Promotion advances one class
          in the same school next year. Repeat keeps the same class next year.
          Transfer changes batches within the same academic year.
        </p>
        <label className="label">
          Search students
          <input
            type="search"
            className="input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name or email"
          />
        </label>
        <label className="label">
          Student
          <select
            className="input"
            value={studentId}
            onChange={(e) => {
              setStudentId(e.target.value);
              setReason('');
              setTarget('');
            }}
          >
            <option value="">Choose student</option>
            {review.data?.students
              .filter((s) =>
                `${s.fullName} ${s.email}`
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName} · {s.email} ·{' '}
                  {s.enrollments[0]?.status ?? 'UNMAPPED'}
                </option>
              ))}
          </select>
        </label>
        {student && (
          <>
            <ul className="my-3 space-y-2">
              {student.enrollments.map((e) => (
                <li key={e.id} className="rounded-lg bg-slate-50 p-3 text-sm">
                  {e.batch.label} <span className="pill">{e.status}</span>
                </li>
              ))}
            </ul>
            {student._count.attempts > 0 && (
              <div className="my-3 rounded-xl bg-amber-50 p-4 text-sm">
                <p>
                  {student._count.attempts} unfinished attempt(s). Finalization
                  submits only server-saved answers and cannot be undone.
                </p>
                <button
                  className="btn-ghost mt-2"
                  disabled={busy}
                  onClick={() =>
                    run(
                      () => api.patch('/api/admin/enrollments', { studentId }),
                      'Open attempts finalized.',
                    )
                  }
                >
                  Finalize saved attempts
                </button>
              </div>
            )}
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                run(
                  () =>
                    api.post('/api/admin/enrollments', {
                      studentId,
                      action,
                      enrollmentId: ['APPROVE', 'REJECT'].includes(action)
                        ? pending?.id
                        : active?.id,
                      targetBatchId: targetBatchId || undefined,
                      reason,
                    }),
                  'Enrollment updated. History retained.',
                );
              }}
            >
              <label className="label">
                Action
                <select
                  className="input"
                  value={action}
                  onChange={(e) => setAction(e.target.value)}
                >
                  {[
                    'APPROVE',
                    'REJECT',
                    'ENROLL',
                    'PROMOTE',
                    'REPEAT',
                    'TRANSFER',
                    'GRADUATE',
                    'WITHDRAW',
                  ].map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
              </label>
              {['ENROLL', 'PROMOTE', 'REPEAT', 'TRANSFER'].includes(action) && (
                <label className="label">
                  Destination batch
                  <select
                    className="input"
                    required
                    value={targetBatchId}
                    onChange={(e) => setTarget(e.target.value)}
                  >
                    <option value="">Choose destination</option>
                    {open.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="label">
                Verification / reason
                <textarea
                  className="input"
                  required
                  minLength={3}
                  maxLength={500}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <p className="rounded-xl bg-brand-50 p-3 text-sm">
                Review: {student.fullName} · {action} ·{' '}
                {open.find((b) => b.id === targetBatchId)?.label ??
                  pending?.batch.label ??
                  active?.batch.label ??
                  'No enrollment'}
                . Previous records remain in history. Transfers stop access to
                the former batch’s chats.
              </p>
              <button disabled={busy} className="btn">
                Confirm enrollment change
              </button>
            </form>
          </>
        )}
      </section>
      <section className="card">
        <h2 className="text-xl font-bold">3. Assign a fresh assessment</h2>
        <p className="my-3 text-sm text-slate-600">
          Copy an existing assessment to a matching class batch. The new draft
          has no submissions or published answer keys. Publish it from
          Assessment studio after reviewing dates.
        </p>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () =>
                api.post('/api/admin/batch-assignments', {
                  assessmentId: sourceId,
                  batchId: assignmentBatch,
                }),
              'Fresh draft created. Open Assessment studio to review and publish.',
            );
          }}
        >
          <label className="label">
            Source assessment
            <select
              className="input"
              required
              value={sourceId}
              onChange={(e) => setSource(e.target.value)}
            >
              <option value="">Choose assessment</option>
              {assessments.data?.assessments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title} · {a.className} · {a.subjectName}
                </option>
              ))}
            </select>
          </label>
          <label className="label">
            Target batch
            <select
              className="input"
              required
              value={assignmentBatch}
              onChange={(e) => setAssignmentBatch(e.target.value)}
            >
              <option value="">Choose batch</option>
              {open.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          </label>
          <button className="btn" disabled={busy}>
            Create fresh draft for batch
          </button>
        </form>
      </section>
      <section className="card">
        <h2 className="text-xl font-bold">Migration review</h2>
        <p className="my-3 text-sm text-slate-600">
          Old assessments are hidden from current batches until verified.
          Students retain their own submitted results under unassigned history.
          Never assign mixed-year submissions to a guessed batch.
        </p>
        <ul className="mb-4 text-sm">
          {review.data?.legacyAssessments.map((a) => (
            <li className="py-2" key={a.id}>
              {a.title} · {a._count.attempts} attempts{' '}
              <button
                className="ml-3 underline"
                onClick={() => setSource(a.id)}
              >
                Select for review
              </button>
            </li>
          ))}
        </ul>
        <label className="label">
          Evidence for the selected assessment and batch
          <textarea
            className="input"
            minLength={10}
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            placeholder="Record how you verified the school, year and every participant."
          />
        </label>
        <button
          className="btn-ghost"
          disabled={
            busy || !sourceId || !assignmentBatch || evidence.trim().length < 10
          }
          onClick={() =>
            run(
              () =>
                api.post('/api/admin/enrollment-reconcile', {
                  assessmentId: sourceId,
                  batchId: assignmentBatch,
                  reason: evidence,
                }),
              'Historical assessment reconciled and archived.',
            )
          }
        >
          Confirm historical assignment
        </button>
        {review.data?.unmappedGroups.length ? (
          <div className="mt-5">
            <h3 className="font-bold">Unmapped historical groups</h3>
            <p className="my-3 text-sm text-slate-600">
              Select a destination batch and enter evidence above. Verify every
              original member before linking. This creates completed historical
              enrollments where missing and archives the group; it never grants
              current-year access.
            </p>
            {review.data.unmappedGroups.map((g) => (
              <div
                key={g.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b py-3"
              >
                <span>
                  {g.name} · {g.schoolName} · {g.academicYear}
                </span>
                <button
                  className="btn-ghost btn-sm"
                  disabled={
                    busy || !assignmentBatch || evidence.trim().length < 10
                  }
                  onClick={() =>
                    run(
                      () =>
                        api.post('/api/admin/group-reconcile', {
                          groupId: g.id,
                          batchId: assignmentBatch,
                          reason: evidence,
                        }),
                      'Verified historical group linked and archived.',
                    )
                  }
                >
                  Confirm roster and archive
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </section>
      <section className="card">
        <h2 className="text-xl font-bold">Close a finished batch</h2>
        <p className="my-3 text-sm text-slate-600">
          Move, graduate or withdraw all students and resolve pending requests
          first. Archived batches accept no new enrollments or activity.
        </p>
        {open.map((b) => (
          <div
            key={b.id}
            className="flex flex-wrap items-center justify-between gap-2 border-b py-3"
          >
            <span>{b.label}</span>
            <button
              className="btn-ghost btn-sm"
              disabled={busy}
              onClick={() =>
                run(
                  () => api.patch('/api/admin/batches', { id: b.id }),
                  'Batch archived.',
                )
              }
            >
              Archive batch
            </button>
          </div>
        ))}
      </section>
      <details className="card">
        <summary className="cursor-pointer font-semibold">
          Recent enrollment audit
        </summary>
        <ul className="mt-3 space-y-3 text-xs">
          {review.data?.audit.map((a) => (
            <li key={a.id}>
              <b>{a.action}</b> · {new Date(a.createdAt).toLocaleString()}
              <pre className="overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(a.details)}
              </pre>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
export default function EnrollmentPage() {
  const { user, loading } = useMe();
  const router = useRouter();
  useEffect(() => {
    if (!loading && !user) router.replace('/login');
    else if (!loading && user?.role !== 'SUPER_ADMIN')
      router.replace('/dashboard');
  }, [loading, user, router]);
  if (loading || !user || user.role !== 'SUPER_ADMIN')
    return <p className="p-8">Loading…</p>;
  return (
    <>
      <Header user={user} subtitle="Batches & enrollments" />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="mb-2 text-3xl font-bold">Every year, its own story.</h1>
        <p className="mb-7 text-slate-600">
          Approve membership. Move students safely. Preserve their learning
          history.
        </p>
        <Workspace />
      </main>
    </>
  );
}
