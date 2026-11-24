'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, Check, ChevronDown } from 'lucide-react';
import { useStudentShell } from '@/components/student/student-shell';
import {
  lessonLearningState,
  useLessonProgress,
  type LessonLearningState,
} from '@/features/lessons/lib/lesson-progress';
import {
  lessonHref,
  nextLessonToRead,
  PRACTICE_HREF,
  programHref,
  readingLabel,
  ROADMAP_HREF,
  type ReadingStep,
  type StudyScope,
} from '@/features/lessons/lib/study-plan';
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
 * "Học": the student's place to read lessons, and only that. It shows the
 * lesson to read next with one button and every lesson with how far it has
 * been read. Practice (results, "làm tiếp", wrong answers) lives on the
 * "Luyện tập" page, so the two pages never offer the same thing.
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

  const chips =
    programs.length > 1 ? <ProgramChips programs={programs} current={scope.id} /> : null;

  if (!progress)
    return (
      <Page>
        {chips}
        {choice && <ProgramBasisNote choice={choice} title={scope.title} />}
        <div aria-hidden="true" className="mt-4 space-y-4">
          <div className="h-[180px] rounded-[20px] bg-white" />
          <div className="h-[320px] rounded-[20px] bg-white" />
        </div>
      </Page>
    );

  const next = nextLessonToRead(scope.lessons, progress);
  const reading = new Map(
    scope.lessons.map((lesson) => [lesson.id, lessonLearningState(progress, lesson.id)])
  );

  return (
    <Page>
      {chips}
      {choice && <ProgramBasisNote choice={choice} title={scope.title} />}
      <div className="mt-4 space-y-4">
        <NextLessonCard next={next} scope={scope} reading={reading} />
        <LessonList scope={scope} reading={reading} nextLessonId={next?.lesson.id ?? null} />
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
    <div className="mx-auto w-full max-w-[760px] pb-12" data-testid="roadmap">
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

// ─── The next step ───────────────────────────────────────────────────────────

function NextLessonCard({
  next,
  scope,
  reading,
}: {
  next: ReadingStep | null;
  scope: StudyScope;
  reading: Map<string, LessonLearningState>;
}) {
  if (!next)
    return (
      <section
        aria-label="Bài tiếp theo"
        className="rounded-[20px] border border-[#E5EBF3] bg-white p-5 sm:p-6"
        data-testid="roadmap-next"
        data-kind="done"
      >
        <h2 className="text-[20px] font-extrabold leading-snug text-[#091224]">
          Em đã học hết các bài đang mở
        </h2>
        <p className="mt-1 text-[15px] text-slate-500">Giờ em làm bài tập để nhớ lâu hơn.</p>
        <Link
          href={PRACTICE_HREF}
          className={`${primaryClass} mt-5`}
          data-testid="roadmap-next-cta"
        >
          Sang Luyện tập <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </section>
    );

  const position = scope.lessons.findIndex((lesson) => lesson.id === next.lesson.id) + 1;
  const status = readingLabel(reading.get(next.lesson.id) ?? { kind: 'new' });

  return (
    <section
      aria-labelledby="roadmap-next-title"
      className="rounded-[20px] border border-[#E5EBF3] bg-white p-5 sm:p-6"
      data-testid="roadmap-next"
      data-kind={next.cta === 'Học tiếp' ? 'resume-lesson' : 'start'}
      data-lesson={next.lesson.id}
    >
      <p className="text-[13px] text-slate-500">
        Bài {position}/{scope.lessons.length} · {readable(next.lesson.chapterTitle)}
      </p>
      <h2
        id="roadmap-next-title"
        className="mt-1.5 text-[22px] font-extrabold leading-tight tracking-tight text-[#091224] sm:text-[26px]"
      >
        {next.lesson.title}
      </h2>
      {status.tone !== 'idle' && (
        <p
          className={`mt-2 text-[14px] font-semibold ${statusTone(status.tone)}`}
          data-testid="roadmap-reason"
        >
          {status.text}
        </p>
      )}
      {next.lesson.description && (
        <p
          className="mt-3 line-clamp-2 text-[14px] leading-6 text-slate-600"
          data-testid="roadmap-next-description"
        >
          {next.lesson.description}
        </p>
      )}
      <Link
        href={lessonHref(next.lesson.id)}
        className={`${primaryClass} mt-5`}
        data-testid="roadmap-next-cta"
      >
        {next.cta} <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
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

function LessonList({
  scope,
  reading,
  nextLessonId,
}: {
  scope: StudyScope;
  reading: Map<string, LessonLearningState>;
  nextLessonId: string | null;
}) {
  const many = scope.chapters.length > 2;
  return (
    <section
      aria-labelledby="roadmap-map"
      className="rounded-[20px] border border-[#E5EBF3] bg-white p-3 sm:p-5"
    >
      <h2 id="roadmap-map" className="px-2 pt-1 text-[16px] font-extrabold text-[#091224]">
        Các bài học
      </h2>
      <ol className="mt-3 space-y-2">
        {scope.chapters.map((chapter, index) => {
          const done = chapter.lessons.filter((l) => reading.get(l.id)?.kind === 'learned').length;
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
              {chapter.lessons.map((lesson) => (
                <LessonRow
                  key={lesson.id}
                  lessonId={lesson.id}
                  title={lesson.title}
                  reading={reading.get(lesson.id) ?? { kind: 'new' }}
                  isNext={lesson.id === nextLessonId}
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
            {done}/{count} đã học
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
  reading,
  isNext,
}: {
  lessonId: string;
  title: string;
  reading: LessonLearningState;
  isNext: boolean;
}) {
  const label = readingLabel(reading);
  return (
    <li className="relative">
      <Link
        href={lessonHref(lessonId)}
        className={`relative flex items-center gap-3 rounded-xl px-4 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
          isNext ? 'bg-[#EEF3FF]' : 'hover:bg-slate-50'
        }`}
        data-testid="roadmap-lesson"
        data-lesson={lessonId}
        data-completed={reading.kind === 'learned'}
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
            {isNext && <span className="sr-only"> (bài tiếp theo)</span>}
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

function EmptyProgram() {
  return (
    <section
      className="rounded-[20px] border border-[#E5EBF3] bg-white p-6 text-center sm:p-10"
      data-testid="roadmap-empty"
    >
      <h2 className="text-[18px] font-extrabold text-[#091224]">Chưa có bài nào được mở</h2>
      <p className="mt-1 text-[15px] text-slate-500">Khi có bài mới, bài sẽ hiện ở đây.</p>
    </section>
  );
}

const primaryClass =
  'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0052FF] px-7 text-center text-[16px] font-bold text-white transition hover:bg-[#0044CC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 sm:w-auto';
