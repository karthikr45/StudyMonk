'use client';

import { logout, MeUser } from '@/lib/client/useAuth';
import { IconLogo, IconLogout } from './icons';

export default function Header({ user, subtitle }: { user: MeUser; subtitle?: string }) {
  const initials = user.fullName
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-lift">
            <IconLogo />
          </span>
          <div>
            <p className="text-base font-bold leading-tight text-slate-900">StudyMonk</p>
            {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="pill-brand hidden sm:inline-flex">
            {user.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Student'}
          </span>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
              {initials}
            </span>
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-tight text-slate-800">{user.fullName}</p>
              <p className="text-xs text-slate-500">{user.email}</p>
            </div>
          </div>
          <button className="btn-ghost btn-sm" onClick={() => logout()}>
            <IconLogout width={15} height={15} />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
