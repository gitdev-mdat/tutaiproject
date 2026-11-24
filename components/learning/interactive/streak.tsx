'use client';

import * as React from 'react';
import type { CompletionResponse, CompletionResult } from '@/lib/learning/learning-streak';
import { prefersReducedMotion } from './fireworks';

/**
 * The daily learning streak on the completion screen. The number shown is
 * always the one the server stored: nothing is counted up in the browser, a
 * failed request shows no streak, and the one celebration only shows what
 * was confirmed.
 */

export type StreakState =
  | { phase: 'idle' }
  | { phase: 'pending' }
  /** `at`: when the answer arrived (Date.now()). */
  | { phase: 'done'; result: CompletionResult; at: number }
  /** Off on this server, signed out, or the request failed: no streak is claimed. */
  | { phase: 'none'; failed: boolean; at: number };

type Answer = { phase: 'done'; result: CompletionResult } | { phase: 'none'; failed: boolean };

// One request per lesson and page load, however often the screen remounts.
const requests = new Map<string, Promise<Answer>>();

async function postCompletion(lessonId: string): Promise<Answer> {
  try {
    const response = await fetch(`/api/student/lessons/${encodeURIComponent(lessonId)}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (response.status === 401) return { phase: 'none', failed: false };
    const body = (await response.json().catch(() => null)) as CompletionResponse | null;
    if (!response.ok || !body) return { phase: 'none', failed: true };
    if (body.status === 'disabled') return { phase: 'none', failed: false };
    if (body.status === 'error') return { phase: 'none', failed: true };
    return { phase: 'done', result: body };
  } catch {
    return { phase: 'none', failed: true };
  }
}

/**
 * Tells the server the lesson is complete once `completed` is true, and holds
 * the streak it answers with. The call is idempotent on the server, so a
 * refresh or a second tab is safe; this only avoids sending it twice.
 */
export function useLessonCompletion(lessonId: string, completed: boolean): StreakState {
  const [state, setState] = React.useState<StreakState>({ phase: 'idle' });
  React.useEffect(() => {
    if (!completed) return;
    let live = true;
    let request = requests.get(lessonId);
    if (!request) {
      request = postCompletion(lessonId);
      requests.set(lessonId, request);
      // A failure may be retried on the next visit.
      void request.then((result) => {
        if (result.phase === 'none' && result.failed) requests.delete(lessonId);
      });
    }
    const timer = window.setTimeout(() => live && setState({ phase: 'pending' }), 0);
    void request.then((answer) => {
      window.clearTimeout(timer);
      if (live) setState({ ...answer, at: Date.now() });
    });
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [lessonId, completed]);
  return state;
}

export function streakCopy(result: CompletionResult): { title: string; message: string } {
  const n = result.current;
  if (result.status === 'awarded') {
    return {
      title: n === 1 ? 'ngày học, chuỗi mới bắt đầu!' : 'ngày học liên tiếp!',
      message:
        n === 1
          ? 'Mai quay lại học tiếp để giữ lửa nhé.'
          : n >= 30
            ? 'Hơn một tháng không nghỉ. Thật đáng nể!'
            : n >= 7
              ? 'Cả tuần không nghỉ, em đang học rất bền bỉ.'
              : 'Đều đặn mỗi ngày, kiến thức sẽ thành phản xạ.',
    };
  }
  if (result.today) {
    return {
      title: 'Hôm nay em đã giữ vững chuỗi học tập!',
      message: `Chuỗi hiện tại: ${n} ngày học liên tiếp.`,
    };
  }
  return {
    title: 'ngày học liên tiếp đang chờ em',
    message: 'Ôn lại bài cũ không tính thêm ngày. Học một bài mới hôm nay để giữ lửa.',
  };
}

/**
 * The streak inside the completion card. `run` is the celebration being
 * played (0 for none): with a new day awarded, the number rolls from the old
 * streak to the new one and the flame flares as it lands. `quiet` (a lesson
 * learned before) shows only the number, in one line.
 */
export function StreakPanel({
  state,
  run,
  revealDelay,
  quiet = false,
}: {
  state: StreakState;
  run: number;
  /** Seconds before the roll, so it lands after the fireworks start. */
  revealDelay: number;
  quiet?: boolean;
}) {
  if (quiet) {
    if (state.phase !== 'done' || state.result.current === 0) return null;
    const waiting = state.result.status === 'repeat' && !state.result.today;
    return (
      <p
        className="mt-3 flex items-center gap-1.5 text-[14px] text-slate-600"
        data-testid="streak"
        data-status={state.result.status}
        data-current={state.result.current}
      >
        <FlameIcon dim={waiting} still className="!h-5 !w-[18px]" style={{}} />
        <span>
          <strong className="font-extrabold text-amber-600">{state.result.current}</strong> ngày học
          liên tiếp
        </span>
      </p>
    );
  }
  if (state.phase === 'pending') {
    return (
      <p className="mt-4 text-[14px] text-slate-400" data-testid="streak-pending">
        Đang lưu chuỗi ngày học…
      </p>
    );
  }
  if (state.phase === 'none') {
    return state.failed ? (
      <p className="mt-4 text-[14px] text-slate-500" role="status" data-testid="streak-error">
        Chưa lưu được chuỗi ngày học lúc này. Bài học của em vẫn được ghi nhận.
      </p>
    ) : null;
  }
  if (state.phase !== 'done') return null;
  const result = state.result;
  if (result.status === 'repeat' && result.current === 0) return null;
  // Under reduced motion the new number is simply there.
  const rising = result.status === 'awarded' && run > 0 && !prefersReducedMotion();
  const waiting = result.status === 'repeat' && !result.today;
  const copy = streakCopy(result);
  const delay = { '--tt-delay': `${revealDelay + 0.35}s` } as React.CSSProperties;
  const numberFirst = result.status === 'awarded' || waiting;

  return (
    <div
      key={run}
      className={`mt-4 flex items-center gap-3 rounded-xl border border-amber-100 bg-amber-50/70 px-3.5 py-2.5 ${run ? 'tt-rise' : ''}`}
      style={run ? { animationDelay: `${revealDelay}s` } : undefined}
      data-testid="streak"
      data-status={result.status}
      data-current={result.current}
    >
      <span className="relative shrink-0" aria-hidden="true">
        <FlameIcon dim={waiting} className={rising ? 'tt-flare' : ''} style={delay} />
        {rising &&
          EMBERS.map(([dx, at], index) => (
            <span
              key={index}
              className="tt-ember absolute bottom-3 left-1/2 size-1.5 rounded-full bg-amber-300"
              style={
                {
                  '--tt-dx': `${dx}px`,
                  '--tt-delay': `${revealDelay + 0.35 + at}s`,
                  opacity: 0,
                } as React.CSSProperties
              }
            />
          ))}
      </span>
      <div className="min-w-0" role="status" aria-live="polite">
        <p className="flex flex-wrap items-baseline gap-x-2 text-[#091224]">
          <span
            className="relative inline-block h-[1.15em] overflow-hidden text-[26px] font-black leading-[1.15] tabular-nums text-amber-600"
            data-testid="streak-number"
          >
            {rising ? (
              <span className="tt-roll flex flex-col" style={delay}>
                <span aria-hidden="true">{result.previous}</span>
                <span>{result.current}</span>
              </span>
            ) : (
              <span>{result.current}</span>
            )}
          </span>
          {numberFirst ? (
            <span className="text-[15px] font-bold">{copy.title}</span>
          ) : (
            <span className="text-[14px] font-semibold text-slate-600">ngày học liên tiếp</span>
          )}
        </p>
        {!numberFirst && <p className="text-[15px] font-bold text-[#091224]">{copy.title}</p>}
        <p className="text-[13px] leading-5 text-slate-600" data-testid="streak-message">
          {numberFirst ? copy.message : 'Mai học tiếp để chuỗi dài thêm nhé.'}
        </p>
      </div>
    </div>
  );
}

const EMBERS: Array<[number, number]> = [
  [-10, 0],
  [8, 0.08],
  [-3, 0.16],
  [12, 0.24],
];

function FlameIcon({
  dim,
  still = false,
  className,
  style,
}: {
  dim: boolean;
  still?: boolean;
  className: string;
  style: React.CSSProperties;
}) {
  const id = React.useId();
  return (
    <svg
      viewBox="0 0 48 56"
      className={`block h-9 w-8 ${className} ${dim ? 'opacity-55 saturate-50' : ''}`}
      style={style}
    >
      <defs>
        <linearGradient id={`${id}-outer`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#F97316" />
          <stop offset="0.55" stopColor="#FB923C" />
          <stop offset="1" stopColor="#FBBF24" />
        </linearGradient>
        <linearGradient id={`${id}-inner`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#FDE68A" />
          <stop offset="1" stopColor="#FFF7D6" />
        </linearGradient>
      </defs>
      <g className={dim || still ? '' : 'tt-flicker'}>
        <path
          d="M24 2c2 9 12 14 14 26 2 13-6 25-14 25S8 46 8 35c0-7 4-11 7-14 0 5 2 8 5 9-2-10 0-20 4-28z"
          fill={`url(#${id}-outer)`}
        />
        <path
          d="M24 26c1 5 7 8 7 15 0 6-3 10-7 10s-7-4-7-9c0-4 2-6 4-8 0 3 1 4 3 5-1-5-1-9 0-13z"
          fill={`url(#${id}-inner)`}
        />
      </g>
    </svg>
  );
}
