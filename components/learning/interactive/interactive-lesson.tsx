'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Clock3, Lock } from 'lucide-react';
import type { LessonJourney } from '@/lib/knowledge-tree/lesson-journey';
import type { PracticeQuestion } from '@/lib/practice/grading';
import { restoreInteractiveStage, type InteractivePlan } from '@/lib/learning/interactive-lesson';
import {
  recordLessonStage,
  recordLessonViewed,
  useLessonProgress,
} from '@/features/lessons/lib/lesson-progress';
import { LESSON_SUMMARY_HASH } from '@/features/lessons/lib/study-plan';
import { InlineText } from '../rich-text';
import { RuntimeContext } from './beats';
import { playChime, readSoundSetting, writeSoundSetting } from './sound';
import { FlatStage } from './stage-flat';
import { FinishStage } from './stage-finish';
import { useGraphHeight } from './stage-layout';
import { ShapeStage } from './stage-shape';
import { SlopeStage } from './stage-slope';
import { ChallengeStage, SolveStage } from './stage-solve';

/**
 * The interactive version of a function lesson (see lib/learning/interactive-lesson.ts):
 * one part at a time, each opened by doing its activity. Progress is saved
 * with the same store and the same rules as the text lesson, under the
 * interactive part ids; a student who reached a part of the text lesson
 * resumes on the part that teaches the same thing.
 */

const EYEBROW = {
  shape: 'Quan sát',
  slope: 'Khám phá',
  flat: 'Mở rộng',
  solve: 'Áp dụng',
  challenge: 'Tự làm',
  finish: 'Hoàn thành',
} as const;

export interface InteractiveLessonProps {
  studentKey: string | null;
  lessonId: string;
  title: string;
  subjectTitle: string;
  chapterTitle: string;
  backHref: string | null;
  backLabel?: string;
  trail?: string;
  plan: InteractivePlan;
  /** The text lesson, for its saved progress and its key idea. */
  journey: LessonJourney;
  checks: PracticeQuestion[];
  practiceCard?: React.ReactNode;
}

export function InteractiveLesson(props: InteractiveLessonProps) {
  const { studentKey, lessonId, plan, journey } = props;
  const stages = plan.stages;
  const stageIds = React.useMemo(() => stages.map((stage) => stage.id as string), [stages]);
  const last = stages.length - 1;
  const progress = useLessonProgress(studentKey ?? '');
  const saved = studentKey ? progress?.stages[lessonId] : undefined;
  const learned = !!saved?.completedAt;
  const outcomes = (studentKey ? progress?.outcomes?.[lessonId] : undefined) ?? {};

  const [opened, setOpened] = React.useState(0);
  const [current, setCurrent] = React.useState(0);
  const [restored, setRestored] = React.useState(false);
  const [ready, setReady] = React.useState<Record<string, boolean>>({});
  // Parts the student chose to do again: shown fresh instead of answered.
  const [redo, setRedo] = React.useState<Record<string, number>>({});
  const [celebrate, setCelebrate] = React.useState(false);
  const [sound, setSound] = React.useState(
    () => typeof window !== 'undefined' && readSoundSetting()
  );
  const top = React.useRef<HTMLDivElement>(null);
  const height = useGraphHeight();

  React.useEffect(() => {
    if (studentKey) recordLessonViewed(studentKey, lessonId);
  }, [studentKey, lessonId]);

  // Saved progress is read after mount; adopt it once, during render. A
  // learned lesson opens on its summary, every part open to revisit.
  if (!restored && typeof window !== 'undefined' && (progress || !studentKey)) {
    const atSummary = window.location.hash === `#${LESSON_SUMMARY_HASH}`;
    const index =
      learned || (atSummary && saved) ? last : restoreInteractiveStage(saved, plan, journey);
    setOpened(learned ? last : index);
    setCurrent(index);
    setRestored(true);
  }

  const reachable = learned ? last : opened;
  const stage = stages[current];
  const review = (index: number) => (learned || index < opened) && !redo[stages[index].id];
  const isReady = (index: number) => review(index) || !!ready[stages[index].id];
  const markReady = React.useMemo(() => {
    const handlers: Record<string, () => void> = {};
    for (const item of stages) {
      handlers[item.id] = () =>
        setReady((current) => (current[item.id] ? current : { ...current, [item.id]: true }));
    }
    return handlers;
  }, [stages]);

  const show = (index: number, limit = reachable) => {
    if (index < 0 || index > limit) return;
    setCurrent(index);
    window.requestAnimationFrame(() => {
      const rect = top.current?.getBoundingClientRect();
      if (rect && rect.top < 0) top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      document.getElementById(`${stages[index].id}-title`)?.focus({ preventScroll: true });
    });
  };

  const advance = () => {
    const next = Math.min(current + 1, last);
    if (next > opened) {
      setOpened(next);
      if (studentKey) recordLessonStage(studentKey, lessonId, next, stageIds);
      if (next === last && !learned) {
        setCelebrate(true);
        if (sound) playChime('complete');
      }
    }
    show(next, Math.max(next, reachable));
  };

  const again = (id: string) => {
    setRedo((current) => ({ ...current, [id]: (current[id] ?? 0) + 1 }));
    setReady((current) => ({ ...current, [id]: false }));
    const index = stageIds.indexOf(id);
    if (index >= 0) show(index);
  };

  const toggleSound = () => {
    setSound((value) => {
      writeSoundSetting(!value);
      return !value;
    });
  };

  const runtime = React.useMemo(
    () => ({ lessonId, studentKey, review: review(current), sound }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lessonId, studentKey, current, opened, learned, redo, sound]
  );

  const canContinue = isReady(current);
  const nextStage = stages[current + 1];

  let body: React.ReactNode;
  switch (stage.kind) {
    case 'shape':
      body = <ShapeStage plan={plan} height={height} onReady={markReady[stage.id]} />;
      break;
    case 'slope':
      body = <SlopeStage plan={plan} height={height} onReady={markReady[stage.id]} />;
      break;
    case 'flat':
      body = <FlatStage plan={plan} height={height} onReady={markReady[stage.id]} />;
      break;
    case 'solve':
      body = <SolveStage plan={plan} height={height} onReady={markReady[stage.id]} />;
      break;
    case 'challenge':
      body = (
        <ChallengeStage
          plan={plan}
          height={height}
          checks={props.checks}
          lessonId={lessonId}
          onReady={markReady[stage.id]}
        />
      );
      break;
    case 'finish':
      body = (
        <FinishStage
          plan={plan}
          outcomes={outcomes}
          practiceCard={props.practiceCard}
          celebrate={celebrate}
          onRestart={() => show(0)}
          onRetryChallenge={stageIds.includes('thu-suc') ? () => again('thu-suc') : null}
          sound={sound}
          onToggleSound={toggleSound}
        />
      );
      break;
  }

  return (
    <div
      className="mx-auto w-full max-w-[1180px] pb-28 md:pb-8"
      data-testid="interactive-lesson"
      data-opened={opened}
      data-current={current}
      data-stage-id={stage.id}
    >
      <div ref={top} className="scroll-mt-20 lg:scroll-mt-6" />
      <header className="-mt-12 flex flex-col gap-3 md:mt-0 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
        <div className="min-w-0 max-w-[720px]">
          <p className="ml-12 flex min-h-10 min-w-0 items-center gap-2 text-[13px] text-slate-500 lg:ml-0 lg:min-h-0">
            {props.backHref && (
              <Link
                href={props.backHref}
                className="inline-flex h-8 min-w-0 shrink items-center gap-1.5 rounded-full bg-[#0A1F5C] pl-2.5 pr-3.5 font-semibold text-white transition-colors hover:bg-[#15307A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                data-testid="journey-back"
              >
                <ArrowLeft className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{props.backLabel ?? 'Lộ trình'}</span>
              </Link>
            )}
            <span className="min-w-0 shrink-0 truncate" data-testid="lesson-trail">
              {props.trail ?? (props.chapterTitle || props.subjectTitle)}
            </span>
          </p>
          <h1 className="mt-1 text-[22px] font-extrabold leading-tight tracking-tight text-[#091224] sm:text-[26px]">
            {props.title}
          </h1>
          {/* The key idea is what the student is about to find: it is said once found. */}
          {learned && journey.keyIdea && (
            <p
              className="mt-1 text-[14px] leading-6 text-slate-600 sm:text-[15px]"
              data-testid="key-idea"
            >
              <span className="font-semibold text-blue-700">Ý chính: </span>
              <InlineText text={journey.keyIdea} />
            </p>
          )}
        </div>
        <StageBar
          stages={stages}
          current={current}
          reachable={reachable}
          learned={learned}
          minutes={Math.max(8, (stages.length - 1) * 3)}
          onSelect={show}
        />
      </header>

      <RuntimeContext.Provider value={runtime}>
        <section
          key={`${stage.id}-${redo[stage.id] ?? 0}`}
          aria-labelledby={`${stage.id}-title`}
          className="mt-4 sm:mt-6"
          data-stage={stage.kind}
        >
          {stage.kind !== 'finish' && (
            <div className="mb-3 sm:mb-4">
              <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-blue-600">
                Phần {current + 1} · {EYEBROW[stage.kind]}
              </p>
              <h2
                id={`${stage.id}-title`}
                tabIndex={-1}
                className="mt-0.5 text-[20px] font-extrabold leading-snug tracking-tight text-[#091224] focus:outline-none sm:text-[23px]"
              >
                <InlineText text={stage.title} />
              </h2>
              {stage.goal && <p className="mt-0.5 text-[14px] text-slate-500">{stage.goal}</p>}
            </div>
          )}
          {stage.kind === 'finish' && (
            <h2 id={`${stage.id}-title`} tabIndex={-1} className="sr-only">
              {stage.title}
            </h2>
          )}
          {body}
        </section>
      </RuntimeContext.Provider>

      {nextStage && (
        <ContinueBar
          index={current}
          title={nextStage.title}
          ready={canContinue}
          onBack={current > 0 ? () => show(current - 1) : null}
          onContinue={advance}
        />
      )}
    </div>
  );
}

/** One segment per part; parts already open can be revisited. */
function StageBar({
  stages,
  current,
  reachable,
  learned,
  minutes,
  onSelect,
}: {
  stages: InteractivePlan['stages'];
  current: number;
  reachable: number;
  learned: boolean;
  minutes: number;
  onSelect: (index: number) => void;
}) {
  return (
    <nav
      aria-label="Các phần của bài"
      className="w-full shrink-0 lg:w-[400px]"
      data-testid="part-bar"
    >
      <div className="flex items-center justify-between text-[13px]">
        <span className="font-semibold text-[#091224]">
          Phần {current + 1}/{stages.length}
        </span>
        <span className="inline-flex items-center gap-1 text-slate-400">
          <Clock3 className="size-3.5" aria-hidden="true" /> ~{minutes} phút
        </span>
      </div>
      <ol className="mt-1.5 flex gap-1" aria-label="Tiến độ">
        {stages.map((stage, index) => {
          const available = index <= reachable;
          const done = learned || index < reachable;
          return (
            <li key={stage.id} className="min-w-0 flex-1">
              <button
                type="button"
                disabled={!available}
                onClick={() => onSelect(index)}
                title={stage.title}
                aria-label={`Phần ${index + 1}: ${stage.title}${available ? '' : ' (chưa mở)'}`}
                aria-current={index === current ? 'step' : undefined}
                className="group block w-full py-2 focus-visible:outline-none disabled:cursor-default"
                data-testid={`part-${stage.id}`}
              >
                <span
                  className={`relative block h-2 overflow-hidden rounded-full transition-colors group-focus-visible:ring-2 group-focus-visible:ring-blue-500 ${
                    index === current
                      ? 'bg-[#0052FF]'
                      : done
                        ? 'bg-emerald-500 group-hover:bg-emerald-600'
                        : available
                          ? 'bg-blue-200 group-hover:bg-blue-300'
                          : 'bg-slate-200'
                  }`}
                />
                <span
                  className={`mt-1 hidden truncate text-left text-[11px] font-semibold sm:block ${
                    index === current
                      ? 'text-blue-700'
                      : available
                        ? 'text-slate-500'
                        : 'text-slate-300'
                  }`}
                >
                  {EYEBROW[stage.kind]}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * The way on: at the end of the part on wide screens, docked at the bottom
 * on phones so it is always one thumb away. Locked until the part's activity
 * is done, and it says so.
 */
function ContinueBar({
  index,
  title,
  ready,
  onBack,
  onContinue,
}: {
  index: number;
  title: string;
  ready: boolean;
  onBack: (() => void) | null;
  onContinue: () => void;
}) {
  const button = (dock: boolean) => (
    <button
      type="button"
      disabled={!ready}
      onClick={onContinue}
      className={`group flex min-w-0 items-center gap-3 rounded-2xl text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed ${
        dock
          ? 'w-full bg-[#0052FF] py-2.5 pl-4 pr-2.5 text-white shadow-[0_10px_24px_rgba(0,82,255,0.3)] disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none'
          : 'border border-slate-200 bg-white py-3 pl-5 pr-3 hover:border-blue-300 hover:bg-[#F4F8FF] disabled:bg-slate-50 sm:min-w-[360px]'
      } ${ready && dock ? 'tt-pop' : ''}`}
      data-testid={dock ? 'dock-continue' : 'stage-continue'}
    >
      <span className="min-w-0 flex-1">
        <span
          className={`block text-[12px] font-bold uppercase tracking-[0.1em] ${
            dock
              ? 'text-blue-100 group-disabled:text-slate-400'
              : 'text-blue-600 group-disabled:text-slate-400'
          }`}
        >
          {ready
            ? `Tiếp tục · Phần ${index + 2}`
            : dock
              ? 'Làm xong để mở'
              : 'Hoàn thành hoạt động để mở'}
        </span>
        <span
          className={`mt-0.5 block truncate text-[16px] font-bold ${
            dock ? '' : 'text-[#091224] group-disabled:text-slate-400'
          }`}
        >
          <InlineText text={title} />
        </span>
      </span>
      <span
        aria-hidden="true"
        className={`grid size-10 shrink-0 place-items-center rounded-full ${
          dock
            ? 'bg-white/20 group-disabled:bg-slate-200'
            : 'bg-[#0052FF] text-white group-disabled:bg-slate-200 group-disabled:text-slate-400'
        }`}
      >
        {ready ? <ArrowRight className="size-5" /> : <Lock className="size-4" />}
      </span>
    </button>
  );
  return (
    <>
      <nav
        aria-label="Chuyển phần"
        className="mt-10 hidden items-start justify-between gap-3 border-t border-slate-200 pt-6 md:flex"
        data-testid="part-end"
      >
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-[15px] font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            data-testid="part-back"
          >
            <ArrowLeft className="size-4" aria-hidden="true" /> Phần trước
          </button>
        ) : (
          <span />
        )}
        {button(false)}
      </nav>
      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5 backdrop-blur md:hidden"
        data-testid="dock"
      >
        <div className="mx-auto flex max-w-[560px] items-center gap-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="Phần trước"
              className="grid size-12 shrink-0 place-items-center rounded-2xl border border-slate-200 text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <ArrowLeft className="size-5" aria-hidden="true" />
            </button>
          )}
          {button(true)}
        </div>
      </div>
      {ready && (
        <span className="sr-only" role="status">
          Đã mở phần tiếp theo.
        </span>
      )}
    </>
  );
}
