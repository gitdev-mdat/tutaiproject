'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { useOnboardingDraft } from '@/lib/onboarding/use-onboarding-draft';

const GOAL_OPTIONS = [
  {
    score: '7+',
    title: 'Ổn định nền tảng',
    description: 'Chắc chắn nắm vững lý thuyết và các dạng bài trọng tâm để đạt mức khá.',
  },
  {
    score: '8+',
    title: 'Nâng chắc điểm khá',
    description: 'Rèn luyện kỹ năng giải nhanh và tránh các lỗi sai thường gặp ở câu thông hiểu.',
  },
  {
    score: '9+',
    title: 'Mục tiêu cao',
    description: 'Luyện sâu các dạng bài vận dụng cao và tối ưu chiến thuật phòng thi.',
  },
  {
    score: '9.5+',
    title: 'Bứt phá tối đa',
    description: 'Chinh phục trọn vẹn các câu phân hóa khó nhất để đạt thứ hạng dẫn đầu.',
  },
];

export default function GoalSelectionPage() {
  const router = useRouter();
  const { draft, updateDraft } = useOnboardingDraft();
  const selectedGoal = draft?.targetScore || null;

  const handleSelect = (score: string) => {
    updateDraft({ targetScore: score, progress: 'goal' });
  };

  const handleNext = () => {
    if (selectedGoal) {
      updateDraft({ progress: 'subjects' });
      router.push('/onboarding/subjects');
    }
  };

  return (
    <div className="w-full max-w-[760px] mx-auto">
      {/* Header & Progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <Link
            href="/"
            className="text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors"
          >
            ← Về trang chủ
          </Link>
          <span className="text-xs font-bold tracking-widest text-[#0052FF] uppercase">
            Bước 1 / 4
          </span>
        </div>
        <div className="grid grid-cols-4 gap-2" aria-label="Tiến độ bước 1 trên 4">
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className={`h-1.5 rounded-full ${index === 0 ? 'bg-[#0052FF]' : 'bg-slate-100'}`}
              aria-hidden="true"
            />
          ))}
        </div>
      </div>

      {/* Title section */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-[#091224] mb-3">
          Mục tiêu điểm số của em là gì?
        </h1>
        <p className="text-base sm:text-lg text-slate-600">
          Chọn mục tiêu mong muốn để Tú Tài thiết lập lộ trình luyện tập với độ khó phù hợp.
        </p>
      </div>

      {/* Goal Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4 mb-10">
        {GOAL_OPTIONS.map((item) => {
          const isSelected = selectedGoal === item.score;
          return (
            <button
              key={item.score}
              type="button"
              onClick={() => handleSelect(item.score)}
              aria-pressed={isSelected}
              className={`flex items-start gap-4 p-5 rounded-2xl border-2 text-left transition-all duration-200 ${
                isSelected
                  ? 'border-[#0052FF] bg-blue-50/60 shadow-[0_2px_12px_rgba(0,82,255,0.08)] ring-2 ring-[#0052FF]/10'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70 shadow-sm'
              }`}
            >
              <div
                className={`flex size-12 shrink-0 items-center justify-center rounded-xl font-extrabold text-lg transition-colors ${
                  isSelected ? 'bg-[#0052FF] text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                {item.score}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-bold text-[16px] text-[#091224]">{item.title}</span>
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
      <div className="flex items-center justify-end pt-4 border-t border-slate-200">
        <button
          type="button"
          onClick={handleNext}
          disabled={!selectedGoal}
          className={`flex h-12 sm:h-13 items-center justify-center gap-2 rounded-xl px-8 text-sm sm:text-base font-bold transition-all duration-200 ${
            selectedGoal
              ? 'bg-[#0052FF] text-white shadow-[0_4px_14px_rgba(0,82,255,0.25)] hover:bg-[#0044CC] active:scale-[0.98]'
              : 'bg-slate-200/80 text-slate-400 cursor-not-allowed'
          }`}
        >
          Tiếp tục
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}
