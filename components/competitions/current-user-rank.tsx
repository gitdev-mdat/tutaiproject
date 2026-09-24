'use client';

import * as React from 'react';
import { Target, TrendingUp } from 'lucide-react';

interface CurrentUserRankProps {
  rank: number;
  score: number;
  percentile: number;
  gapToNextTier: number;
  nextTierPercentile: number;
}

export function CurrentUserRank({
  rank,
  score,
  percentile,
  gapToNextTier,
  nextTierPercentile,
}: CurrentUserRankProps) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-[#0c1a34]/40 border border-[#1768FF]/30 p-5 mt-6 mb-2">
      <div className="absolute top-0 right-0 p-4 opacity-10">
        <Target size={64} />
      </div>

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-[#7ca8ff] uppercase tracking-wider mb-2">
            Hạng của em
          </h3>
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold text-white">#{rank}</span>
            <span className="text-lg font-medium text-slate-300">{score.toFixed(2)} điểm</span>
            <span className="inline-flex items-center gap-1 rounded bg-white/10 px-2 py-0.5 text-xs font-medium text-slate-300">
              Top {percentile}%
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-lg bg-[#0c1a34]/50 border border-white/5 p-3 md:max-w-xs">
          <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-blue-500/20 text-blue-400">
            <TrendingUp size={16} />
          </div>
          <p className="text-sm text-slate-300 leading-snug">
            Chỉ còn <span className="font-bold text-white">{gapToNextTier} điểm</span> để vào{' '}
            <span className="font-semibold text-blue-400">Top {nextTierPercentile}%</span>.
          </p>
        </div>
      </div>
    </div>
  );
}
