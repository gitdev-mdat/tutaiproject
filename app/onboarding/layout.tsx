import * as React from 'react';
import Link from 'next/link';

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#F8FAFC] font-sans text-[#091224] selection:bg-blue-200">
      <header className="w-full border-b border-slate-200/80 bg-white/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center justify-between px-4 sm:px-6 lg:px-10 xl:px-12">
          <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-85">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
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
            <span className="text-[18px] font-extrabold tracking-tight text-[#091224]">Tú Tài</span>
          </Link>
          <div className="text-xs font-semibold text-slate-400">Lộ trình học cá nhân hóa</div>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-[1600px] flex-1 flex-col items-center justify-start overflow-x-clip px-4 py-6 sm:px-6 sm:py-10 lg:px-10 lg:py-12 xl:px-12">
        <div className="w-full">{children}</div>
      </main>
    </div>
  );
}
