'use client';

import { MeUser } from '@/lib/client/useAuth';
import BrandMark from './BrandMark';
import NotificationBell from './NotificationBell';
import UserMenu from './UserMenu';
import AdminNav from './AdminNav';
import QuickNavigate from './QuickNavigate';

export default function Header({
  user,
  subtitle,
}: {
  user: MeUser;
  subtitle?: string;
}) {
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/70 backdrop-blur-xl">
        <div className="h-0.5 w-full bg-brand-gradient" />
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <BrandMark
              size={40}
              className="shadow-lift transition-transform duration-200 hover:scale-105"
            />
            <div className="min-w-0">
              <p className="font-display text-base font-bold leading-tight text-slate-900">
                Study<span className="text-brand-600">Monk</span>
              </p>
              {subtitle && (
                <p className="max-w-[180px] truncate text-xs font-medium text-slate-500 sm:max-w-none">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <QuickNavigate admin={user.role === 'SUPER_ADMIN'} />
            <NotificationBell />
            <UserMenu user={user} />
          </div>
        </div>
      </header>
      {user.role === 'SUPER_ADMIN' && <AdminNav />}
    </>
  );
}
