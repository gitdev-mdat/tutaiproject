'use client';

import * as React from 'react';
import { Check, ChevronDown, ChevronRight, CircleCheck, RotateCcw } from 'lucide-react';
import type { InteractivePlan } from '@/lib/learning/interactive-lesson';
import type { ActivityOutcome } from '@/features/lessons/lib/lesson-progress';
import type { Celebration } from '@/lib/learning/lesson-celebration';
import { InlineText, RichText } from '../rich-text';
import { Fireworks } from './fireworks';
import { playReward } from './sound';
import { StreakPanel, type StreakState } from './streak';

/**
 * The end of the lesson as one sheet that answers three questions in order:
 * is it done (status, how it went, the streak), what to remember (the
 * teacher's recap, objectives on request), and what to do next (the
 * practice or next lesson, one primary action), with reviewing a part kept
 * beside it and quieter.
 *
 * Only the first finish celebrates (see lib/learning/lesson-celebration):
 * the check pops, a short firework at 0.3 s (about 3 s, never takes a click)
 * and, with sound on, the completion bells once, plus a brighter accent when
 * the server confirmed a new streak day. Reduced motion keeps only the final
 * state. A refresh, a reopened lesson or coming back to this part shows the
 * same card without any of it.
 */
const FIREWORKS_AT = 0.3;
const STREAK_AT = 0.9;

export function FinishStage({
  plan,
  outcomes,
  practiceCard,
  celebrate,
  celebration,
  streak,
  onReview,
  onRetryChallenge,
  sound,
}: {
  plan: InteractivePlan;
  outcomes: Record<string, ActivityOutcome>;
  practiceCard?: React.ReactNode;
  /** True when the student finished the lesson during this page view. */
  celebrate: boolean;
  /** The one celebration of this page view (run 0 for none) and when it started. */
  celebration: Celebration;
  streak: StreakState;
  /** Opens a part (by index) to review it with the student's answers. */
  onReview: (index: number) => void;
  onRetryChallenge: (() => void) | null;
  sound: boolean;
}) {
  const run = celebration.run;
  // The streak appears at 0.9 s into the celebration, or as soon as the
  // server answers if that is later.
  const arrived = streak.phase === 'done' || streak.phase === 'none' ? streak.at : 0;
  const revealDelay = run ? Math.max(0, STREAK_AT - (arrived - celebration.at) / 1000) : 0;

  const soundOn = React.useRef(sound);
  React.useEffect(() => {
    soundOn.current = sound;
  }, [sound]);
  // The bells with the fireworks, once.
  React.useEffect(() => {
    if (!run || !soundOn.current) return;
    const timer = window.setTimeout(() => void playReward('complete'), FIREWORKS_AT * 1000);
    return () => window.clearTimeout(timer);
  }, [run]);
  // The accent only for a new day the server confirmed, as the number rolls.
  const awarded = streak.phase === 'done' && streak.result.status === 'awarded';
  React.useEffect(() => {
    if (!run || !awarded || !soundOn.current) return;
    const timer = window.setTimeout(() => void playReward('streak'), (revealDelay + 0.35) * 1000);
    return () => window.clearTimeout(timer);
    // Once: revealDelay is fixed by then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, awarded]);

  // Exploring (dragging M) has no wrong answer: only questions count here.
  const values = Object.entries(outcomes)
    .filter(([id]) => !/\/keo-/.test(id))
    .map(([, value]) => value);
  const firstTry = values.filter((value) => value === 'first-try').length;
  const helped = values.filter((value) => value === 'with-help').length;
  const shown = values.filter((value) => value === 'revealed').length;
  // Just finished (this page view): a warmer card. A revisit: a quiet status.
  const fresh = celebrate;
  const mode = run ? 'celebrate' : fresh ? 'summary' : 'revisit';

  const parts = plan.stages.filter((stage) => stage.kind !== 'finish');

  return (
    <div className="mt-1" data-testid="finish" data-run={run} data-mode={mode}>
      <Fireworks run={run} delay={FIREWORKS_AT} />
      {/* One sheet: what was done and what to remember on the left, what to do
          next and how to review on the right. On phones it reads in that
          order: done, next, review, remember. */}
      <article className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(9,18,36,0.04),0_16px_40px_-12px_rgba(9,18,36,0.08)] lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(320px,392px)] lg:grid-rows-[auto_1fr]">
        <header
          className="px-5 pb-5 pt-6 sm:px-8 sm:pt-8 lg:col-start-1 lg:row-start-1"
          data-testid="finish-summary"
        >
          {fresh && (
            <p className="mb-2.5 flex items-center gap-2 text-[13px] font-bold text-emerald-700">
              <span
                className={`grid size-6 place-items-center rounded-full bg-emerald-500 text-white ${run ? 'tt-pop' : ''}`}
                aria-hidden="true"
              >
                <Check className="size-3.5" strokeWidth={3} />
              </span>
              Hoàn thành bài học
            </p>
          )}
          <h3
            className="flex items-center gap-2.5 text-[24px] font-extrabold leading-tight tracking-tight text-[#091224] sm:text-[28px]"
            data-testid="finish-title"
          >
            {!fresh && (
              <span
                className="grid size-7 shrink-0 place-items-center rounded-full bg-emerald-500 text-white"
                aria-hidden="true"
              >
                <Check className="size-4" strokeWidth={3} />
              </span>
            )}
            {fresh ? 'Tuyệt vời! Em đã tự khám phá cả bài.' : 'Em đã học xong bài này'}
          </h3>
          {values.length > 0 && (
            <p className="mt-1.5 text-[15px] leading-6 text-slate-600" data-testid="finish-stats">
              {firstTry}/{values.length} câu đúng ngay lần đầu
              {helped ? ` · ${helped} câu đúng nhờ gợi ý` : ''}
              {shown ? ` · ${shown} câu đã xem đáp án` : ''}
            </p>
          )}
          {/* During the celebration the streak row opens as it appears, so the
              header holds no empty gap before it. */}
          <div
            className={run ? 'tt-expand' : ''}
            style={run ? { animationDelay: `${revealDelay}s` } : undefined}
          >
            <div className="min-h-0 overflow-hidden">
              <StreakPanel state={streak} run={run} revealDelay={revealDelay} quiet={!fresh} />
            </div>
          </div>
        </header>

        <aside
          className="border-t border-slate-100 bg-[#F6F8FC] lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:border-l lg:border-t-0"
          aria-label="Học tiếp"
        >
          {practiceCard && (
            <div className="px-5 py-6 sm:px-8 lg:px-7 lg:pt-8" data-testid="finish-next">
              {practiceCard}
            </div>
          )}
          <nav
            aria-labelledby="finish-review-title"
            className={`px-5 pb-6 sm:px-8 lg:px-7 ${practiceCard ? 'border-t border-slate-200/70 pt-5' : 'pt-6'}`}
            data-testid="finish-review"
          >
            <p
              id="finish-review-title"
              className="text-[12px] font-bold uppercase tracking-[0.12em] text-slate-500"
            >
              Ôn lại bài
            </p>
            <p className="mt-1 hidden text-[13px] leading-5 text-slate-500 lg:block">
              Mở lại một phần để xem câu trả lời của em. Bài vẫn được tính là đã học.
            </p>
            <ol className="mt-3 flex flex-wrap gap-2 lg:-mx-2 lg:mt-2 lg:block">
              {parts.map((stage, index) => (
                <li key={stage.id}>
                  <button
                    type="button"
                    onClick={() => onReview(index)}
                    className="group flex min-h-10 items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1.5 pr-3.5 text-left hover:border-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 lg:w-full lg:gap-3 lg:rounded-lg lg:border-0 lg:bg-transparent lg:px-2 lg:hover:bg-white"
                    data-testid={index === 0 ? 'restart' : `review-${stage.id}`}
                  >
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-emerald-100 text-[12px] font-bold tabular-nums text-emerald-700">
                      {index + 1}
                    </span>
                    <span className="min-w-0 truncate text-[14px] lg:flex-1">
                      <span className="font-semibold text-[#091224]">{PART_NAMES[stage.kind]}</span>
                      <span className="hidden text-slate-500 lg:inline">
                        {' · '}
                        <InlineText text={stage.title} />
                      </span>
                    </span>
                    <ChevronRight
                      className="hidden size-4 shrink-0 text-slate-300 group-hover:text-blue-600 lg:block"
                      aria-hidden="true"
                    />
                  </button>
                </li>
              ))}
            </ol>
            {onRetryChallenge && (
              <button
                type="button"
                onClick={onRetryChallenge}
                className="-mx-2 mt-2 flex min-h-10 w-[calc(100%+1rem)] items-center lg:mt-1 gap-3 rounded-lg px-2 text-left text-[14px] font-semibold text-slate-600 hover:bg-white hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                data-testid="retry-challenge"
              >
                <span className="grid size-6 shrink-0 place-items-center" aria-hidden="true">
                  <RotateCcw className="size-4" />
                </span>
                Làm lại phần Tự làm, giữ kết quả tốt nhất
              </button>
            )}
          </nav>
        </aside>

        {(plan.recap.length > 0 || plan.objectives.length > 0 || plan.references) && (
          <section
            aria-labelledby="recap-title"
            className="border-t border-slate-100 px-5 py-6 sm:px-8 lg:col-start-1 lg:row-start-2 lg:pb-8"
            data-testid="recap"
          >
            {plan.recap.length > 0 && (
              <>
                <h3 id="recap-title" className="text-[17px] font-extrabold text-[#091224]">
                  Điều cần nhớ
                </h3>
                <ol className="mt-2 divide-y divide-slate-100">
                  {plan.recap.map((item, index) => (
                    <li key={index} className="flex gap-3.5 py-3 first:pt-2 last:pb-0">
                      <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg bg-blue-50 text-[13px] font-extrabold tabular-nums text-blue-700">
                        {index + 1}
                      </span>
                      <span className="min-w-0 text-[16px] leading-7 text-slate-800">
                        <InlineText text={item} />
                      </span>
                    </li>
                  ))}
                </ol>
              </>
            )}
            {(plan.objectives.length > 0 || plan.references) && (
              <details
                className={`group ${plan.recap.length ? 'mt-5 border-t border-slate-100 pt-3' : ''}`}
                data-testid="finish-more"
              >
                <summary className="inline-flex min-h-10 cursor-pointer list-none items-center gap-1.5 text-[14px] font-semibold text-slate-600 hover:text-slate-900 [&::-webkit-details-marker]:hidden">
                  <ChevronDown
                    className="size-4 transition-transform group-open:rotate-180"
                    aria-hidden="true"
                  />
                  {plan.objectives.length > 0
                    ? `Mục tiêu em đã đạt (${plan.objectives.length})`
                    : 'Tài liệu tham khảo'}
                </summary>
                {plan.objectives.length > 0 && (
                  <ul className="mt-1 space-y-1.5">
                    {plan.objectives.map((item, index) => (
                      <li key={index} className="flex gap-2.5 text-[15px] leading-6 text-slate-700">
                        <CircleCheck
                          className="mt-1 size-4 shrink-0 text-emerald-600"
                          aria-hidden="true"
                        />
                        <span className="min-w-0">
                          <InlineText text={item} />
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {plan.references && (
                  <RichText content={plan.references} className="mt-3 text-[14px] text-slate-500" />
                )}
              </details>
            )}
          </section>
        )}
      </article>
    </div>
  );
}

/** The short name of each kind of part, as on the lesson's progress bar. */
export const PART_NAMES = {
  shape: 'Quan sát',
  slope: 'Khám phá',
  flat: 'Mở rộng',
  solve: 'Áp dụng',
  challenge: 'Tự làm',
  finish: 'Hoàn thành',
} as const;
