'use client';

import * as React from 'react';
import type { Competition } from '@/data/mock-competitions';

interface PrizePoolProps {
  competition: Pick<Competition, 'prizePool' | 'prizes'>;
}

export function PrizePool({ competition }: PrizePoolProps) {
  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  };

  return (
    <div className="flex flex-col rounded-[20px] bg-gradient-to-b from-white/[0.04] to-transparent border border-white/10 overflow-hidden h-full">
      <div className="p-6 border-b border-white/10 bg-white/[0.02]">
        <h3 className="text-sm font-medium text-slate-400 mb-1">Tổng giải thưởng</h3>
        <div className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#fbbf24] to-[#f59e0b]">
          {formatCurrency(competition.prizePool)}
        </div>
      </div>

      <div className="p-6 flex flex-col gap-4 flex-1">
        {competition.prizes.slice(0, 3).map((prize, index) => {
          const count = prize.rankTo - prize.rankFrom + 1;
          const labels = ['Giải Nhất', 'Nhóm giải tiếp theo', 'Nhóm giải khuyến khích'];
          const icons = ['🥇', '🥈', '🥉'];
          const colors = ['text-[#fbbf24]', 'text-slate-300', 'text-[#d97706]'];
          return (
            <div
              key={`${prize.rankFrom}-${prize.rankTo}`}
              className="flex items-center gap-4 rounded-xl border border-white/5 bg-white/[0.03] p-3"
            >
              <div className="flex size-12 shrink-0 items-center justify-center rounded-full border border-amber-400/20 bg-amber-400/10">
                <span className="text-xl">{icons[index]}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center justify-between gap-3">
                  <span className="truncate font-semibold text-white">{labels[index]}</span>
                  <span className="shrink-0 text-xs text-slate-400">
                    Hạng {prize.rankFrom}
                    {prize.rankTo > prize.rankFrom ? `–${prize.rankTo}` : ''}
                  </span>
                </div>
                <div className={`font-bold ${colors[index]}`}>
                  {formatCurrency(prize.amount)}{' '}
                  {count > 1 && <span className="text-xs font-normal text-slate-500">/ giải</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-4 bg-white/[0.02] border-t border-white/5 text-center">
        <p className="text-xs text-slate-400">Kết quả được xác minh trước khi trao giải</p>
      </div>
    </div>
  );
}
