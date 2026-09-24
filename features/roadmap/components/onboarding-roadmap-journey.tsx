export interface JourneyStage {
  step: string;
  title: string;
  description: string;
  outcome: string;
}

export function OnboardingRoadmapJourney({ stages }: { stages: JourneyStage[] }) {
  return (
    <section aria-labelledby="journey-title" className="min-w-0">
      <div className="mb-2.5 flex items-baseline justify-between gap-3 sm:mb-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#0052FF]">
            Hành trình phía trước
          </p>
          <h2
            id="journey-title"
            className="mt-1.5 text-xl font-extrabold text-[#091224] sm:text-2xl"
          >
            4 giai đoạn để tiến tới mục tiêu
          </h2>
        </div>
        <p className="shrink-0 text-xs font-semibold text-slate-400">Bắt đầu → Mục tiêu</p>
      </div>

      {/* A single shared surface — not four separate cards — so the stages read
          as one connected journey threaded by the connector lines below. */}
      <div className="min-w-0 rounded-2xl border border-[#E8EEF8] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)] sm:p-5 lg:p-5">
        <ol className="flex min-w-0 flex-col gap-4 lg:grid lg:grid-cols-4 lg:items-start lg:gap-3">
          {stages.map((stage, index) => {
            const isFirst = index === 0;
            const isLast = index === stages.length - 1;
            const staggerClass = `stagger-${Math.min(index + 1, 6)}`;

            return (
              <li
                key={stage.step}
                className={`animate-reveal-up ${staggerClass} relative min-w-0 pl-12 lg:pl-0 lg:pt-11`}
              >
                {!isLast && (
                  <span
                    aria-hidden="true"
                    className="absolute left-[17px] top-9 h-[calc(100%+1.25rem)] w-0.5 bg-gradient-to-b from-[#0052FF]/60 via-[#66A3FF]/40 to-slate-200 lg:hidden"
                  />
                )}
                {!isLast && (
                  <span
                    aria-hidden="true"
                    className="absolute left-9 top-[17px] hidden h-0.5 w-[calc(100%+1rem)] bg-gradient-to-r from-[#0052FF]/60 via-[#66A3FF]/40 to-slate-200 lg:block"
                  />
                )}

                <div
                  className={`absolute left-0 top-0 z-10 flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ring-4 ring-white ${
                    isFirst
                      ? 'bg-[#0052FF] text-white shadow-[0_0_0_4px_rgba(0,82,255,0.15)]'
                      : isLast
                        ? 'border-2 border-[#0052FF] bg-white text-[#0052FF]'
                        : 'border-2 border-slate-300 bg-white text-slate-600'
                  }`}
                >
                  {stage.step}
                </div>

                {isFirst && (
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[#0052FF]">
                    Bắt đầu tại đây
                  </p>
                )}
                {isLast && (
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[#0052FF]">
                    Đích đến
                  </p>
                )}
                <h3 className="break-words text-sm font-extrabold leading-5 text-[#091224] sm:text-base">
                  {stage.title}
                </h3>
                <p className="mt-1.5 break-words text-sm leading-6 text-slate-600">
                  {stage.description}
                </p>
                <p className="mt-2 break-words text-xs font-bold text-blue-700">
                  Kết quả: {stage.outcome}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
