'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto max-w-xl px-5 py-20">
      <section className="card p-8">
        <span className="eyebrow text-brand-600">LET’S TRY THAT AGAIN</span>
        <h1 className="mt-3 text-3xl font-bold">A small interruption.</h1>
        <p className="my-5 text-slate-600">
          This page couldn’t load. Try again to reconnect. If you were
          submitting work, check its status before resubmitting.
        </p>
        <div className="flex flex-wrap gap-3">
          <button className="btn" onClick={reset}>
            Try again ↗
          </button>
          <a className="btn-ghost" href="/dashboard">
            Back to workspace
          </a>
        </div>
      </section>
    </main>
  );
}
