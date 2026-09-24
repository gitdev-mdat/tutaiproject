'use client';

import * as React from 'react';
import { Clock, Users, BookOpen, Target, Sparkles } from 'lucide-react';
import type { Competition } from '@/data/mock-competitions';

interface FeaturedCompetitionProps {
  competition: Competition;
  prizePool?: React.ReactNode;
}

export function FeaturedCompetition({ competition, prizePool }: FeaturedCompetitionProps) {
  // Simple countdown logic for visual purposes
  const [timeLeft] = React.useState('Còn 06 ngày 02:14:32');

  return (
    <div
      id="featured-competition"
      className="relative overflow-hidden rounded-[24px] bg-[#0c1a34] border border-white/5 p-6 md:p-8 lg:p-10"
    >
      {/* Background Glows */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-[#1768FF]/10 rounded-full blur-[80px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#0052FF]/10 rounded-full blur-[60px] pointer-events-none" />

      <div className="relative z-10 flex flex-col lg:flex-row gap-8 lg:gap-12">
        {/* Left Col: Info */}
        <div className="flex-1 flex flex-col justify-center">
          {/* Status & Subject */}
          <div className="flex flex-wrap items-center gap-3 mb-5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-400 border border-blue-500/20 uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              {competition.status === 'UPCOMING' ? 'Sắp diễn ra' : 'Đang mở'}
            </span>
            <span className="text-sm font-medium text-slate-400">{competition.subject}</span>
          </div>

          {/* Title */}
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-4">
            {competition.title}
          </h2>

          {/* Description */}
          <p className="text-slate-300 mb-8 max-w-xl">{competition.description}</p>

          {/* Meta Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-slate-400 text-sm">
                <Clock size={16} />
                <span>Thời gian</span>
              </div>
              <span className="text-white font-medium">{competition.durationMinutes} phút</span>
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-slate-400 text-sm">
                <BookOpen size={16} />
                <span>Số lượng</span>
              </div>
              <span className="text-white font-medium">{competition.questionCount} câu</span>
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-slate-400 text-sm">
                <Target size={16} />
                <span>Độ khó</span>
              </div>
              <span className="text-white font-medium">{competition.difficulty}</span>
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-slate-400 text-sm">
                <Users size={16} />
                <span>Tham gia</span>
              </div>
              <span className="text-white font-medium">
                {competition.participantCount} học sinh
              </span>
            </div>
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center gap-4 mt-auto">
            <button className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#1768FF] px-8 py-3.5 text-sm font-semibold text-white shadow-[0_4px_20px_rgba(23,104,255,0.2)] hover:bg-[#1558EB] transition-all">
              <Sparkles size={18} />
              Tham gia với Plus
            </button>
            <div className="text-sm text-slate-400 font-medium">{timeLeft}</div>
          </div>
        </div>

        {/* Right Col: Prize Pool */}
        <div className="lg:w-[400px] shrink-0">{prizePool}</div>
      </div>
    </div>
  );
}
