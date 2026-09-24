'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Map, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function WelcomePage() {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center max-w-[600px] mx-auto text-center">
      {/* Simple Roadmap Illustration */}
      <div className="relative flex items-center justify-center mb-10 h-32 w-full">
        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-100 -translate-y-1/2" />

        <div className="flex w-full justify-between px-10 relative z-10">
          <div className="flex flex-col items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-full border-4 border-white bg-emerald-500 text-white shadow-sm">
              <CheckCircle2 size={24} strokeWidth={3} />
            </div>
            <div className="h-2 w-16 bg-slate-100 rounded-full" />
          </div>

          <div className="flex flex-col items-center gap-3 -translate-y-4">
            <div className="flex size-14 items-center justify-center rounded-full border-4 border-white bg-blue-500 text-white shadow-lg ring-4 ring-blue-500/20">
              <Map size={24} strokeWidth={2.5} />
            </div>
            <div className="h-2 w-24 bg-slate-200 rounded-full" />
          </div>

          <div className="flex flex-col items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-full border-4 border-white bg-slate-100 text-slate-300 shadow-sm">
              <div className="size-4 rounded-full bg-slate-300" />
            </div>
            <div className="h-2 w-16 bg-slate-100 rounded-full" />
          </div>
        </div>
      </div>

      <h1 className="text-[32px] md:text-[40px] font-extrabold tracking-tight text-[#091224] mb-4">
        Chào mừng đến với Tú Tài.
      </h1>

      <p className="text-[16px] md:text-[18px] text-slate-500 font-medium max-w-[400px] mx-auto mb-10">
        Chỉ mất khoảng 5 phút để tạo lộ trình học phù hợp với em.
      </p>

      <button
        onClick={() => router.push('/onboarding/goal')}
        className="flex h-14 items-center justify-center gap-2 rounded-[16px] bg-[#0052FF] px-10 text-[16px] font-bold text-white shadow-[0_8px_20px_rgba(0,82,255,0.2)] transition-all hover:bg-[#0044CC] hover:-translate-y-[2px] hover:shadow-[0_12px_24px_rgba(0,82,255,0.3)] active:scale-95 group"
      >
        Bắt đầu
        <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
      </button>
    </div>
  );
}
