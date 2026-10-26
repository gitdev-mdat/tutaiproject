'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, Check, ChevronDown } from 'lucide-react';
import { useStudentShell } from '@/components/student/student-shell';
import { useLessonProgress } from '@/features/lessons/lib/lesson-progress';
import {
  lessonHref,
  lessonStanding,
  pickNextStep,
  planProgress,
  programHref,
  ROADMAP_HREF,
  standingLabel,
  type LessonStanding,
  type NextStep,
  type StudyScope,
  type Summaries,
} from '@/features/lessons/lib/study-plan';
import type { LessonProgressState } from '@/features/lessons/lib/lesson-progress';
import type { ProgramBasis } from '@/features/lessons/lib/program-match';

/** Why the Roadmap shows this program; see program-match. */
export interface RoadmapChoice {
  basis: ProgramBasis;
  /** The program the profile asks for, e.g. "Vật lý 12". */
  requested: string | null;
  /** The published program the profile leads to. */
  profileProgram: { id: string; title: string } | null;
}

/**
 * The Roadmap is the student's one place to learn: every published program
 * (a subject's lessons for one grade), how far they have come and the one
 * step to take next. Lessons open from it and lead back to it.
 *
 * It shows what a student acts on and little else: the program and its
 * progress, the next lesson with one button, and every lesson to open.
 * Rules and reasons are not spelled out on the page; each lesson's status
 * line and the button's label carry them.
 */
export function StudentRoadmap({
  programs,
  program: scope,
  choice,
  summaries,
  targetScore,
}: {
  programs: StudyScope[];
  program: StudyScope | null;
  choice?: RoadmapChoice;
  summaries: Summaries | null;
  targetScore: number | null;
}) {
  const { model } = useStudentShell();
  const progress = useLessonProgress(model.identity.id);

  if (!scope)
    return (
      <Page>
        <Hero title={choice?.requested ?? 'Lộ trình của em'} targetScore={targetScore} />
        <EmptyProgram />
      </Page>
    );

  const tabs =
    programs.length > 1 ? (
      <ProgramTabs
        programs={programs}
        current={scope.id}
        progress={progress}
        summaries={summaries ?? {}}
      />
    ) : null;

  if (!progress)
    return (
      <Page>
        <Hero title={scope.title} targetScore={targetScore} tabs={tabs} />
        {choice && <ProgramBasisNote choice={choice} title={scope.title} />}
        <div
          aria-hidden="true"
          className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]"
        >
          <div className="h-[260px] rounded-[24px] bg-white" />
          <div className="h-[260px] rounded-[24px] bg-white" />
        </div>
      </Page>
    );

  const safeSummaries = summaries ?? {};
  const step = pickNextStep(scope.lessons, progress, safeSummaries, {
    currentScore: model.learning?.currentScore,
  });
  const standings = new Map(
    scope.lessons.map((lesson) => [lesson.id, lessonStanding(lesson.id, progress, safeSummaries)])
  );
  const { completed, total } = planProgress(scope.lessons, progress, safeSummaries);

  return (
    <Page>
      <Hero
        title={scope.title}
        targetScore={targetScore}
        tabs={tabs}
        progress={{ completed, total }}
      />
      {choice && <ProgramBasisNote choice={choice} title={scope.title} />}
      {summaries === null && (
        <p className="mt-3 text-[13px] text-amber-800" role="status">
          Chưa tải được kết quả luyện tập. Bước tiếp theo đang dựa trên phần em đã đọc.
        </p>
      )}
      {/* Side by side the two columns end level: the quote takes up what the lesson list leaves. */}
      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:grid-rows-[auto_1fr]">
        <div className="lg:col-start-1 lg:row-start-1">
          <NextStepCard step={step} scope={scope} standings={standings} />
        </div>
        <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <LessonList scope={scope} standings={standings} nextLessonId={step?.lesson.id ?? null} />
        </div>
        <DailyQuote className="lg:col-start-1 lg:row-start-2" />
      </div>
    </Page>
  );
}

/**
 * Only when the program on screen is not simply the one the profile asks
 * for: one line saying so, with the way back or the way to change it.
 */
function ProgramBasisNote({ choice, title }: { choice: RoadmapChoice; title: string }) {
  const { basis, requested, profileProgram } = choice;
  if (basis === 'PROFILE') return null;
  const text =
    basis === 'OTHER_GRADE'
      ? `${requested} chưa có bài, em đang học ${title}.`
      : basis === 'NO_SUBJECT_PROGRAM'
        ? `${requested ? `Môn ${requested}` : 'Môn em chọn'} chưa có bài, em đang học ${title}.`
        : profileProgram
          ? `Em đang xem ${title}.`
          : null;
  if (!text) return null;
  const back = basis === 'CHOSEN' && profileProgram;
  return (
    <p
      className="mt-3 flex flex-wrap gap-x-3 gap-y-1 px-1 text-[13px] text-slate-500"
      data-testid="roadmap-basis"
      data-basis={basis}
    >
      <span>{text}</span>
      <Link
        href={back ? ROADMAP_HREF : '/student/profile#muc-tieu'}
        className="font-semibold text-blue-700 hover:underline"
        data-testid={back ? 'roadmap-basis-back' : 'roadmap-basis-edit'}
      >
        {back ? `Về ${profileProgram.title}` : 'Đổi môn, lớp'}
      </Link>
    </p>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[1080px] pb-12" data-testid="roadmap">
      {children}
    </div>
  );
}

/** Chapter titles come from textbooks in capitals; shown in sentence case, they read. */
function readable(title: string): string {
  if (title !== title.toLocaleUpperCase('vi') || !/\p{Ll}/u.test(title.toLocaleLowerCase('vi')))
    return title;
  const lower = title.toLocaleLowerCase('vi');
  return lower.charAt(0).toLocaleUpperCase('vi') + lower.slice(1);
}

// ─── Hero: the program and how far along it the student is ───────────────────

function Hero({
  title,
  targetScore,
  tabs,
  progress,
}: {
  title: string;
  targetScore: number | null;
  tabs?: React.ReactNode;
  progress?: { completed: number; total: number };
}) {
  return (
    <header className="rounded-[24px] bg-[#0A1F5C] px-5 py-5 text-white sm:px-7 sm:py-6">
      {tabs}
      <h1
        className={
          tabs
            ? 'sr-only'
            : 'mb-4 text-[26px] font-extrabold leading-tight tracking-tight text-white sm:text-[32px]'
        }
      >
        {title}
      </h1>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        {targetScore ? (
          <p className="text-[16px] text-blue-100">
            Mục tiêu{' '}
            <span className="text-[22px] font-extrabold text-[#5EE0A8]">{targetScore} điểm</span>
          </p>
        ) : (
          <span />
        )}
        {progress && (
          <p
            className="rounded-full bg-white/10 px-3.5 py-1 text-[13px] text-blue-100"
            data-testid="roadmap-progress"
          >
            <span className="text-[15px] font-bold text-white" data-testid="roadmap-completed">
              {progress.completed}/{progress.total}
            </span>{' '}
            bài đã xong
          </p>
        )}
      </div>
      {progress && (
        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-white/15"
          role="progressbar"
          aria-label="Tiến độ lộ trình"
          aria-valuenow={progress.completed}
          aria-valuemin={0}
          aria-valuemax={progress.total}
        >
          <div
            className="h-full rounded-full bg-[#34D399] motion-safe:transition-[width] motion-safe:duration-700"
            style={{
              width: `${progress.total ? (progress.completed / progress.total) * 100 : 0}%`,
            }}
          />
        </div>
      )}
    </header>
  );
}

// ─── The next step ───────────────────────────────────────────────────────────

function NextStepCard({
  step,
  scope,
  standings,
}: {
  step: NextStep | null;
  scope: StudyScope;
  standings: Map<string, LessonStanding>;
}) {
  if (!step)
    return (
      <section
        aria-label="Bước tiếp theo"
        className="rounded-[24px] border border-[#E5EBF3] bg-white p-6 sm:p-7"
        data-testid="roadmap-next"
        data-kind="done"
      >
        <h2 className="text-[22px] font-extrabold leading-snug text-[#091224]">
          Em đã xong các bài đang mở
        </h2>
        <p className="mt-1 text-[15px] text-slate-500">Trong lúc chờ bài mới, em luyện đề nhé.</p>
        <Link href="/student/practice" className={`${primaryClass} mt-6`}>
          Đi tới Luyện đề <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </section>
    );

  const position = scope.lessons.findIndex((lesson) => lesson.id === step.lesson.id) + 1;
  // When the step is this lesson's practice, the lesson itself stays one tap away.
  const alternative =
    step.kind === 'practice' || step.kind === 'resume-practice' || step.kind === 'retry'
      ? { href: lessonHref(step.lesson.id), label: 'Xem lại bài học' }
      : step.kind === 'check'
        ? { href: lessonHref(step.lesson.id), label: 'Học bài trước' }
        : null;
  const standing = standings.get(step.lesson.id)!;
  const status = standingLabel(standing);
  const open = standing.practice?.inProgress;

  return (
    <section
      aria-labelledby="roadmap-next-title"
      className="rounded-[24px] border border-[#E5EBF3] bg-white p-5 sm:p-7"
      data-testid="roadmap-next"
      data-kind={step.kind}
      data-lesson={step.lesson.id}
    >
      <p className="text-[14px] text-slate-500">
        Bài tiếp theo · {position}/{scope.lessons.length}
      </p>
      <h2
        id="roadmap-next-title"
        className="mt-2 text-[26px] font-extrabold leading-tight tracking-tight text-[#091224] sm:text-[32px]"
      >
        {step.lesson.title}
      </h2>
      <p className="mt-1 text-[15px] text-slate-500">{readable(step.lesson.chapterTitle)}</p>
      {status.tone !== 'idle' && (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <p
            className={`text-[15px] font-semibold ${statusTone(status.tone)}`}
            data-testid="roadmap-reason"
          >
            {status.text}
          </p>
          {open && open.totalCount <= 20 && (
            <span className="flex gap-1" aria-hidden="true">
              {Array.from({ length: open.totalCount }, (_, i) => (
                <span
                  key={i}
                  className={`h-2 w-4 rounded-full ${i < open.answeredCount ? 'bg-[#0052FF]' : 'bg-[#DCE5F3]'}`}
                />
              ))}
            </span>
          )}
        </div>
      )}
      {step.lesson.description && (
        <div className="mt-5 rounded-2xl bg-[#F5F8FC] px-4 py-3.5">
          <p className="text-[13px] font-semibold text-slate-700">Nội dung bài học</p>
          <p
            className="mt-1 line-clamp-3 text-[14px] leading-6 text-slate-600"
            data-testid="roadmap-next-description"
          >
            {step.lesson.description}
          </p>
        </div>
      )}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
        <Link href={step.href} className={primaryClass} data-testid="roadmap-next-cta">
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

function statusTone(tone: string) {
  return tone === 'done'
    ? 'text-emerald-700'
    : tone === 'attention'
      ? 'text-amber-700'
      : tone === 'active'
        ? 'text-blue-700'
        : 'text-slate-500';
}

// ─── Every lesson ────────────────────────────────────────────────────────────

const QUOTES = [
  { text: 'Không có việc gì khó, chỉ sợ lòng không bền.', by: 'Hồ Chí Minh' },
  { text: 'Có công mài sắt, có ngày nên kim.', by: 'Tục ngữ Việt Nam' },
  {
    text: 'Thiên tài là một phần trăm cảm hứng và chín mươi chín phần trăm mồ hôi.',
    by: 'Thomas Edison',
  },
  { text: 'Học, học nữa, học mãi.', by: 'V. I. Lenin' },
  { text: 'Đi một ngày đàng, học một sàng khôn.', by: 'Tục ngữ Việt Nam' },
  {
    text: 'Thành công không phải là điểm cuối, thất bại không phải là dấu chấm hết: điều quan trọng là can đảm để tiếp tục.',
    by: 'Winston Churchill',
  },
];

/** One quote a day, the same for everyone on that day in Vietnam. */
function quoteOfTheDay() {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  const n = Math.floor(Date.parse(day) / 86_400_000);
  return QUOTES[n % QUOTES.length];
}

function DailyQuote({ className = '' }: { className?: string }) {
  const quote = quoteOfTheDay();
  return (
    <figure
      className={`flex flex-col justify-center rounded-[24px] bg-[#EEF3FF] px-6 py-6 text-[#0A1F5C] sm:px-7 ${className}`}
      data-testid="roadmap-quote"
    >
      <blockquote
        className="text-[18px] font-semibold leading-relaxed sm:text-[20px]"
        suppressHydrationWarning
      >
        “{quote.text}”
      </blockquote>
      <figcaption className="mt-3 text-[14px] text-slate-500" suppressHydrationWarning>
        {quote.by}
      </figcaption>
    </figure>
  );
}

function LessonList({
  scope,
  standings,
  nextLessonId,
}: {
  scope: StudyScope;
  standings: Map<string, LessonStanding>;
  nextLessonId: string | null;
}) {
  const many = scope.chapters.length > 2;
  return (
    <section
      aria-labelledby="roadmap-map"
      className="h-full rounded-[24px] border border-[#E5EBF3] bg-white p-4 sm:p-6"
    >
      <h2 id="roadmap-map" className="px-1 text-[18px] font-extrabold text-[#091224]">
        Các bài học
      </h2>
      <ol className="mt-4 space-y-3">
        {scope.chapters.map((chapter, index) => {
          const done = chapter.lessons.filter((l) => standings.get(l.id)?.completed).length;
          const here = chapter.lessons.some((l) => l.id === nextLessonId);
          return (
            <Chapter
              key={chapter.id}
              index={index}
              title={readable(chapter.title)}
              done={done}
              count={chapter.lessons.length}
              open={!many || here || (!nextLessonId && index === scope.chapters.length - 1)}
            >
              {chapter.lessons.map((lesson, i) => (
                <LessonRow
                  key={lesson.id}
                  lessonId={lesson.id}
                  title={lesson.title}
                  standing={standings.get(lesson.id)!}
                  isNext={lesson.id === nextLessonId}
                  last={i === chapter.lessons.length - 1}
                />
              ))}
            </Chapter>
          );
        })}
      </ol>
    </section>
  );
}

function Chapter({
  index,
  title,
  done,
  count,
  open,
  children,
}: {
  index: number;
  title: string;
  done: number;
  count: number;
  open: boolean;
  children: React.ReactNode;
}) {
  return (
    <li data-testid="roadmap-chapter">
      <details open={open} className="group">
        <summary className="flex cursor-pointer list-none items-center gap-3 rounded-xl bg-[#F3F6FB] px-4 py-3 hover:bg-[#EDF2FA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 [&::-webkit-details-marker]:hidden">
          <span className="min-w-0 flex-1 text-[15px] font-bold leading-snug text-[#091224]">
            {index + 1}. {title}
          </span>
          <span
            className={`shrink-0 text-[13px] font-semibold ${done === count ? 'text-emerald-700' : 'text-slate-500'}`}
          >
            {done}/{count}
          </span>
          <ChevronDown
            className="size-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>
        <ol className="mt-1">{children}</ol>
      </details>
    </li>
  );
}

function LessonRow({
  lessonId,
  title,
  standing,
  isNext,
  last,
}: {
  lessonId: string;
  title: string;
  standing: LessonStanding;
  isNext: boolean;
  last: boolean;
}) {
  const label = standingLabel(standing);
  return (
    <li className="relative">
      {!last && (
        <span
          aria-hidden="true"
          className="absolute left-[24px] top-[38px] -bottom-[14px] w-0.5 bg-[#E3E9F2]"
        />
      )}
      <Link
        href={lessonHref(lessonId)}
        className={`relative flex items-center gap-3 rounded-xl px-4 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
          isNext ? 'bg-[#EEF3FF]' : 'hover:bg-slate-50'
        }`}
        data-testid="roadmap-lesson"
        data-lesson={lessonId}
        data-completed={standing.completed}
        aria-current={isNext ? 'step' : undefined}
      >
        <Mark tone={label.tone} isNext={isNext} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3">
          <span
            className={`min-w-0 flex-1 text-[15px] leading-snug ${
              isNext ? 'font-bold text-[#091224]' : 'text-slate-700'
            }`}
          >
            {title}
            {isNext && <span className="sr-only"> (bước tiếp theo)</span>}
          </span>
          <span
            className={`shrink-0 text-[13px] sm:text-right ${statusTone(label.tone)}`}
            data-testid="roadmap-lesson-status"
          >
            {label.text}
          </span>
        </span>
      </Link>
    </li>
  );
}

function Mark({ tone, isNext }: { tone: string; isNext: boolean }) {
  if (tone === 'done')
    return (
      <span
        aria-hidden="true"
        className="grid size-[18px] shrink-0 place-items-center rounded-full bg-emerald-500 text-white ring-4 ring-white"
      >
        <Check className="size-3" strokeWidth={3.5} />
      </span>
    );
  return (
    <span
      aria-hidden="true"
      className={`size-[18px] shrink-0 rounded-full bg-white ${
        isNext
          ? 'border-[5px] border-[#0052FF] ring-4 ring-[#EEF3FF]'
          : tone === 'attention'
            ? 'border-2 border-amber-400 ring-4 ring-white'
            : tone === 'active'
              ? 'border-2 border-blue-400 ring-4 ring-white'
              : 'border-2 border-slate-300 ring-4 ring-white'
      }`}
    />
  );
}

/**
 * The programs, as a switch at the top of the hero: one per subject and
 * grade with published lessons, each with how many of its lessons are done.
 * Only shown when there is more than one.
 */
function ProgramTabs({
  programs,
  current,
  progress,
  summaries,
}: {
  programs: StudyScope[];
  current: string;
  progress: LessonProgressState | null;
  summaries: Summaries;
}) {
  const list = React.useRef<HTMLUListElement>(null);
  // On a phone the switch scrolls sideways: keep the open program in view.
  React.useEffect(() => {
    const box = list.current;
    const active = box?.querySelector<HTMLElement>('[aria-current="page"]');
    if (box && active && active.offsetLeft + active.offsetWidth > box.clientWidth)
      box.scrollLeft = active.offsetLeft - 20;
  }, [current]);
  return (
    <nav aria-label="Chọn môn học" className="-mx-5 mb-5 sm:-mx-7">
      <ul
        ref={list}
        className="flex gap-2 overflow-x-auto px-5 pb-1 sm:px-7 [scrollbar-width:none]"
      >
        {programs.map((program) => {
          const active = program.id === current;
          const done = progress ? planProgress(program.lessons, progress, summaries) : null;
          return (
            <li key={program.id} className="shrink-0">
              <Link
                href={programHref(program)}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex h-11 items-center gap-2.5 rounded-xl px-4 text-[15px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 ${
                  active
                    ? 'bg-white text-[#0A1F5C]'
                    : 'bg-white/10 text-blue-100 hover:bg-white/20 hover:text-white'
                }`}
                data-testid="program-tab"
                data-program={program.id}
              >
                {program.title}
                {done && (
                  <span
                    className={`text-[13px] font-medium ${active ? 'text-slate-500' : 'text-blue-200/80'}`}
                  >
                    {done.completed}/{done.total}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function EmptyProgram() {
  return (
    <section
      className="mt-5 rounded-[24px] border border-[#E5EBF3] bg-white p-6 text-center sm:p-10"
      data-testid="roadmap-empty"
    >
      <h2 className="text-[20px] font-extrabold text-[#091224]">Chưa có bài nào được mở</h2>
      <p className="mt-1 text-[15px] text-slate-500">Trong lúc chờ, em luyện đề nhé.</p>
      <Link href="/student/practice" className={`${primaryClass} mt-6`}>
        Đi tới Luyện đề <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </section>
  );
}

const primaryClass =
  'inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#0052FF] px-7 text-center text-[16px] font-bold text-white transition hover:bg-[#0044CC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 sm:w-auto';
const linkClass =
  'inline-flex min-h-10 items-center rounded-lg text-[14px] font-semibold text-slate-600 underline-offset-4 hover:text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500';
