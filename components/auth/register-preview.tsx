import * as React from 'react';
import { Target, BookOpen } from 'lucide-react';

export function RegisterPreview() {
  return (
    <div className="relative mt-2 hidden w-full max-w-[420px] animate-fade-in lg:block">
      {/* Background Radial Glow */}
      <div className="absolute top-1/2 left-1/2 -z-10 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/[0.07] blur-[60px]" />

      <div className="relative overflow-hidden rounded-[20px] border border-slate-200/80 bg-white/70 p-4 backdrop-blur-xl shadow-[0_20px_40px_rgba(0,0,0,0.05)] ring-1 ring-slate-900/5">
        {/* Personalized Goal Section */}
        <div className="flex items-center justify-between rounded-[14px] bg-gradient-to-br from-blue-50 to-slate-50 p-4 border border-blue-100/60">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm text-blue-600 border border-blue-100">
              <Target size={18} />
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Mục tiêu của em
              </div>
              <div className="text-[15px] font-extrabold text-[#091224]">Do em lựa chọn</div>
            </div>
          </div>
          <div className="flex items-center justify-center rounded-full bg-white px-3 py-1 border border-slate-200 shadow-sm">
            <span className="text-[12px] font-bold text-slate-500">Cá nhân hóa</span>
          </div>
        </div>

        {/* Today's lesson preview */}
        <div className="mt-3 flex items-center gap-3 rounded-[14px] bg-white p-3 border border-slate-100 shadow-sm">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-indigo-50 text-indigo-600">
            <BookOpen size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-extrabold text-[#091224] truncate">
              Lộ trình cá nhân
            </div>
            <div className="text-[11px] font-medium text-slate-400 mt-0.5">
              Được tạo riêng cho em
            </div>
          </div>
          <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-sm" />
        </div>
      </div>
    </div>
  );
}
