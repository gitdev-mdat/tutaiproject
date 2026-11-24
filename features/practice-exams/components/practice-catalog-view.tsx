import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen, Check, Lock, RotateCcw } from 'lucide-react';
import type {
  ChapterEntry,
  LessonEntry,
  PracticeCatalog,
  SetEntry,
} from '@/lib/practice/practice-catalog';
import {
  attemptStatus,
  lessonAction,
  lessonStatus,
  nextLessonId,
  passedCount,
  type StatusTone,
} from '@/lib/practice/catalog-status';
import { lessonHref, practiceHref } from '@/features/lessons/lib/study-plan';
import { AdminPreviewBar } from './admin-preview-note';
import { DifficultyLadder } from './difficulty-ladder';
import { PLUS_SURFACE, PlusRibbon, PlusTexture } from './plus-mark';
import { practicePageHref, setHref, type PracticeView } from '../lib/links';

/*
 * The Practice page answers three questions, in this order:
 * what is open (one resume strip), what each lesson's result is (one status
 * line per row), and what to do (one action per row; the page's main action
 * is the only filled button). The sidebar already names the page and the
 * chapter headings name the subject, so neither is repeated here.
 */

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2';
const primaryButton = `inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#0052FF] px-4 text-[14px] font-bold text-white transition-colors hover:bg-[#0044CC] ${focusRing}`;
const quietButton = `inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[#D5DEEA] bg-white px-4 text-[14px] font-bold text-slate-700 transition-colors hover:border-[#B8C7DD] hover:bg-slate-50 ${focusRing}`;
const plusButton =
  'inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#F5B83D] px-4 text-[14px] font-extrabold text-[#2B1C00] transition-colors hover:bg-[#FFC857] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B83D] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A1F5C]';
const plusQuietButton =
  'inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-white/25 bg-white/5 px-4 text-[14px] font-bold text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white';

const STATUS_TEXT: Record<StatusTone, string> = {
  empty: 'text-slate-500',
  idle: 'text-slate-500',
  active: 'font-semibold text-[#0052FF]',
  attention: 'font-semibold text-amber-700',
  done: 'font-semibold text-emerald-700',
};

// ── Lesson rows ──────────────────────────────────────────────────────────────

function LessonMarker({
  lesson,
  tone,
  index,
}: {
  lesson: LessonEntry;
  tone: StatusTone;
  index: number;
}) {
  if (tone === 'done')
    return (
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-emerald-500 text-white">
        <Check className="size-[18px]" strokeWidth={3} aria-hidden="true" />
      </span>
    );
  if (tone === 'active' && lesson.inProgress) {
    const ratio = lesson.inProgress.answered / lesson.inProgress.total;
    return (
      <span
        className="grid size-9 shrink-0 place-items-center rounded-full text-[13px] font-extrabold text-[#0052FF]"
        style={{ background: `conic-gradient(#0052FF ${ratio * 360}deg, #DCE7FF 0deg)` }}
        aria-hidden="true"
      >
        <span className="grid size-[30px] place-items-center rounded-full bg-white">
          {index + 1}
        </span>
      </span>
    );
  }
  return (
    <span
      className={`grid size-9 shrink-0 place-items-center rounded-full text-[13px] font-extrabold ${
        tone === 'attention'
          ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
          : 'bg-[#F1F5FB] text-slate-500'
      }`}
      aria-hidden="true"
    >
      {index + 1}
    </span>
  );
}

function LessonActionLink({ lesson, primary }: { lesson: LessonEntry; primary: boolean }) {
  const action = lessonAction(lesson);
  const className = primary ? primaryButton : quietButton;
  const describedBy = `lesson-${lesson.id}`;
  switch (action.kind) {
    case 'read':
      return (
        <Link
          href={lessonHref(lesson.id)}
          className={quietButton}
          data-testid="lesson-read"
          aria-describedby={describedBy}
        >
          <BookOpen className="size-4" aria-hidden="true" /> Học bài
        </Link>
      );
    case 'resume':
      return (
        <Link
          href={practiceHref(lesson.id, action.attemptId, 'practice')}
          className={className}
          data-testid="lesson-action"
          data-action="resume"
          aria-describedby={describedBy}
        >
          Làm tiếp <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      );
    case 'mistakes':
      // Opens the finished session: each question with its solution, then "Luyện lại n câu sai".
      return (
        <Link
          href={practiceHref(lesson.id, action.attemptId, 'practice')}
          className={className}
          data-testid="lesson-action"
          data-action="mistakes"
          data-count={action.count}
          aria-describedby={describedBy}
        >
          <RotateCcw className="size-4" aria-hidden="true" /> {action.label}
        </Link>
      );
    case 'retry':
      return (
        <Link
          href={practiceHref(lesson.id, undefined, 'practice')}
          className={className}
          data-testid="lesson-action"
          data-action="retry"
          aria-describedby={describedBy}
        >
          <RotateCcw className="size-4" aria-hidden="true" /> Luyện lại
        </Link>
      );
    case 'start':
      return (
        <Link
          href={practiceHref(lesson.id, undefined, 'practice')}
          className={className}
          data-testid="lesson-action"
          data-action="start"
          aria-describedby={describedBy}
        >
          Bắt đầu <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      );
  }
}

function LessonRow({
  lesson,
  index,
  primary,
}: {
  lesson: LessonEntry;
  index: number;
  primary: boolean;
}) {
  const status = lessonStatus(lesson);
  const wide = lessonAction(lesson).kind === 'mistakes';
  return (
    <li
      className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border bg-white px-3 py-3 sm:flex-nowrap sm:gap-4 sm:px-4 ${
        primary ? 'border-[#B9CEFF]' : 'border-[#E5EBF3]'
      }`}
      data-testid="lesson-row"
      data-lesson={lesson.id}
      data-status={status.tone}
      data-next={primary || undefined}
    >
      <LessonMarker lesson={lesson} tone={status.tone} index={index} />
      <div
        className={`min-w-0 flex-1 ${wide ? 'basis-[calc(100%-48px)] sm:basis-auto' : ''}`}
        id={`lesson-${lesson.id}`}
      >
        <h3 className="text-[15px] font-bold leading-6 text-[#091224]">{lesson.title}</h3>
        <p
          className={`text-[13px] leading-5 ${STATUS_TEXT[status.tone]}`}
          data-testid="lesson-status"
        >
          {status.text}
        </p>
      </div>
      {/* A long label ("Xem 6 câu còn sai") goes under the title on phones, so the title keeps its width. */}
      <div className={wide ? 'ml-12 sm:ml-0' : undefined}>
        <LessonActionLink lesson={lesson} primary={primary} />
      </div>
    </li>
  );
}

// ── Chapter sets ─────────────────────────────────────────────────────────────

function setAction(set: SetEntry) {
  if (set.inProgress)
    return { href: setHref(set.kind, set.chapterId, set.inProgress.attemptId), label: 'Làm tiếp' };
  return { href: setHref(set.kind, set.chapterId), label: set.best ? 'Làm lại' : 'Bắt đầu' };
}

/** The facts a set really has; a zero is left out instead of shown. */
function synthesisFacts(set: SetEntry): string[] {
  const { facts } = set;
  return [
    facts.lessonsLinked >= 2 ? `Nối ${facts.lessonsLinked} bài` : null,
    facts.demandingCount ? `${facts.demandingCount} câu nâng cao` : null,
    facts.curatedCount ? `${facts.curatedCount} câu chọn lọc có ghi chú` : null,
  ].filter((fact): fact is string => Boolean(fact));
}

export function SynthesisCard({ set }: { set: SetEntry }) {
  const status = attemptStatus(set, set.facts.questionCount);
  const action = setAction(set);
  return (
    <article
      className={`${PLUS_SURFACE} p-5`}
      data-testid="synthesis-card"
      data-locked={set.locked}
      data-chapter={set.chapterId}
    >
      <PlusTexture />
      <PlusRibbon />
      <div className="relative flex h-full flex-col gap-4">
        <div className="min-w-0 pr-12">
          <h3 className="text-[17px] font-extrabold leading-7 text-white">Tổng hợp</h3>
          <p className="text-[13px] text-white/75" data-testid="set-state">
            {set.locked ? `${set.facts.questionCount} câu` : status.text}
          </p>
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Bộ này gồm">
            {synthesisFacts(set).map((fact) => (
              <li
                key={fact}
                className="rounded-full bg-white/10 px-2.5 py-0.5 text-[12px] font-semibold text-white/90 ring-1 ring-white/15"
              >
                {fact}
              </li>
            ))}
            <li className="flex items-center rounded-full bg-white/10 px-2.5 py-0.5 ring-1 ring-white/15">
              <DifficultyLadder mix={set.facts.mix} tone="dark" />
            </li>
          </ul>
        </div>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
          {set.locked ? (
            <>
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-white/80">
                <Lock className="size-3.5" aria-hidden="true" /> Cần Tú Tài Plus
              </p>
              <Link
                href={setHref(set.kind, set.chapterId)}
                className={plusQuietButton}
                data-testid="synthesis-action"
                data-action="preview"
              >
                Xem bộ này gồm gì
              </Link>
            </>
          ) : (
            <Link
              href={action.href}
              className={`${plusButton} ml-auto`}
              data-testid="synthesis-action"
              data-action={set.inProgress ? 'resume' : set.best ? 'retry' : 'start'}
            >
              {action.label} <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

function ReviewCard({ set }: { set: SetEntry }) {
  const status = attemptStatus(set, set.facts.questionCount);
  const action = setAction(set);
  return (
    <article
      className="flex h-full flex-col gap-4 rounded-[24px] border border-[#DCE6F7] bg-white p-5"
      data-testid="review-card"
      data-chapter={set.chapterId}
    >
      <div>
        <h3 className="text-[17px] font-extrabold leading-7 text-[#091224]">Ôn chương</h3>
        <p className={`text-[13px] ${STATUS_TEXT[status.tone]}`} data-testid="set-state">
          {status.text}
        </p>
        <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-slate-600">
          <span>Trộn câu của {set.facts.lessonsLinked} bài</span>
          <DifficultyLadder mix={set.facts.mix} />
        </p>
      </div>
      <Link
        href={action.href}
        className={`${set.inProgress ? primaryButton : quietButton} mt-auto self-end`}
        data-testid="review-action"
      >
        {action.label} <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </article>
  );
}

// ── Page sections ────────────────────────────────────────────────────────────

function ChapterHeading({ chapter, id }: { chapter: ChapterEntry; id: string }) {
  const { passed, total } = passedCount(chapter.lessons);
  return (
    <div className="flex items-baseline justify-between gap-4 px-1">
      <h2 id={id} className="min-w-0 text-[17px] font-extrabold leading-7 text-[#091224]">
        <span className="mr-1.5 font-bold text-slate-400">Chương {chapter.number}</span>
        {chapter.title}
      </h2>
      {total > 0 && (
        <p
          className="shrink-0 text-[13px] font-semibold text-slate-500"
          data-testid="chapter-progress"
        >
          {passed}/{total} bài đạt
        </p>
      )}
    </div>
  );
}

function ByLesson({ chapters, next }: { chapters: ChapterEntry[]; next: string | null }) {
  return (
    <div className="space-y-8">
      {chapters.map((chapter) => (
        <section
          key={chapter.id}
          aria-labelledby={`ch-${chapter.id}`}
          data-testid="chapter-section"
        >
          <ChapterHeading chapter={chapter} id={`ch-${chapter.id}`} />
          <ol className="mt-3 space-y-2">
            {chapter.lessons.map((lesson, index) => (
              <LessonRow
                key={lesson.id}
                lesson={lesson}
                index={index}
                primary={lesson.id === next}
              />
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

function ByChapter({ chapters, lessonView }: { chapters: ChapterEntry[]; lessonView: string }) {
  return (
    <div className="space-y-8">
      {chapters.map((chapter) => (
        <section key={chapter.id} aria-labelledby={`chc-${chapter.id}`} data-testid="chapter-card">
          <ChapterHeading chapter={chapter} id={`chc-${chapter.id}`} />
          {chapter.review || chapter.synthesis ? (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {chapter.review && <ReviewCard set={chapter.review} />}
              {chapter.synthesis && <SynthesisCard set={chapter.synthesis} />}
            </div>
          ) : (
            <p
              className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl border border-dashed border-[#D5DEEA] bg-white px-4 py-3 text-[14px] text-slate-600"
              data-testid="chapter-no-sets"
            >
              Chưa có bộ ôn cho chương này.
              <Link
                href={lessonView}
                replace
                scroll={false}
                className="inline-flex min-h-8 items-center gap-1 rounded-md font-bold text-[#0052FF] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                Luyện theo bài <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </p>
          )}
        </section>
      ))}
    </div>
  );
}

/** The one session left open: the page's main action when there is one. */
function ResumeStrip({ catalog }: { catalog: PracticeCatalog }) {
  const resume = catalog.resume;
  if (!resume) return null;
  const href =
    resume.kind === 'LESSON'
      ? practiceHref(resume.id, resume.attemptId, 'practice')
      : setHref(resume.kind, resume.id, resume.attemptId);
  const title =
    resume.kind === 'LESSON' ? resume.title : `${resume.title} · ${resume.chapterTitle}`;
  return (
    <section
      className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-[#CFE0FF] bg-[#F2F7FF] px-4 py-3"
      aria-label="Bài em đang làm dở"
      data-testid="practice-resume"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-bold text-[#091224]">{title}</p>
        <div className="mt-1.5 flex items-center gap-2.5">
          <span
            className="h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-[#DCE7FF]"
            role="progressbar"
            aria-label="Số câu đã làm"
            aria-valuenow={resume.answered}
            aria-valuemin={0}
            aria-valuemax={resume.total}
          >
            <span
              className="block h-full rounded-full bg-[#0052FF]"
              style={{ width: `${(resume.answered / resume.total) * 100}%` }}
            />
          </span>
          <span className="whitespace-nowrap text-[13px] font-semibold text-slate-600">
            Đang làm · {resume.answered}/{resume.total} câu
          </span>
        </div>
      </div>
      <Link href={href} className={primaryButton} data-testid="practice-resume-action">
        Làm tiếp <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </section>
  );
}

/** Seen only by a server-verified admin; students' pages never render it. */
function AdminNote({ catalog }: { catalog: PracticeCatalog }) {
  if (!catalog.previewAsAdmin) return null;
  const total = catalog.chapters.length;
  const open = catalog.chapters.filter((chapter) => chapter.synthesis).length;
  const review = catalog.chapters.filter((chapter) => chapter.review).length;
  return (
    <AdminPreviewBar>
      Tổng hợp mở để kiểm tra, không qua gói Plus.{' '}
      <span data-testid="admin-preview-counts">
        {catalog.program?.title}: {open}/{total} chương có Tổng hợp, {review}/{total} có Ôn chương.
      </span>
    </AdminPreviewBar>
  );
}

function Toolbar({ catalog, view }: { catalog: PracticeCatalog; view: PracticeView }) {
  const tabs: { id: PracticeView; label: string }[] = [
    { id: 'lesson', label: 'Theo bài' },
    { id: 'chapter', label: 'Theo chương' },
  ];
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {catalog.programs.length > 1 ? (
        <nav className="flex flex-wrap gap-2" aria-label="Môn học">
          {catalog.programs.map((item) => {
            const active = item.id === catalog.program?.id;
            return (
              <Link
                key={item.id}
                href={practicePageHref(item, view)}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex h-9 items-center rounded-full px-4 text-[13px] font-bold transition-colors ${focusRing} ${
                  active
                    ? 'bg-[#0A1F5C] text-white'
                    : 'border border-[#D5DEEA] bg-white text-slate-600 hover:bg-slate-50'
                }`}
                data-testid="program-chip"
              >
                {item.title}
              </Link>
            );
          })}
        </nav>
      ) : (
        <span />
      )}
      <nav
        className="grid grid-cols-2 gap-1 rounded-xl bg-[#EEF2F8] p-1"
        aria-label="Cách luyện tập"
      >
        {tabs.map((tab) => {
          const active = tab.id === view;
          return (
            <Link
              key={tab.id}
              href={practicePageHref(catalog.program, tab.id)}
              replace
              scroll={false}
              aria-current={active ? 'page' : undefined}
              className={`inline-flex h-8 items-center justify-center rounded-lg px-4 text-[13px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                active
                  ? 'bg-white text-[#0052FF] shadow-sm ring-1 ring-[#DCE4F0]'
                  : 'text-slate-600 hover:bg-white/60'
              }`}
              data-testid={`tab-${tab.id}`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function PracticeCatalogView({
  catalog,
  view,
}: {
  catalog: PracticeCatalog;
  view: PracticeView;
}) {
  const program = catalog.program;
  const lessons = catalog.chapters.flatMap((chapter) => chapter.lessons);
  // With a session open, "Làm tiếp" is the main action; otherwise the next lesson to pass.
  const next = catalog.resume ? null : nextLessonId(lessons);

  return (
    <div className="mx-auto w-full max-w-[960px] pb-14" data-testid="practice-page">
      {/* The sidebar names the page on wide screens; next to the menu button on small ones. */}
      <h1 className="-mt-12 flex min-h-10 items-center pl-12 text-[17px] font-extrabold md:-mt-2 text-[#091224] lg:sr-only">
        Luyện tập
      </h1>

      {!program ? (
        <section
          className="mt-6 rounded-[24px] border border-[#E5EBF3] bg-white p-8 text-center sm:p-12"
          data-testid="practice-empty"
        >
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#F1F5FB] text-slate-500">
            <BookOpen className="size-5" aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-[18px] font-extrabold text-[#091224]">
            Chưa có bài nào để luyện
          </h2>
          <Link href="/student/roadmap" className={`${quietButton} mt-5`}>
            Về Lộ trình
          </Link>
        </section>
      ) : (
        <div className="mt-4 space-y-5 lg:mt-0">
          <Toolbar catalog={catalog} view={view} />
          <AdminNote catalog={catalog} />
          <ResumeStrip catalog={catalog} />
          {view === 'chapter' ? (
            <ByChapter
              chapters={catalog.chapters}
              lessonView={practicePageHref(program, 'lesson')}
            />
          ) : (
            <ByLesson chapters={catalog.chapters} next={next} />
          )}
        </div>
      )}
    </div>
  );
}
