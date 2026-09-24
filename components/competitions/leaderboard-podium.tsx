'use client';

import * as React from 'react';
import type { LeaderboardEntry } from '@/data/mock-competitions';

interface LeaderboardPodiumProps {
  entries: LeaderboardEntry[];
}

export function LeaderboardPodium({ entries }: LeaderboardPodiumProps) {
  // Ensure we have up to 3 entries
  const top3 = entries.slice(0, 3);

  // Helpers
  const getAvatarInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(-2)
      .join('')
      .toUpperCase();
  };

  const prizes = {
    1: '2.000.000đ',
    2: '1.000.000đ',
    3: '500.000đ',
  };

  return (
    <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-6 lg:gap-8 mb-8">
      {/* 
        Mobile: #1 is first in DOM to show on top.
        Desktop: We use order to place #1 in the middle.
      */}

      {/* Rank 1 */}
      {top3[0] && (
        <div className="order-1 md:order-2 w-full max-w-[340px] md:w-[32%] lg:w-[320px] md:-mt-8 z-10">
          <div className="relative p-6 rounded-[24px] bg-gradient-to-b from-[#fbbf24]/10 to-[#0c1a34] border border-[#fbbf24]/40 shadow-[0_15px_40px_rgba(251,191,36,0.15)] flex flex-col items-center text-center">
            {/* Subtle glow behind card */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#fbbf24]/5 to-transparent rounded-[24px] pointer-events-none" />

            {/* Rank badge */}
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 flex flex-col items-center">
              <span className="text-xl drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]">👑</span>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#fbbf24] to-[#d97706] flex items-center justify-center text-amber-950 font-bold border-2 border-[#020817] shadow-lg mt-0.5">
                #1
              </div>
            </div>

            {/* Avatar */}
            <div className="w-16 h-16 rounded-full bg-[#051024] border-2 border-[#fbbf24]/60 flex items-center justify-center shadow-[0_0_20px_rgba(251,191,36,0.2)] mt-4 mb-3">
              <span className="text-lg font-bold text-[#fbbf24] tracking-wider">
                {getAvatarInitials(top3[0].studentName)}
              </span>
            </div>

            {/* Info */}
            <h3 className="text-lg font-bold text-white mb-1">{top3[0].studentName}</h3>
            <p className="text-xs text-slate-400 mb-4">{top3[0].school}</p>

            <div className="flex flex-col items-center mb-4">
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-extrabold text-[#fbbf24] drop-shadow-[0_0_10px_rgba(251,191,36,0.3)]">
                  {top3[0].score.toFixed(2)}
                </span>
                <span className="text-sm font-medium text-slate-300">điểm</span>
              </div>
              <span className="text-xs text-slate-400 font-mono mt-1">
                {top3[0].completionTime}
              </span>
            </div>

            <div className="mt-auto px-4 py-1.5 rounded-full bg-[#fbbf24]/10 border border-[#fbbf24]/20 text-sm font-semibold text-[#fbbf24]">
              🏆 Giải Nhất • {prizes[1]}
            </div>
          </div>
        </div>
      )}

      {/* Row for #2 and #3 on Mobile */}
      <div className="order-2 md:order-none flex flex-row md:contents w-full gap-4 justify-center">
        {/* Rank 2 */}
        {top3[1] && (
          <div className="order-2 md:order-1 w-1/2 max-w-[280px] md:w-[32%] lg:w-[280px]">
            <div className="relative p-5 rounded-[20px] bg-gradient-to-b from-slate-300/5 to-[#0c1a34] border border-slate-300/20 shadow-lg flex flex-col items-center text-center h-full">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-gradient-to-br from-slate-200 to-slate-400 flex items-center justify-center text-slate-900 font-bold border-2 border-[#020817] shadow-md">
                #2
              </div>

              <div className="w-14 h-14 rounded-full bg-[#051024] border border-slate-300/40 flex items-center justify-center mt-3 mb-3">
                <span className="text-base font-bold text-slate-300 tracking-wider">
                  {getAvatarInitials(top3[1].studentName)}
                </span>
              </div>

              <h3 className="text-base font-bold text-white mb-1 line-clamp-1">
                {top3[1].studentName}
              </h3>
              <p className="text-[11px] text-slate-400 mb-3 line-clamp-1">{top3[1].school}</p>

              <div className="flex flex-col items-center mb-4">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-white">{top3[1].score.toFixed(2)}</span>
                  <span className="text-xs text-slate-400">điểm</span>
                </div>
                <span className="text-[11px] text-slate-500 font-mono mt-0.5">
                  {top3[1].completionTime}
                </span>
              </div>

              <div className="mt-auto text-[11px] font-medium text-slate-300 bg-white/5 px-3 py-1 rounded-full border border-white/10">
                🥈 {prizes[2]}
              </div>
            </div>
          </div>
        )}

        {/* Rank 3 */}
        {top3[2] && (
          <div className="order-3 md:order-3 w-1/2 max-w-[280px] md:w-[32%] lg:w-[280px]">
            <div className="relative p-5 rounded-[20px] bg-gradient-to-b from-[#b45309]/10 to-[#0c1a34] border border-[#b45309]/30 shadow-lg flex flex-col items-center text-center h-full">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-gradient-to-br from-[#d97706] to-[#92400e] flex items-center justify-center text-orange-50 font-bold border-2 border-[#020817] shadow-md">
                #3
              </div>

              <div className="w-14 h-14 rounded-full bg-[#051024] border border-[#b45309]/50 flex items-center justify-center mt-3 mb-3">
                <span className="text-base font-bold text-[#d97706] tracking-wider">
                  {getAvatarInitials(top3[2].studentName)}
                </span>
              </div>

              <h3 className="text-base font-bold text-white mb-1 line-clamp-1">
                {top3[2].studentName}
              </h3>
              <p className="text-[11px] text-slate-400 mb-3 line-clamp-1">{top3[2].school}</p>

              <div className="flex flex-col items-center mb-4">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-white">{top3[2].score.toFixed(2)}</span>
                  <span className="text-xs text-slate-400">điểm</span>
                </div>
                <span className="text-[11px] text-slate-500 font-mono mt-0.5">
                  {top3[2].completionTime}
                </span>
              </div>

              <div className="mt-auto text-[11px] font-medium text-[#d97706] bg-[#b45309]/10 px-3 py-1 rounded-full border border-[#b45309]/20">
                🥉 {prizes[3]}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
// Force UI Update
