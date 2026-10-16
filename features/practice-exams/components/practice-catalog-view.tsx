import * as React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  Check,
  Layers,
  Lock,
  PlayCircle,
  RotateCcw,
  Trophy,
} from 'lucide-react';
import type {
  ChapterEntry,
  LessonEntry,
  PracticeCatalog,
  SetEntry,
} from '@/lib/practice/practice-catalog';
import { lessonHref, practiceHref } from '@/features/lessons/lib/study-plan';
import { AdminPreviewNote } from './admin-preview-note';
import { DifficultyLadder } from './difficulty-ladder';
import { PLUS_SURFACE, PlusRibbon, PlusTag, PlusTexture } from './plus-mark';
import { practicePageHref, setHref, type PracticeView } from '../lib/links';

const primaryButton =
  'inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#0052FF] px-5 text-[14px] font-bold text-white transition-colors hover:bg-[#0044CC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2';
const quietButton =
  'inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[#D5DEEA] bg-white px-4 text-[13px] font-bold text-slate-700 transition-colors hover:border-[#B8C7DD] hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2';
const plusButton =
  'inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#F5B83D] px-5 text-[14px] font-extrabold text-[#2B1C00] transition-colors hover:bg-[#FFC857] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B83D] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A1F5C]';
const plusQuietButton =
  'inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/5 px-5 text-[14px] font-bold text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white';

// ── Lesson rows ──────────────────────────────────────────────────────────────

function lessonStatus(lesson: LessonEntry) {
  if (lesson.inProgress)
    return {
      tone: 'active' as const,
      text: `Đang làm · câu ${Math.min(lesson.inProgress.answered + 1, lesson.inProgress.total)}/${lesson.inProgress.total}`,
    };
  if (lesson.best?.passed)
    return { tone: 'done' as const, text: `Đã đạt · ${lesson.best.correct}/${lesson.best.total}` };
  if (lesson.best)
    return {
      tone: 'attention' as const,
      text: `Chưa đạt · tốt nhất ${lesson.best.correct}/${lesson.best.total}`,
    };
  return { tone: 'idle' as const, text: 'Chưa luyện' };
}

const STATUS_TEXT = {
  active: 'text-[#0052FF]',
  done: 'text-emerald-700',
  attention: 'text-amber-700',
  idle: 'text-slate-500',
} as const;

function LessonMarker({ lesson, index }: { lesson: LessonEntry; index: number }) {
  const status = lessonStatus(lesson);
  if (status.tone === 'done')
    return (
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-emerald-500 text-white">
        <Check className="size-5" strokeWidth={3} aria-hidden="true" />
      </span>
    );
  if (status.tone === 'active' && lesson.inProgress) {
    const ratio = lesson.inProgress.answered / lesson.inProgress.total;
    return (
      <span
        className="grid size-10 shrink-0 place-items-center rounded-full text-[13px] font-extrabold text-[#0052FF]"
        style={{ background: `conic-gradient(#0052FF ${ratio * 360}deg, #DCE7FF 0deg)` }}
      >
        <span className="grid size-[34px] place-items-center rounded-full bg-white">
          {index + 1}
        </span>
      </span>
    );
  }
  return (
    <span
      className={`grid size-10 shrink-0 place-items-center rounded-full text-[13px] font-extrabold ${
        status.tone === 'attention'
          ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
          : 'bg-[#F1F5FB] text-slate-500'
      }`}
    >
      {index + 1}
    </span>
  );
}

function LessonAction({ lesson }: { lesson: LessonEntry }) {
  if (!lesson.questionCount)
    return (
      <Link href={lessonHref(lesson.id)} className={quietButton} data-testid="lesson-read">
        <BookOpen className="size-4" aria-hidden="true" /> Học bài
      </Link>
    );
  if (lesson.inProgress)
    return (
      <Link
        href={practiceHref(lesson.id, lesson.inProgress.attemptId, 'practice')}
        className={primaryButton}
        data-testid="lesson-action"
        data-action="resume"
      >
        Làm tiếp <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    );
  const last = lesson.lastCompleted;
  if (last && !last.passed && last.correct < last.total)
    return (
      <Link
        href={practiceHref(lesson.id, last.attemptId, 'practice')}
        className={quietButton}
        data-testid="lesson-action"
        data-action="mistakes"
      >
        <RotateCcw className="size-4" aria-hidden="true" /> Sửa {last.total - last.correct} câu sai
      </Link>
    );
  if (lesson.best)
    return (
      <Link
        href={practiceHref(lesson.id, undefined, 'practice')}
        className={quietButton}
        data-testid="lesson-action"
        data-action="retry"
      >
        <RotateCcw className="size-4" aria-hidden="true" /> Luyện lại
      </Link>
    );
  return (
    <Link
      href={practiceHref(lesson.id, undefined, 'practice')}
      className={quietButton}
      data-testid="lesson-action"
      data-action="start"
    >
      Bắt đầu <ArrowRight className="size-4" aria-hidden="true" />
    </Link>
  );
}

function LessonRow({ lesson, index }: { lesson: LessonEntry; index: number }) {
  const status = lessonStatus(lesson);
  return (
    <li
      className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-[#E5EBF3] bg-white p-4 sm:flex-nowrap sm:px-5"
      data-testid="lesson-row"
      data-lesson={lesson.id}
      data-status={status.tone}
    >
      <LessonMarker lesson={lesson} index={index} />
      <div className="min-w-0 flex-1 basis-[calc(100%-56px)] sm:basis-auto">
        <h3 className="text-[15px] font-bold leading-6 text-[#091224] sm:text-[16px]">
          {lesson.title}
        </h3>
        {lesson.questionCount ? (
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
            <span className="font-semibold text-slate-600">{lesson.questionCount} câu</span>
            <DifficultyLadder mix={lesson.mix} />
            <span
              className={`font-semibold ${STATUS_TEXT[status.tone]}`}
              data-testid="lesson-status"
            >
              {status.text}
            </span>
          </p>
        ) : (
          <p className="mt-1 text-[13px] text-slate-500" data-testid="lesson-status">
            Chưa có câu luyện tập · em vẫn học bài được
          </p>
        )}
      </div>
      <div className="ml-14 sm:ml-0">
        <LessonAction lesson={lesson} />
      </div>
    </li>
  );
}

// ── Chapter sets ─────────────────────────────────────────────────────────────

function setState(set: SetEntry) {
  if (set.inProgress)
    return `Đang làm · câu ${Math.min(set.inProgress.answered + 1, set.inProgress.total)}/${set.inProgress.total}`;
  if (set.best)
    return `${set.best.passed ? 'Đã đạt' : 'Tốt nhất'} ${set.best.correct}/${set.best.total} · ${set.completedCount} lần`;
  return null;
}

function setAction(set: SetEntry) {
  if (set.inProgress)
    return { href: setHref(set.kind, set.chapterId, set.inProgress.attemptId), label: 'Làm tiếp' };
  return { href: setHref(set.kind, set.chapterId), label: set.best ? 'Làm lại' : 'Bắt đầu' };
}

/** The facts a set really has; a zero is left out instead of shown. */
function synthesisFacts(set: SetEntry): string[] {
  const { facts } = set;
  return [
    `${facts.questionCount} câu`,
    facts.lessonsLinked >= 2 ? `Nối ${facts.lessonsLinked} bài` : null,
    facts.demandingCount ? `${facts.demandingCount} câu nâng cao` : null,
    facts.curatedCount ? `${facts.curatedCount} câu chọn lọc có ghi chú` : null,
  ].filter((fact): fact is string => Boolean(fact));
}

export function SynthesisCard({
  set,
  chapterNumber,
  layout = 'wide',
}: {
  set: SetEntry;
  chapterNumber: number;
  layout?: 'wide' | 'tile';
}) {
  const state = setState(set);
  const action = setAction(set);
  return (
    <article
      className={`${PLUS_SURFACE} p-5 sm:p-6`}
      data-testid="synthesis-card"
      data-locked={set.locked}
      data-chapter={set.chapterId}
    >
      <PlusTexture />
      <PlusRibbon />
      <div
        className={`relative flex h-full flex-col gap-5 ${layout === 'wide' ? 'lg:flex-row lg:items-end lg:justify-between' : ''}`}
      >
        <div className="min-w-0 pr-12">
          <p className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-[#F5B83D]">
            Tổng hợp · Chương {chapterNumber}
          </p>
          <h3 className="mt-1.5 text-[19px] font-extrabold leading-7 text-white sm:text-[21px]">
            {set.chapterTitle}
          </h3>
          <p className="mt-1.5 max-w-[56ch] text-[14px] leading-6 text-white/75">
            Câu hỏi nối nhiều bài trong chương, khó dần, để em luyện cách phối hợp kiến thức.
          </p>
          <ul className="mt-4 flex flex-wrap gap-2" aria-label="Bộ này gồm">
            {synthesisFacts(set).map((fact) => (
              <li
                key={fact}
                className="rounded-full bg-white/10 px-3 py-1 text-[12px] font-semibold text-white/90 ring-1 ring-white/15"
              >
                {fact}
              </li>
            ))}
            <li className="flex items-center rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/15">
              <DifficultyLadder mix={set.facts.mix} tone="dark" />
            </li>
          </ul>
        </div>
        <div
          className={`flex shrink-0 flex-col gap-2 ${layout === 'wide' ? 'lg:items-end' : 'mt-auto'}`}
        >
          {set.locked ? (
            <>
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-white/80">
                <Lock className="size-3.5" aria-hidden="true" /> Dành cho tài khoản Tú Tài Plus
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
            <>
              {state && (
                <p className="text-[13px] font-semibold text-white/80" data-testid="set-state">
                  {state}
                </p>
              )}
              <Link
                href={action.href}
                className={plusButton}
                data-testid="synthesis-action"
                data-action={set.inProgress ? 'resume' : set.best ? 'retry' : 'start'}
              >
                {action.label} <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

function ReviewTile({ set }: { set: SetEntry }) {
  const state = setState(set);
  const action = setAction(set);
  return (
    <article
      className="relative flex h-full flex-col overflow-hidden rounded-[24px] border border-[#DCE6F7] bg-white p-5 sm:p-6"
      data-testid="review-card"
      data-chapter={set.chapterId}
    >
      <span className="absolute inset-y-0 left-0 w-1.5 bg-[#0052FF]" aria-hidden="true" />
      <p className="flex items-center gap-1.5 text-[12px] font-extrabold uppercase tracking-[0.14em] text-[#0052FF]">
        <Layers className="size-3.5" aria-hidden="true" /> Ôn chương · Miễn phí
      </p>
      <h3 className="mt-1.5 text-[18px] font-extrabold leading-7 text-[#091224]">
        Trộn câu của {set.facts.lessonsLinked} bài
      </h3>
      <p className="mt-1.5 text-[14px] leading-6 text-slate-600">
        Câu luyện tập của từng bài, đảo lẫn với nhau, để em ôn cả chương trong một lượt.
      </p>
      <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
        <span className="font-semibold text-slate-600">{set.facts.questionCount} câu</span>
        <DifficultyLadder mix={set.facts.mix} />
      </p>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
        <span className="text-[13px] font-semibold text-slate-500" data-testid="set-state">
          {state ?? 'Chưa luyện'}
        </span>
        <Link href={action.href} className={quietButton} data-testid="review-action">
          {action.label} <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}

// ── Page sections ────────────────────────────────────────────────────────────

function passedLessons(chapter: ChapterEntry) {
  const withPractice = chapter.lessons.filter((lesson) => lesson.questionCount > 0);
  return {
    passed: withPractice.filter((lesson) => lesson.best?.passed).length,
    total: withPractice.length,
  };
}

function ChapterHeading({ chapter }: { chapter: ChapterEntry }) {
  const { passed, total } = passedLessons(chapter);
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
      <div className="min-w-0">
        <p className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
          Chương {chapter.number}
        </p>
        <h2 className="mt-0.5 text-[19px] font-extrabold leading-7 tracking-tight text-[#091224] sm:text-[21px]">
          {chapter.title}
        </h2>
      </div>
      {total > 0 && (
        <div className="flex items-center gap-3" data-testid="chapter-progress">
          <span className="text-[13px] font-semibold text-slate-600">
            Đạt {passed}/{total} bài
          </span>
          <span className="h-1.5 w-24 overflow-hidden rounded-full bg-[#E5EBF3]" aria-hidden="true">
            <span
              className="block h-full rounded-full bg-emerald-500"
              style={{ width: `${(passed / total) * 100}%` }}
            />
          </span>
        </div>
      )}
    </div>
  );
}

function ByLesson({ chapters }: { chapters: ChapterEntry[] }) {
  return (
    <div className="space-y-10">
      {chapters.map((chapter) => (
        <section
          key={chapter.id}
          aria-labelledby={`ch-${chapter.id}`}
          data-testid="chapter-section"
        >
          <div id={`ch-${chapter.id}`}>
            <ChapterHeading chapter={chapter} />
          </div>
          <ol className="mt-4 space-y-2.5">
            {chapter.lessons.map((lesson, index) => (
              <LessonRow key={lesson.id} lesson={lesson} index={index} />
            ))}
          </ol>
          {chapter.synthesis && (
            <div className="mt-4">
              <SynthesisCard set={chapter.synthesis} chapterNumber={chapter.number} />
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

function ByChapter({ chapters }: { chapters: ChapterEntry[] }) {
  return (
    <div className="space-y-6">
      {chapters.map((chapter) => (
        <section
          key={chapter.id}
          className="rounded-[28px] border border-[#E5EBF3] bg-[#F8FAFE] p-4 sm:p-6"
          aria-labelledby={`chc-${chapter.id}`}
          data-testid="chapter-card"
        >
          <div id={`chc-${chapter.id}`}>
            <ChapterHeading chapter={chapter} />
          </div>
          {chapter.review || chapter.synthesis ? (
            <div
              className={`mt-5 grid gap-4 ${chapter.review && chapter.synthesis ? 'lg:grid-cols-2' : ''}`}
            >
              {chapter.review && <ReviewTile set={chapter.review} />}
              {chapter.synthesis && (
                <SynthesisCard
                  set={chapter.synthesis}
                  chapterNumber={chapter.number}
                  layout={chapter.review ? 'tile' : 'wide'}
                />
              )}
            </div>
          ) : (
            <p
              className="mt-4 rounded-2xl bg-white p-4 text-[14px] leading-6 text-slate-600"
              data-testid="chapter-no-sets"
            >
              Chương này chưa có bộ luyện cả chương. Bộ Ôn chương mở khi có từ 2 bài có câu luyện
              tập; em luyện từng bài ở mục <span className="font-semibold">Theo bài</span>.
            </p>
          )}
        </section>
      ))}
    </div>
  );
}

function ResumeCard({ catalog }: { catalog: PracticeCatalog }) {
  const resume = catalog.resume;
  if (!resume) return null;
  const href =
    resume.kind === 'LESSON'
      ? practiceHref(resume.id, resume.attemptId, 'practice')
      : setHref(resume.kind, resume.id, resume.attemptId);
  const label =
    resume.kind === 'LESSON' ? resume.title : `${resume.title} · ${resume.chapterTitle}`;
  return (
    <section
      className="mt-6 flex flex-col gap-4 rounded-[24px] border border-[#CFE0FF] bg-gradient-to-r from-[#F2F7FF] to-white p-5 sm:flex-row sm:items-center sm:p-6"
      aria-label="Tiếp tục luyện tập"
      data-testid="practice-resume"
    >
      <span className="hidden size-12 shrink-0 place-items-center rounded-2xl bg-[#0052FF] text-white sm:grid">
        <PlayCircle className="size-6" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-[#0052FF]">
          Em đang làm dở
        </p>
        <h2 className="mt-0.5 truncate text-[17px] font-extrabold text-[#091224] sm:text-[18px]">
          {label}
        </h2>
        <div className="mt-2 flex items-center gap-3">
          <span className="h-1.5 w-40 overflow-hidden rounded-full bg-[#DCE7FF]" aria-hidden="true">
            <span
              className="block h-full rounded-full bg-[#0052FF]"
              style={{ width: `${(resume.answered / resume.total) * 100}%` }}
            />
          </span>
          <span className="text-[13px] font-semibold text-slate-600">
            {resume.answered}/{resume.total} câu
          </span>
        </div>
      </div>
      <Link href={href} className={primaryButton} data-testid="practice-resume-action">
        Làm tiếp <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </section>
  );
}

function PlusNote({ catalog }: { catalog: PracticeCatalog }) {
  if (catalog.previewAsAdmin) {
    const total = catalog.chapters.length;
    const open = catalog.chapters.filter((chapter) => chapter.synthesis).length;
    const review = catalog.chapters.filter((chapter) => chapter.review).length;
    return (
      <AdminPreviewNote>
        Bộ Tổng hợp đã xuất bản mở để bạn kiểm tra mà không cần gói Plus; học sinh không có Plus vẫn
        bị khoá.{' '}
        <span data-testid="admin-preview-counts">
          {catalog.program?.title}: {open}/{total} chương có bộ Tổng hợp, {review}/{total} chương có
          bộ Ôn chương.
        </span>
      </AdminPreviewNote>
    );
  }
  if (!catalog.chapters.some((chapter) => chapter.synthesis)) return null;
  return (
    <p
      className="mt-4 flex items-start gap-2.5 text-[13px] leading-6 text-slate-600"
      data-testid="plus-note"
    >
      <PlusTag tone="light" />
      <span>
        {catalog.hasPlus
          ? 'Tài khoản của em có Tú Tài Plus: các bộ Tổng hợp đã mở.'
          : 'Bộ Tổng hợp gom câu nối nhiều bài và câu khó hơn của chương, dành cho tài khoản Tú Tài Plus. Em vẫn xem được mỗi bộ gồm những gì.'}
      </span>
    </p>
  );
}

function Tabs({ catalog, view }: { catalog: PracticeCatalog; view: PracticeView }) {
  const tabs: { id: PracticeView; label: string; hint: string }[] = [
    { id: 'lesson', label: 'Theo bài', hint: 'Củng cố từng bài' },
    { id: 'chapter', label: 'Theo chương', hint: 'Ôn và tổng hợp' },
  ];
  return (
    <nav
      className="mt-7 grid w-full max-w-[440px] grid-cols-2 gap-1 rounded-2xl bg-[#EEF2F8] p-1"
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
            className={`rounded-xl px-4 py-2 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              active ? 'bg-white shadow-sm ring-1 ring-[#DCE4F0]' : 'hover:bg-white/60'
            }`}
            data-testid={`tab-${tab.id}`}
          >
            <span
              className={`block text-[14px] font-extrabold ${active ? 'text-[#0052FF]' : 'text-slate-600'}`}
            >
              {tab.label}
            </span>
            <span className="block text-[11px] font-semibold text-slate-500">{tab.hint}</span>
          </Link>
        );
      })}
    </nav>
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
  const withPractice = lessons.filter((lesson) => lesson.questionCount > 0);
  const passed = withPractice.filter((lesson) => lesson.best?.passed).length;

  return (
    <div className="mx-auto w-full max-w-[1080px] pb-14" data-testid="practice-page">
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <p className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-[#0052FF] md:flex md:min-h-8 md:items-center md:pl-12 lg:block lg:min-h-0 lg:pl-0">
            {program ? `${program.title} · Luyện tập` : 'Luyện tập'}
          </p>
          <h1 className="mt-1 text-[28px] font-extrabold tracking-tight text-[#091224] sm:text-[32px]">
            Luyện tập
          </h1>
          <p className="mt-1.5 max-w-[60ch] text-[15px] leading-6 text-slate-600">
            Củng cố từng bài, chấm ngay sau mỗi câu. Khi đã vững, ôn cả chương và thử bộ Tổng hợp.
          </p>
        </div>
        {withPractice.length > 0 && (
          <div
            className="flex items-center gap-3 rounded-2xl border border-[#E5EBF3] bg-white px-4 py-3"
            data-testid="practice-summary"
          >
            <Trophy className="size-4 text-emerald-600" aria-hidden="true" />
            <span className="text-[14px] font-semibold text-slate-700">
              Đã đạt <span className="font-extrabold text-[#091224]">{passed}</span>/
              {withPractice.length} bài
            </span>
          </div>
        )}
      </header>

      {catalog.programs.length > 1 && (
        <nav className="mt-5 flex flex-wrap gap-2" aria-label="Chọn môn">
          {catalog.programs.map((item) => {
            const active = item.id === program?.id;
            return (
              <Link
                key={item.id}
                href={practicePageHref(item, view)}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex h-9 items-center rounded-full px-4 text-[13px] font-bold transition-colors ${
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
      )}

      {!program ? (
        <section
          className="mt-8 rounded-[24px] border border-[#E5EBF3] bg-white p-8 text-center sm:p-12"
          data-testid="practice-empty"
        >
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#F1F5FB] text-slate-500">
            <BookOpen className="size-6" aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-[20px] font-extrabold text-[#091224]">
            Chưa có bài nào để luyện tập
          </h2>
          <p className="mx-auto mt-2 max-w-[44ch] text-[15px] leading-6 text-slate-600">
            Khi thầy cô xuất bản bài học và câu luyện tập, các bài sẽ xuất hiện ở đây.
          </p>
          <Link href="/student/roadmap" className={`${quietButton} mt-6`}>
            Về Lộ trình
          </Link>
        </section>
      ) : (
        <>
          <ResumeCard catalog={catalog} />
          <Tabs catalog={catalog} view={view} />
          <PlusNote catalog={catalog} />
          {withPractice.length === 0 && (
            <p
              className="mt-6 rounded-2xl border border-dashed border-[#D5DEEA] bg-white p-4 text-[14px] leading-6 text-slate-600"
              data-testid="practice-sparse"
            >
              Các bài của {program.title} chưa có câu luyện tập. Em vẫn học bài được; câu hỏi sẽ
              xuất hiện ở đây khi thầy cô soạn xong.
            </p>
          )}
          <div className="mt-8">
            {view === 'chapter' ? (
              <ByChapter chapters={catalog.chapters} />
            ) : (
              <ByLesson chapters={catalog.chapters} />
            )}
          </div>
        </>
      )}
    </div>
  );
}
