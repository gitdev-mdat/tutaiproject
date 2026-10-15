'use client';

import Link from 'next/link';
import { ArrowRight, BookOpen, Check, ChevronDown } from 'lucide-react';
import { useStudentShell } from '@/components/student/student-shell';
import { useLessonProgress } from '@/features/lessons/lib/lesson-progress';
import {
  lessonHref,
  lessonStanding,
  nextFreshLesson,
  pickNextStep,
  planProgress,
  standingLabel,
  withFrom,
  type NextStep,
  type StudyScope,
  type Summaries,
} from '@/features/lessons/lib/study-plan';
import type { LessonProgressState } from '@/features/lessons/lib/lesson-progress';

/**
 * The Roadmap answers three questions, in this order: what to do next and
 * why, how far along the program the student is, and where each lesson
 * stands. Browsing and reading lessons belong to the lesson list and the
 * lesson page; this page only decides and explains.
 */
export function StudentRoadmap({
  scope,
  summaries,
  targetScore,
  otherSubjects,
}: {
  scope: StudyScope | null;
  summaries: Summaries | null;
  targetScore: number | null;
  otherSubjects: string[];
}) {
  const { model } = useStudentShell();
  const progress = useLessonProgress(model.identity.id);

  return (
    <div className="mx-auto w-full max-w-[880px] pb-12" data-testid="roadmap">
      <header className="pt-1">
        <p className="text-[13px] font-semibold text-blue-600">
          Lộ trình · {scope?.title ?? 'Toán 12'}
        </p>
        <h1 className="mt-1 text-[28px] font-extrabold leading-tight tracking-tight text-[#091224] sm:text-[34px]">
          Lộ trình học của em
        </h1>
        <p className="mt-1.5 text-[15px] text-slate-500">
          Các bài theo thứ tự của chương trình
          {targetScore ? ` · mục tiêu ${targetScore} điểm` : ''}
        </p>
      </header>

      {!scope ? (
        <EmptyProgram />
      ) : !progress ? (
        <div aria-hidden="true" className="mt-6 space-y-4">
          <div className="h-[196px] rounded-[20px] bg-[#F4F8FF]" />
          <div className="h-40 rounded-2xl bg-white" />
        </div>
      ) : (
        <RoadmapBody
          scope={scope}
          progress={progress}
          summaries={summaries ?? {}}
          resultsMissing={summaries === null}
          otherSubjects={otherSubjects}
        />
      )}
    </div>
  );
}

function RoadmapBody({
  scope,
  progress,
  summaries,
  resultsMissing,
  otherSubjects,
}: {
  scope: StudyScope;
  progress: LessonProgressState;
  summaries: Summaries;
  resultsMissing: boolean;
  otherSubjects: string[];
}) {
  const step = pickNextStep(scope.lessons, progress, summaries);
  const { completed, total } = planProgress(scope.lessons, progress, summaries);
  const percent = total ? Math.round((completed / total) * 100) : 0;
  const currentChapter = step?.lesson.chapterId ?? null;

  return (
    <>
      <NextStepPanel step={step} scope={scope} progress={progress} summaries={summaries} />
      {resultsMissing && (
        <p className="mt-3 text-[13px] text-amber-800" role="status">
          Chưa tải được kết quả luyện tập. Bước tiếp theo đang dựa trên phần em đã đọc.
        </p>
      )}

      <section aria-labelledby="roadmap-progress" className="mt-8" data-testid="roadmap-progress">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="roadmap-progress" className="text-[15px] font-bold text-[#091224]">
            Tiến độ lộ trình
          </h2>
          <p className="text-[14px] text-slate-600">
            <strong className="font-bold text-[#091224]" data-testid="roadmap-completed">
              {completed}/{total}
            </strong>{' '}
            bài hoàn thành
          </p>
        </div>
        <div
          className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"
          role="progressbar"
          aria-label="Số bài đã hoàn thành trong lộ trình"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={completed}
        >
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${percent}%` }} />
        </div>
        <p className="mt-2 text-[13px] leading-5 text-slate-500">
          Một bài được tính là hoàn thành khi em luyện tập đạt từ 80%. Bài chưa có câu luyện tập thì
          tính khi em học hết bài. Chỉ mở bài ra xem thì chưa tính.
        </p>
      </section>

      <section aria-labelledby="roadmap-lessons" className="mt-8">
        <h2 id="roadmap-lessons" className="text-[15px] font-bold text-[#091224]">
          Các bài trong lộ trình
        </h2>
        <div className="mt-3 space-y-3">
          {scope.chapters.map((chapter, index) => (
            <ChapterPath
              key={chapter.id}
              index={index}
              chapter={chapter}
              collapsible={scope.chapters.length > 2}
              open={scope.chapters.length <= 2 || chapter.id === currentChapter}
              nextLessonId={step?.lesson.id ?? null}
              progress={progress}
              summaries={summaries}
            />
          ))}
        </div>
        <p className="mt-4 text-[13px] leading-5 text-slate-500">
          Không bài nào bị khóa: em mở được mọi bài, và bài học trước thứ tự vẫn được tính.
          {otherSubjects.length > 0 &&
            ` Bài của ${otherSubjects.join(', ')} nằm trong mục Bài học.`}
        </p>
      </section>
    </>
  );
}

// ─── The one next step ───────────────────────────────────────────────────────

function NextStepPanel({
  step,
  scope,
  progress,
  summaries,
}: {
  step: NextStep | null;
  scope: StudyScope;
  progress: LessonProgressState;
  summaries: Summaries;
}) {
  if (!step) {
    return (
      <section
        aria-label="Bước tiếp theo"
        className="mt-6 rounded-[20px] border border-emerald-100 bg-emerald-50/60 p-5 sm:p-6"
        data-testid="roadmap-next"
        data-kind="done"
      >
        <p className="text-[13px] font-semibold text-emerald-700">Hoàn thành</p>
        <h2 className="mt-1 text-[20px] font-extrabold leading-snug text-[#091224]">
          Em đã hoàn thành mọi bài đang mở
        </h2>
        <p className="mt-1 text-[15px] leading-6 text-slate-600">
          Bài mới sẽ hiện ở đây khi thầy cô mở thêm. Trong lúc chờ, em luyện đề để giữ nhịp.
        </p>
        <Link href="/student/practice" className={`${primaryClass} mt-5`}>
          Đi tới Luyện đề <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </section>
    );
  }

  const position = scope.lessons.findIndex((lesson) => lesson.id === step.lesson.id) + 1;
  let alternative: { href: string; label: string } | null = null;
  if (step.kind === 'practice') {
    const later = nextFreshLesson(scope.lessons, progress, summaries, step.lesson.id);
    if (later)
      alternative = {
        href: withFrom(lessonHref(later.id), 'roadmap'),
        label: `Để sau, học bài tiếp: ${later.title}`,
      };
  } else if (step.kind === 'retry') {
    alternative = {
      href: withFrom(lessonHref(step.lesson.id), 'roadmap'),
      label: 'Ôn lại bài trước khi luyện',
    };
  }

  return (
    <section
      aria-labelledby="roadmap-next-title"
      className="mt-6 rounded-[20px] border border-blue-100 bg-[#F4F8FF] p-5 sm:p-6"
      data-testid="roadmap-next"
      data-kind={step.kind}
      data-lesson={step.lesson.id}
    >
      <p className="text-[13px] font-semibold text-blue-600">Bước tiếp theo</p>
      <h2
        id="roadmap-next-title"
        className="mt-1 text-[20px] font-extrabold leading-snug text-[#091224] sm:text-[22px]"
      >
        {step.lesson.title}
      </h2>
      <p className="mt-0.5 text-[13px] text-slate-500">
        Bài {position}/{scope.lessons.length} · {step.lesson.chapterTitle}
      </p>
      <p
        className="mt-3 max-w-[640px] text-[15px] leading-6 text-slate-700"
        data-testid="roadmap-reason"
      >
        {step.reason}
      </p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
        <Link
          href={withFrom(step.href, 'roadmap')}
          className={primaryClass}
          data-testid="roadmap-next-cta"
        >
          {step.cta} <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
        {alternative && (
          <Link href={alternative.href} className={linkClass} data-testid="roadmap-next-alt">
            {alternative.label}
          </Link>
        )}
      </div>
    </section>
  );
}

// ─── The path ────────────────────────────────────────────────────────────────

function ChapterPath({
  index,
  chapter,
  collapsible,
  open,
  nextLessonId,
  progress,
  summaries,
}: {
  index: number;
  chapter: StudyScope['chapters'][number];
  collapsible: boolean;
  open: boolean;
  nextLessonId: string | null;
  progress: LessonProgressState;
  summaries: Summaries;
}) {
  const done = chapter.lessons.filter(
    (lesson) => lessonStanding(lesson.id, progress, summaries).completed
  ).length;
  const heading = (
    <span className="flex min-w-0 flex-1 items-baseline justify-between gap-3">
      <span className="min-w-0 text-[15px] font-bold leading-snug text-[#091224]">
        <span className="text-slate-400">Chương {index + 1} · </span>
        {chapter.title}
      </span>
      <span className="shrink-0 text-[13px] text-slate-500">
        {done}/{chapter.lessons.length} hoàn thành
      </span>
    </span>
  );
  const list = (
    <ol className="relative px-2 pb-2 sm:px-3">
      {chapter.lessons.map((lesson, position) => (
        <PathRow
          key={lesson.id}
          lessonId={lesson.id}
          title={lesson.title}
          isNext={lesson.id === nextLessonId}
          isLast={position === chapter.lessons.length - 1}
          progress={progress}
          summaries={summaries}
        />
      ))}
    </ol>
  );

  if (!collapsible)
    return (
      <div className="rounded-2xl border border-[#E5EBF3] bg-white" data-testid="roadmap-chapter">
        <div className="flex px-5 pb-1 pt-4 sm:px-6">{heading}</div>
        {list}
      </div>
    );
  return (
    <details
      open={open}
      className="group rounded-2xl border border-[#E5EBF3] bg-white"
      data-testid="roadmap-chapter"
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-2xl px-5 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:px-6 [&::-webkit-details-marker]:hidden">
        {heading}
        <ChevronDown
          className="size-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="-mt-3">{list}</div>
    </details>
  );
}

function PathRow({
  lessonId,
  title,
  isNext,
  isLast,
  progress,
  summaries,
}: {
  lessonId: string;
  title: string;
  isNext: boolean;
  isLast: boolean;
  progress: LessonProgressState;
  summaries: Summaries;
}) {
  const standing = lessonStanding(lessonId, progress, summaries);
  const label = standingLabel(standing);
  return (
    <li className="relative">
      {!isLast && (
        <span
          aria-hidden="true"
          className="absolute bottom-0 left-[23px] top-9 w-px bg-slate-200 sm:left-[23px]"
        />
      )}
      <Link
        href={withFrom(lessonHref(lessonId), 'roadmap')}
        className={`group relative flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
          isNext ? 'bg-[#F4F8FF]' : 'hover:bg-slate-50'
        }`}
        data-testid="roadmap-lesson"
        data-lesson={lessonId}
        data-completed={standing.completed}
        aria-current={isNext ? 'step' : undefined}
      >
        <StatusDot tone={label.tone} isNext={isNext} />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold leading-snug text-slate-800 group-hover:text-[#091224]">
            {title}
          </span>
          <span
            className={`mt-0.5 block text-[13px] ${
              label.tone === 'done'
                ? 'text-emerald-700'
                : label.tone === 'attention'
                  ? 'text-amber-800'
                  : 'text-slate-500'
            }`}
            data-testid="roadmap-lesson-status"
          >
            {label.text}
            {isNext && <span className="sr-only"> (bước tiếp theo)</span>}
          </span>
        </span>
        <ArrowRight
          aria-hidden="true"
          className="mt-1 size-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-500"
        />
      </Link>
    </li>
  );
}

function StatusDot({ tone, isNext }: { tone: string; isNext: boolean }) {
  if (tone === 'done')
    return (
      <span
        aria-hidden="true"
        className="relative mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-emerald-500 text-white"
      >
        <Check className="size-3.5" strokeWidth={3} />
      </span>
    );
  return (
    <span
      aria-hidden="true"
      className={`relative mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-white ${
        isNext
          ? 'ring-2 ring-[#0052FF]'
          : tone === 'attention'
            ? 'ring-2 ring-amber-400'
            : tone === 'active'
              ? 'ring-2 ring-blue-300'
              : 'ring-2 ring-slate-200'
      }`}
    >
      {isNext && <span className="size-2.5 rounded-full bg-[#0052FF]" />}
    </span>
  );
}

function EmptyProgram() {
  return (
    <section
      className="mt-6 rounded-[20px] border border-[#E5EBF3] bg-white p-6 text-center sm:p-10"
      data-testid="roadmap-empty"
    >
      <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-blue-50 text-blue-600">
        <BookOpen className="size-6" aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-[20px] font-extrabold text-[#091224]">
        Chương trình chưa có bài nào được mở
      </h2>
      <p className="mx-auto mt-1 max-w-[420px] text-[15px] leading-6 text-slate-500">
        Thầy cô đang chuẩn bị nội dung. Khi có bài mới, lộ trình của em sẽ hiện ở đây.
      </p>
      <Link href="/student/practice" className={`${primaryClass} mt-5`}>
        Đi tới Luyện đề <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </section>
  );
}

const primaryClass =
  'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0052FF] px-6 text-center text-[15px] font-bold text-white shadow-[0_8px_20px_rgba(0,82,255,0.2)] transition hover:bg-[#0044CC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 sm:w-auto';
const linkClass =
  'inline-flex min-h-10 items-center rounded-lg text-[14px] font-semibold text-slate-600 underline-offset-4 hover:text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500';
