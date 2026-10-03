'use client';

import Link from 'next/link';
import BrandMark from './BrandMark';

export default function AuthShell({
  title,
  subtitle,
  children,
  footer,
  wide,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-10">
      <div className="pointer-events-none absolute -top-24 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-brand-100 blur-3xl" />
      <div className="auth-layout relative w-full max-w-6xl animate-fade-in">
        <aside
          className="auth-story hidden lg:flex"
          aria-label="Welcome to StudyMonk"
        >
          <span className="eyebrow">
            A LITTLE CURIOSITY. A LOT OF POSSIBILITY.
          </span>
          <h2>
            Your next
            <br />
            lightbulb
            <br />
            <span>moment.</span>
          </h2>
          <p>
            A space to find your focus, learn with friends, and see how far you
            can go.
          </p>
          <div className="auth-tags">
            <span>Study your way</span>
            <span>Grow together</span>
            <span>See your progress</span>
          </div>
          <div className="auth-art" aria-hidden="true">
            ✳
          </div>
        </aside>
        <div className={`w-full mx-auto ${wide ? 'max-w-lg' : 'max-w-md'}`}>
          <Link
            href="/"
            className="mb-6 flex items-center justify-center gap-2.5"
          >
            <BrandMark
              size={40}
              className="shadow-lift transition-transform duration-200 hover:scale-105"
            />
            <span className="font-display text-xl font-bold text-slate-900">
              Study<span className="text-brand-600">Monk</span>
            </span>
          </Link>
          <div className="card sm:p-6">
            <h1 className="text-xl font-bold text-slate-900">{title}</h1>
            {subtitle && (
              <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
            )}
            <div className="mt-6">{children}</div>
          </div>
          {footer && (
            <div className="mt-4 text-center text-sm text-slate-500">
              {footer}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
