'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen, Check, ChevronDown, RotateCcw } from 'lucide-react';
import { useStudentShell } from '@/components/student/student-shell';
import {
  useLessonProgress,
  type LessonLearningState,
} from '@/features/lessons/lib/lesson-progress';
import {
  lessonHref,
  PRACTICE_HREF,
  programHref,
  readingLabel,
  ROADMAP_HREF,
  type StudyScope,
} from '@/features/lessons/lib/study-plan';
import type { ProgramBasis } from '@/features/lessons/lib/program-match';
import {
  buildLearningPath,
  openChaptersByDefault,
  type LearningPath,
  type PathChapter,
  type PathLesson,
} from '../lib/learning-path';
import { ChapterArt } from './chapter-art';

/** Why the page shows this program; see program-match. */
export interface RoadmapChoice {
  basis: ProgramBasis;
  /** The program the profile asks for, e.g. "Vật lý 12". */
  requested: string | null;
  /** The published program the profile leads to. */
  profileProgram: { id: string; title: string } | null;
}

/**
 * "Học": the student's learning path through one program. Reading only;
 * practice lives on the Luyện tập page.
 *
 * - The lesson to read now, large, with its chapter's picture, how far it
 *   has been read and what comes after it.
 * - The path: every chapter in order on one line, each lesson a stop on it,
 *   numbered across the program. Read lessons fill the line in green; the
 *   student's place is marked. A long program folds into its chapters, with
 *   the current one open, so the page holds hundreds of lessons.
 * - On wide screens, a map of the chapters beside the path, with the real
 *   counts of lessons read, that jumps to any chapter.
 *
 * Every lesson can be opened at any time; nothing is locked.
 */
export function StudentRoadmap({
  programs,
  program: scope,
  choice,
}: {
  programs: StudyScope[];
  program: StudyScope | null;
  choice?: RoadmapChoice;
}) {
  const { model } = useStudentShell();
  const progress = useLessonProgress(model.identity.id);

  if (!scope)
    return (
      <Page>
        <EmptyProgram />
      </Page>
    );

  const head = (
    <>
      {programs.length > 1 && <ProgramChips programs={programs} current={scope.id} />}
      {choice && <ProgramBasisNote choice={choice} title={scope.title} />}
    </>
  );

  if (!progress)
    return (
      <Page>
        {head}
        <PathSkeleton />
      </Page>
    );

  return (
    <Page>
      {head}
      <LearningPathView scope={scope} path={buildLearningPath(scope, progress)} />
    </Page>
  );
}

function LearningPathView({ scope, path }: { scope: StudyScope; path: LearningPath }) {
  const defaults = React.useMemo(() => openChaptersByDefault(path), [path]);
  const [chosen, setChosen] = React.useState<Set<string> | null>(null);
  const open = chosen ?? defaults;
  // A map of one or two chapters only repeats the path beside it.
  const map = path.chapters.length > 2;
  const toggle = (id: string) =>
    setChosen((prev) => {
      const next = new Set(prev ?? defaults);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const reveal = (chapter: PathChapter) => {
    setChosen((prev) => new Set(prev ?? defaults).add(chapter.id));
    requestAnimationFrame(() => {
      const target = document.getElementById(chapterAnchor(chapter));
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      target?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      target?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
    });
  };

  return (
    <div
      className={`mt-4 grid gap-6 ${map ? 'xl:grid-cols-[minmax(0,1fr)_288px] xl:items-start' : 'mx-auto max-w-[860px]'}`}
    >
      <div className="min-w-0 space-y-6">
        {path.next ? (
          <ContinueCard scope={scope} path={path} />
        ) : (
          <FinishedCard scope={scope} path={path} />
        )}
        <Journey scope={scope} path={path} open={open} onToggle={toggle} map={map} />
      </div>
      {map && (
        <aside className="hidden xl:sticky xl:top-6 xl:block" aria-label="Các chương">
          <ChapterMap path={path} subject={scope.subjectTitle} onJump={reveal} />
        </aside>
      )}
    </div>
  );
}

// ─── The lesson to read now ──────────────────────────────────────────────────

function ContinueCard({ scope, path }: { scope: StudyScope; path: LearningPath }) {
  const next = path.next!;
  const chapter = path.chapters.find((item) => item.id === next.lesson.chapterId)!;
  const stop = chapter.lessons.find((item) => item.lesson.id === next.lesson.id)!;
  const fresh = path.learned === 0 && next.cta === 'Bắt đầu học';
  const reading = stop.reading;
  return (
    <section
      aria-labelledby="roadmap-next-title"
      className={`${cardClass} overflow-hidden sm:grid sm:grid-cols-[minmax(180px,34%)_1fr]`}
      data-testid="roadmap-next"
      data-kind={next.cta === 'Học tiếp' ? 'resume-lesson' : 'start'}
      data-lesson={next.lesson.id}
    >
      <ChapterArt
        size="lg"
        number={chapter.number}
        subject={scope.subjectTitle}
        className="h-32 sm:h-full sm:min-h-[248px]"
      />
      <div className="flex min-w-0 flex-col p-5 sm:p-7">
        <p className="text-[13px] font-semibold text-blue-700">
          {fresh ? 'Bắt đầu lộ trình' : 'Bài tiếp theo của em'}
        </p>
        <p className="mt-3 text-[13px] text-slate-500">
          Chương {chapter.number} · Bài {stop.number}/{path.total}
        </p>
        <h2
          id="roadmap-next-title"
          className="mt-1 text-[24px] font-extrabold leading-[1.15] tracking-tight text-[#091224] sm:text-[30px]"
        >
          {next.lesson.title}
        </h2>
        {next.lesson.description && (
          <p
            className="mt-2 line-clamp-2 text-[15px] leading-6 text-slate-600"
            data-testid="roadmap-next-description"
          >
            {next.lesson.description}
          </p>
        )}
        {reading.kind === 'started' && reading.total > 0 && (
          <PartsBar stage={reading.stage} total={reading.total} />
        )}
        <div className="mt-auto flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:gap-5">
          <Link
            href={lessonHref(next.lesson.id)}
            className={primaryClass}
            data-testid="roadmap-next-cta"
          >
            {next.cta} <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
          {path.after && (
            <p className="min-w-0 text-[13px] text-slate-500" data-testid="roadmap-after">
              Sau đó: <span className="font-semibold text-slate-700">{path.after.title}</span>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

/** The parts of the lesson already read, out of all its parts. */
function PartsBar({ stage, total }: { stage: number; total: number }) {
  const read = Math.max(0, stage - 1);
  return (
    <div className="mt-4" data-testid="roadmap-reason">
      <p className="text-[13px] font-semibold text-blue-700">
        Đang học · phần {stage}/{total}
      </p>
      <div
        className="mt-2 flex max-w-[320px] gap-1"
        role="progressbar"
        aria-label="Phần đã học của bài"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={read}
      >
        {Array.from({ length: total }, (_, index) => (
          <span
            key={index}
            className={`h-1.5 flex-1 rounded-full ${
              index < read ? 'bg-[#0052FF]' : index === read ? 'bg-[#9DB8FF]' : 'bg-[#E3EAF5]'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

/** Every open lesson read: what was done, and where to go now. */
function FinishedCard({ scope, path }: { scope: StudyScope; path: LearningPath }) {
  const first = scope.lessons[0];
  return (
    <section
      aria-labelledby="roadmap-done-title"
      className={`${cardClass} overflow-hidden sm:grid sm:grid-cols-[minmax(180px,34%)_1fr]`}
      data-testid="roadmap-next"
      data-kind="done"
    >
      <span
        aria-hidden="true"
        className="relative grid h-32 place-items-center overflow-hidden bg-[#E5F5EF] sm:h-full sm:min-h-[232px]"
        style={{
          backgroundImage:
            'linear-gradient(#C2E7D8 1px, transparent 1px), linear-gradient(90deg, #C2E7D8 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
      >
        <span className="grid size-16 place-items-center rounded-full bg-emerald-600 text-white shadow-[0_10px_30px_-8px_rgba(5,150,105,0.6)] sm:size-20">
          <Check className="size-8 sm:size-10" strokeWidth={3} />
        </span>
      </span>
      <div className="flex min-w-0 flex-col p-5 sm:p-7">
        <p className="text-[13px] font-semibold text-emerald-700">Hoàn thành các bài đang mở</p>
        <h2
          id="roadmap-done-title"
          className="mt-3 text-[24px] font-extrabold leading-[1.15] tracking-tight text-[#091224] sm:text-[30px]"
        >
          Em đã học hết {path.total} bài
        </h2>
        <p className="mt-2 text-[15px] leading-6 text-slate-600">
          {path.chapters.length > 1 ? `Trọn ${path.chapters.length} chương. ` : ''}
          Luyện tập giúp em nhớ lâu và biết mình còn hổng chỗ nào. Bài mới sẽ hiện trên lộ trình khi
          được mở.
        </p>
        <div className="mt-auto flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:gap-5">
          <Link href={PRACTICE_HREF} className={primaryClass} data-testid="roadmap-next-cta">
            Sang Luyện tập <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
          {first && (
            <Link
              href={lessonHref(first.id)}
              className={quietClass}
              data-testid="roadmap-review-first"
            >
              <RotateCcw className="size-4" aria-hidden="true" /> Ôn lại từ bài 1
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

// ─── The path ────────────────────────────────────────────────────────────────

function Journey({
  scope,
  path,
  open,
  onToggle,
  map,
}: {
  scope: StudyScope;
  path: LearningPath;
  open: Set<string>;
  onToggle: (id: string) => void;
  /** The chapter map beside the path shows the overall progress on wide screens. */
  map: boolean;
}) {
  return (
    <section
      aria-labelledby="roadmap-path-title"
      className={`${cardClass} p-4 sm:p-6`}
      data-testid="roadmap-path"
    >
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 px-1">
        <div>
          <h2 id="roadmap-path-title" className="text-[18px] font-extrabold text-[#091224]">
            Lộ trình
          </h2>
          <p className="mt-0.5 text-[13px] text-slate-500">
            {path.chapters.length} chương · {path.total} bài
          </p>
        </div>
        {/* On wide screens the chapter map beside the path shows this. */}
        <div className={`w-full sm:w-56 ${map ? 'xl:hidden' : ''}`}>
          <OverallProgress path={path} />
        </div>
      </div>
      <ol className="mt-5">
        {path.chapters.map((chapter, index) => (
          <ChapterStop
            key={chapter.id}
            chapter={chapter}
            subject={scope.subjectTitle}
            open={open.has(chapter.id)}
            onToggle={() => onToggle(chapter.id)}
            prevDone={index > 0 && path.chapters[index - 1].state === 'done'}
            last={index === path.chapters.length - 1}
          />
        ))}
      </ol>
    </section>
  );
}

const chapterAnchor = (chapter: PathChapter) => `chuong-${chapter.number}`;

/**
 * One line runs through the path at the centre of the chapter tiles. Each row
 * draws its own piece of it, green once that row is read, so the line shows
 * how far the student has come without any extra counter.
 */
function Spine({
  done,
  from = 'top',
  to = 'bottom',
}: {
  done: boolean;
  from?: 'top' | 'mid';
  to?: 'bottom' | 'mid';
}) {
  return (
    <span
      aria-hidden="true"
      className={`absolute left-[21px] w-0.5 -translate-x-1/2 sm:left-7 ${from === 'mid' ? 'top-7' : 'top-0'} ${
        to === 'mid' ? 'h-7' : 'bottom-0'
      } ${done ? 'bg-emerald-400' : 'bg-[#E1E8F2]'}`}
    />
  );
}

function ChapterStop({
  chapter,
  subject,
  open,
  onToggle,
  prevDone,
  last,
}: {
  chapter: PathChapter;
  subject: string;
  open: boolean;
  onToggle: () => void;
  /** Every lesson before this chapter is read: the line into it is green. */
  prevDone: boolean;
  last: boolean;
}) {
  const done = chapter.state === 'done';
  const panel = `${chapterAnchor(chapter)}-bai`;
  return (
    <li
      id={chapterAnchor(chapter)}
      className="relative scroll-mt-6"
      data-testid="roadmap-chapter"
      data-state={chapter.state}
      data-open={open}
    >
      <h3 className="relative">
        {chapter.number > 1 && <Spine done={prevDone} to="mid" />}
        {(!last || open) && <Spine done={done} from="mid" />}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={panel}
          className="group relative flex w-full items-center gap-3 rounded-2xl py-2 pr-2 text-left transition-colors hover:bg-[#F6F8FC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:gap-4"
        >
          <ChapterArt
            number={chapter.number}
            subject={subject}
            done={done}
            className={`relative size-[42px] shrink-0 rounded-xl ring-4 ring-white sm:size-14 sm:rounded-2xl ${
              done ? '!bg-emerald-50 !text-emerald-600' : ''
            }`}
          />
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-x-1 text-[12px] font-semibold text-slate-500">
              Chương {chapter.number}
              {chapter.state === 'current' && <span className="text-blue-700">· Em đang học</span>}
              {done && <span className="text-emerald-700">· Đã học xong</span>}
            </span>
            <span className="mt-0.5 block text-[16px] font-bold leading-snug text-[#091224] sm:text-[17px]">
              {readable(chapter.title)}
            </span>
            <span className="mt-1.5 flex items-center gap-2.5 text-[12px] text-slate-500">
              <MiniBar value={chapter.learned} max={chapter.total} />
              <span data-testid="roadmap-chapter-count">
                {chapter.learned}/{chapter.total} bài đã học
              </span>
            </span>
          </span>
          <ChevronDown
            className={`size-5 shrink-0 text-slate-400 transition-transform group-hover:text-slate-600 ${
              open ? 'rotate-180' : ''
            }`}
            aria-hidden="true"
          />
        </button>
      </h3>
      <ol id={panel} hidden={!open}>
        {chapter.lessons.map((stop, index) => (
          <LessonStop
            key={stop.lesson.id}
            stop={stop}
            lastInChapter={index === chapter.lessons.length - 1}
            lastInPath={last && index === chapter.lessons.length - 1}
          />
        ))}
      </ol>
    </li>
  );
}

function LessonStop({
  stop,
  lastInChapter,
  lastInPath,
}: {
  stop: PathLesson;
  lastInChapter: boolean;
  lastInPath: boolean;
}) {
  const label = readingLabel(stop.reading);
  const learned = stop.reading.kind === 'learned';
  return (
    <li className={`relative ${lastInChapter && !lastInPath ? 'pb-3' : ''}`}>
      <Spine done={learned} to={lastInPath ? 'mid' : 'bottom'} />
      <Link
        href={lessonHref(stop.lesson.id)}
        className={`group relative my-0.5 flex items-center gap-3 rounded-xl py-2.5 pr-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:gap-4 ${
          stop.isCurrent ? 'bg-[#EEF3FF]' : 'hover:bg-[#F6F8FC]'
        }`}
        data-testid="roadmap-lesson"
        data-lesson={stop.lesson.id}
        data-completed={learned}
        data-current={stop.isCurrent}
        aria-current={stop.isCurrent ? 'step' : undefined}
      >
        <span className="grid w-[42px] shrink-0 place-items-center sm:w-14">
          <Node reading={stop.reading} current={stop.isCurrent} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-4">
          <span className="min-w-0 flex-1">
            <span className="block text-[12px] tabular-nums text-slate-400">Bài {stop.number}</span>
            <span
              data-testid="roadmap-lesson-title"
              className={`block text-[15px] leading-snug ${
                stop.isCurrent
                  ? 'font-bold text-[#091224]'
                  : learned
                    ? 'text-slate-600'
                    : 'font-medium text-slate-800 group-hover:text-[#091224]'
              }`}
            >
              {stop.lesson.title}
              {stop.isCurrent && <span className="sr-only"> (bài tiếp theo)</span>}
            </span>
          </span>
          <span
            className={`shrink-0 text-[13px] sm:text-right ${
              stop.isCurrent ? 'font-semibold text-blue-700' : tone(label.tone)
            }`}
            data-testid="roadmap-lesson-status"
          >
            {stop.isCurrent && stop.reading.kind === 'new' ? 'Học bài này tiếp theo' : label.text}
          </span>
        </span>
      </Link>
    </li>
  );
}

function Node({ reading, current }: { reading: LessonLearningState; current: boolean }) {
  if (reading.kind === 'learned')
    return (
      <span className="relative grid size-6 place-items-center rounded-full bg-emerald-500 text-white ring-4 ring-white">
        <Check className="size-3.5" strokeWidth={3.5} aria-hidden="true" />
      </span>
    );
  if (current)
    return (
      <span className="relative grid size-6 place-items-center rounded-full bg-[#0052FF] ring-4 ring-[#EEF3FF]">
        <span className="absolute inset-0 rounded-full bg-[#0052FF] opacity-30 motion-safe:animate-ping" />
        <span className="relative size-2 rounded-full bg-white" />
      </span>
    );
  if (reading.kind === 'started')
    return (
      <span
        className="relative size-6 rounded-full border-2 border-blue-400 ring-4 ring-white"
        style={{ background: 'linear-gradient(90deg, #BFD2FF 50%, #fff 50%)' }}
      />
    );
  return (
    <span className="relative size-6 rounded-full border-2 border-[#CBD5E3] bg-white ring-4 ring-white" />
  );
}

function MiniBar({ value, max }: { value: number; max: number }) {
  return (
    <span
      aria-hidden="true"
      className="h-1.5 w-16 overflow-hidden rounded-full bg-[#E6ECF4] sm:w-20"
    >
      <span
        className={`block h-full rounded-full ${value === max ? 'bg-emerald-500' : 'bg-[#0052FF]'} motion-safe:transition-[width] motion-safe:duration-500`}
        style={{ width: `${max ? (value / max) * 100 : 0}%` }}
      />
    </span>
  );
}

// ─── Progress and the chapter map ────────────────────────────────────────────

/** Lessons read out of all; one segment per chapter, as wide as its lesson count. */
function OverallProgress({ path }: { path: LearningPath }) {
  return (
    <div data-testid="roadmap-progress">
      <p className="flex items-baseline justify-between gap-3 text-[13px] text-slate-500">
        <span>
          <span
            className="text-[20px] font-extrabold tabular-nums text-[#091224]"
            data-testid="roadmap-completed"
          >
            {path.learned}/{path.total}
          </span>{' '}
          bài đã học
        </span>
        {path.total > 0 && (
          <span className="tabular-nums">{Math.round((path.learned / path.total) * 100)}%</span>
        )}
      </p>
      <div
        className="mt-2 flex gap-1"
        role="progressbar"
        aria-label="Bài đã học trong chương trình"
        aria-valuemin={0}
        aria-valuemax={path.total}
        aria-valuenow={path.learned}
      >
        {path.chapters.map((chapter) => (
          <span
            key={chapter.id}
            className="h-2 overflow-hidden rounded-full bg-[#E6ECF4]"
            style={{ flexGrow: chapter.total, flexBasis: 0 }}
          >
            <span
              className={`block h-full ${chapter.state === 'done' ? 'bg-emerald-500' : 'bg-[#0052FF]'}`}
              style={{ width: `${(chapter.learned / chapter.total) * 100}%` }}
            />
          </span>
        ))}
      </div>
    </div>
  );
}

function ChapterMap({
  path,
  subject,
  onJump,
}: {
  path: LearningPath;
  subject: string;
  onJump: (chapter: PathChapter) => void;
}) {
  return (
    <nav aria-label="Đi tới chương" className={`${cardClass} p-5`} data-testid="roadmap-map">
      <OverallProgress path={path} />
      <ol className="mt-5 space-y-1 border-t border-[#EDF1F7] pt-4">
        {path.chapters.map((chapter) => {
          const current = chapter.state === 'current';
          return (
            <li key={chapter.id}>
              <a
                href={`#${chapterAnchor(chapter)}`}
                onClick={(event) => {
                  event.preventDefault();
                  onJump(chapter);
                }}
                aria-current={current ? 'location' : undefined}
                className={`flex items-center gap-3 rounded-xl px-2 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  current ? 'bg-[#EEF3FF]' : 'hover:bg-[#F6F8FC]'
                }`}
                data-testid="roadmap-map-chapter"
              >
                <ChapterArt
                  number={chapter.number}
                  subject={subject}
                  done={chapter.state === 'done'}
                  className={`size-8 shrink-0 rounded-lg text-[13px] [&>span:last-child]:text-[13px] ${
                    chapter.state === 'done' ? '!bg-emerald-50 !text-emerald-600' : ''
                  }`}
                />
                <span
                  className={`min-w-0 flex-1 text-[13px] leading-snug ${
                    current ? 'font-bold text-[#091224]' : 'text-slate-600'
                  }`}
                >
                  <span className="line-clamp-2">{readable(chapter.title)}</span>
                </span>
                <span
                  className={`shrink-0 text-[12px] tabular-nums ${
                    chapter.state === 'done' ? 'text-emerald-700' : 'text-slate-400'
                  }`}
                >
                  {chapter.learned}/{chapter.total}
                </span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ─── Around the path ─────────────────────────────────────────────────────────

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
    <div className="mx-auto w-full max-w-[1120px] pb-12" data-testid="roadmap">
      {/* The sidebar names the page on wide screens; next to the menu button on small ones. */}
      <h1 className="-mt-12 flex min-h-10 items-center pl-12 text-[17px] font-extrabold text-[#091224] md:-mt-2 lg:sr-only">
        Học
      </h1>
      <div className="mt-4 lg:mt-0">{children}</div>
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

function tone(value: string) {
  return value === 'done'
    ? 'text-emerald-700'
    : value === 'active'
      ? 'text-blue-700'
      : 'text-slate-400';
}

/** The programs with published lessons, as plain chips. Only shown when there is more than one. */
function ProgramChips({ programs, current }: { programs: StudyScope[]; current: string }) {
  return (
    <nav aria-label="Môn học" className="flex flex-wrap gap-2">
      {programs.map((program) => {
        const active = program.id === current;
        return (
          <Link
            key={program.id}
            href={programHref(program)}
            aria-current={active ? 'page' : undefined}
            className={`inline-flex h-9 items-center rounded-full px-4 text-[13px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              active
                ? 'bg-[#0A1F5C] text-white'
                : 'border border-[#D5DEEA] bg-white text-slate-600 hover:bg-slate-50'
            }`}
            data-testid="program-tab"
            data-program={program.id}
          >
            {program.title}
          </Link>
        );
      })}
    </nav>
  );
}

/** Same shapes as the path, while reading progress loads from the browser. */
export function PathSkeleton() {
  return (
    <div aria-busy="true" className="mt-4 grid gap-6 xl:grid-cols-[minmax(0,1fr)_288px]">
      <div className="space-y-6">
        <div className={`${cardClass} h-[260px] animate-pulse sm:h-[248px]`} />
        <div className={`${cardClass} space-y-4 p-6`}>
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="flex items-center gap-4">
              <div className="size-12 animate-pulse rounded-2xl bg-slate-100" />
              <div className="h-4 flex-1 animate-pulse rounded bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
      <div className={`${cardClass} hidden h-[320px] animate-pulse xl:block`} />
      <span className="sr-only">Đang tải lộ trình…</span>
    </div>
  );
}

function EmptyProgram() {
  return (
    <section
      className={`${cardClass} mx-auto max-w-[640px] overflow-hidden text-center`}
      data-testid="roadmap-empty"
    >
      <span
        aria-hidden="true"
        className="grid h-40 place-items-center bg-[#EAF1FF]"
        style={{
          backgroundImage:
            'linear-gradient(#C9D9FF 1px, transparent 1px), linear-gradient(90deg, #C9D9FF 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
      >
        <span className="grid size-16 place-items-center rounded-2xl bg-white text-[#2347C4] shadow-[0_10px_30px_-10px_rgba(35,71,196,0.45)]">
          <BookOpen className="size-7" />
        </span>
      </span>
      <div className="p-6 sm:p-8">
        <h2 className="text-[20px] font-extrabold text-[#091224]">Chưa có bài học nào được mở</h2>
        <p className="mx-auto mt-2 max-w-[420px] text-[15px] leading-6 text-slate-500">
          Khi thầy cô mở bài, lộ trình của em sẽ hiện ở đây, sắp theo từng chương.
        </p>
        <Link href="/student/exams" className={`${quietClass} mt-4`}>
          Trong lúc chờ, làm đề ở Luyện thi <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

const cardClass =
  'rounded-[24px] border border-[#E5EBF3] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_12px_32px_-20px_rgba(16,24,40,0.18)]';
const primaryClass =
  'inline-flex min-h-12 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-[#0052FF] px-6 text-center text-[15px] font-bold text-white shadow-[0_8px_20px_-6px_rgba(0,82,255,0.45)] transition hover:bg-[#0044CC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 motion-safe:active:scale-[0.98] sm:w-auto';
const quietClass =
  'inline-flex min-h-10 items-center gap-1.5 rounded-lg text-[14px] font-semibold text-slate-600 underline-offset-4 hover:text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500';
