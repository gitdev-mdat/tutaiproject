'use client';

import * as React from 'react';
import Link from 'next/link';
import { Trophy, ArrowRight, BarChart2, UserCheck, Timer, Medal } from 'lucide-react';
import { PublicHeader } from '@/components/layout/public-header';
import { CompetitionCountdown } from '@/components/competitions/competition-countdown';
import type { Competition } from '@/data/mock-competitions';

interface CompetitionHeroProps {
  competition?: Competition;
}

export function CompetitionHero({ competition }: CompetitionHeroProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  };

  return (
    <div className="relative overflow-hidden bg-[#020817]">
      {/* Background elements */}
      <div className="absolute inset-0 z-0">
        <div className="absolute -top-[20%] left-[20%] w-[60%] h-[60%] rounded-full bg-[#1448E0]/10 blur-[120px]" />
        <div className="absolute top-[40%] right-[-10%] w-[40%] h-[40%] rounded-full bg-[#1768FF]/10 blur-[100px]" />
      </div>

      {/* Header */}
      <div className="relative z-10">
        <PublicHeader />
      </div>

      {/* Hero Content */}
      <div className="relative z-10 mx-auto max-w-[1440px] px-[14px] lg:px-6 pt-12 pb-16 lg:pt-20 lg:pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(480px,0.95fr)] gap-12 lg:gap-8 items-center">
          {/* Left Column */}
          <div className="max-w-3xl">
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 rounded-full border border-[#1768FF]/30 bg-[#1768FF]/10 px-3 py-1 text-sm font-medium text-[#7ca8ff] mb-6">
              <Trophy size={16} className="text-[#1768FF]" />
              ĐẤU TRƯỜNG TÚ TÀI
            </div>

            {/* Headline */}
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl mb-6">
              Học để tiến bộ. <br className="hidden sm:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#1768FF] to-[#7ca8ff]">
                Thi để biết mình đang ở đâu.
              </span>
            </h1>

            {/* Supporting Copy */}
            <p className="text-lg text-slate-300 mb-8 max-w-2xl leading-relaxed">
              Thử sức cùng những học sinh có cùng mục tiêu, leo bảng xếp hạng và chinh phục những
              phần thưởng xứng đáng với năng lực của em.
            </p>

            {/* Flow indicator */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 mb-8">
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <UserCheck size={16} className="text-[#7ca8ff]" />
                Đăng ký với Plus
              </div>
              <ArrowRight size={14} className="text-slate-600 hidden sm:block" />
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <Timer size={16} className="text-[#7ca8ff]" />
                Thi chính thức
              </div>
              <ArrowRight size={14} className="text-slate-600 hidden sm:block" />
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <Medal size={16} className="text-[#7ca8ff]" />
                Lên BXH & nhận giải
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <Link
                href="#how-it-works"
                className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-[#1768FF] px-8 h-12 text-sm font-semibold text-white transition-all duration-150 hover:bg-[#1558EB] hover:shadow-[0_8px_24px_rgba(23,104,255,0.3)]"
              >
                Cách Đấu trường hoạt động
              </Link>
              <Link
                href="#leaderboard"
                className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-white/5 border border-white/10 px-8 h-12 text-sm font-semibold text-white transition-all duration-150 hover:bg-white/10 hover:border-white/20"
              >
                <BarChart2 size={16} />
                Xem bảng xếp hạng
              </Link>
            </div>
          </div>

          {/* Right Column: Featured Preview */}
          {competition && (
            <div className="relative mx-auto w-full max-w-[560px] lg:ml-auto group/card">
              {/* Subtle radial glow behind the card */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full max-w-[400px] bg-[#1768FF]/20 rounded-full blur-[80px] pointer-events-none transition-opacity duration-500 group-hover/card:opacity-100 opacity-70" />

              {/* Main Card Wrapper */}
              <div
                className="relative rounded-[24px] p-[1px] transition-all duration-500 group-hover/card:shadow-[0_25px_50px_rgba(0,0,0,0.5)]"
                style={{
                  boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                }}
              >
                {/* Animated Masked Glow Layer (Blurred outside) */}
                <div
                  className="absolute z-0 rounded-[34px] pointer-events-none opacity-40 transition-opacity duration-500 group-hover/card:opacity-70"
                  style={{
                    inset: '-10px',
                    padding: '10px',
                    WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                    WebkitMaskComposite: 'xor',
                    maskComposite: 'exclude',
                  }}
                >
                  <div
                    className="absolute inset-[-50%] h-[200%] w-[200%] animate-[spin_3.5s_linear_infinite] motion-reduce:hidden blur-[8px]"
                    style={{
                      background:
                        'conic-gradient(from 0deg, transparent 0deg, transparent 180deg, rgba(59,130,246,0.1) 220deg, rgba(59,130,246,0.5) 270deg, rgba(14,165,233,0.8) 310deg, rgba(253,230,138,1) 330deg, rgba(59,130,246,0.5) 345deg, transparent 360deg)',
                    }}
                  />
                </div>

                {/* Animated Masked Border Layer (Crisp) */}
                <div
                  className="absolute inset-0 z-0 rounded-[24px] overflow-hidden pointer-events-none"
                  style={{
                    padding: '1.5px',
                    WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                    WebkitMaskComposite: 'xor',
                    maskComposite: 'exclude',
                  }}
                >
                  <div
                    className="absolute inset-[-50%] h-[200%] w-[200%] animate-[spin_3.5s_linear_infinite] motion-reduce:hidden"
                    style={{
                      background:
                        'conic-gradient(from 0deg, transparent 0deg, transparent 180deg, rgba(59,130,246,0.1) 220deg, rgba(59,130,246,0.5) 270deg, rgba(14,165,233,0.8) 310deg, rgba(253,230,138,1) 330deg, rgba(59,130,246,0.5) 345deg, transparent 360deg)',
                    }}
                  />
                </div>

                {/* Static base border (visible always, primary border if reduced motion) */}
                <div className="absolute inset-0 z-0 h-full w-full rounded-[24px] border border-[rgba(83,145,255,0.15)] pointer-events-none" />

                <div
                  className="relative z-10 flex flex-col rounded-[23px] p-5 sm:p-6 pt-6 sm:pt-7 overflow-hidden h-full w-full transition-colors duration-500"
                  style={{
                    background: 'linear-gradient(145deg, rgb(18, 45, 88), rgb(10, 31, 66))',
                  }}
                >
                  {/* Status & Subject */}
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/20 px-2.5 py-1 text-xs font-semibold text-blue-300 border border-blue-500/30 uppercase tracking-wider">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                      {competition.status === 'UPCOMING' ? 'Sắp diễn ra' : 'Đang mở'}
                    </span>
                    <span className="text-sm font-medium text-slate-400">
                      {competition.subject}
                    </span>
                  </div>

                  {/* Title & Meta */}
                  <h3 className="text-xl sm:text-2xl font-bold text-white mb-1.5 leading-tight">
                    {competition.title}
                  </h3>
                  <p className="text-sm text-slate-300 mb-4 line-clamp-2">
                    {competition.description}
                  </p>

                  <div className="flex items-center flex-wrap gap-x-4 gap-y-2 text-sm text-slate-400 font-medium mb-5">
                    <span>{competition.durationMinutes} phút</span>
                    <span className="w-1 h-1 rounded-full bg-slate-600" />
                    <span>{competition.questionCount} câu</span>
                  </div>

                  {/* Prize Hook */}
                  <div className="rounded-xl bg-white/[0.03] border border-white/10 p-3 sm:p-4 mb-5 relative overflow-hidden group">
                    <div className="absolute right-[-20%] top-[-50%] w-[150px] h-[150px] bg-[#fbbf24]/10 rounded-full blur-[40px] pointer-events-none transition-all duration-500 group-hover:bg-[#fbbf24]/20" />

                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5">
                      Tổng giải thưởng
                    </div>
                    <div className="text-2xl sm:text-3xl font-bold text-[#fbbf24] mb-3 drop-shadow-[0_0_15px_rgba(251,191,36,0.2)]">
                      {formatCurrency(competition.prizePool)}
                    </div>

                    <div className="flex flex-col gap-1 text-sm">
                      <div className="flex items-center justify-between text-slate-200">
                        <span>
                          <span className="mr-2">🥇</span>
                          {formatCurrency(2000000)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-300">
                        <span>
                          <span className="mr-2">🥈</span>2 × {formatCurrency(1000000)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-400">
                        <span>
                          <span className="mr-2">🥉</span>3 × {formatCurrency(500000)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions & Status */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-auto">
                    <div className="text-sm font-medium text-slate-400">
                      <CompetitionCountdown startAt={competition.startAt} />
                    </div>
                    <div className="flex flex-col items-center sm:items-end w-full sm:w-auto">
                      <button className="relative overflow-hidden w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#1768FF] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#1558EB] transition-all duration-300 shadow-[0_4px_15px_rgba(23,104,255,0.25)] hover:shadow-[0_6px_20px_rgba(23,104,255,0.4)] hover:border-[#7ca8ff]/30 group/btn">
                        {/* Button sweep effect on hover */}
                        <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 ease-out group-hover/btn:translate-x-full motion-reduce:hidden" />

                        <span className="relative z-10">Tham gia với Plus</span>
                        <ArrowRight
                          size={16}
                          className="relative z-10 transition-transform duration-300 group-hover/btn:translate-x-1"
                        />
                      </button>
                      <Link
                        href={`/competitions/thpt-quoc-gia-01`}
                        className="text-[12px] text-slate-400 hover:text-slate-300 underline underline-offset-2 decoration-slate-600 mt-2"
                      >
                        Xem thể lệ
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
