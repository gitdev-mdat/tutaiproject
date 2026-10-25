'use client';

import * as React from 'react';
import { Check, ChevronDown, RotateCcw, Sparkles, Volume2, VolumeX } from 'lucide-react';
import type { InteractivePlan } from '@/lib/learning/interactive-lesson';
import type { ActivityOutcome } from '@/features/lessons/lib/lesson-progress';
import { InlineText, RichText } from '../rich-text';
import { Fireworks } from './fireworks';
import { playReward } from './sound';
import { StreakPanel, type StreakState } from './streak';

/**
 * The end of the lesson: what the student found by themselves, how it went,
 * their learning streak, what to remember and the next step.
 *
 * The first time a student lands here (and on "Xem lại hiệu ứng") it
 * celebrates: the check draws in, fireworks at 0.3 s, the banner lifts and
 * shines at 0.7 s, then the streak, rolling to its new number if the server
 * confirmed a new learning day. The fireworks are gone after about 3 s and
 * never take a click; reduced motion keeps only the final state. With sound
 * on, a bell arpeggio plays with the fireworks and a brighter accent with a
 * new streak day.
 */
const FIREWORKS_AT = 0.3;
const STREAK_AT = 0.9;

export function FinishStage({
  plan,
  outcomes,
  practiceCard,
  celebrate,
  celebration,
  onReplay,
  streak,
  onRestart,
  onRetryChallenge,
  sound,
  onToggleSound,
}: {
  plan: InteractivePlan;
  outcomes: Record<string, ActivityOutcome>;
  practiceCard?: React.ReactNode;
  /** True the first time the student lands here. */
  celebrate: boolean;
  /** The celebration being played (run 0 for none) and when it started. */
  celebration: { run: number; at: number };
  onReplay: () => void;
  streak: StreakState;
  onRestart: () => void;
  onRetryChallenge: (() => void) | null;
  sound: boolean;
  onToggleSound: () => void;
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
  // The bells with the fireworks, once per play.
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
    // Once per play: revealDelay is fixed by then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, awarded]);

  const toggleSound = () => {
    // Turning sound on is a click, so the browser lets it play: a preview.
    if (!sound) void playReward('complete');
    onToggleSound();
  };

  // Exploring (dragging M) has no wrong answer: only questions count here.
  const values = Object.entries(outcomes)
    .filter(([id]) => !/\/keo-/.test(id))
    .map(([, value]) => value);
  const firstTry = values.filter((value) => value === 'first-try').length;
  const helped = values.filter((value) => value === 'with-help').length;
  const shown = values.filter((value) => value === 'revealed').length;

  const found = [
    {
      title: 'Đồ thị đổi chiều ở đâu',
      body: 'Ở đỉnh và đáy, nơi tiếp tuyến nằm ngang: f′(x) = 0.',
    },
    {
      title: 'Bí mật của độ dốc',
      body: 'f′(x) > 0 thì đồ thị đi lên (đồng biến), f′(x) < 0 thì đi xuống (nghịch biến).',
    },
    plan.flat
      ? {
          title: 'f′ = 0 chưa chắc đổi chiều',
          body: 'f′ bằng 0 tại vài điểm nhưng không đổi dấu thì hàm số vẫn giữ chiều.',
        }
      : {
          title: 'Quy trình 4 bước',
          body: 'Tập xác định → đạo hàm → xét dấu f′ → kết luận.',
        },
  ];

  return (
    <div className="mx-auto max-w-[1040px]" data-testid="finish" data-run={run}>
      <Fireworks run={run} delay={FIREWORKS_AT} />
      <div
        key={run}
        className={`relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0A1F5C] via-[#0F2D7A] to-[#0052FF] px-5 py-7 text-white shadow-[0_24px_60px_rgba(0,82,255,0.25)] sm:px-8 sm:py-9 ${run ? 'tt-emphasis' : ''}`}
        data-testid="finish-banner"
      >
        <BannerSparkles />
        {run > 0 && (
          <span
            className="tt-shine pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent"
            aria-hidden="true"
          />
        )}
        <div className="relative flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          <div className="relative grid size-20 shrink-0 place-items-center" aria-hidden="true">
            <svg viewBox="0 0 80 80" className="absolute inset-0 size-20 -rotate-90">
              <circle
                cx="40"
                cy="40"
                r="34"
                className="fill-none stroke-white/15"
                strokeWidth="7"
              />
              <circle
                cx="40"
                cy="40"
                r="34"
                pathLength={1}
                className={`fill-none stroke-emerald-400 ${run ? 'tt-draw' : ''}`}
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray="1"
              />
            </svg>
            {run > 0 && (
              <span className="tt-glow absolute left-1/2 top-1/2 size-12 -translate-x-1/2 -translate-y-1/2 rounded-full" />
            )}
            <span
              className={`relative grid size-12 place-items-center rounded-full bg-emerald-400 text-[#0A1F5C] ${run ? 'tt-pop' : ''}`}
            >
              <Check className="size-7" strokeWidth={3} />
            </span>
            {run > 0 &&
              BURST.map(([dx, dy, tone], index) => (
                <span
                  key={index}
                  className={`tt-burst absolute left-1/2 top-1/2 size-2 rounded-full ${tone}`}
                  style={
                    {
                      '--tt-dx': `${dx}px`,
                      '--tt-dy': `${dy}px`,
                      opacity: 0,
                    } as React.CSSProperties
                  }
                />
              ))}
          </div>
          <div className="min-w-0">
            <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-blue-200">
              Hoàn thành 100%
            </p>
            <h3 className="mt-1 text-[22px] font-extrabold leading-tight text-white sm:text-[26px]">
              {celebrate ? 'Tuyệt vời! Em đã tự khám phá cả bài.' : 'Em đã học xong bài này'}
            </h3>
            {values.length > 0 && (
              <p className="mt-2 text-[15px] text-blue-100" data-testid="finish-stats">
                {firstTry}/{values.length} câu đúng ngay lần đầu
                {helped ? ` · ${helped} câu đúng nhờ gợi ý` : ''}
                {shown ? ` · ${shown} câu đã xem đáp án` : ''}
              </p>
            )}
          </div>
        </div>
        {/* During a celebration the streak row opens as it appears, so the
            banner holds no empty gap before it. */}
        <div
          className={`relative ${run ? 'tt-expand' : ''}`}
          style={run ? { animationDelay: `${revealDelay}s` } : undefined}
        >
          <div className="min-h-0 overflow-hidden">
            <StreakPanel state={streak} run={run} revealDelay={revealDelay} />
          </div>
        </div>
        <div className="relative mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={toggleSound}
            aria-pressed={sound}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-white/10 px-3.5 text-[14px] font-semibold text-white ring-1 ring-white/20 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            data-testid="sound-toggle"
          >
            {sound ? (
              <Volume2 className="size-4" aria-hidden="true" />
            ) : (
              <VolumeX className="size-4" aria-hidden="true" />
            )}
            Âm thanh: {sound ? 'bật' : 'tắt'}
          </button>
          <button
            type="button"
            onClick={onReplay}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-[14px] font-semibold text-blue-100 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            data-testid="replay-celebration"
          >
            <Sparkles className="size-4" aria-hidden="true" /> Xem lại hiệu ứng
          </button>
        </div>
      </div>

      <h3 className="mt-7 flex items-center gap-2 text-[15px] font-bold text-[#091224]">
        <Sparkles className="size-4 text-blue-600" aria-hidden="true" /> Em đã tự tìm ra
      </h3>
      <ol className="mt-3 grid gap-3 md:grid-cols-3" data-testid="found-cards">
        {found.map((card, index) => (
          <li
            key={card.title}
            className="tt-rise rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(9,18,36,0.05)]"
            style={{ animationDelay: `${0.15 + index * 0.12}s` }}
          >
            <span className="grid size-7 place-items-center rounded-full bg-blue-50 text-[13px] font-extrabold text-blue-700">
              {index + 1}
            </span>
            <p className="mt-2 text-[16px] font-bold text-[#091224]">{card.title}</p>
            <p className="mt-1 text-[14px] leading-6 text-slate-600">{card.body}</p>
          </li>
        ))}
      </ol>

      <div className="mt-7 grid gap-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:items-start">
        <div className="min-w-0">
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
          <div className="mt-4 flex flex-wrap gap-2">
            {onRetryChallenge && (
              <button
                type="button"
                onClick={onRetryChallenge}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-[14px] font-semibold text-[#091224] hover:border-blue-300 hover:bg-[#F4F8FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                data-testid="retry-challenge"
              >
                <RotateCcw className="size-4" aria-hidden="true" /> Thử thách lại
              </button>
            )}
            <button
              type="button"
              onClick={onRestart}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-[14px] font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              data-testid="restart"
            >
              Xem lại từ đầu
            </button>
          </div>
        </div>
        {practiceCard && (
          <div className="min-w-0 md:sticky md:top-6" data-testid="finish-next">
            {practiceCard}
          </div>
        )}
      </div>
    </div>
  );
}

/** A few faint stars in the banner, always there (not animated). */
function BannerSparkles() {
  return (
    <svg
      className="pointer-events-none absolute right-0 top-0 h-36 w-1/2 text-white"
      viewBox="0 0 200 120"
      preserveAspectRatio="xMaxYMin slice"
      aria-hidden="true"
    >
      {STARS.map(([x, y, r, o], index) => (
        <path
          key={index}
          d={`M${x} ${y - r}L${x + r * 0.28} ${y - r * 0.28}L${x + r} ${y}L${x + r * 0.28} ${y + r * 0.28}L${x} ${y + r}L${x - r * 0.28} ${y + r * 0.28}L${x - r} ${y}L${x - r * 0.28} ${y - r * 0.28}Z`}
          fill="currentColor"
          opacity={o}
        />
      ))}
    </svg>
  );
}

const STARS: Array<[number, number, number, number]> = [
  [170, 22, 7, 0.35],
  [146, 50, 4, 0.25],
  [186, 70, 3.5, 0.2],
  [120, 16, 3, 0.18],
  [160, 96, 5, 0.15],
];

const BURST: Array<[number, number, string]> = [
  [-38, -30, 'bg-amber-300'],
  [36, -34, 'bg-emerald-300'],
  [44, 8, 'bg-sky-300'],
  [-44, 12, 'bg-pink-300'],
  [-12, -46, 'bg-white'],
  [16, 42, 'bg-amber-200'],
  [-26, 38, 'bg-emerald-200'],
  [30, 30, 'bg-white'],
];
