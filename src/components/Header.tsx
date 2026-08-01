'use client';

import { MeUser } from '@/lib/client/useAuth';
import { IconLogo } from './icons';
import NotificationBell from './NotificationBell';
import UserMenu from './UserMenu';

export default function Header({ user, subtitle }: { user: MeUser; subtitle?: string }) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/70 backdrop-blur-xl">
      <div className="h-0.5 w-full bg-brand-gradient" />
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-lift transition-transform duration-200 hover:scale-105">
            <IconLogo />
          </span>
          <div>
            <p className="font-display text-base font-bold leading-tight text-slate-900">StudyMonk</p>
            {subtitle && <p className="text-xs font-medium text-slate-500">{subtitle}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <NotificationBell />
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  );
}
