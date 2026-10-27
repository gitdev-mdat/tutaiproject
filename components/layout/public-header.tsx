'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { ArrowRight, X } from 'lucide-react';

import { publicNav } from '@/config/navigation';
import {
  resolveLandingCtas,
  resolveProfileDestination,
  type LandingCtaModel,
} from '@/lib/navigation/landing-cta';
import { AccountMenu, DrawerLogoutAction } from './account-menu';

const GUEST_CTAS = resolveLandingCtas({ state: 'GUEST' });

const MOBILE_STATE_CAPTION: Record<LandingCtaModel['state'], string> = {
  GUEST: '',
  AUTHENTICATED_ONBOARDING_INCOMPLETE: 'Hồ sơ chưa hoàn tất',
  AUTHENTICATED_READY_FOR_ASSIGNMENT: 'Sẵn sàng nhận lộ trình',
  AUTHENTICATED_PROGRAM_ASSIGNED: 'Đã có chương trình học',
  AUTHENTICATED_ACTIVE_STUDENT: 'Đang học',
  ASSIGNMENT_BLOCKED: 'Cần kiểm tra hồ sơ',
};

// ─── Shared logo ─────────────────────────────────────────────────────────────

interface TuTaiMarkProps {
  size?: number;
  className?: string;
}

export function TuTaiMark({ size = 28, className }: TuTaiMarkProps) {
  const gradientId = React.useId().replace(/:/g, '');

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect width="28" height="28" rx="8" fill={`url(#${gradientId})`} />
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
          id={gradientId}
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
  );
}

function TuTaiLogo() {
  return (
    <span className="flex items-center gap-2.5 whitespace-nowrap">
      <TuTaiMark />
      <span className="text-[1rem] font-bold tracking-tight" style={{ color: '#EEF2FF' }}>
        Tú Tài
      </span>
    </span>
  );
}

// ─── Mobile drawer (fully custom, portal-mounted) ────────────────────────────

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
  ctas: LandingCtaModel;
}

function MobileDrawer({ open, onClose, ctas }: MobileDrawerProps) {
  const drawerRef = React.useRef<HTMLDivElement>(null);
  const closeRef = React.useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = React.useState(false);
  // Separate "visible" state so we can animate out before unmounting
  const [visible, setVisible] = React.useState(false);

  // SSR guard — only mount portal after client hydration
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // Drive open → visible → closed lifecycle
  React.useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(true);
    } else {
      // Let CSS transition complete (280ms) before hiding
      const id = setTimeout(() => setVisible(false), 300);
      return () => clearTimeout(id);
    }
  }, [open]);

  // ── Scroll lock ──────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!open) return;
    const scrollY = window.scrollY;
    const prev = document.body.style.cssText;
    // Lock without causing layout shift (compensate for scrollbar width)
    const scrollbarW = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    document.body.style.paddingRight = `${scrollbarW}px`;
    return () => {
      document.body.style.cssText = prev;
      // Restore exact scroll position — no jump
      window.scrollTo({ top: scrollY, behavior: 'instant' });
    };
  }, [open]);

  // ── Focus: move into drawer on open ─────────────────────────────────────
  React.useEffect(() => {
    if (open) {
      // Small delay to let the drawer paint first
      const id = setTimeout(() => closeRef.current?.focus(), 50);
      return () => clearTimeout(id);
    }
  }, [open]);

  // ── Focus trap ───────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!open) return;
    const el = drawerRef.current;
    if (!el) return;

    function getFocusable() {
      return Array.from(
        el!.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])'
        )
      );
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusable = getFocusable();
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!mounted || !visible) return null;

  // ── Animation state ──────────────────────────────────────────────────────
  const easing = 'cubic-bezier(0.22, 1, 0.36, 1)';
  const dur = '260ms';

  return createPortal(
    <>
      {/* ── Backdrop ── */}
      <div
        aria-hidden="true"
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9998,
          background: 'rgba(2, 10, 24, 0.58)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          opacity: open ? 1 : 0,
          transition: `opacity ${dur} ${easing}`,
        }}
      />

      {/* ── Drawer panel ── */}
      <div
        id="mobile-nav-drawer"
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Menu điều hướng"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: 9999,
          width: 'min(82vw, 320px)',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(180deg, #071A35 0%, #0A2245 100%)',
          borderLeft: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '-20px 0 50px rgba(0, 8, 24, 0.25)',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: `transform ${dur} ${easing}`,
          paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 22px',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            flexShrink: 0,
          }}
        >
          <Link href="/" onClick={onClose}>
            <TuTaiLogo />
          </Link>

          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Đóng menu"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.7)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <X size={18} strokeWidth={2.2} />
          </button>
        </div>

        {/* ── Navigation items ── */}
        <nav aria-label="Điều hướng di động" style={{ padding: '12px 12px 0', flexShrink: 0 }}>
          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            {publicNav.flatMap((section) =>
              section.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      minHeight: 48,
                      padding: '0 14px',
                      borderRadius: 12,
                      fontSize: 16,
                      fontWeight: 500,
                      color: 'rgba(255,255,255,0.82)',
                      textDecoration: 'none',
                      transition: 'background 150ms ease, color 150ms ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                      e.currentTarget.style.color = '#FFFFFF';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'rgba(255,255,255,0.82)';
                    }}
                  >
                    {item.title}
                  </Link>
                </li>
              ))
            )}
          </ul>
        </nav>

        {/* ── Divider ── */}
        <div
          aria-hidden="true"
          style={{
            height: 1,
            background: 'rgba(255,255,255,0.06)',
            margin: '20px 12px',
            flexShrink: 0,
          }}
        />

        {/* ── Account actions ── */}
        <div
          style={{
            padding: '0 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            flexShrink: 0,
          }}
        >
          {ctas.displayName ? (
            <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-white">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#0052FF_0%,#1448E0_100%)] text-sm font-bold">
                {ctas.displayName.trim().charAt(0).toLocaleUpperCase('vi')}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{ctas.displayName}</span>
                <span className="block truncate text-xs text-white/55">
                  {MOBILE_STATE_CAPTION[ctas.state]}
                </span>
              </span>
            </div>
          ) : null}

          {ctas.header.secondary ? (
            <Link
              href={ctas.header.secondary.path}
              onClick={onClose}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 46,
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.14)',
                background: 'rgba(255,255,255,0.03)',
                fontSize: 15,
                fontWeight: 550,
                color: 'rgba(255,255,255,0.90)',
                textDecoration: 'none',
                transition: 'background 150ms ease, border-color 150ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.07)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.22)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)';
              }}
            >
              {ctas.header.secondary.label}
            </Link>
          ) : null}

          {/* Primary CTA */}
          <Link
            href={ctas.header.primary.path}
            onClick={onClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              height: 48,
              borderRadius: 12,
              background: '#1768FF',
              fontSize: 15,
              fontWeight: 600,
              color: '#FFFFFF',
              textDecoration: 'none',
              boxShadow: '0 6px 20px rgba(23,104,255,0.30)',
              transition: 'background 150ms ease, box-shadow 150ms ease',
              letterSpacing: '-0.01em',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#1558EB';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(23,104,255,0.40)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#1768FF';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(23,104,255,0.30)';
            }}
          >
            {ctas.header.primary.label}
            <ArrowRight size={15} strokeWidth={2.2} aria-hidden="true" />
          </Link>

          {/* Account actions for signed-in students — profile + logout must be reachable on mobile */}
          {ctas.displayName ? (
            <>
              <Link
                href={resolveProfileDestination(ctas.state)}
                onClick={onClose}
                className="flex h-11 w-full items-center justify-between rounded-xl border border-white/[0.1] bg-white/[0.02] px-3.5 text-sm font-medium text-[#E4ECFA] transition-colors hover:bg-white/[0.07] hover:text-white"
              >
                Hồ sơ học tập
                <span aria-hidden="true" className="text-[#8FA9D4]">
                  →
                </span>
              </Link>
              <DrawerLogoutAction />
            </>
          ) : null}
        </div>
      </div>
    </>,
    document.body
  );
}

// ─── Public header ────────────────────────────────────────────────────────────

// PublicHeader: rendered inside the Hero. By default it scrolls away
// naturally when the Hero leaves the viewport; pass sticky to pin it to
// the top of the viewport instead (the hosting frame must reserve the
// header height, see --public-header-height).
export function PublicHeader({
  ctas = GUEST_CTAS,
  sticky = false,
}: {
  ctas?: LandingCtaModel;
  sticky?: boolean;
}) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  // Guests are in the acquisition funnel: the header keeps a visible accented entry point.
  // Signed-in students already get one dominant next action in the hero, so the header
  // action is demoted to a quiet duplicate instead of a second competing primary.
  const isGuest = ctas.state === 'GUEST';

  const openDrawer = React.useCallback(() => setMobileOpen(true), []);
  const closeDrawer = React.useCallback(() => setMobileOpen(false), []);

  return (
    // z-50: the hero frame is an isolated stacking context whose floating artwork uses
    // z-index 20. The header must sit above it so the account dropdown (and its options)
    // can never be overlapped by hero glass cards.
    <header
      className={
        sticky
          ? 'fixed inset-x-0 top-0 z-50 box-border px-[14px] pt-[14px] lg:px-6 lg:pt-4'
          : 'relative z-50 box-border px-[14px] pt-[14px] lg:px-6 lg:pt-4'
      }
    >
      {/* Pill — full-width centered container with no scroll-dependent styles */}
      <div className="mx-auto flex h-14 max-w-[1440px] box-border items-center justify-between rounded-[13px] border border-white/[0.09] bg-[linear-gradient(180deg,rgba(18,36,64,0.80)_0%,rgba(12,26,52,0.76)_100%)] px-2.5 shadow-[0_10px_28px_rgba(0,10,30,0.16)] backdrop-blur-[18px] lg:h-[68px] lg:rounded-[18px] lg:px-6 lg:shadow-[0_14px_40px_rgba(0,10,30,0.18)]">
        {/* Wordmark */}
        <Link
          href="/"
          aria-label="Tú Tài – Trang chủ"
          className="flex shrink-0 items-center rounded-lg transition-opacity hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7ca8ff]"
        >
          <TuTaiLogo />
        </Link>

        {/* Desktop navigation */}
        <nav className="hidden lg:flex items-center gap-0.5" aria-label="Điều hướng chính">
          {publicNav.flatMap((section) =>
            section.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="relative px-3.5 py-1.5 text-sm font-medium rounded-full transition-all duration-150"
                style={{ letterSpacing: '-0.005em', color: 'rgba(210,220,235,0.72)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#FFFFFF';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'rgba(210,220,235,0.72)';
                }}
              >
                {item.title}
              </Link>
            ))
          )}
        </nav>

        {/* Desktop actions */}
        <div className="hidden lg:flex items-center gap-2.5 shrink-0">
          {ctas.displayName ? <AccountMenu ctas={ctas} displayName={ctas.displayName} /> : null}

          {ctas.header.secondary ? (
            <Link
              href={ctas.header.secondary.path}
              className="flex items-center rounded-full px-4 h-9 text-sm font-medium transition-all duration-150"
              style={{
                color: 'rgba(210,220,235,0.80)',
                background: 'transparent',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#FFFFFF';
                e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'rgba(210,220,235,0.80)';
                e.currentTarget.style.background = 'transparent';
              }}
            >
              {ctas.header.secondary.label}
            </Link>
          ) : null}

          {/* Header next-step action.
              CTA hierarchy: the hero owns the ONE dominant next action per viewport, so this
              header control is deliberately quiet — same destination, lower visual weight.
              Guests (who see the sign-up funnel) keep a slightly stronger accent border. */}
          <Link
            href={ctas.header.primary.path}
            className="group flex h-9 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7ca8ff] motion-reduce:transition-none"
            style={{
              borderColor: isGuest ? 'rgba(120,170,255,0.55)' : 'rgba(255,255,255,0.16)',
              background: isGuest ? 'rgba(0,82,255,0.16)' : 'rgba(255,255,255,0.05)',
              color: isGuest ? '#DCE8FF' : 'rgba(228,236,250,0.92)',
              letterSpacing: '-0.01em',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = isGuest
                ? 'rgba(0,82,255,0.28)'
                : 'rgba(255,255,255,0.11)';
              e.currentTarget.style.color = '#FFFFFF';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = isGuest
                ? 'rgba(0,82,255,0.16)'
                : 'rgba(255,255,255,0.05)';
              e.currentTarget.style.color = isGuest ? '#DCE8FF' : 'rgba(228,236,250,0.92)';
            }}
          >
            {ctas.header.primary.label}
            <ArrowRight
              size={13}
              aria-hidden="true"
              className="transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
            />
          </Link>
        </div>

        {/* ── Mobile hamburger — only visible on < lg ── */}
        <div className="lg:hidden">
          <button
            type="button"
            onClick={openDrawer}
            aria-label="Mở menu điều hướng"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav-drawer"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-medium text-[#9cabc7] transition-colors hover:bg-white/[0.06] hover:text-white active:bg-white/[0.1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7ca8ff]"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="4" x2="20" y1="6" y2="6" />
              <line x1="4" x2="20" y1="12" y2="12" />
              <line x1="4" x2="20" y1="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Custom mobile drawer — portal-mounted, desktop-invisible ── */}
      <MobileDrawer open={mobileOpen} onClose={closeDrawer} ctas={ctas} />
    </header>
  );
}
