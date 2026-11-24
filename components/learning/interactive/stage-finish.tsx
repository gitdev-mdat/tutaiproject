'use client';

import * as React from 'react';
import { BookOpen, Check, ChevronDown, RotateCcw } from 'lucide-react';
import type { InteractivePlan } from '@/lib/learning/interactive-lesson';
import type { ActivityOutcome } from '@/features/lessons/lib/lesson-progress';
import type { Celebration } from '@/lib/learning/lesson-celebration';
import { InlineText, RichText } from '../rich-text';
import { Fireworks } from './fireworks';
import { playReward } from './sound';
import { StreakPanel, type StreakState } from './streak';

/**
 * The end of the lesson, kept calm: one status card (done, how it went, the
 * learning streak), the next step beside it, then what to remember and the
 * ways to review.
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
  onRestart,
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
  onRestart: () => void;
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

  return (
    <div className="mx-auto max-w-[1040px]" data-testid="finish" data-run={run} data-mode={mode}>
      <Fireworks run={run} delay={FIREWORKS_AT} />
      <div className="grid gap-4 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:items-start md:gap-6">
        <div
          className={`rounded-2xl border bg-white p-4 sm:p-5 md:col-start-1 md:row-start-1 ${
            fresh
              ? 'border-emerald-200 shadow-[0_12px_32px_rgba(16,185,129,0.10)]'
              : 'border-slate-200'
          }`}
          data-testid="finish-summary"
        >
          <div className="flex items-start gap-3.5">
            <span
              className={`grid shrink-0 place-items-center rounded-full bg-emerald-500 text-white ${
                fresh ? 'size-11' : 'size-9'
              } ${run ? 'tt-pop' : ''}`}
              aria-hidden="true"
            >
              <Check className={fresh ? 'size-6' : 'size-5'} strokeWidth={3} />
            </span>
            <div className="min-w-0">
              <h3
                className={`font-extrabold leading-snug text-[#091224] ${
                  fresh ? 'text-[20px] sm:text-[22px]' : 'text-[17px] sm:text-[18px]'
                }`}
                data-testid="finish-title"
              >
                {fresh ? 'Tuyệt vời! Em đã tự khám phá cả bài.' : 'Em đã học xong bài này'}
              </h3>
              {values.length > 0 && (
                <p
                  className="mt-0.5 text-[14px] leading-6 text-slate-600"
                  data-testid="finish-stats"
                >
                  {firstTry}/{values.length} câu đúng ngay lần đầu
                  {helped ? ` · ${helped} câu đúng nhờ gợi ý` : ''}
                  {shown ? ` · ${shown} câu đã xem đáp án` : ''}
                </p>
              )}
            </div>
          </div>
          {/* During the celebration the streak row opens as it appears, so the
              card holds no empty gap before it. */}
          <div
            className={run ? 'tt-expand' : ''}
            style={run ? { animationDelay: `${revealDelay}s` } : undefined}
          >
            <div className="min-h-0 overflow-hidden">
              <StreakPanel state={streak} run={run} revealDelay={revealDelay} quiet={!fresh} />
            </div>
          </div>
        </div>

        {practiceCard && (
          <div
            className="min-w-0 md:sticky md:top-6 md:col-start-2 md:row-span-2 md:row-start-1"
            data-testid="finish-next"
          >
            {practiceCard}
          </div>
        )}

        <div className="min-w-0 md:col-start-1 md:row-start-2">
          {plan.recap.length > 0 && (
            <details
              className="group rounded-2xl border border-slate-200 bg-white"
              open
              data-testid="recap"
            >
              <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-[15px] font-bold text-[#091224] [&::-webkit-details-marker]:hidden">
                <ChevronDown
                  className="size-4 transition-transform group-open:rotate-180"
                  aria-hidden="true"
                />
                Điều cần nhớ
              </summary>
              <ol className="space-y-2.5 px-4 pb-4">
                {plan.recap.map((item, index) => (
                  <li key={index} className="flex gap-3">
                    <span className="w-4 shrink-0 text-right text-[15px] font-extrabold leading-7 tabular-nums text-blue-600">
                      {index + 1}
                    </span>
                    <span className="text-[15px] leading-7 text-slate-800">
                      <InlineText text={item} />
                    </span>
                  </li>
                ))}
              </ol>
            </details>
          )}
          {(plan.objectives.length > 0 || plan.references) && (
            <details className="group mt-3" data-testid="finish-more">
              <summary className="inline-flex min-h-10 cursor-pointer list-none items-center gap-1.5 text-[14px] font-semibold text-slate-500 hover:text-slate-800 [&::-webkit-details-marker]:hidden">
                <ChevronDown
                  className="size-4 transition-transform group-open:rotate-180"
                  aria-hidden="true"
                />
                Mục tiêu bài học{plan.references ? ' và tài liệu tham khảo' : ''}
              </summary>
              <ul className="mt-1 space-y-1.5 text-[14px] leading-6 text-slate-600">
                {plan.objectives.map((item, index) => (
                  <li key={index}>
                    • <InlineText text={item} />
                  </li>
                ))}
              </ul>
              {plan.references && (
                <RichText content={plan.references} className="mt-2 text-[14px] text-slate-500" />
              )}
            </details>
          )}
          <div className="mt-3 flex flex-wrap gap-2" data-testid="finish-review">
            <button
              type="button"
              onClick={onRestart}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-[14px] font-semibold text-[#091224] hover:border-blue-300 hover:bg-[#F4F8FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              data-testid="restart"
            >
              <BookOpen className="size-4" aria-hidden="true" /> Xem lại từ đầu
            </button>
            {onRetryChallenge && (
              <button
                type="button"
                onClick={onRetryChallenge}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-[14px] font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                data-testid="retry-challenge"
              >
                <RotateCcw className="size-4" aria-hidden="true" /> Thử thách lại
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
