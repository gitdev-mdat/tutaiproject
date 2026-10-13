'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BookOpen,
  LayoutDashboard,
  Map,
  User,
  Dumbbell,
  FileText,
  LogOut,
  Trophy,
  Swords,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import type { StudentDestination, StudentShellModel } from '@/lib/student/types';

const DESTINATION_ICONS: Record<string, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard,
  roadmap: Map,
  lessons: BookOpen,
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

export function StudentSidebar({
  model,
  canAdmin = false,
}: {
  model: StudentShellModel;
  canAdmin?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);
  const [logoutError, setLogoutError] = React.useState<string | null>(null);
  const logoGradient = `logo-grad-${React.useId().replace(/:/g, '')}`;
  const inGroup = (group: StudentDestination['group']) =>
    model.destinations.filter((item) => item.group === group);
  const learn = inGroup('learn');
  const extra = inGroup('extra');
  const compete = inGroup('compete');
  const profile = inGroup('account')[0];
  const profileActive = profile ? isDestinationActive(pathname, profile.href) : false;

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
      <div className="flex h-[76px] shrink-0 items-center px-6">
        <Link href="/student/dashboard" className="flex items-center gap-2.5">
          <svg width="38" height="38" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="8" fill={`url(#${logoGradient})`} />
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
                id={logoGradient}
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

      <nav className="flex-1 overflow-y-auto px-4 pb-4 pt-2" aria-label="Điều hướng học tập">
        <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Hành trình học
        </p>
        <ol className="relative space-y-1">
          <span
            aria-hidden="true"
            className="absolute bottom-6 left-[27px] top-6 w-px bg-gradient-to-b from-blue-200 via-blue-100 to-transparent"
          />
          {learn.map((item) => {
            const isActive = isDestinationActive(pathname, item.href);
            const Icon = DESTINATION_ICONS[item.id] ?? Map;
            return (
              <li key={item.id} className="relative">
                <Link
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={`group flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    isActive ? 'bg-blue-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <span
                    className={`relative grid size-8 shrink-0 place-items-center rounded-lg ring-4 ring-white transition-colors ${
                      isActive
                        ? 'bg-[#0052FF] text-white'
                        : 'bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-slate-800'
                    }`}
                  >
                    <Icon size={16} strokeWidth={isActive ? 2.5 : 2} aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span
                      className={`block text-[14px] font-bold leading-5 ${
                        isActive ? 'text-blue-700' : 'text-slate-700 group-hover:text-slate-900'
                      }`}
                    >
                      {item.title}
                    </span>
                    {item.hint && (
                      <span className="block truncate text-[12px] leading-4 text-slate-400">
                        {item.hint}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>

        {[
          { label: 'Luyện thêm', items: extra },
          { label: 'Thi đấu', items: compete },
        ].map(
          (section) =>
            section.items.length > 0 && (
              <div key={section.label} className="mt-5">
                <p className="px-3 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  {section.label}
                </p>
                <ul className="space-y-0.5">
                  {section.items.map((item) => {
                    const isActive = isDestinationActive(pathname, item.href);
                    const Icon = DESTINATION_ICONS[item.id] ?? Map;
                    return (
                      <li key={item.id}>
                        <Link
                          href={item.href}
                          aria-current={isActive ? 'page' : undefined}
                          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                            isActive
                              ? 'bg-blue-50 text-blue-700'
                              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                          }`}
                        >
                          <Icon size={16} strokeWidth={2} aria-hidden="true" />
                          {item.title}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )
        )}
      </nav>

      {/* Account and, for admins, a clearly separate way out of the student area */}
      <div className="space-y-2 border-t border-slate-100 p-4">
        {canAdmin && (
          <Link
            href="/admin"
            className="flex items-center gap-2.5 rounded-xl border border-dashed border-slate-300 px-3 py-2 text-[12px] font-semibold text-slate-500 transition-colors hover:border-slate-400 hover:bg-slate-50 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <ShieldCheck size={15} strokeWidth={2} aria-hidden="true" />
            <span className="flex-1">Khu quản trị nội dung</span>
            <ChevronRight size={14} aria-hidden="true" />
          </Link>
        )}
        <Link
          href={profile?.href ?? '/student/profile'}
          aria-current={profileActive ? 'page' : undefined}
          aria-label={`Hồ sơ của ${model.identity.name}`}
          className={`flex items-center gap-3 rounded-xl p-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
            profileActive ? 'bg-blue-50' : 'hover:bg-slate-50'
          }`}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[13px] font-bold text-blue-600">
            {model.identity.initials}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[13px] font-bold text-[#091224]">
              {model.identity.name}
            </span>
            <span className="truncate text-[12px] font-medium text-slate-500">
              Hồ sơ và cài đặt
            </span>
          </span>
          <User size={15} className="shrink-0 text-slate-400" aria-hidden="true" />
        </Link>
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          aria-describedby="student-logout-status"
          className="flex w-full items-center gap-2 rounded-xl px-3 py-1.5 text-[13px] font-semibold text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <LogOut size={15} strokeWidth={2.5} aria-hidden="true" />
          {isLoggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}
        </button>
        <div
          id="student-logout-status"
          role="status"
          aria-live="polite"
          className="min-h-0 text-[12px] font-medium text-red-500 empty:hidden"
        >
          {logoutError}
        </div>
      </div>
    </aside>
  );
}
