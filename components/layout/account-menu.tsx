'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronDown, LogOut } from 'lucide-react';

import { resolveProfileDestination, type LandingCtaModel } from '@/lib/navigation/landing-cta';

function initial(name: string): string {
  return name.trim().charAt(0).toLocaleUpperCase('vi') || '•';
}

const STATE_CAPTION: Record<LandingCtaModel['state'], string> = {
  GUEST: '',
  AUTHENTICATED_ONBOARDING_INCOMPLETE: 'Hồ sơ chưa hoàn tất',
  AUTHENTICATED_READY_FOR_ASSIGNMENT: 'Sẵn sàng nhận lộ trình',
  AUTHENTICATED_PROGRAM_ASSIGNED: 'Đã có chương trình học',
  AUTHENTICATED_ACTIVE_STUDENT: 'Đang học',
  ASSIGNMENT_BLOCKED: 'Cần kiểm tra hồ sơ',
};

/** Shared logout action so header and mobile drawer behave identically. */
export function useLogout() {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const logout = React.useCallback(async () => {
    setLoggingOut(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error('logout failed');
      router.replace('/');
      router.refresh();
    } catch {
      setError('Không đăng xuất được. Em thử lại nhé.');
    } finally {
      setLoggingOut(false);
    }
  }, [router]);

  return { logout, loggingOut, error };
}

/** Full-width logout row used inside the mobile drawer. */
export function DrawerLogoutAction() {
  const { logout, loggingOut, error } = useLogout();

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={logout}
        disabled={loggingOut}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/[0.1] text-sm font-medium text-white/65 transition-colors hover:border-red-400/30 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-55"
      >
        <LogOut size={15} aria-hidden="true" />
        {loggingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}
      </button>
      <p role="status" aria-live="polite" className="px-1 text-xs text-red-300">
        {error}
      </p>
    </div>
  );
}

/**
 * Header account entry for authenticated visitors on public pages.
 *
 * Presentation only: the next-step destination comes from the lifecycle CTA model,
 * logout uses the existing `/api/auth/logout` endpoint.
 */
export function AccountMenu({ ctas, displayName }: { ctas: LandingCtaModel; displayName: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loggingOut, setLoggingOut] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const wrapRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const logout = React.useCallback(async () => {
    setLoggingOut(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error('logout failed');
      setOpen(false);
      router.replace('/');
      router.refresh();
    } catch {
      setError('Không đăng xuất được. Em thử lại nhé.');
    } finally {
      setLoggingOut(false);
    }
  }, [router]);

  const caption = STATE_CAPTION[ctas.state];

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-9 max-w-52 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] pl-1 pr-2.5 text-sm font-medium text-white/85 transition-colors duration-150 hover:bg-white/[0.09] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7ca8ff]"
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#0052FF_0%,#1448E0_100%)] text-xs font-bold text-white">
          {initial(displayName)}
        </span>
        <span className="truncate">{displayName}</span>
        <ChevronDown
          size={14}
          aria-hidden="true"
          className="shrink-0 text-white/55 transition-transform duration-150 motion-reduce:transition-none"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Tài khoản"
          className="absolute right-0 top-[calc(100%+10px)] z-[120] w-[17.5rem] origin-top-right overflow-hidden rounded-2xl border border-white/15 p-1.5 shadow-[0_24px_56px_rgba(0,8,26,0.62)] motion-safe:animate-[accountMenuIn_140ms_cubic-bezier(0.22,1,0.36,1)]"
          style={{
            // Opaque base (not translucent) so no option can sink into hero artwork.
            background: '#0B1A33',
            backgroundImage: 'linear-gradient(180deg, #132646 0%, #0A1730 100%)',
          }}
        >
          <div className="flex items-center gap-2.5 px-2 pb-2.5 pt-2">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#0052FF_0%,#1448E0_100%)] text-sm font-bold text-white">
              {initial(displayName)}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-white">{displayName}</span>
              {caption ? (
                <span className="mt-0.5 block truncate text-xs font-medium text-[#9DB6DC]">
                  {caption}
                </span>
              ) : null}
            </span>
          </div>

          <div aria-hidden="true" className="mx-1 mb-1.5 h-px bg-white/[0.12]" />

          <Link
            href={resolveProfileDestination(ctas.state)}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex min-h-11 items-center justify-between gap-2 rounded-xl px-2.5 text-sm font-medium text-[#E4ECFA] transition-colors duration-150 hover:bg-white/[0.12] hover:text-white focus-visible:bg-white/[0.12] focus-visible:text-white focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#9CC6FF] motion-reduce:transition-none"
          >
            Hồ sơ học tập
            <span aria-hidden="true" className="text-[#8FA9D4]">
              →
            </span>
          </Link>

          <button
            type="button"
            role="menuitem"
            onClick={logout}
            disabled={loggingOut}
            aria-busy={loggingOut}
            className="mt-0.5 flex min-h-11 w-full items-center gap-2 rounded-xl px-2.5 text-sm font-medium text-[#E4ECFA] transition-colors duration-150 hover:bg-[rgba(239,68,68,0.16)] hover:text-[#FFB4B4] focus-visible:bg-[rgba(239,68,68,0.16)] focus-visible:text-[#FFB4B4] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#9CC6FF] disabled:cursor-not-allowed disabled:text-[#9DB6DC] disabled:hover:bg-transparent motion-reduce:transition-none"
          >
            <LogOut size={15} aria-hidden="true" />
            {loggingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}
          </button>

          <p
            role="status"
            aria-live="polite"
            className={error ? 'px-2.5 pb-1 pt-1.5 text-xs font-medium text-[#FFA9A9]' : 'sr-only'}
          >
            {error}
          </p>
        </div>
      ) : null}
    </div>
  );
}
