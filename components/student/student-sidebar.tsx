'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Map,
  User,
  Dumbbell,
  FileText,
  LogOut,
  Trophy,
  Swords,
} from 'lucide-react';
import type { StudentShellModel } from '@/lib/student/types';

const DESTINATION_ICONS: Record<string, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard,
  roadmap: Map,
  practice: Dumbbell,
  exams: FileText,
  rankings: Trophy,
  arena: Swords,
  profile: User,
};

function isDestinationActive(pathname: string, href: string): boolean {
  if (href === '/student/dashboard') {
    // Treat the bare /student redirect target as part of the dashboard destination
    // without letting it ambiguously activate any other entry.
    return pathname === href || pathname === '/student' || pathname.startsWith(href + '/');
  }
  return pathname === href || pathname.startsWith(href + '/');
}

export function StudentSidebar({ model }: { model: StudentShellModel }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);
  const [logoutError, setLogoutError] = React.useState<string | null>(null);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    setLogoutError(null);
    try {
      const response = await fetch('/api/auth/demo-logout', { method: 'POST' });
      if (!response.ok) {
        throw new Error('Logout request failed');
      }
      router.push('/auth/login');
      router.refresh();
    } catch {
      setIsLoggingOut(false);
      setLogoutError('Đăng xuất không thành công. Vui lòng thử lại.');
    }
  };

  return (
    <aside className="flex h-full w-[244px] flex-col border-r border-[#E5EBF3] bg-white">
      {/* Logo */}
      <div className="flex h-20 items-center px-6">
        <Link href="/student/dashboard" className="flex items-center gap-2.5">
          <svg width="38" height="38" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="8" fill="url(#logoGrad)" />
            <path
              d="M8 20.5L11.5 9L14 14.5L16.5 8.5L20 20.5"
              stroke="white"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <circle cx="14" cy="17" r="1.5" fill="rgba(255,255,255,0.5)" />
            <defs>
              <linearGradient
                id="logoGrad"
                x1="0"
                y1="0"
                x2="28"
                y2="28"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#0052FF" />
                <stop offset="1" stopColor="#1448E0" />
              </linearGradient>
            </defs>
          </svg>
          <span className="flex flex-col text-[18px] font-extrabold leading-tight tracking-tight text-[#091224]">
            Tú Tài
            <small className="text-[9px] font-semibold tracking-normal text-slate-400">
              Học vững vàng · Vươn xa hơn
            </small>
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-4 py-6" aria-label="Điều hướng học tập">
        {model.destinations.map((item) => {
          const isActive = isDestinationActive(pathname, item.href);
          const Icon = DESTINATION_ICONS[item.id] ?? Map;
          return (
            <React.Fragment key={item.id}>
              {item.id === 'profile' && (
                <div aria-hidden="true" className="my-3 border-t border-slate-100" />
              )}
              <Link
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-[14px] font-semibold transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon size={18} strokeWidth={isActive ? 2.5 : 2} aria-hidden="true" />
                {item.title}
              </Link>
            </React.Fragment>
          );
        })}
      </nav>

      {/* Student Profile & Logout */}
      <div className="border-t border-slate-100 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 font-bold">
            {model.identity.initials}
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="truncate text-[14px] font-bold text-[#091224]">
              {model.identity.name}
            </span>
            {model.identity.email && (
              <span className="truncate text-[12px] font-medium text-slate-500">
                {model.identity.email}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          aria-describedby="student-logout-status"
          className="mt-3 flex w-full items-center gap-2 rounded-xl px-2 py-2 text-[13px] font-semibold text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
        >
          <LogOut size={15} strokeWidth={2.5} aria-hidden="true" />
          {isLoggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}
        </button>
        <div
          id="student-logout-status"
          role="status"
          aria-live="polite"
          className="mt-2 min-h-[16px] text-[12px] font-medium text-red-500"
        >
          {logoutError}
        </div>
      </div>
    </aside>
  );
}
