import * as React from 'react';
import { BookOpen, Flame, Activity, PlayCircle } from 'lucide-react';

export function LoginPreview() {
  return (
    <div className="relative mt-10 hidden w-full max-w-[400px] animate-fade-in lg:block">
      {/* Background Radial Glow */}
      <div className="absolute top-1/2 left-1/2 -z-10 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/[0.08] blur-[60px]"></div>

      <div className="flex flex-col gap-4">
        {/* Top Row: Streak and Progress */}
        <div className="flex gap-4">
          <div className="flex flex-1 items-center gap-3 rounded-[20px] border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_rgba(0,0,0,0.03)] ring-1 ring-slate-900/5">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-50 text-orange-500">
              <Flame size={20} />
            </div>
            <div>
              <div className="text-[17px] font-black text-[#091224]">12 Ngày</div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Streak
              </div>
            </div>
          </div>
          <div className="flex flex-1 items-center gap-3 rounded-[20px] border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_rgba(0,0,0,0.03)] ring-1 ring-slate-900/5">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-500">
              <Activity size={20} />
            </div>
            <div className="w-full">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Tuần này
                </span>
                <span className="text-[13px] font-bold text-[#091224]">65%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full w-[65%] rounded-full bg-indigo-500"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Current Lesson Card */}
        <div className="relative overflow-hidden rounded-[24px] border border-slate-200/80 bg-white p-6 shadow-[0_16px_40px_rgba(0,0,0,0.05)] ring-1 ring-slate-900/5">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500 rounded-l-[24px]"></div>

          <div className="mb-2 flex items-center justify-between">
            <span className="text-[12px] font-bold uppercase tracking-widest text-indigo-500">
              Bài học đang dở
            </span>
            <span className="text-[13px] font-semibold text-slate-400">Còn 15 phút</span>
          </div>

          <div className="mb-6 flex items-start gap-4 mt-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-indigo-50 text-indigo-600">
              <BookOpen size={24} />
            </div>
            <div>
              <h3 className="text-[18px] font-extrabold leading-tight text-[#091224]">
                Tích phân & Ứng dụng
              </h3>
              <p className="mt-1 text-[14px] font-medium text-slate-500">
                Chuyên đề Toán Giải tích 12
              </p>
            </div>
          </div>

          <div className="flex w-full items-center justify-center gap-2 rounded-[14px] bg-slate-50 py-3 text-[14px] font-bold text-slate-600 border border-slate-100 transition-colors hover:bg-slate-100">
            <PlayCircle size={18} className="text-indigo-500" />
            Tiếp tục học
          </div>
        </div>
      </div>
    </div>
  );
}
