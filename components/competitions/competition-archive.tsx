'use client';

import * as React from 'react';
import Link from 'next/link';
import { Calendar, Users, FileText, CheckCircle, BarChart2, Award } from 'lucide-react';
import type { Competition } from '@/data/mock-competitions';

interface CompetitionArchiveProps {
  competitions: Competition[];
}

export function CompetitionArchive({ competitions }: CompetitionArchiveProps) {
  if (competitions.length === 0) return null;

  return (
    <div id="archive" className="py-16 bg-white/[0.01] border-t border-white/5">
      <div className="mx-auto max-w-5xl px-[14px] lg:px-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
              Các cuộc thi đã diễn ra
            </h2>
            <p className="text-slate-400">
              Xem lại đề thi, lời giải và bảng xếp hạng của các kỳ trước.
            </p>
          </div>
          <Link
            href="/competitions"
            className="text-sm font-medium text-[#1768FF] hover:text-[#7ca8ff] transition-colors"
          >
            Xem tất cả cuộc thi &rarr;
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {competitions.map((comp) => (
            <div
              key={comp.id}
              className="flex flex-col rounded-[20px] bg-white/[0.02] border border-white/5 hover:border-white/10 hover:bg-white/[0.03] transition-all p-5"
            >
              <div className="mb-4">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">
                  {comp.subject}
                </span>
                <h3 className="text-lg font-bold text-white leading-tight">{comp.title}</h3>
              </div>

              <div className="flex flex-wrap gap-4 text-sm text-slate-400 mb-6">
                <div className="flex items-center gap-1.5">
                  <Calendar size={14} />
                  <span>
                    {new Date(comp.startAt).toLocaleDateString('vi-VN', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Users size={14} />
                  <span>{comp.participantCount} thí sinh</span>
                </div>
              </div>

              {comp.winner && (
                <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-[#fbbf24]/10 to-transparent p-3 mb-6 border border-[#fbbf24]/20">
                  <div className="w-8 h-8 flex items-center justify-center rounded-full bg-[#fbbf24]/20 text-[#fbbf24]">
                    <Award size={16} />
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 mb-0.5">Top 1</div>
                    <div className="text-sm font-semibold text-slate-200">
                      {comp.winner.name}{' '}
                      <span className="text-[#fbbf24]">· {comp.winner.score.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-auto pt-4 border-t border-white/5 flex flex-wrap gap-3">
                <Link
                  href={`/competitions/${comp.slug}/exam`}
                  className="flex items-center gap-1.5 text-sm font-medium text-slate-300 hover:text-white transition-colors"
                >
                  <FileText size={16} />
                  Xem đề
                </Link>
                <Link
                  href={`/competitions/${comp.slug}/leaderboard`}
                  className="flex items-center gap-1.5 text-sm font-medium text-slate-300 hover:text-white transition-colors"
                >
                  <BarChart2 size={16} />
                  Bảng xếp hạng
                </Link>
                {comp.solutionAvailable && (
                  <Link
                    href={`/competitions/${comp.slug}/solutions`}
                    className="flex items-center gap-1.5 text-sm font-medium text-slate-300 hover:text-white transition-colors"
                  >
                    <CheckCircle size={16} />
                    Lời giải
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
