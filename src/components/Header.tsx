'use client';

import { logout, MeUser } from '@/lib/client/useAuth';

export default function Header({ user, subtitle }: { user: MeUser; subtitle?: string }) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div>
          <p className="text-lg font-semibold text-slate-900">StudyMonk</p>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-medium text-slate-800">{user.fullName}</p>
            <p className="text-xs text-slate-500">{user.email}</p>
          </div>
          <button className="btn-ghost" onClick={() => logout()}>
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
