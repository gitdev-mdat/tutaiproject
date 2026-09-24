'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

function TuTaiLogo() {
  return (
    <span className="flex items-center gap-2.5">
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
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
      <span className="text-[1rem] font-bold tracking-tight" style={{ color: '#091224' }}>
        Tú Tài
      </span>
    </span>
  );
}

export function AuthHeader() {
  const pathname = usePathname();
  const isLogin = pathname === '/auth/login';

  return (
    <header className="relative z-10 w-full pt-3 md:pt-4 lg:pt-5 mb-6 lg:mb-2">
      <div
        className="mx-auto flex h-[56px] md:h-[64px] items-center justify-between w-[calc(100%-24px)] lg:w-[calc(100%-48px)] max-w-[1680px] rounded-[16px] lg:rounded-[20px] px-4 lg:px-6"
        style={{
          background: 'rgba(255, 255, 255, 0.88)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(15,23,42,0.07)',
          boxShadow: '0 2px 12px rgba(15,23,42,0.04)',
        }}
      >
        <Link href="/" className="flex shrink-0 items-center transition-opacity hover:opacity-70">
          <TuTaiLogo />
        </Link>

        <div className="flex items-center gap-3">
          <span className="hidden text-[13px] font-medium text-slate-500 sm:inline-block">
            {isLogin ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}
          </span>
          <Link
            href={isLogin ? '/auth/register' : '/auth/login'}
            className={`flex h-9 items-center justify-center rounded-[12px] px-4 text-[13px] font-bold transition-all ${
              isLogin
                ? 'bg-[#0052FF] text-white shadow-[0_2px_8px_rgba(0,82,255,0.25)] hover:bg-[#0044CC]'
                : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            {isLogin ? 'Đăng ký miễn phí' : 'Đăng nhập'}
          </Link>
        </div>
      </div>
    </header>
  );
}
