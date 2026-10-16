'use client';

import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  ClipboardCheck,
  Flag,
  Info,
  MapPin,
  Trophy,
} from 'lucide-react';
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
  type LessonStanding,
  type NextStep,
  type StudyScope,
  type Summaries,
} from '@/features/lessons/lib/study-plan';
import type { LessonProgressState } from '@/features/lessons/lib/lesson-progress';

/**
 * The Roadmap is the student's journey through one program, not a catalog:
 * where they are on it, how far they have come, and the one step to take
 * next. Every mark on it comes from the published curriculum, the student's
 * practice results and their reading progress; nothing is a template.
 *
 * - The hero places the student on the whole program (chapters as stages).
 * - The next-step card says what to do, why, and what finishing that lesson takes.
 * - The map shows the road: chapters as milestones, lessons as stops, a pin
 *   where the student is. It does not repeat the next step's details.
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
  const firstName = model.identity.name.trim().split(/\s+/).pop() ?? '';

  if (!scope)
    return (
      <Page>
        <Hero title="Toán 12" greeting={firstName} targetScore={targetScore} />
        <EmptyProgram />
      </Page>
    );

  if (!progress)
    return (
      <Page>
        <Hero title={scope.title} greeting={firstName} targetScore={targetScore} />
        <div
          aria-hidden="true"
          className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]"
        >
          <div className="h-[320px] rounded-[24px] bg-white" />
          <div className="h-[320px] rounded-[24px] bg-white" />
        </div>
      </Page>
    );

  const safeSummaries = summaries ?? {};
  const step = pickNextStep(scope.lessons, progress, safeSummaries);
  const standings = new Map(
    scope.lessons.map((lesson) => [lesson.id, lessonStanding(lesson.id, progress, safeSummaries)])
  );
  const { completed, total } = planProgress(scope.lessons, progress, safeSummaries);

  return (
    <Page>
      <Hero
        title={scope.title}
        greeting={firstName}
        targetScore={targetScore}
        journey={{ scope, standings, completed, total, currentLessonId: step?.lesson.id ?? null }}
      />
      {summaries === null && (
        <p className="mt-3 text-[13px] text-amber-800" role="status">
          Chưa tải được kết quả luyện tập. Bước tiếp theo đang dựa trên phần em đã đọc.
        </p>
      )}
      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-6">
          <NextStepCard
            step={step}
            scope={scope}
            progress={progress}
            summaries={safeSummaries}
            standings={standings}
          />
        </div>
        <JourneyMap
          scope={scope}
          standings={standings}
          nextLessonId={step?.lesson.id ?? null}
          initials={model.identity.initials}
          targetScore={targetScore}
          otherSubjects={otherSubjects}
        />
      </div>
    </Page>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[1080px] pb-12" data-testid="roadmap">
      {children}
    </div>
  );
}

// ─── Hero: the whole program at a glance ─────────────────────────────────────

interface Journey {
  scope: StudyScope;
  standings: Map<string, LessonStanding>;
  completed: number;
  total: number;
  currentLessonId: string | null;
}

function Hero({
  title,
  greeting,
  targetScore,
  journey,
}: {
  title: string;
  greeting: string;
  targetScore: number | null;
  journey?: Journey;
}) {
  const remaining = journey ? journey.total - journey.completed : 0;
  return (
    <header className="relative isolate overflow-hidden rounded-[24px] bg-[#0A1F5C] px-5 pb-5 pt-6 text-white sm:px-8 sm:pb-7 sm:pt-8">
      <HeroArt />
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 max-w-[560px]">
          <p className="text-[13px] font-semibold tracking-wide text-blue-200">Lộ trình của em</p>
          <h1 className="mt-1.5 text-[30px] text-white font-extrabold leading-[1.1] tracking-tight sm:text-[40px]">
            Hành trình <span className="text-[#7FB2FF]">{title}</span>
          </h1>
          <p className="mt-2.5 text-[15px] leading-6 text-blue-100/90">
            {greeting ? `${greeting} ơi, ` : ''}
            {targetScore
              ? `mục tiêu của em là ${targetScore} điểm. Đi từng bài, chắc từng bước.`
              : 'đi từng bài, chắc từng bước. Mỗi bài em hoàn thành là một chặng đã qua.'}
          </p>
        </div>
        {journey && (
          <div
            className="flex shrink-0 items-center gap-4 md:flex-col md:items-end md:gap-2"
            data-testid="roadmap-progress"
          >
            <ProgressRing completed={journey.completed} total={journey.total} />
            <p className="text-[13px] leading-5 text-blue-100/90 md:text-right">
              {remaining === 0
                ? 'Em đã đi hết các bài đang mở'
                : `Còn ${remaining} bài nữa trên hành trình`}
              <CompletionRule />
            </p>
          </div>
        )}
      </div>
      {journey && <StageTrack journey={journey} />}
    </header>
  );
}

function ProgressRing({ completed, total }: { completed: number; total: number }) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const ratio = total ? completed / total : 0;
  return (
    <div
      className="relative grid size-[92px] place-items-center"
      role="img"
      aria-label={`Đã hoàn thành ${completed} trên ${total} bài`}
    >
      <svg viewBox="0 0 80 80" className="absolute inset-0 size-full -rotate-90" aria-hidden="true">
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,.14)"
          strokeWidth="7"
        />
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke="#34D399"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          className="motion-safe:transition-[stroke-dashoffset] motion-safe:duration-700"
        />
      </svg>
      <span className="text-center leading-none">
        <span className="block text-[22px] font-extrabold" data-testid="roadmap-completed">
          {completed}/{total}
        </span>
        <span className="mt-1 block text-[11px] font-semibold text-blue-100/80">bài xong</span>
      </span>
    </div>
  );
}

/** What "completed" means, one tap away instead of a paragraph on the page. */
function CompletionRule() {
  return (
    <details className="group relative mt-1 block text-left md:text-right [&_summary::-webkit-details-marker]:hidden">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded text-[12px] font-semibold text-blue-200 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70">
        <Info className="size-3.5" aria-hidden="true" />
        Thế nào là hoàn thành?
      </summary>
      <span className="absolute right-0 z-10 mt-2 block w-[min(280px,80vw)] rounded-xl bg-white p-3 text-left text-[13px] leading-5 text-slate-700 shadow-xl md:right-0 max-md:left-0">
        Luyện tập đạt từ 80% số câu. Bài chưa có câu luyện tập thì học hết bài là xong. Chỉ mở bài
        ra xem thì chưa tính.
      </span>
    </details>
  );
}

/** The program as stages: one segment per chapter, sized by its lessons, filled by what is done. */
function StageTrack({ journey }: { journey: Journey }) {
  const { scope, standings, currentLessonId } = journey;
  return (
    <div className="mt-6 sm:mt-7">
      <ol className="flex gap-1.5" aria-label="Các chương trong hành trình">
        {scope.chapters.map((chapter, index) => {
          const done = chapter.lessons.filter((l) => standings.get(l.id)?.completed).length;
          const here = chapter.lessons.some((l) => l.id === currentLessonId);
          return (
            <li
              key={chapter.id}
              className="min-w-[30px]"
              style={{ flexGrow: chapter.lessons.length, flexBasis: 0 }}
              aria-label={`Chương ${index + 1}: ${chapter.title}, ${done}/${chapter.lessons.length} bài xong${here ? ', em đang ở chương này' : ''}`}
            >
              <span className="flex h-2 overflow-hidden rounded-full bg-white/15">
                <span
                  className="h-full rounded-full bg-[#34D399]"
                  style={{ width: `${(done / chapter.lessons.length) * 100}%` }}
                />
              </span>
              <span
                className={`mt-2 flex items-center gap-1 truncate text-[12px] font-semibold ${
                  here ? 'text-white' : 'text-blue-200/80'
                }`}
                aria-hidden="true"
              >
                {here && <MapPin className="size-3.5 shrink-0 text-[#FFC857]" />}
                <span className="truncate">
                  {scope.chapters.length > 4 ? `C${index + 1}` : `Chương ${index + 1}`}
                  {scope.chapters.length <= 2 && (
                    <span className="font-normal text-blue-200/80"> · {chapter.title}</span>
                  )}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function HeroArt() {
  return (
    <svg
      className="pointer-events-none absolute -right-24 -top-6 md:right-[150px] -z-10 h-[260px] w-[620px] text-[#7FB2FF] opacity-[.22] max-lg:opacity-[.1]"
      viewBox="0 0 620 260"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <pattern id="roadmap-hero-grid" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M24 0H0V24" stroke="currentColor" strokeWidth=".6" />
        </pattern>
      </defs>
      <rect x="120" width="500" height="260" fill="url(#roadmap-hero-grid)" opacity=".5" />
      <g stroke="currentColor" strokeWidth="1.6">
        <path d="M150 200H600M220 240V20" opacity=".6" />
        <path d="M160 190C210 188 214 80 262 80c50 0 54 108 102 108c46 0 60-74 98-120 30-36 70-44 110-40" />
      </g>
      <g fill="currentColor" fontFamily="serif" fontStyle="italic" fontSize="16">
        <text x="300" y="62">
          y = f(x)
        </text>
        <text x="470" y="150" opacity=".8">
          ∫ f(x) dx
        </text>
      </g>
      <circle cx="262" cy="80" r="4" fill="currentColor" />
    </svg>
  );
}

// ─── The next step ───────────────────────────────────────────────────────────

function NextStepCard({
  step,
  scope,
  progress,
  summaries,
  standings,
}: {
  step: NextStep | null;
  scope: StudyScope;
  progress: LessonProgressState;
  summaries: Summaries;
  standings: Map<string, LessonStanding>;
}) {
  if (!step)
    return (
      <section
        aria-label="Bước tiếp theo"
        className="relative overflow-hidden rounded-[24px] border border-emerald-100 bg-white p-6 sm:p-7"
        data-testid="roadmap-next"
        data-kind="done"
      >
        <span className="grid size-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
          <Trophy className="size-6" aria-hidden="true" />
        </span>
        <h2 className="mt-4 text-[22px] font-extrabold leading-snug text-[#091224]">
          Em đã đi hết các bài đang mở
        </h2>
        <p className="mt-1.5 text-[15px] leading-6 text-slate-600">
          Mọi bài trong lộ trình đều đã hoàn thành. Bài mới sẽ xuất hiện trên hành trình khi thầy cô
          mở thêm; trong lúc chờ, em luyện đề để giữ nhịp.
        </p>
        <Link href="/student/practice" className={`${primaryClass} mt-6`}>
          Đi tới Luyện đề <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </section>
    );

  const position = scope.lessons.findIndex((lesson) => lesson.id === step.lesson.id) + 1;
  const chapterIndex = scope.chapters.findIndex((c) => c.id === step.lesson.chapterId) + 1;
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
  const standing = standings.get(step.lesson.id)!;

  return (
    <section
      aria-labelledby="roadmap-next-title"
      className="relative overflow-hidden rounded-[24px] border border-[#DCE6F7] bg-white p-5 shadow-[0_12px_32px_-18px_rgba(10,31,92,0.35)] sm:p-7"
      data-testid="roadmap-next"
      data-kind={step.kind}
      data-lesson={step.lesson.id}
    >
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1.5 bg-[#0052FF]" />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="rounded-full bg-[#0052FF] px-2.5 py-1 text-[12px] font-bold text-white">
          Bước tiếp theo
        </span>
        <span className="text-[13px] font-medium text-slate-500">
          Chương {chapterIndex} · Bài {position}/{scope.lessons.length}
        </span>
      </div>
      <h2
        id="roadmap-next-title"
        className="mt-3 text-[24px] font-extrabold leading-tight tracking-tight text-[#091224] sm:text-[28px]"
      >
        {step.lesson.title}
      </h2>
      <p className="mt-1 text-[14px] text-slate-500">{step.lesson.chapterTitle}</p>
      <p className="mt-4 text-[15px] leading-6 text-slate-700" data-testid="roadmap-reason">
        {step.reason}
      </p>

      <LessonTrack standing={standing} kind={step.kind} />

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-5">
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

type TrackState = 'done' | 'current' | 'todo';

/** What finishing this lesson takes, with the student's real state at each step. */
function LessonTrack({ standing, kind }: { standing: LessonStanding; kind: NextStep['kind'] }) {
  const { reading, practice, hasPractice } = standing;
  const read: TrackState = reading.kind === 'learned' ? 'done' : 'current';
  const readNote =
    reading.kind === 'learned'
      ? 'Đã học hết'
      : reading.kind === 'started' && reading.total > 0
        ? `Phần ${reading.stage}/${reading.total}`
        : 'Chưa bắt đầu';

  const steps: { label: string; note: string; state: TrackState; icon: typeof BookOpen }[] = [
    { label: 'Học bài', note: readNote, state: read, icon: BookOpen },
  ];
  if (hasPractice) {
    const open = practice?.inProgress;
    const best = practice?.best;
    const practising = kind === 'resume-practice' || kind === 'practice' || kind === 'retry';
    steps.push({
      label: 'Luyện tập',
      note: open
        ? `Đang làm ${open.answeredCount}/${open.totalCount} câu`
        : best
          ? `Tốt nhất ${best.correctCount}/${best.totalCount} câu`
          : `${practice!.questionCount} câu`,
      state: practising ? 'current' : 'todo',
      icon: ClipboardCheck,
    });
  }
  steps.push({
    label: 'Hoàn thành',
    note: hasPractice ? 'Đúng từ 80% số câu' : 'Học đến phần cuối',
    state: 'todo',
    icon: Flag,
  });

  return (
    <ol
      className="mt-5 grid gap-2 rounded-2xl bg-[#F4F8FF] p-3 sm:p-4"
      style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
      aria-label="Để hoàn thành bài này"
    >
      {steps.map((item, index) => (
        <li key={item.label} className="relative min-w-0">
          {index < steps.length - 1 && (
            <span
              aria-hidden="true"
              className={`absolute left-[34px] right-0 top-[15px] h-0.5 ${
                item.state === 'done' ? 'bg-emerald-400' : 'bg-[#C9D8F2]'
              }`}
            />
          )}
          <span
            aria-hidden="true"
            className={`relative grid size-8 place-items-center rounded-full ${
              item.state === 'done'
                ? 'bg-emerald-500 text-white'
                : item.state === 'current'
                  ? 'bg-[#0052FF] text-white ring-4 ring-blue-200/70'
                  : 'bg-white text-slate-400 ring-1 ring-[#C9D8F2]'
            }`}
          >
            {item.state === 'done' ? (
              <Check className="size-4" strokeWidth={3} />
            ) : (
              <item.icon className="size-4" />
            )}
          </span>
          <span className="mt-2 block text-[13px] font-bold text-[#091224]">{item.label}</span>
          <span className="block text-[12px] leading-4 text-slate-500">{item.note}</span>
        </li>
      ))}
    </ol>
  );
}

// ─── The map ─────────────────────────────────────────────────────────────────

function JourneyMap({
  scope,
  standings,
  nextLessonId,
  initials,
  targetScore,
  otherSubjects,
}: {
  scope: StudyScope;
  standings: Map<string, LessonStanding>;
  nextLessonId: string | null;
  initials: string;
  targetScore: number | null;
  otherSubjects: string[];
}) {
  const many = scope.chapters.length > 2;
  return (
    <section
      aria-labelledby="roadmap-map"
      className="rounded-[24px] border border-[#E5EBF3] bg-white p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="roadmap-map" className="text-[17px] font-extrabold text-[#091224]">
          Bản đồ hành trình
        </h2>
        <p className="text-[12px] text-slate-500">Mọi bài đều mở, học trước thứ tự vẫn được tính</p>
      </div>

      <ol className="relative mt-4">
        {scope.chapters.map((chapter, index) => {
          const done = chapter.lessons.filter((l) => standings.get(l.id)?.completed).length;
          const here = chapter.lessons.some((l) => l.id === nextLessonId);
          const finished = done === chapter.lessons.length;
          return (
            <Milestone
              key={chapter.id}
              index={index}
              title={chapter.title}
              done={done}
              count={chapter.lessons.length}
              finished={finished}
              here={here}
              collapsible={many}
              open={!many || here || (!nextLessonId && index === scope.chapters.length - 1)}
            >
              {chapter.lessons.map((lesson) => (
                <Stop
                  key={lesson.id}
                  lessonId={lesson.id}
                  title={lesson.title}
                  standing={standings.get(lesson.id)!}
                  isNext={lesson.id === nextLessonId}
                  initials={initials}
                />
              ))}
            </Milestone>
          );
        })}
        <li className="relative flex items-start gap-3 pt-1">
          <span
            aria-hidden="true"
            className="relative z-[1] grid size-10 shrink-0 place-items-center rounded-full bg-[#FFF4D6] text-[#B7791F] ring-4 ring-white"
          >
            <Trophy className="size-5" />
          </span>
          <span className="min-w-0 pt-1">
            <span className="block text-[15px] font-bold text-[#091224]">
              Đích đến{targetScore ? `: ${targetScore} điểm` : ''}
            </span>
            <span className="mt-0.5 block text-[13px] leading-5 text-slate-500">
              Hiện có {scope.lessons.length} bài trong {scope.chapters.length} chương. Bài mới sẽ tự
              xuất hiện trên hành trình khi thầy cô mở thêm.
            </span>
          </span>
        </li>
      </ol>

      {otherSubjects.length > 0 && (
        <p className="mt-5 border-t border-slate-100 pt-4 text-[13px] text-slate-500">
          Bài của {otherSubjects.join(', ')} nằm trong{' '}
          <Link
            href="/student/lessons"
            className="font-semibold text-blue-700 underline-offset-4 hover:underline"
          >
            Bài học
          </Link>
          .
        </p>
      )}
    </section>
  );
}

function Milestone({
  index,
  title,
  done,
  count,
  finished,
  here,
  collapsible,
  open,
  children,
}: {
  index: number;
  title: string;
  done: number;
  count: number;
  finished: boolean;
  here: boolean;
  collapsible: boolean;
  open: boolean;
  children: React.ReactNode;
}) {
  const node = (
    <span
      aria-hidden="true"
      className={`relative z-[1] grid size-10 shrink-0 place-items-center rounded-full text-[15px] font-extrabold ring-4 ring-white ${
        finished
          ? 'bg-emerald-500 text-white'
          : here
            ? 'bg-[#0052FF] text-white'
            : 'bg-[#EEF3FB] text-slate-500'
      }`}
    >
      {finished ? <Check className="size-5" strokeWidth={3} /> : index + 1}
    </span>
  );
  const heading = (
    <span className="min-w-0 flex-1 pt-0.5">
      <span className="block text-[12px] font-semibold uppercase tracking-wider text-slate-400">
        Chương {index + 1}
      </span>
      <span className="block text-[15px] font-bold leading-snug text-[#091224]">{title}</span>
      <span className="mt-1.5 flex items-center gap-2">
        <span className="flex gap-1" aria-hidden="true">
          {Array.from({ length: Math.min(count, 12) }, (_, i) => (
            <span
              key={i}
              className={`h-1.5 w-4 rounded-full ${i < done ? 'bg-emerald-500' : 'bg-slate-200'}`}
            />
          ))}
        </span>
        <span className="text-[12px] text-slate-500">
          {done}/{count} bài xong
        </span>
      </span>
    </span>
  );
  const line = (
    <span aria-hidden="true" className="absolute bottom-0 left-[19px] top-0 w-0.5 bg-[#E5EBF3]" />
  );

  if (!collapsible)
    return (
      <li className="relative pb-4" data-testid="roadmap-chapter">
        {line}
        <div className="flex items-start gap-3">
          {node}
          {heading}
        </div>
        <ol className="mt-2">{children}</ol>
      </li>
    );
  return (
    <li className="relative pb-4" data-testid="roadmap-chapter">
      {line}
      <details open={open} className="group">
        <summary className="flex cursor-pointer list-none items-start gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 [&::-webkit-details-marker]:hidden">
          {node}
          {heading}
          <ChevronDown
            className="mt-3 size-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>
        <ol className="mt-2">{children}</ol>
      </details>
    </li>
  );
}

function Stop({
  lessonId,
  title,
  standing,
  isNext,
  initials,
}: {
  lessonId: string;
  title: string;
  standing: LessonStanding;
  isNext: boolean;
  initials: string;
}) {
  const label = standingLabel(standing);
  return (
    <li className="relative">
      <Link
        href={withFrom(lessonHref(lessonId), 'roadmap')}
        className={`group relative flex items-center gap-3 rounded-xl py-2 pl-[11px] pr-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
          isNext ? 'bg-[#F0F5FF]' : 'hover:bg-slate-50'
        }`}
        data-testid="roadmap-lesson"
        data-lesson={lessonId}
        data-completed={standing.completed}
        aria-current={isNext ? 'step' : undefined}
      >
        <StopMark tone={label.tone} isNext={isNext} initials={initials} />
        <span className="min-w-0 flex-1">
          <span
            className={`block text-[14px] leading-snug ${
              isNext ? 'font-bold text-[#091224]' : 'font-semibold text-slate-700'
            } group-hover:text-[#091224]`}
          >
            {title}
          </span>
          <span
            className={`mt-0.5 block text-[12px] ${
              label.tone === 'done'
                ? 'text-emerald-700'
                : label.tone === 'attention'
                  ? 'text-amber-800'
                  : label.tone === 'active'
                    ? 'text-blue-700'
                    : 'text-slate-500'
            }`}
            data-testid="roadmap-lesson-status"
          >
            {label.text}
            {isNext && <span className="sr-only"> (bước tiếp theo)</span>}
          </span>
        </span>
        {isNext && (
          <span className="shrink-0 rounded-full bg-[#0052FF] px-2 py-0.5 text-[11px] font-bold text-white">
            Em ở đây
          </span>
        )}
      </Link>
    </li>
  );
}

function StopMark({ tone, isNext, initials }: { tone: string; isNext: boolean; initials: string }) {
  if (isNext)
    return (
      <span
        aria-hidden="true"
        className="relative z-[1] grid size-[18px] shrink-0 place-items-center rounded-full bg-[#0052FF] text-[8px] font-bold text-white ring-4 ring-blue-100"
      >
        {initials.slice(0, 2)}
      </span>
    );
  if (tone === 'done')
    return (
      <span
        aria-hidden="true"
        className="relative z-[1] grid size-[18px] shrink-0 place-items-center rounded-full bg-emerald-500 text-white ring-4 ring-white"
      >
        <Check className="size-3" strokeWidth={3.5} />
      </span>
    );
  return (
    <span
      aria-hidden="true"
      className={`relative z-[1] size-[18px] shrink-0 rounded-full bg-white ring-4 ring-white ${
        tone === 'attention'
          ? 'border-[3px] border-amber-400'
          : tone === 'active'
            ? 'border-[3px] border-blue-400'
            : 'border-2 border-slate-300'
      }`}
    />
  );
}

function EmptyProgram() {
  return (
    <section
      className="mt-5 rounded-[24px] border border-[#E5EBF3] bg-white p-6 text-center sm:p-10"
      data-testid="roadmap-empty"
    >
      <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-blue-50 text-blue-600">
        <MapPin className="size-6" aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-[20px] font-extrabold text-[#091224]">
        Hành trình đang được chuẩn bị
      </h2>
      <p className="mx-auto mt-1 max-w-[440px] text-[15px] leading-6 text-slate-500">
        Thầy cô đang soạn những bài đầu tiên. Khi bài được mở, hành trình của em sẽ hiện ở đây theo
        đúng thứ tự chương trình.
      </p>
      <Link href="/student/practice" className={`${primaryClass} mt-6`}>
        Đi tới Luyện đề <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </section>
  );
}

const primaryClass =
  'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0052FF] px-6 text-center text-[15px] font-bold text-white shadow-[0_8px_20px_rgba(0,82,255,0.25)] transition hover:bg-[#0044CC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 sm:w-auto';
const linkClass =
  'inline-flex min-h-10 items-center rounded-lg text-[14px] font-semibold text-slate-600 underline-offset-4 hover:text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500';
