'use client';

import * as React from 'react';
import { ShieldAlert } from 'lucide-react';

export function CompetitionRules() {
  const rules = [
    'Một tài khoản chỉ có một lượt thi chính thức.',
    'Bài thi phải được nộp trong thời gian quy định.',
    'Xếp hạng ưu tiên điểm số trước, thời gian hoàn thành sau.',
    'Kết quả bất thường có thể được Tú Tài kiểm tra trước khi công nhận giải.',
    'Đáp án và lời giải được mở sau khi cuộc thi kết thúc.',
  ];

  return (
    <div className="bg-[#020817] py-12">
      <div className="mx-auto max-w-5xl px-[14px] lg:px-6">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 sm:p-8 flex flex-col md:flex-row gap-6 md:gap-10 md:items-center">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 mb-4 md:mb-0">
              <ShieldAlert size={24} />
            </div>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-white mb-4 md:mb-3">Thể lệ Đấu trường</h3>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
              {rules.map((rule, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-slate-400">
                  <span className="text-blue-500/50 mt-0.5">•</span>
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
