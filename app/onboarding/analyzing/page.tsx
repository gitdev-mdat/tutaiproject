'use client';

import * as React from 'react';
import { Check, Circle } from 'lucide-react';
import { useRouter } from 'next/navigation';

const PREPARATION_STEPS = [
  'Đã ghi nhận mục tiêu',
  'Đã ghi nhận môn học',
  'Đang sắp xếp nhịp học phù hợp',
];

export default function AnalyzingPage() {
  const router = useRouter();
  const [stepIndex, setStepIndex] = React.useState(0);
  const [isReady, setIsReady] = React.useState(false);

  React.useEffect(() => {
    const stepTimer = window.setTimeout(() => setStepIndex(1), 450);
    const finalStepTimer = window.setTimeout(() => setStepIndex(2), 900);
    const redirectTimer = window.setTimeout(() => {
      setIsReady(true);
      router.push('/onboarding/roadmap');
    }, 1600);

    return () => {
      window.clearTimeout(stepTimer);
      window.clearTimeout(finalStepTimer);
      window.clearTimeout(redirectTimer);
    };
  }, [router]);

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-[500px] flex-col items-center justify-center px-6 text-center">
      <div className="relative mb-8 flex size-20 items-center justify-center">
        <div className="absolute inset-0 rounded-full border-[3px] border-slate-100" />
        <div className="motion-safe:animate-spin absolute inset-0 rounded-full border-[3px] border-blue-600 border-t-transparent motion-reduce:animate-none" />
        <div className="flex size-11 items-center justify-center rounded-full bg-blue-50 text-blue-600">
          {isReady ? <Check size={22} strokeWidth={2.5} /> : <Circle size={18} />}
        </div>
      </div>

      <h1 className="text-[22px] font-extrabold tracking-tight text-[#091224] md:text-[26px]">
        {isReady ? 'Lộ trình đã sẵn sàng' : 'Đang sắp xếp lộ trình của em'}
      </h1>
      <p className="mt-2 text-[15px] font-medium text-slate-500">
        Một kế hoạch học tập phù hợp với lựa chọn của em.
      </p>

      <div className="mt-8 w-full space-y-3 text-left">
        {PREPARATION_STEPS.map((step, index) => {
          const completed = index < stepIndex;
          const active = index === stepIndex;

          return (
            <div
              key={step}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors duration-300 ${
                active
                  ? 'border-blue-100 bg-blue-50/60 text-blue-700'
                  : 'border-slate-100 bg-white text-slate-500'
              }`}
            >
              <span
                className={`flex size-5 shrink-0 items-center justify-center rounded-full ${completed ? 'bg-emerald-100 text-emerald-600' : active ? 'text-blue-600' : 'text-slate-300'}`}
              >
                {completed ? <Check size={14} strokeWidth={2.5} /> : <Circle size={12} />}
              </span>
              <span className={completed || active ? 'font-semibold' : 'font-medium'}>{step}</span>
            </div>
          );
        })}
      </div>
    </main>
  );
}
