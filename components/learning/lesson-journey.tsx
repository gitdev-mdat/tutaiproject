'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  BookmarkCheck,
  ClipboardCheck,
  Clock3,
  Eye,
  PlayCircle,
  RotateCcw,
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
  lessonLearningState,
  recordLessonStage,
  recordLessonViewed,
  useLessonProgress,
} from '@/features/lessons/lib/lesson-progress';
import { FunctionGraph, VariationTable } from './function-graph';
import { QuickCheck } from './quick-check';
import { InlineText, RichText } from './rich-text';

/**
 * The lesson as a journey: one stage at a time, each ending with the next
 * step. Used by the student lesson page and, with `mode="preview"`, by the
 * admin editor, so an editor previews exactly what a student will work through.
 */

const EYEBROW: Record<JourneyStage['kind'], string> = {
  hook: 'Mở đầu',
  concept: 'Ý chính',
  example: 'Ví dụ mẫu',
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
}

export function LessonJourney(props: LessonJourneyProps) {
  const { mode, studentKey, lessonId, journey, checks } = props;
  const stages = journey.stages;
  const last = stages.length - 1;
  const preview = mode === 'preview';
  const progress = useLessonProgress(studentKey ?? '');
  const stored = studentKey ? progress?.stages[lessonId] : undefined;
  const learning = studentKey && progress ? lessonLearningState(progress, lessonId) : null;

  // The furthest stage opened in this visit; earlier visits are restored after mount.
  const [opened, setOpened] = React.useState(preview ? last : 0);
  const [restored, setRestored] = React.useState(preview);
  const [predicted, setPredicted] = React.useState(false);
  const [exampleDone, setExampleDone] = React.useState(false);
  const [checksDone, setChecksDone] = React.useState(false);

  React.useEffect(() => {
    if (studentKey) recordLessonViewed(studentKey, lessonId);
  }, [studentKey, lessonId]);

  // Saved progress is read after mount; adopt it once, during render.
  if (!restored && progress) {
    setOpened(stored?.completedAt ? last : Math.min(stored?.reached ?? 0, last));
    setRestored(true);
  }

  const reviewing = preview || !!stored?.completedAt;
  // Stages before the furthest one are finished: show their answers and full solutions.
  const finished = (index: number) => reviewing || index < opened;

  const goTo = (index: number) => {
    const target = stages[index];
    if (!target) return;
    window.requestAnimationFrame(() => {
      const element = document.getElementById(target.id);
      element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      document.getElementById(`${target.id}-title`)?.focus({ preventScroll: true });
    });
  };

  const advance = (from: number) => {
    const next = Math.min(from + 1, last);
    setOpened((current) => Math.max(current, next));
    if (studentKey) recordLessonStage(studentKey, lessonId, next, stages.length);
    goTo(next);
  };

  const canContinue = (stage: JourneyStage, index: number) => {
    if (finished(index)) return true;
    if (stage.kind === 'hook' && stage.graph) return predicted;
    if (stage.kind === 'example') return exampleDone;
    if (stage.kind === 'check') return checksDone;
    return true;
  };

  return (
    <div
      className="@container mx-auto w-full max-w-[1040px] pb-16"
      data-testid="lesson-journey"
      data-opened={opened}
    >
      <header className="max-w-[720px]">
        {props.backHref && (
          <Link
            href={props.backHref}
            className="ml-12 inline-flex items-center gap-1.5 rounded-lg py-2 text-[14px] font-semibold text-slate-500 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 lg:ml-0"
          >
            <ArrowLeft className="size-4" aria-hidden="true" /> Bài học
          </Link>
        )}
        <h1 className="mt-3 text-[30px] font-extrabold leading-[1.15] tracking-tight text-[#091224] sm:text-[38px]">
          {props.title}
        </h1>
        <p className="mt-2 flex flex-wrap items-center gap-x-2 text-[14px] text-slate-500">
          <span>
            {props.subjectTitle} · {props.chapterTitle}
          </span>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1">
            <Clock3 className="size-3.5" aria-hidden="true" /> khoảng {journey.minutes} phút
          </span>
        </p>
        <StageRail stages={stages} opened={opened} onSelect={goTo} />
        {preview && (
          <p className="mt-4 rounded-xl bg-blue-50 px-4 py-3 text-[14px] leading-6 text-blue-900">
            Bản xem trước mở sẵn mọi chặng. Học sinh đi lần lượt từng chặng; câu hỏi nhanh và luyện
            tập lấy từ câu hỏi đã xuất bản của bài nên không hiện ở đây.
          </p>
        )}
        {mode === 'student' && restored && learning && (
          <ReturnBanner
            learning={learning}
            stages={stages}
            practice={props.practice}
            practiceHref={props.practiceHref}
            next={props.next}
            onResume={() => goTo(opened)}
            onReview={() => goTo(0)}
          />
        )}
      </header>

      <div className="mt-8 space-y-14">
        {stages.slice(0, opened + 1).map((stage, index) => {
          const isLatest = index === opened && index < last;
          const nextStage = stages[index + 1];
          return (
            <section
              key={stage.id}
              id={stage.id}
              aria-labelledby={`${stage.id}-title`}
              className="scroll-mt-20 lg:scroll-mt-6"
              data-stage={stage.kind}
            >
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
              <div className="mt-4">
                <StageBody
                  stage={stage}
                  journey={journey}
                  lessonId={lessonId}
                  checks={checks}
                  done={finished(index)}
                  onPredicted={() => setPredicted(true)}
                  onExampleDone={() => setExampleDone(true)}
                  onChecksDone={() => setChecksDone(true)}
                  practiceCard={props.practiceCard}
                  hasPractice={!!props.practice?.questionCount}
                  next={props.next}
                  backHref={props.backHref}
                />
              </div>
              {isLatest && nextStage && (
                <ContinueBar
                  ready={canContinue(stage, index)}
                  first={index === 0}
                  nextTitle={nextStage.title}
                  stage={stage}
                  onContinue={() => advance(index)}
                />
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

// ─── Header pieces ───────────────────────────────────────────────────────────

/** Where the student is in the lesson: one segment per stage, opened ones clickable. */
function StageRail({
  stages,
  opened,
  onSelect,
}: {
  stages: JourneyStage[];
  opened: number;
  onSelect: (index: number) => void;
}) {
  return (
    <nav aria-label="Tiến độ trong bài" className="mt-5">
      <ol className="flex gap-1.5">
        {stages.map((stage, index) => {
          const open = index <= opened;
          return (
            <li key={stage.id} className="min-w-0 flex-1">
              <button
                type="button"
                disabled={!open}
                onClick={() => onSelect(index)}
                aria-current={index === opened ? 'step' : undefined}
                aria-label={`${index + 1}. ${stage.title}${open ? '' : ' (chưa mở)'}`}
                className="group block w-full py-2 focus-visible:outline-none disabled:cursor-default"
              >
                <span
                  className={`block h-1.5 rounded-full transition-colors group-focus-visible:ring-2 group-focus-visible:ring-blue-500 ${
                    index < opened
                      ? 'bg-[#0052FF]'
                      : index === opened
                        ? 'bg-[#0052FF]/60'
                        : 'bg-slate-200'
                  }`}
                />
              </button>
            </li>
          );
        })}
      </ol>
      <p className="text-[13px] text-slate-500" aria-live="polite">
        Chặng {opened + 1}/{stages.length}
      </p>
    </nav>
  );
}

function ReturnBanner({
  learning,
  stages,
  practice,
  practiceHref,
  next,
  onResume,
  onReview,
}: {
  learning: ReturnType<typeof lessonLearningState>;
  stages: JourneyStage[];
  practice: LessonPracticeOverview | null;
  practiceHref: string;
  next: { id: string; title: string } | null;
  onResume: () => void;
  onReview: () => void;
}) {
  const inProgress = practice?.inProgress;
  const best = practice?.best;
  const questionCount = practice?.questionCount ?? 0;
  const primary =
    'inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#0052FF] px-5 text-[15px] font-bold text-white hover:bg-[#0044CC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2';
  const secondary =
    'inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-[15px] font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500';

  let message: React.ReactNode = null;
  let actions: React.ReactNode = null;

  if (inProgress) {
    message = `Em đang làm dở phần luyện tập: ${inProgress.answeredCount}/${inProgress.totalCount} câu.`;
    actions = (
      <>
        <Link
          href={`${practiceHref}?attempt=${inProgress.id}`}
          className={primary}
          data-testid="banner-primary"
        >
          <ClipboardCheck className="size-4" aria-hidden="true" /> Làm tiếp luyện tập
        </Link>
        {learning.kind !== 'learned' && (
          <button type="button" onClick={onResume} className={secondary}>
            Xem lại bài
          </button>
        )}
      </>
    );
  } else if (learning.kind === 'learned') {
    if (best?.passed) {
      message = `Em đã học xong bài này và đạt phần luyện tập (${best.correctCount}/${best.totalCount} câu đúng).`;
      actions = (
        <>
          {next ? (
            <Link
              href={`/student/lessons/${encodeURIComponent(next.id)}`}
              className={primary}
              data-testid="banner-primary"
            >
              Bài tiếp theo <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          ) : (
            <a href="#tong-ket" className={primary} data-testid="banner-primary">
              <BookmarkCheck className="size-4" aria-hidden="true" /> Ôn nhanh phần tóm tắt
            </a>
          )}
          <button type="button" onClick={onReview} className={secondary}>
            <RotateCcw className="size-4" aria-hidden="true" /> Ôn lại từ đầu
          </button>
        </>
      );
    } else if (best) {
      message = `Kết quả luyện tập tốt nhất: ${best.correctCount}/${best.totalCount} câu đúng. Cần 80% để hoàn thành bài.`;
      actions = (
        <>
          <Link href={practiceHref} className={primary} data-testid="banner-primary">
            <RotateCcw className="size-4" aria-hidden="true" /> Luyện tập lại
          </Link>
          {stages.some((stage) => stage.kind === 'example') && (
            <a href="#vi-du" className={secondary}>
              Xem lại ví dụ mẫu
            </a>
          )}
        </>
      );
    } else if (questionCount > 0) {
      message = 'Em đã học xong bài này. Giờ là lúc luyện tập để chắc rằng em làm được.';
      actions = (
        <>
          <Link href={practiceHref} className={primary} data-testid="banner-primary">
            <ClipboardCheck className="size-4" aria-hidden="true" /> Luyện tập {questionCount} câu
          </Link>
          <button type="button" onClick={onReview} className={secondary}>
            Ôn lại từ đầu
          </button>
        </>
      );
    } else {
      message = 'Em đã học xong bài này. Bài chưa có câu luyện tập.';
      actions = next ? (
        <Link
          href={`/student/lessons/${encodeURIComponent(next.id)}`}
          className={primary}
          data-testid="banner-primary"
        >
          Bài tiếp theo <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      ) : (
        <button type="button" onClick={onReview} className={secondary}>
          Ôn lại từ đầu
        </button>
      );
    }
  } else if (learning.kind === 'started' && learning.total > 0 && learning.stage > 1) {
    const stage = stages[Math.min(learning.stage, stages.length) - 1];
    message = (
      <>
        Em đang học dở ở chặng {learning.stage}/{stages.length}:{' '}
        <InlineText text={stage?.title ?? ''} />.
      </>
    );
    actions = (
      <button type="button" onClick={onResume} className={primary} data-testid="banner-primary">
        <PlayCircle className="size-4" aria-hidden="true" /> Học tiếp
      </button>
    );
  }

  if (!message) return null;
  return (
    <div
      className="mt-5 flex flex-col gap-3 rounded-2xl border border-blue-100 bg-[#F4F8FF] p-4 sm:flex-row sm:items-center sm:p-5"
      data-testid="return-banner"
    >
      <p className="min-w-0 flex-1 text-[15px] leading-6 text-[#091224]">{message}</p>
      <div className="flex flex-wrap gap-2">{actions}</div>
    </div>
  );
}

// ─── Stage bodies ────────────────────────────────────────────────────────────

function StageBody({
  stage,
  journey,
  lessonId,
  checks,
  done,
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
  onPredicted: () => void;
  onExampleDone: () => void;
  onChecksDone: () => void;
  practiceCard?: React.ReactNode;
  hasPractice: boolean;
  next: { id: string; title: string } | null;
  backHref: string | null;
}) {
  const prose = 'text-[16px] leading-8 text-slate-800 sm:text-[17px]';
  switch (stage.kind) {
    case 'hook':
      return (
        <div className="space-y-6">
          {stage.intro && (
            <RichText
              content={stage.intro}
              className={`${prose} max-w-[680px] sm:text-[19px] sm:leading-9`}
            />
          )}
          {stage.goals.length > 0 && (
            <div className="max-w-[680px] rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-[14px] font-bold text-[#091224]">Học xong bài này, em sẽ:</p>
              <ul className="mt-2 space-y-1.5 text-[15px] leading-7 text-slate-700">
                {stage.goals.map((goal, index) => (
                  <li key={index} className="flex gap-2.5">
                    <span
                      aria-hidden="true"
                      className="mt-3 size-1.5 shrink-0 rounded-full bg-blue-500"
                    />
                    <InlineText text={goal} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {stage.graph && journey.graphSource && (
            <FunctionGraph
              source={journey.graphSource}
              layer="predict"
              onPredicted={onPredicted}
              predicted={done}
              split
            />
          )}
        </div>
      );
    case 'concept':
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
            </div>
            <FunctionGraph source={journey.graphSource} layer={stage.graph} />
          </div>
        );
      }
      return <RichText content={stage.body} className={`${prose} max-w-[680px]`} />;
    case 'example':
      return (
        <div className="max-w-[720px] space-y-10">
          {stage.examples.map((example, index) => (
            <ExampleWalkthrough
              key={index}
              example={example}
              showTitle={stage.examples.length > 1}
              graphSource={
                exampleUsesGraph(example, journey.graphSource) ? journey.graphSource : null
              }
              done={done}
              onDone={index === stage.examples.length - 1 ? onExampleDone : undefined}
            />
          ))}
        </div>
      );
    case 'check':
      return (
        <div className="max-w-[720px]">
          <p className={`${prose} mb-5`}>
            Áp dụng ngay điều vừa học. Chọn đáp án rồi bấm Kiểm tra, em sẽ thấy lời giải và biết vì
            sao đúng hay sai.
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
              <ul className="mt-2 space-y-1.5 text-[16px] leading-7 text-slate-700">
                {stage.objectives.map((item, index) => (
                  <li key={index} className="flex gap-2.5">
                    <span
                      aria-hidden="true"
                      className="mt-3 size-1.5 shrink-0 rounded-full bg-slate-400"
                    />
                    <InlineText text={item} />
                  </li>
                ))}
              </ul>
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

/** A worked example revealed one reasoning step at a time, after the student has tried. */
function ExampleWalkthrough({
  example,
  showTitle,
  graphSource,
  done,
  onDone,
}: {
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
    </div>
  );
}

function ContinueBar({
  ready,
  first,
  nextTitle,
  stage,
  onContinue,
}: {
  ready: boolean;
  first: boolean;
  nextTitle: string;
  stage: JourneyStage;
  onContinue: () => void;
}) {
  const waiting =
    stage.kind === 'hook'
      ? 'Trả lời câu hỏi trên đồ thị để đi tiếp.'
      : stage.kind === 'example'
        ? 'Mở hết lời giải để đi tiếp.'
        : stage.kind === 'check'
          ? null
          : null;
  return (
    <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-6">
      <button
        type="button"
        disabled={!ready}
        onClick={onContinue}
        className="inline-flex h-12 items-center gap-2 rounded-xl bg-[#0052FF] px-6 text-[16px] font-bold text-white shadow-[0_8px_20px_rgba(0,82,255,0.22)] transition hover:bg-[#0044CC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
        data-testid="stage-continue"
      >
        {first && stage.kind === 'hook' && !stage.graph ? 'Bắt đầu học' : 'Tiếp tục'}
        <ArrowRight className="size-4" aria-hidden="true" />
      </button>
      {ready ? (
        <span className="text-[14px] text-slate-500">
          Tiếp theo: <InlineText text={nextTitle} />
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
    </div>
  );
}
