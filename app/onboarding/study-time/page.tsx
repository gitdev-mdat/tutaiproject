'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, Clock } from 'lucide-react';
import { useOnboardingDraft } from '@/lib/onboarding/use-onboarding-draft';

const STUDY_TIME_OPTIONS = [
  {
    minutes: 15,
    title: '15 phút',
    badge: 'Nhẹ nhàng',
    description: 'Duy trì thói quen học mỗi ngày, giải quyết nhanh một dạng bài trọng tâm.',
  },
  {
    minutes: 30,
    title: '30 phút',
    badge: 'Khuyên dùng',
    description: 'Nhịp học cân bằng lý tưởng để vừa ôn lý thuyết vừa luyện bài tập áp dụng.',
  },
  {
    minutes: 45,
    title: '45 phút',
    badge: 'Tập trung',
    description: 'Đào sâu chuyên đề khó, rèn luyện kỹ năng phân tích và phản xạ tốc độ.',
  },
  {
    minutes: 60,
    title: '60 phút',
    badge: 'Bứt phá',
    description: 'Tiến độ nhanh, tối đa hóa thời gian cọ xát với bộ đề phân hóa cao.',
  },
];

export default function StudyTimeSelectionPage() {
  const router = useRouter();
  const { draft, updateDraft } = useOnboardingDraft();
  const selectedMinutes = draft?.dailyStudyMinutes || null;

  const handleSelect = (minutes: number) => {
    updateDraft({ dailyStudyMinutes: minutes, progress: 'study-time' });
  };

  const handleNext = () => {
    if (selectedMinutes) {
      updateDraft({ progress: 'analyzing' });
      router.push('/onboarding/analyzing');
    }
  };

  return (
    <div className="w-full max-w-[760px] mx-auto">
      {/* Header & Progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={() => router.push('/onboarding/assessment')}
            className="flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft size={16} /> Quay lại
          </button>
          <span className="text-xs font-bold tracking-widest text-[#0052FF] uppercase">
            Bước 4 / 4
          </span>
        </div>
        <div className="grid grid-cols-4 gap-2" aria-label="Tiến độ bước 4 trên 4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="h-1.5 rounded-full bg-[#0052FF]" aria-hidden="true" />
          ))}
        </div>
      </div>

      {/* Title section */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-[#091224] mb-3">
          Mỗi ngày em có thể dành bao nhiêu thời gian?
        </h1>
        <p className="text-base sm:text-lg text-slate-600">
          Hãy chọn khoảng thời gian em có thể duy trì đều đặn. Sự kiên trì mỗi ngày quan trọng hơn
          học dồn.
        </p>
      </div>

      {/* Study Time Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4 mb-10">
        {STUDY_TIME_OPTIONS.map((item) => {
          const isSelected = selectedMinutes === item.minutes;
          return (
            <button
              key={item.minutes}
              type="button"
              onClick={() => handleSelect(item.minutes)}
              aria-pressed={isSelected}
              className={`flex items-start gap-4 p-5 rounded-2xl border-2 text-left transition-all duration-200 ${
                isSelected
                  ? 'border-[#0052FF] bg-blue-50/60 shadow-[0_2px_12px_rgba(0,82,255,0.08)] ring-2 ring-[#0052FF]/10'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70 shadow-sm'
              }`}
            >
              <div
                className={`flex size-12 shrink-0 items-center justify-center rounded-xl transition-colors ${
                  isSelected ? 'bg-[#0052FF] text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                <Clock size={24} strokeWidth={2.2} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[16px] text-[#091224]">{item.title}</span>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        isSelected ? 'bg-blue-100 text-[#0052FF]' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {item.badge}
                    </span>
                  </div>
                  {isSelected && (
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#0052FF] text-white">
                      <Check size={12} strokeWidth={3} />
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-slate-500 line-clamp-2 leading-relaxed">
                  {item.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-200">
        <button
          type="button"
          onClick={() => router.push('/onboarding/assessment')}
          className="text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors"
        >
          ← Quay lại
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={!selectedMinutes}
          className={`flex h-12 sm:h-13 items-center justify-center gap-2 rounded-xl px-8 text-sm sm:text-base font-bold transition-all duration-200 ${
            selectedMinutes
              ? 'bg-[#0052FF] text-white shadow-[0_4px_14px_rgba(0,82,255,0.25)] hover:bg-[#0044CC] active:scale-[0.98]'
              : 'bg-slate-200/80 text-slate-400 cursor-not-allowed'
          }`}
        >
          Xem lộ trình
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}
