'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  Eye,
  ListChecks,
  Lock,
} from 'lucide-react';
import {
  exampleUsesGraph,
  type JourneyStage,
  type LessonJourney as Journey,
  type WorkedExample,
} from '@/lib/knowledge-tree/lesson-journey';
import type { PracticeQuestion } from '@/lib/practice/grading';
import type { LessonPracticeOverview } from '@/lib/practice/practice-service';
import {
  recordLessonStage,
  recordLessonViewed,
  restoreStageIndex,
  useLessonProgress,
} from '@/features/lessons/lib/lesson-progress';
import { FunctionGraph, VariationTable } from './function-graph';
import { AssistContext, LessonAssist, type AssistSettings } from './lesson-assist';
import { QuickCheck } from './quick-check';
import { InlineText, RichText } from './rich-text';

/**
 * The lesson as guided instruction: one part on screen at a time, opened in
 * order, with a compact outline to go back to any part already seen.
 *
 * The first screen is the lesson itself: title, its central idea in one line,
 * where the student is, then the content. A returning student lands directly
 * on the part they had reached. Used by the student lesson page and, with
 * `mode="preview"`, by the admin editor (every part shown, one under another).
 */

const EYEBROW: Record<JourneyStage['kind'], string> = {
  hook: 'Mở đầu',
  concept: 'Ý chính',
  example: 'Áp dụng',
  check: 'Tự làm',
  mistakes: 'Cẩn thận',
  finish: 'Tổng kết',
};

export interface LessonJourneyProps {
  mode: 'student' | 'preview';
  /** Key for this student's progress in the browser; null in the admin preview. */
  studentKey: string | null;
  lessonId: string;
  title: string;
  subjectTitle: string;
  chapterTitle: string;
  backHref: string | null;
  journey: Journey;
  checks: PracticeQuestion[];
  practice: LessonPracticeOverview | null;
  practiceHref: string;
  next: { id: string; title: string } | null;
  /** The end-of-lesson practice card, rendered on the server. */
  practiceCard?: React.ReactNode;
  /** Enables "Chưa hiểu chỗ này?"; absent in the admin preview. */
  assist?: AssistSettings;
}

export function LessonJourney(props: LessonJourneyProps) {
  const content =
    props.mode === 'preview' ? <PreviewJourney {...props} /> : <StudentJourney {...props} />;
  return props.assist ? (
    <AssistContext.Provider value={props.assist}>{content}</AssistContext.Provider>
  ) : (
    content
  );
}

// ─── Student ─────────────────────────────────────────────────────────────────

function StudentJourney(props: LessonJourneyProps) {
  const { studentKey, lessonId, journey } = props;
  const stages = journey.stages;
  const stageIds = React.useMemo(() => stages.map((stage) => stage.id), [stages]);
  const last = stages.length - 1;
  const progress = useLessonProgress(studentKey ?? '');
  const saved = studentKey ? progress?.stages[lessonId] : undefined;
  const learned = !!saved?.completedAt;

  // `opened`: the furthest part unlocked; `current`: the part on screen.
  const [opened, setOpened] = React.useState(0);
  const [current, setCurrent] = React.useState(0);
  const [restored, setRestored] = React.useState(false);
  const [resumedAt, setResumedAt] = React.useState<number | null>(null);
  const [predicted, setPredicted] = React.useState(false);
  const [exampleDone, setExampleDone] = React.useState(false);
  const [checksDone, setChecksDone] = React.useState(false);
  const top = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (studentKey) recordLessonViewed(studentKey, lessonId);
  }, [studentKey, lessonId]);

  // Saved progress is read after mount; adopt it once, during render.
  if (!restored && progress) {
    const index = restoreStageIndex(saved, stageIds, journey.legacyStageIds);
    setOpened(index);
    setCurrent(index);
    setResumedAt(index > 0 ? index : null);
    setRestored(true);
  }

  const finished = (index: number) => learned || index < opened;

  const show = (index: number, reachable = learned ? last : opened) => {
    if (index < 0 || index > reachable) return;
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
    }
    setResumedAt(null);
    show(next, Math.max(next, learned ? last : opened));
  };

  const canContinue = (stage: JourneyStage, index: number) => {
    if (finished(index)) return true;
    if (stage.kind === 'hook' && stage.graph) return predicted;
    if (stage.kind === 'example') return exampleDone;
    if (stage.kind === 'check') return checksDone;
    return true;
  };

  const stage = stages[current];
  const reachable = learned ? last : opened;

  return (
    <div
      className="@container mx-auto w-full max-w-[1040px] pb-16"
      data-testid="lesson-journey"
      data-opened={opened}
      data-current={current}
    >
      <div ref={top} className="scroll-mt-20 lg:scroll-mt-6" />
      <LessonHeader {...props} />
      <PartBar
        stages={stages}
        current={current}
        reachable={reachable}
        learned={learned}
        minutes={journey.minutes}
        onSelect={show}
        practice={props.practice}
        practiceHref={props.practiceHref}
      />
      {resumedAt !== null && current === resumedAt && (
        <p className="mt-3 text-[14px] text-slate-500" data-testid="resume-note">
          {learned ? 'Em đã học xong bài này.' : 'Em đang học tiếp từ chỗ đã dừng.'}{' '}
          <button
            type="button"
            onClick={() => {
              setResumedAt(null);
              show(0);
            }}
            className="font-semibold text-blue-700 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Xem lại từ đầu
          </button>
        </p>
      )}

      <section
        key={stage.id}
        id={stage.id}
        aria-labelledby={`${stage.id}-title`}
        className="mt-6 sm:mt-8"
        data-stage={stage.kind}
      >
        <StageHeading stage={stage} />
        <div className="mt-4">
          <StageBody
            stage={stage}
            journey={journey}
            lessonId={lessonId}
            checks={props.checks}
            done={finished(current)}
            predicted={predicted}
            exampleDone={exampleDone}
            onPredicted={() => setPredicted(true)}
            onExampleDone={() => setExampleDone(true)}
            onChecksDone={() => setChecksDone(true)}
            practiceCard={props.practiceCard}
            hasPractice={!!props.practice?.questionCount}
            next={props.next}
            backHref={props.backHref}
          />
        </div>
        <PartNav
          stage={stage}
          index={current}
          stages={stages}
          atFrontier={current === opened && !learned}
          ready={canContinue(stage, current)}
          onBack={() => show(current - 1)}
          onContinue={advance}
        />
      </section>
    </div>
  );
}

function LessonHeader(props: LessonJourneyProps) {
  const { journey } = props;
  return (
    <header className="max-w-[760px]">
      <p className="ml-12 flex min-h-10 min-w-0 items-center gap-1.5 text-[14px] text-slate-500 lg:ml-0">
        {props.backHref && (
          <>
            <Link
              href={props.backHref}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg py-1.5 font-semibold hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <ArrowLeft className="size-4" aria-hidden="true" /> Bài học
            </Link>
            <span aria-hidden="true">·</span>
          </>
        )}
        <span className="truncate">{props.chapterTitle || props.subjectTitle}</span>
      </p>
      <h1 className="mt-1 text-[26px] font-extrabold leading-[1.15] tracking-tight text-[#091224] sm:text-[32px]">
        {props.title}
      </h1>
      {journey.keyIdea && (
        <p
          className="mt-2 text-[15px] leading-7 text-slate-600 sm:text-[16px]"
          data-testid="key-idea"
        >
          <span className="font-semibold text-blue-700">Ý chính: </span>
          <InlineText text={journey.keyIdea} />
        </p>
      )}
    </header>
  );
}

/**
 * Where the student is, in one row: a thin progress line, "Phần 3/6" with the
 * part's name (opens the outline), and a resume link for unfinished practice.
 */
function PartBar({
  stages,
  current,
  reachable,
  learned,
  minutes,
  onSelect,
  practice,
  practiceHref,
}: {
  stages: JourneyStage[];
  current: number;
  reachable: number;
  learned: boolean;
  minutes: number;
  onSelect: (index: number) => void;
  practice: LessonPracticeOverview | null;
  practiceHref: string;
}) {
  const [open, setOpen] = React.useState(false);
  const listId = React.useId();
  const box = React.useRef<HTMLDivElement>(null);
  const inProgress = practice?.inProgress;

  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    const onClick = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  return (
    <nav aria-label="Các phần của bài" className="mt-4 max-w-[760px]" data-testid="part-bar">
      <div className="flex gap-1" aria-hidden="true">
        {stages.map((stage, index) => (
          <span
            key={stage.id}
            className={`h-1 flex-1 rounded-full ${
              index < current || (learned && index !== current)
                ? 'bg-[#0052FF]'
                : index === current
                  ? 'bg-[#0052FF]/55'
                  : index <= reachable
                    ? 'bg-blue-200'
                    : 'bg-slate-200'
            }`}
          />
        ))}
      </div>
      <div
        ref={box}
        className="relative mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1"
      >
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={listId}
          className="-ml-1.5 inline-flex min-h-10 min-w-0 max-w-full items-center gap-1.5 rounded-lg px-1.5 text-[14px] text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          data-testid="outline-toggle"
        >
          <span className="shrink-0 font-semibold text-[#091224]">
            Phần {current + 1}/{stages.length}
          </span>
          <span className="truncate">
            · <InlineText text={stages[current].title} />
          </span>
          <ChevronDown
            className={`size-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
        {inProgress && (
          <Link
            href={`${practiceHref}?attempt=${inProgress.id}`}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg text-[14px] font-semibold text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            data-testid="practice-resume"
          >
            <ClipboardCheck className="size-4" aria-hidden="true" />
            Làm tiếp luyện tập {inProgress.answeredCount}/{inProgress.totalCount}
          </Link>
        )}
        {open && (
          <div
            id={listId}
            className="absolute left-0 top-full z-30 mt-1 w-full max-w-[420px] rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_16px_40px_rgba(9,18,36,0.14)]"
            data-testid="outline"
          >
            <p className="flex items-center gap-1.5 px-3 pb-1 pt-2 text-[12px] font-semibold text-slate-500">
              <Clock3 className="size-3.5" aria-hidden="true" /> Cả bài khoảng {minutes} phút
            </p>
            <ol>
              {stages.map((stage, index) => {
                const available = index <= reachable;
                const done = learned || index < reachable;
                return (
                  <li key={stage.id}>
                    <button
                      type="button"
                      disabled={!available}
                      onClick={() => {
                        setOpen(false);
                        onSelect(index);
                      }}
                      aria-current={index === current ? 'step' : undefined}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                        index === current
                          ? 'bg-[#F4F8FF] font-semibold text-[#091224]'
                          : available
                            ? 'text-slate-700 hover:bg-slate-50'
                            : 'cursor-default text-slate-400'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`grid size-6 shrink-0 place-items-center rounded-full text-[12px] font-bold ${
                          done && index !== current
                            ? 'bg-[#0052FF] text-white'
                            : index === current
                              ? 'bg-white text-blue-700 ring-2 ring-[#0052FF]'
                              : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        {done && index !== current ? (
                          <Check className="size-3.5" />
                        ) : available ? (
                          index + 1
                        ) : (
                          <Lock className="size-3" />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">
                          {EYEBROW[stage.kind]}
                        </span>
                        <span className="block truncate">
                          <InlineText text={stage.title} />
                        </span>
                      </span>
                      {!available && <span className="sr-only">(chưa mở)</span>}
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </div>
    </nav>
  );
}

function StageHeading({ stage }: { stage: JourneyStage }) {
  return (
    <>
      <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-blue-600">
        {EYEBROW[stage.kind]}
      </p>
      <h2
        id={`${stage.id}-title`}
        tabIndex={-1}
        className="mt-1 text-[22px] font-extrabold leading-snug tracking-tight text-[#091224] focus:outline-none sm:text-[26px]"
      >
        <InlineText text={stage.title} />
      </h2>
    </>
  );
}

/** Back and forward between parts; forward waits for the part's activity the first time. */
function PartNav({
  stage,
  index,
  stages,
  atFrontier,
  ready,
  onBack,
  onContinue,
}: {
  stage: JourneyStage;
  index: number;
  stages: JourneyStage[];
  atFrontier: boolean;
  ready: boolean;
  onBack: () => void;
  onContinue: () => void;
}) {
  const nextStage = stages[index + 1];
  const waiting =
    stage.kind === 'hook'
      ? 'Trả lời câu hỏi trên đồ thị để đi tiếp.'
      : stage.kind === 'example'
        ? 'Mở hết lời giải để đi tiếp.'
        : null;
  const back =
    index > 0 ? (
      <button
        type="button"
        onClick={onBack}
        className="inline-flex h-11 items-center gap-1.5 rounded-xl px-3 text-[15px] font-semibold text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        data-testid="part-back"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> Phần trước
      </button>
    ) : null;
  if (!nextStage) {
    return back ? <div className="mt-8 border-t border-slate-200 pt-5">{back}</div> : null;
  }
  return (
    <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-6">
      <button
        type="button"
        disabled={!ready}
        onClick={onContinue}
        className="inline-flex h-12 items-center gap-2 rounded-xl bg-[#0052FF] px-6 text-[16px] font-bold text-white shadow-[0_8px_20px_rgba(0,82,255,0.22)] transition hover:bg-[#0044CC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
        data-testid="stage-continue"
      >
        {index === 0 && stage.kind === 'hook' && !stage.graph ? 'Bắt đầu học' : 'Tiếp tục'}
        <ArrowRight className="size-4" aria-hidden="true" />
      </button>
      {ready || !atFrontier ? (
        <span className="min-w-0 text-[14px] text-slate-500">
          Tiếp theo: <InlineText text={nextStage.title} />
        </span>
      ) : stage.kind === 'check' ? (
        <button
          type="button"
          onClick={onContinue}
          className="text-[14px] font-semibold text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
          data-testid="check-skip"
        >
          Để sau, đi tiếp
        </button>
      ) : (
        waiting && <span className="text-[14px] text-slate-500">{waiting}</span>
      )}
      {back && <span className="ml-auto">{back}</span>}
    </div>
  );
}

// ─── Admin preview ───────────────────────────────────────────────────────────

function PreviewJourney(props: LessonJourneyProps) {
  const { journey } = props;
  return (
    <div className="@container mx-auto w-full max-w-[1040px] pb-16" data-testid="lesson-journey">
      <LessonHeader {...props} />
      <p className="mt-4 max-w-[760px] rounded-xl bg-blue-50 px-4 py-3 text-[14px] leading-6 text-blue-900">
        Bản xem trước mở sẵn mọi phần. Học sinh đi lần lượt từng phần, mỗi lần một phần; câu hỏi
        nhanh và luyện tập lấy từ câu hỏi đã xuất bản của bài nên không hiện ở đây.
      </p>
      <div className="mt-8 space-y-14">
        {journey.stages.map((stage) => (
          <section
            key={stage.id}
            id={stage.id}
            aria-labelledby={`${stage.id}-title`}
            data-stage={stage.kind}
          >
            <StageHeading stage={stage} />
            <div className="mt-4">
              <StageBody
                stage={stage}
                journey={journey}
                lessonId={props.lessonId}
                checks={props.checks}
                done
                predicted
                exampleDone
                onPredicted={() => undefined}
                onExampleDone={() => undefined}
                onChecksDone={() => undefined}
                hasPractice={false}
                next={null}
                backHref={null}
              />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

// ─── Stage bodies ────────────────────────────────────────────────────────────

const prose = 'text-[16px] leading-8 text-slate-800 sm:text-[17px]';

function StageBody({
  stage,
  journey,
  lessonId,
  checks,
  done,
  predicted,
  exampleDone,
  onPredicted,
  onExampleDone,
  onChecksDone,
  practiceCard,
  hasPractice,
  next,
  backHref,
}: {
  stage: JourneyStage;
  journey: Journey;
  lessonId: string;
  checks: PracticeQuestion[];
  done: boolean;
  predicted: boolean;
  exampleDone: boolean;
  onPredicted: () => void;
  onExampleDone: () => void;
  onChecksDone: () => void;
  practiceCard?: React.ReactNode;
  hasPractice: boolean;
  next: { id: string; title: string } | null;
  backHref: string | null;
}) {
  const recap = journey.stages.find((s) => s.kind === 'finish');
  const recapFallback =
    recap?.kind === 'finish' && recap.recap.length ? <PlainList items={recap.recap} /> : undefined;
  switch (stage.kind) {
    case 'hook':
      return (
        <div className="space-y-6">
          {stage.intro && (
            <RichText
              content={stage.intro}
              className={`${prose} max-w-[680px] sm:text-[18px] sm:leading-9`}
            />
          )}
          {stage.goals.length > 0 && (
            <div className="max-w-[680px] rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-[14px] font-bold text-[#091224]">Học xong bài này, em sẽ:</p>
              <PlainList items={stage.goals} />
            </div>
          )}
          {stage.graph && journey.graphSource && (
            <FunctionGraph
              source={journey.graphSource}
              layer="predict"
              onPredicted={onPredicted}
              predicted={done || predicted}
              split
            />
          )}
        </div>
      );
    case 'concept': {
      const help = (
        <LessonAssist
          className="mt-3"
          target={{ kind: 'concept', stageId: stage.id }}
          topic={stage.title}
          fallback={recapFallback}
        />
      );
      if (stage.graph && journey.graphSource) {
        return (
          <div className="grid gap-6 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] @3xl:items-start">
            <div className="max-w-[640px]">
              <RichText content={stage.body} className={prose} />
              <p className="mt-5 flex gap-2 rounded-xl bg-slate-50 px-4 py-3 text-[15px] leading-6 text-slate-700">
                <ArrowDown
                  className="mt-1 size-4 shrink-0 text-blue-600 @3xl:hidden"
                  aria-hidden="true"
                />
                <ArrowRight
                  className="mt-1 hidden size-4 shrink-0 text-blue-600 @3xl:block"
                  aria-hidden="true"
                />
                {stage.graph === 'values'
                  ? 'Thử ngay trên đồ thị: kéo x₁ và x₂ vào cùng một khoảng rồi so sánh f(x₁) với f(x₂).'
                  : 'Thử ngay trên đồ thị: kéo điểm dọc theo đường cong, để ý tiếp tuyến và dấu của y′ bên dưới.'}
              </p>
              {help}
            </div>
            <FunctionGraph source={journey.graphSource} layer={stage.graph} />
          </div>
        );
      }
      return (
        <div className="max-w-[680px]">
          <RichText content={stage.body} className={prose} />
          {help}
        </div>
      );
    }
    case 'example': {
      const examples = stage.examples.map((example, index) => (
        <ExampleWalkthrough
          key={index}
          index={index}
          example={example}
          showTitle={stage.examples.length > 1}
          graphSource={exampleUsesGraph(example, journey.graphSource) ? journey.graphSource : null}
          done={done || exampleDone}
          onDone={index === stage.examples.length - 1 ? onExampleDone : undefined}
        />
      ));
      if (!stage.method) return <div className="max-w-[720px] space-y-10">{examples}</div>;
      return (
        <div className="grid gap-6 @3xl:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] @3xl:items-start">
          <MethodCard title={stage.method.title} steps={stage.method.steps} />
          <div className="min-w-0 space-y-10">{examples}</div>
        </div>
      );
    }
    case 'check':
      return (
        <div className="max-w-[720px]">
          {stage.mistakes.length > 0 && (
            <div
              className="mb-6 rounded-2xl border border-amber-200 bg-amber-50/60 p-4"
              data-testid="check-traps"
            >
              <p className="flex items-center gap-2 text-[14px] font-bold text-amber-900">
                <AlertTriangle className="size-4" aria-hidden="true" /> Trước khi làm, tránh các bẫy
                này
              </p>
              <ul className="mt-2 space-y-1.5 text-[15px] leading-7 text-slate-800">
                {stage.mistakes.map((item, index) => (
                  <li key={index} className="flex gap-2.5">
                    <span
                      aria-hidden="true"
                      className="mt-3 size-1.5 shrink-0 rounded-full bg-amber-500"
                    />
                    <span>
                      <InlineText text={item} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className={`${prose} mb-5`}>
            Chọn đáp án rồi bấm Kiểm tra. Em sẽ thấy lời giải ngay, và nếu sai thì hỏi được vì sao.
          </p>
          <QuickCheck
            lessonId={lessonId}
            questions={checks}
            onAnswered={(count) => count >= checks.length && onChecksDone()}
          />
        </div>
      );
    case 'mistakes':
      return (
        <ul className="max-w-[720px] space-y-3">
          {stage.items.map((item, index) => (
            <li
              key={index}
              className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50/50 p-4"
            >
              <AlertTriangle className="mt-1.5 size-5 shrink-0 text-amber-600" aria-hidden="true" />
              <span className={prose}>
                <InlineText text={item} />
              </span>
            </li>
          ))}
        </ul>
      );
    case 'finish':
      return (
        <div className="max-w-[720px] space-y-8">
          {stage.recap.length > 0 && (
            <div>
              <h3 className="text-[15px] font-bold text-slate-500">Điều cần nhớ</h3>
              <ol className="mt-3 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
                {stage.recap.map((item, index) => (
                  <li key={index} className="flex gap-3 px-4 py-3.5">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#091224] text-[12px] font-bold text-white">
                      {index + 1}
                    </span>
                    <span className="text-[16px] leading-7 text-slate-800">
                      <InlineText text={item} />
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {stage.objectives.length > 0 && (
            <div>
              <h3 className="text-[15px] font-bold text-slate-500">Bài này giúp em</h3>
              <PlainList items={stage.objectives} muted />
              {practiceCard && hasPractice && (
                <p className="mt-2 text-[15px] text-slate-500">
                  Phần luyện tập dưới đây cho em biết mình đã làm được những điều này chưa.
                </p>
              )}
            </div>
          )}
          {practiceCard}
          <div className="flex flex-col gap-3 sm:flex-row">
            {next && (
              <Link
                href={`/student/lessons/${encodeURIComponent(next.id)}`}
                className="group flex-1 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-blue-200 hover:bg-[#F4F8FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <span className="flex items-center gap-1.5 text-[13px] font-semibold text-blue-600">
                  Bài tiếp theo <ArrowRight className="size-3.5" aria-hidden="true" />
                </span>
                <span className="mt-1 block text-[16px] font-semibold text-[#091224]">
                  {next.title}
                </span>
              </Link>
            )}
            {backHref && (
              <Link
                href={backHref}
                className="inline-flex h-11 items-center gap-1.5 self-start rounded-xl px-3 text-[15px] font-semibold text-slate-600 hover:bg-slate-100 sm:self-center"
              >
                <ArrowLeft className="size-4" aria-hidden="true" /> Về danh sách bài học
              </Link>
            )}
          </div>
          {stage.references && (
            <div className="text-[14px] text-slate-500">
              <h3 className="text-[12px] font-bold uppercase tracking-wider text-slate-400">
                Tham khảo
              </h3>
              <RichText content={stage.references} className="mt-1" />
            </div>
          )}
        </div>
      );
  }
}

function PlainList({ items, muted = false }: { items: string[]; muted?: boolean }) {
  return (
    <ul
      className={`mt-2 space-y-1.5 text-[15px] leading-7 ${muted ? 'text-slate-700' : 'text-slate-800'}`}
    >
      {items.map((item, index) => (
        <li key={index} className="flex gap-2.5">
          <span
            aria-hidden="true"
            className={`mt-3 size-1.5 shrink-0 rounded-full ${muted ? 'bg-slate-400' : 'bg-blue-500'}`}
          />
          <span>
            <InlineText text={item} />
          </span>
        </li>
      ))}
    </ul>
  );
}

/** The procedure, kept in view beside the example that applies it. */
function MethodCard({ title, steps }: { title: string; steps: string[] }) {
  return (
    <aside
      className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 @3xl:sticky @3xl:top-6"
      aria-label={title}
      data-testid="method-card"
    >
      <p className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.1em] text-slate-500">
        <ListChecks className="size-4 text-blue-600" aria-hidden="true" /> Các bước
      </p>
      <ol className="mt-3 space-y-2.5">
        {steps.map((step, index) => (
          <li key={index} className="flex gap-3 text-[15px] leading-7 text-slate-800">
            <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-blue-50 text-[12px] font-bold text-blue-700">
              {index + 1}
            </span>
            <span className="min-w-0">
              <InlineText text={step} />
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-[13px] leading-5 text-slate-500">
        Ví dụ bên cạnh làm đúng theo các bước này.
      </p>
    </aside>
  );
}

/** A worked example revealed one reasoning step at a time, after the student has tried. */
function ExampleWalkthrough({
  index: exampleIndex,
  example,
  showTitle,
  graphSource,
  done,
  onDone,
}: {
  index: number;
  example: WorkedExample;
  showTitle: boolean;
  graphSource: string | null;
  done: boolean;
  onDone?: () => void;
}) {
  const total = example.steps.length;
  const [shown, setShown] = React.useState(done ? total : 0);
  const stepRefs = React.useRef<Array<HTMLLIElement | null>>([]);
  const all = done || shown >= total;
  React.useEffect(() => {
    if (all) onDone?.();
  }, [all, onDone]);

  const reveal = (count: number) => {
    setShown(count);
    window.requestAnimationFrame(() => stepRefs.current[Math.min(count, total) - 1]?.focus());
  };
  const visible = all ? total : shown;

  return (
    <div data-testid="worked-example" data-shown={visible} data-total={total}>
      {showTitle && <h3 className="mb-2 text-[17px] font-bold text-[#091224]">{example.title}</h3>}
      {example.problem && (
        <div className="rounded-2xl bg-[#091224] px-5 py-4 text-white sm:px-6 sm:py-5">
          <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-blue-200">Đề bài</p>
          <RichText
            content={example.problem}
            className="mt-1 text-[17px] leading-8 [&_strong]:text-white [&_*]:text-inherit"
          />
        </div>
      )}
      {total > 0 && (
        <ol className="mt-4 space-y-3">
          {example.steps.slice(0, visible).map((step, index) => (
            <li
              key={index}
              ref={(element) => {
                stepRefs.current[index] = element;
              }}
              tabIndex={-1}
              className="relative pl-11 focus:outline-none"
            >
              <span
                aria-hidden="true"
                className="absolute left-0 top-1 grid size-8 place-items-center rounded-full bg-blue-50 text-[13px] font-bold text-blue-700"
              >
                {index + 1}
              </span>
              {step.label && <p className="text-[13px] font-bold text-blue-700">{step.label}</p>}
              <RichText content={step.body} className="text-[16px] leading-8 text-slate-800" />
            </li>
          ))}
        </ol>
      )}
      {!all && total > 0 && (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-300 p-4">
          <p className="text-[15px] leading-6 text-slate-700">
            {visible === 0
              ? 'Em thử tự làm bài này trước: cần làm gì đầu tiên?'
              : visible === total - 1
                ? 'Từ các bước trên, em rút ra kết luận gì?'
                : 'Em đoán bước tiếp theo là gì?'}{' '}
            Nghĩ xong rồi mở để so sánh.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => reveal(visible + 1)}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#091224] px-4 text-[14px] font-bold text-white hover:bg-[#1c2740] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              data-testid="example-next-step"
            >
              <Eye className="size-4" aria-hidden="true" />
              {visible === total - 1 ? 'Xem kết luận' : `Xem bước ${visible + 1}`}
            </button>
            <button
              type="button"
              onClick={() => reveal(total)}
              className="inline-flex h-10 items-center rounded-xl px-3 text-[14px] font-semibold text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              Xem cả lời giải
            </button>
          </div>
          <p className="sr-only" aria-live="polite">
            Đang hiện {visible} trên {total} bước.
          </p>
        </div>
      )}
      {all && graphSource && (
        <div className="mt-5">
          <VariationTable source={graphSource} />
        </div>
      )}
      {(visible > 0 || total === 0) && (
        <LessonAssist
          className="mt-3"
          target={{ kind: 'example', exampleIndex, revealedSteps: visible }}
          topic={example.title}
          label="Chưa hiểu ví dụ này?"
          fallback={
            <ol className="space-y-2">
              {example.steps.slice(0, visible).map((step, index) => (
                <li key={index}>
                  <RichText content={step.body} className="text-[15px] leading-7 text-slate-700" />
                </li>
              ))}
            </ol>
          }
        />
      )}
    </div>
  );
}
