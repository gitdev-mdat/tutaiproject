'use client';

import * as React from 'react';
import { LeaderboardPodium } from './leaderboard-podium';
import { LeaderboardTable } from './leaderboard-table';
import { CurrentUserRank } from './current-user-rank';
import type { LeaderboardEntry } from '@/data/mock-competitions';

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  currentUserRank?: {
    rank: number;
    score: number;
    percentile: number;
    gapToNextTier: number;
    nextTierPercentile: number;
  };
}

export function Leaderboard({ entries, currentUserRank }: LeaderboardProps) {
  const [activeTab, setActiveTab] = React.useState<'latest' | 'month'>('latest');

  return (
    <div id="leaderboard" className="py-10 md:py-16">
      <div className="mx-auto max-w-[1240px] px-[14px] lg:px-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">Bảng xếp hạng</h2>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            Những học sinh đang dẫn đầu Đấu trường Tú Tài.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex justify-center mb-8 md:mb-10">
          <div className="inline-flex items-center p-1 rounded-lg bg-white/5 border border-white/10">
            <button
              onClick={() => setActiveTab('latest')}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === 'latest'
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              Cuộc thi gần nhất
            </button>
            <button
              onClick={() => setActiveTab('month')}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === 'month'
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              Tháng này
            </button>
          </div>
        </div>

        {/* Podium (Top 3) */}
        <LeaderboardPodium entries={entries} />

        {/* Table (Rank 4+) */}
        <div className="mt-6 md:mt-8">
          <LeaderboardTable entries={entries} />
        </div>

        {/* Current User Rank (if authenticated/passed) */}
        {currentUserRank && (
          <div className="mt-4">
            <CurrentUserRank {...currentUserRank} />
          </div>
        )}
      </div>
    </div>
  );
}
// Force UI Update
