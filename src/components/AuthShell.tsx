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
      <div className={`relative w-full ${wide ? 'max-w-lg' : 'max-w-md'} animate-fade-in`}>
        <Link href="/" className="mb-6 flex items-center justify-center gap-2.5">
          <BrandMark size={40} className="shadow-lift transition-transform duration-200 hover:scale-105" />
          <span className="font-display text-xl font-bold text-slate-900">Study<span className="text-brand-600">Monk</span></span>
        </Link>
        <div className="card sm:p-6">
          <h1 className="text-xl font-bold text-slate-900">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-4 text-center text-sm text-slate-500">{footer}</div>}
      </div>
    </main>
  );
}
