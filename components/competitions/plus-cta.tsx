'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export function PlusCTA() {
  return (
    <div className="relative py-24 bg-[#020817] overflow-hidden">
      {/* Glows */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] max-w-[800px] h-[300px] bg-[#1768FF]/10 rounded-[100%] blur-[120px] pointer-events-none" />

      <div className="relative z-10 mx-auto max-w-3xl px-[14px] lg:px-6 text-center flex flex-col items-center">
        <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
          Sẵn sàng bước vào Đấu trường?
        </h2>

        <p className="text-lg text-slate-300 mb-10 max-w-xl">
          Tú Tài Plus mở quyền tham gia các cuộc thi chính thức, bảng xếp hạng và cơ hội nhận giải
          thưởng.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          <Link
            href="/pricing"
            className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-[#1768FF] px-8 py-4 text-sm font-semibold text-white transition-all duration-150 hover:bg-[#1558EB] hover:shadow-[0_8px_24px_rgba(23,104,255,0.3)]"
          >
            Nâng cấp Tú Tài Plus
            <ArrowRight size={18} />
          </Link>
          <Link
            href="/plus"
            className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-white/5 border border-white/10 px-8 py-4 text-sm font-semibold text-white transition-all duration-150 hover:bg-white/10 hover:border-white/20"
          >
            Xem quyền lợi Plus
          </Link>
        </div>
      </div>
    </div>
  );
}
