'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ArrowLeft, Check, Calculator, Zap, FlaskConical, Dna } from 'lucide-react';
import { useOnboardingDraft } from '@/lib/onboarding/use-onboarding-draft';

const SUBJECT_OPTIONS = [
  {
    id: 'Toán',
    name: 'Toán học',
    description: 'Đại số, Hình học và Giải tích 12',
    icon: Calculator,
  },
  {
    id: 'Vật lý',
    name: 'Vật lý',
    description: 'Cơ học, Sóng, Điện xoay chiều và Hạt nhân',
    icon: Zap,
  },
  {
    id: 'Hóa học',
    name: 'Hóa học',
    description: 'Hóa hữu cơ, Vô cơ và Phản ứng nhiệt hóa',
    icon: FlaskConical,
  },
  {
    id: 'Sinh học',
    name: 'Sinh học',
    description: 'Di truyền, Tiến hóa và Sinh thái học',
    icon: Dna,
  },
];

export default function SubjectsSelectionPage() {
  const router = useRouter();
  const { draft, updateDraft } = useOnboardingDraft();
  const selectedSubjects = draft?.subjects || [];

  const toggleSubject = (name: string) => {
    const nextSubjects = selectedSubjects.includes(name)
      ? selectedSubjects.filter((s) => s !== name)
      : [...selectedSubjects, name];
    updateDraft({ subjects: nextSubjects, progress: 'subjects' });
  };

  const handleNext = () => {
    if (selectedSubjects.length > 0) {
      updateDraft({ progress: 'assessment' });
      router.push('/onboarding/assessment');
    }
  };

  return (
    <div className="w-full max-w-[760px] mx-auto">
      {/* Header & Progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={() => router.push('/onboarding/goal')}
            className="flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft size={16} /> Quay lại
          </button>
          <span className="text-xs font-bold tracking-widest text-[#0052FF] uppercase">
            Bước 2 / 4
          </span>
        </div>
        <div className="grid grid-cols-4 gap-2" aria-label="Tiến độ bước 2 trên 4">
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className={`h-1.5 rounded-full ${index < 2 ? 'bg-[#0052FF]' : 'bg-slate-100'}`}
              aria-hidden="true"
            />
          ))}
        </div>
      </div>

      {/* Title section */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-[#091224] mb-3">
          Em muốn tập trung vào môn nào?
        </h1>
        <p className="text-base sm:text-lg text-slate-600">
          Chọn một hoặc nhiều môn trọng tâm để xây dựng lộ trình ôn thi phù hợp.
        </p>
      </div>

      {/* 2x2 Subject Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4 mb-10">
        {SUBJECT_OPTIONS.map((subject) => {
          const isSelected = selectedSubjects.includes(subject.id);
          const Icon = subject.icon;
          return (
            <button
              key={subject.id}
              type="button"
              onClick={() => toggleSubject(subject.id)}
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
                <Icon size={24} strokeWidth={2.2} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-bold text-[16px] text-[#091224]">{subject.name}</span>
                  {isSelected && (
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#0052FF] text-white">
                      <Check size={12} strokeWidth={3} />
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-slate-500 line-clamp-2 leading-relaxed">
                  {subject.description}
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
          onClick={() => router.push('/onboarding/goal')}
          className="text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors"
        >
          ← Quay lại
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={selectedSubjects.length === 0}
          className={`flex h-12 sm:h-13 items-center justify-center gap-2 rounded-xl px-8 text-sm sm:text-base font-bold transition-all duration-200 ${
            selectedSubjects.length > 0
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
