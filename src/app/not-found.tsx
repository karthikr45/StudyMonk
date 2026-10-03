import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-5 py-20">
      <section className="card p-8">
        <span className="eyebrow text-brand-600">404 · WRONG TURN</span>
        <h1 className="mt-3 text-3xl font-bold">
          Let’s get you back on track.
        </h1>
        <p className="my-5 text-slate-600">
          This page doesn’t exist or has moved.
        </p>
        <Link className="btn" href="/dashboard">
          Go to my workspace ↗
        </Link>
      </section>
    </main>
  );
}
