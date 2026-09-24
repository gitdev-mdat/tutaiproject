'use client';

import * as React from 'react';

export function HowItWorks() {
  const steps = [
    {
      id: '01',
      title: 'Đăng ký',
      description: 'Chọn cuộc thi và đăng ký bằng Tú Tài Plus.',
    },
    {
      id: '02',
      title: 'Thi chính thức',
      description:
        'Vào phòng thi theo thời gian đã công bố và hoàn thành bài trong thời gian quy định.',
    },
    {
      id: '03',
      title: 'Lên bảng xếp hạng',
      description:
        'Điểm cao hơn xếp trên; nếu bằng điểm, thời gian hoàn thành nhanh hơn được ưu tiên.',
    },
    {
      id: '04',
      title: 'Nhận kết quả',
      description:
        'Xem đáp án, lời giải, thứ hạng và kết quả giải thưởng sau khi cuộc thi được xác minh.',
    },
  ];

  return (
    <div id="how-it-works" className="bg-[#020817] py-16">
      <div className="mx-auto max-w-5xl px-[14px] lg:px-6">
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-12 text-center">
          Cách Đấu trường hoạt động
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
          {/* Connecting line on desktop */}
          <div className="hidden md:block absolute top-6 left-12 right-12 h-px bg-white/10 z-0" />

          {steps.map((step) => (
            <div
              key={step.id}
              className="relative z-10 flex flex-col md:items-center text-left md:text-center"
            >
              <div className="flex md:justify-center mb-4 md:mb-6">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[#0c1a34] border border-[#1768FF]/30 text-[#7ca8ff] font-bold shadow-[0_0_15px_rgba(23,104,255,0.15)]">
                  {step.id}
                </div>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{step.title}</h3>
              <p className="text-sm text-slate-400 max-w-[220px] mx-auto">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
