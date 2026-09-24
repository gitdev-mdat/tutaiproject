'use client';

import * as React from 'react';
import type { LeaderboardEntry } from '@/data/mock-competitions';

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
}

export function LeaderboardTable({ entries }: LeaderboardTableProps) {
  // Only display entries rank 4 and below
  const tableEntries = entries.filter((entry) => entry.rank > 3);

  if (tableEntries.length === 0) {
    return null;
  }

  return (
    <div className="w-full overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-400 uppercase bg-white/[0.03] border-b border-white/10">
            <tr>
              <th scope="col" className="px-4 py-3 md:px-6 md:py-4 font-medium w-16 text-center">
                Hạng
              </th>
              <th scope="col" className="px-4 py-3 md:px-6 md:py-4 font-medium">
                Học sinh
              </th>
              <th
                scope="col"
                className="px-4 py-3 md:px-6 md:py-4 font-medium hidden md:table-cell"
              >
                Trường
              </th>
              <th scope="col" className="px-4 py-3 md:px-6 md:py-4 font-medium text-right">
                Điểm số
              </th>
              <th
                scope="col"
                className="px-4 py-3 md:px-6 md:py-4 font-medium text-right hidden sm:table-cell"
              >
                Thời gian
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {tableEntries.map((entry) => (
              <tr key={entry.id} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-3 md:px-6 md:py-4 whitespace-nowrap text-center text-slate-400 font-medium">
                  {entry.rank}
                </td>
                <td className="px-4 py-3 md:px-6 md:py-4">
                  <div className="font-semibold text-slate-200">{entry.studentName}</div>
                  {/* On mobile, show school below name */}
                  <div className="text-xs text-slate-500 md:hidden mt-0.5">{entry.school}</div>
                </td>
                <td className="px-4 py-3 md:px-6 md:py-4 text-slate-400 hidden md:table-cell">
                  {entry.school}
                </td>
                <td className="px-4 py-3 md:px-6 md:py-4 text-right">
                  <span className="font-bold text-white bg-white/5 px-2 py-1 rounded">
                    {entry.score.toFixed(2)}
                  </span>
                </td>
                <td className="px-4 py-3 md:px-6 md:py-4 text-right text-slate-400 font-mono text-xs hidden sm:table-cell">
                  {entry.completionTime}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Visual cue for more rows... */}
      <div className="py-4 border-t border-white/5 bg-gradient-to-b from-transparent to-white/[0.01] flex justify-center">
        <button className="text-sm text-[#1768FF] font-medium hover:text-[#7ca8ff] transition-colors">
          Xem thêm kết quả
        </button>
      </div>
    </div>
  );
}
// Force UI Update
