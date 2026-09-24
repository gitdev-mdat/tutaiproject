'use client';

import { ArrowRight, Target } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface OnboardingRoadmapHeroProps {
  subject: string;
  targetScore: string;
  baselineScore: string;
  dailyCommitment: string;
  durationLabel: string;
  onStart: () => void;
  isStarting?: boolean;
}

export function OnboardingRoadmapHero({
  subject,
  targetScore,
  baselineScore,
  dailyCommitment,
  durationLabel,
  onStart,
  isStarting = false,
}: OnboardingRoadmapHeroProps) {
  const subjectList = subject
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const subjectItems = subjectList.length > 0 ? subjectList : [subject];

  return (
    <section
      className="min-w-0 overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-[#F5F8FF] via-white to-white shadow-sm"
      aria-labelledby="roadmap-title"
    >
      <div className="min-w-0 p-5 sm:p-7 lg:grid lg:grid-cols-[1.35fr_1fr] lg:items-start lg:gap-8 lg:p-7">
        <div className="min-w-0">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[#0052FF]">
            Lộ trình cá nhân hóa
          </p>

          <ul className="mb-3 flex min-w-0 flex-wrap gap-2" aria-label="Môn học đã chọn">
            {subjectItems.map((item) => (
              <li
                key={item}
                className="max-w-full break-words rounded-full border border-blue-100 bg-white px-3 py-1 text-xs font-bold text-[#0052FF] shadow-sm"
              >
                {item}
              </li>
            ))}
          </ul>

          <h1
            id="roadmap-title"
            className="max-w-full break-words text-2xl font-extrabold leading-tight tracking-tight text-[#091224] sm:text-3xl lg:text-4xl lg:leading-[1.1]"
          >
            Hành trình chinh phục {targetScore}
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
            Xuất phát từ đúng nơi em đang đứng hôm nay, tiến dần từng bước tới mục tiêu.
          </p>
        </div>

        <div className="mt-5 min-w-0 lg:mt-0">
          <div
            className="min-w-0 rounded-xl border border-blue-100 bg-white/70 p-4 sm:p-5"
            role="group"
            aria-label="Tiến trình từ điểm hiện tại đến mục tiêu"
          >
            <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-blue-700">
              <Target size={16} aria-hidden="true" /> Điểm xuất phát &amp; mục tiêu
            </div>

            <div className="flex min-w-0 flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-4">
              <div className="min-w-0 flex-1 rounded-lg bg-[#F5F8FF] px-3 py-2.5">
                <dl className="min-w-0">
                  <dt className="text-[11px] font-semibold text-slate-500">
                    Điểm hiện tại (tự đánh giá)
                  </dt>
                  <dd className="mt-0.5 break-words text-xl font-extrabold leading-tight text-slate-700 sm:text-2xl">
                    {baselineScore}
                  </dd>
                </dl>
              </div>

              <div
                className="flex shrink-0 items-center justify-center gap-1 self-center"
                aria-hidden="true"
              >
                <span className="h-6 w-px bg-gradient-to-b from-blue-200 to-[#0052FF] sm:hidden" />
                <span className="hidden h-px w-6 bg-gradient-to-r from-blue-200 to-[#0052FF] sm:block" />
                <ArrowRight size={18} className="shrink-0 rotate-90 text-[#0052FF] sm:rotate-0" />
              </div>

              <div className="min-w-0 flex-1 rounded-lg bg-[#0052FF]/5 px-3 py-2.5">
                <dl className="min-w-0">
                  <dt className="text-[11px] font-semibold text-blue-600">Mục tiêu</dt>
                  <dd className="mt-0.5 break-words text-xl font-extrabold leading-tight text-[#0052FF] sm:text-2xl">
                    {targetScore}
                  </dd>
                </dl>
              </div>
            </div>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-3 sm:max-w-md">
            <div className="min-w-0 rounded-lg border border-blue-100 bg-white px-3 py-2">
              <dt className="text-[11px] font-semibold text-slate-500">Cam kết mỗi ngày</dt>
              <dd className="mt-0.5 break-words text-sm font-bold text-slate-800">
                {dailyCommitment}
              </dd>
            </div>
            <div className="min-w-0 rounded-lg border border-blue-100 bg-white px-3 py-2">
              <dt className="text-[11px] font-semibold text-slate-500">Thời gian dự kiến</dt>
              <dd className="mt-0.5 break-words text-sm font-bold text-slate-800">
                {durationLabel}
              </dd>
            </div>
          </dl>

          <Button
            type="button"
            onClick={onStart}
            disabled={isStarting}
            aria-busy={isStarting}
            size="lg"
            className="mt-6 h-12 min-h-[44px] w-full gap-2 rounded-xl px-6 text-sm font-bold shadow-[0_4px_14px_rgba(0,82,255,0.25)] sm:w-auto lg:mt-5"
          >
            {isStarting ? 'Đang chuyển hướng...' : 'Bắt đầu lộ trình'}
            {!isStarting && <ArrowRight size={18} aria-hidden="true" />}
          </Button>
        </div>
      </div>
    </section>
  );
}
