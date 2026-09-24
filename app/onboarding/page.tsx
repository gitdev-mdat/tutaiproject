'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useOnboardingDraft } from '@/lib/onboarding/use-onboarding-draft';
import { getClientRoadmapUserState, getRoadmapCta } from '@/lib/navigation/roadmap-flow';

const goals = ['7+', '8+', '9+', '9.5+'];
const subjects = ['Toán', 'Ngữ văn', 'Tiếng Anh', 'Vật lý', 'Hóa học', 'Sinh học'];
const levels = ['Dưới 5', '5–6', '6–7', '7–8', '8+'];
const studyTimes = [15, 30, 45, 60];
const activities = [
  ['Nền tảng hàm số', '15 phút'],
  ['Đạo hàm cơ bản', '20 phút'],
  ['Tính đơn điệu', '10 câu'],
  ['Cực trị', '15 phút'],
];

function CheckIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 20 20" fill="none">
      <path
        d="m5 10 3 3 7-7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function OnboardingPage() {
  const { draft, updateDraft } = useOnboardingDraft();
  const [step, setStep] = useState(1);
  const goal = draft?.targetScore ?? '';
  const selectedSubjects = draft?.subjects ?? [];
  const level = draft?.selfReportedLevel ?? '';
  const minutes = draft?.dailyStudyMinutes ?? 0;
  const preview = step === 5;
  const canContinue =
    [Boolean(goal), selectedSubjects.length > 0, Boolean(level), Boolean(minutes)][step - 1] ??
    true;
  const subjectLabel = selectedSubjects.join(' · ');
  const cta = getRoadmapCta(getClientRoadmapUserState('roadmap'));

  const select = (key: string, value: string | number | string[]) => updateDraft({ [key]: value });
  const next = () => setStep((current) => Math.min(5, current + 1));

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#f7faff] px-4 py-8 text-[#091224] sm:px-8">
      <section className="mx-auto w-full max-w-3xl py-4 sm:py-10">
        {!preview && (
          <div className="mb-10">
            <p className="mb-3 text-sm font-semibold text-[#3569d4]">BƯỚC {step} / 4</p>
            <div className="h-1 rounded-full bg-[#dbe6f7]">
              <div
                className="h-1 rounded-full bg-[#1769e8] transition-all"
                style={{ width: `${step * 25}%` }}
              />
            </div>
          </div>
        )}
        {preview ? (
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-[.18em] text-[#3569d4]">
              Lộ trình của em
            </p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
              Sẵn sàng cho mục tiêu {goal}
            </h1>
            <p className="mt-4 text-base text-slate-600">
              {subjectLabel} · {minutes} phút / ngày
            </p>
            <div className="mt-10 rounded-3xl border border-[#dce6f4] bg-white p-6 shadow-sm sm:p-8">
              <p className="text-sm font-bold uppercase tracking-[.16em] text-[#1769e8]">
                Tuần khởi động
              </p>
              <p className="mt-2 text-slate-600">
                Bắt đầu từ nền tảng, theo nhịp học phù hợp với em.
              </p>
              <div className="mt-7">
                {activities.map(([title, detail], index) => (
                  <div key={title} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-[#1769e8] text-xs font-bold text-[#1769e8]">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      {index < activities.length - 1 && (
                        <span className="my-1 h-12 w-px bg-[#cbd9ed]" />
                      )}
                    </div>
                    <div className="pb-6">
                      <p className="font-semibold">{title}</p>
                      <p className="mt-1 text-sm text-slate-500">{detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-6 rounded-2xl border border-[#dce6f4] bg-[#eef5ff] p-5">
              <p className="font-semibold">Muốn biết chính xác mình đang ở đâu?</p>
              <p className="mt-1 text-sm text-slate-600">
                Làm bài chẩn đoán khoảng 10–15 phút để cá nhân hóa điểm bắt đầu.
              </p>
              <Link
                href="/onboarding/assessment"
                className="mt-3 inline-block text-sm font-semibold text-[#1769e8]"
              >
                Làm bài chẩn đoán →
              </Link>
            </div>
            <p className="mt-5 text-sm text-slate-500">
              Lộ trình sẽ được điều chỉnh khi Tú Tài có thêm kết quả luyện tập của em.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href={cta.path}
                className="rounded-xl bg-[#1769e8] px-6 py-3 text-center text-sm font-semibold text-white hover:bg-[#1258c5]"
              >
                {cta.path === '/onboarding/roadmap' ? 'Lưu lộ trình của em' : cta.label}
              </Link>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-xl border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700"
              >
                Điều chỉnh lựa chọn
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="mb-3 text-sm font-semibold text-[#3569d4]">XÂY LỘ TRÌNH CỦA EM</p>
            <h1 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-5xl">
              {step === 1
                ? 'Mục tiêu điểm số của em là gì?'
                : step === 2
                  ? 'Em muốn học môn nào?'
                  : step === 3
                    ? 'Điểm hiện tại của em khoảng bao nhiêu?'
                    : 'Mỗi ngày em có thể học bao lâu?'}
            </h1>
            <p className="mt-4 max-w-xl leading-7 text-slate-600">
              {step === 3
                ? 'Tú Tài dùng mức này để chọn điểm bắt đầu phù hợp. Đây không phải bài kiểm tra năng lực.'
                : step === 4
                  ? 'Chọn thời gian em có thể duy trì đều đặn, không cần quá sức.'
                  : 'Một lựa chọn rõ ràng hôm nay sẽ giúp em bắt đầu dễ hơn.'}
            </p>
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(step === 1 ? goals : step === 2 ? subjects : step === 3 ? levels : studyTimes).map(
                (value) => {
                  const text = String(value);
                  const active =
                    step === 1
                      ? goal === text
                      : step === 2
                        ? selectedSubjects.includes(text)
                        : step === 3
                          ? level === text
                          : minutes === value;
                  return (
                    <button
                      key={text}
                      type="button"
                      aria-pressed={active}
                      onClick={() =>
                        step === 1
                          ? select('targetScore', text)
                          : step === 2
                            ? select(
                                'subjects',
                                active
                                  ? selectedSubjects.filter((item) => item !== text)
                                  : [...selectedSubjects, text]
                              )
                            : step === 3
                              ? select('selfReportedLevel', text)
                              : select('dailyStudyMinutes', value)
                      }
                      className={`flex min-h-14 items-center justify-between rounded-xl border px-4 py-3 text-left font-semibold transition ${active ? 'border-[#1769e8] bg-[#eaf2ff] text-[#1258c5]' : 'border-slate-200 bg-white hover:border-[#8eb2e8]'}`}
                    >
                      {text}
                      {active && <CheckIcon />}
                    </button>
                  );
                }
              )}
            </div>
            <div className="mt-10 flex items-center justify-between gap-3">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={() => setStep(step - 1)}
                  className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                >
                  ← Quay lại
                </button>
              ) : (
                <Link href="/" className="text-sm font-semibold text-slate-600">
                  ← Trang chủ
                </Link>
              )}
              <button
                type="button"
                disabled={!canContinue}
                onClick={next}
                className="rounded-xl bg-[#1769e8] px-6 py-3 text-sm font-semibold text-white hover:bg-[#1258c5] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {step === 4 ? 'Xem lộ trình' : 'Tiếp tục'} →
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
