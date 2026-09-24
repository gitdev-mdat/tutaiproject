'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { useOnboardingDraft } from '@/lib/onboarding/use-onboarding-draft';

const LEVEL_OPTIONS = [
  { range: 'Dưới 5', desc: 'Mất gốc hoặc hổng nhiều kiến thức cơ bản' },
  { range: '5–6', desc: 'Nắm được khái niệm nhưng chưa làm bài tập ổn định' },
  { range: '6–7', desc: 'Làm tốt bài cơ bản, hay nhầm ở bài thông hiểu' },
  { range: '7–8', desc: 'Nền tảng vững, cần bứt phá các câu phân hóa' },
  { range: '8+', desc: 'Học lực tốt, nhắm tới điểm số tối đa' },
  { range: 'Chưa biết', desc: 'Chưa thi thử hoặc chưa rõ mức độ hiện tại' },
];

export default function AssessmentInfoPage() {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const { draft, updateDraft } = useOnboardingDraft();
  const selectedLevel = draft?.selfReportedLevel || null;

  const handleSelect = (level: string) => {
    updateDraft({ selfReportedLevel: level, progress: 'assessment' });
  };

  const handleNext = () => {
    if (selectedLevel) {
      startTransition(() => {
        updateDraft({ progress: 'study-time' });
        router.push('/onboarding/study-time');
      });
    }
  };

  return (
    <div className="w-full max-w-[760px] mx-auto">
      {/* Header & Progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={() => router.push('/onboarding/subjects')}
            className="flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft size={16} /> Quay lại
          </button>
          <span className="text-xs font-bold tracking-widest text-[#0052FF] uppercase">
            Bước 3 / 4
          </span>
        </div>
        <div className="grid grid-cols-4 gap-2" aria-label="Tiến độ bước 3 trên 4">
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className={`h-1.5 rounded-full ${index < 3 ? 'bg-[#0052FF]' : 'bg-slate-300'}`}
              aria-hidden="true"
            />
          ))}
        </div>
      </div>

      {/* Title section */}
      <div className="mb-5 sm:mb-7">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-[#091224] mb-2">
          Điểm hiện tại của em khoảng bao nhiêu?
        </h1>
        <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
          Mức ước lượng này giúp chọn điểm bắt đầu ban đầu. Kết quả chẩn đoán theo từng chủ đề sau
          đó sẽ điều chỉnh lộ trình nếu cần — đây không phải bài kiểm tra năng lực.
        </p>
      </div>

      {/* Score Range Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-3 mb-5 sm:mb-7">
        {LEVEL_OPTIONS.map((item) => {
          const isSelected = selectedLevel === item.range;
          return (
            <button
              key={item.range}
              type="button"
              onClick={() => handleSelect(item.range)}
              aria-pressed={isSelected}
              className={`flex items-center gap-3 rounded-xl border text-left px-3.5 py-3 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0052FF] focus-visible:ring-offset-2 active:bg-blue-50 ${
                isSelected
                  ? 'border-[#0052FF] bg-blue-50/70'
                  : 'border-slate-200 bg-white hover:border-slate-400 hover:bg-slate-50'
              }`}
            >
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-2 text-base font-extrabold text-[#091224]">
                  {item.range}
                  {isSelected && <span className="text-xs font-bold text-[#0052FF]">Đã chọn</span>}
                </span>
                <span className="block text-xs text-slate-600 leading-snug">{item.desc}</span>
              </span>
              <span
                className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${
                  isSelected
                    ? 'border-[#0052FF] bg-[#0052FF] text-white'
                    : 'border-slate-300 text-transparent'
                }`}
                aria-hidden="true"
              >
                <Check size={12} strokeWidth={3} />
              </span>
            </button>
          );
        })}
      </div>

      {/* Action Footer */}
      <div className="sticky bottom-0 -mx-4 flex items-center justify-end border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-sm sm:static sm:mx-0 sm:bg-transparent sm:px-0 sm:pt-4 sm:pb-0">
        <button
          type="button"
          onClick={handleNext}
          disabled={!selectedLevel || isPending}
          aria-busy={isPending}
          className={`flex h-11 sm:h-12 items-center justify-center gap-2 rounded-xl px-6 text-sm sm:text-base font-bold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0052FF] focus-visible:ring-offset-2 ${
            selectedLevel && !isPending
              ? 'bg-[#0052FF] text-white hover:bg-[#0044CC] active:scale-[0.98]'
              : 'bg-slate-200/80 text-slate-500 cursor-not-allowed'
          }`}
        >
          {isPending ? 'Đang lưu…' : 'Tiếp tục'}
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}
