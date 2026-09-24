'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, CircleDot, Layers3, PlayCircle, RotateCcw } from 'lucide-react';
import { studentAssessmentHref } from '@/features/student-experience/lib/assessment-links';
import { getLatestAttempt } from '@/features/student-experience/lib/student-experience-service';
import { CURRICULUM_CHAPTERS, CURRICULUM_EXAM_SETS } from '@/lib/exam-sets/curriculum-data';
import type { CurriculumChapter, CurriculumExamSet } from '@/lib/exam-sets/types';
import styles from './practice.module.css';

type Scope = 'LESSON' | 'CHAPTER';
type PracticeState = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
type Attempt = ReturnType<typeof getLatestAttempt>;

const PRACTICE_CHAPTERS = CURRICULUM_CHAPTERS.filter(
  (chapter) => chapter.subjectId === 'MATH' && chapter.grade === 12
);

const LESSON_SETS = CURRICULUM_EXAM_SETS.filter(
  (set) =>
    set.subjectId === 'MATH' &&
    set.grade === 12 &&
    set.scope === 'LESSON' &&
    set.tier === 'STANDARD'
);

const CHAPTER_SETS = CURRICULUM_EXAM_SETS.filter(
  (set) =>
    set.subjectId === 'MATH' &&
    set.grade === 12 &&
    set.scope === 'CHAPTER' &&
    set.tier === 'STANDARD'
);

const TYPE_STYLES = {
  foundation: {
    label: 'Kiến thức nền',
    badge: 'border-blue-200 bg-blue-50 text-blue-700',
    accent: 'bg-blue-500',
  },
  practice: {
    label: 'Luyện thêm',
    badge: 'border-violet-200 bg-violet-50 text-violet-700',
    accent: 'bg-violet-500',
  },
  synthesis: {
    label: 'Tổng hợp',
    badge: 'border-amber-200 bg-amber-50 text-amber-700',
    accent: 'bg-amber-500',
  },
} as const;

function typeFor(set: CurriculumExamSet) {
  if (set.difficultyLabel === 'Nền tảng' || set.sequence === 1) return TYPE_STYLES.foundation;
  if (set.difficultyLabel === 'Củng cố' || set.sequence === 2) return TYPE_STYLES.practice;
  return TYPE_STYLES.synthesis;
}

function stateFor(set: CurriculumExamSet, attempt: Attempt): PracticeState {
  if (attempt || set.status === 'COMPLETED') return 'COMPLETED';
  if (set.status === 'IN_PROGRESS') return 'IN_PROGRESS';
  return 'NOT_STARTED';
}

function ctaFor(state: PracticeState) {
  if (state === 'COMPLETED') {
    return {
      label: 'Làm lại',
      Icon: RotateCcw,
      className: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
    };
  }
  if (state === 'IN_PROGRESS') {
    return {
      label: 'Luyện tiếp',
      Icon: PlayCircle,
      className: 'border border-blue-600 bg-blue-600 text-white hover:bg-blue-700',
    };
  }
  return {
    label: 'Luyện ngay',
    Icon: ArrowRight,
    className:
      'border border-blue-200 bg-blue-50 text-blue-700 hover:border-blue-300 hover:bg-blue-100',
  };
}

function assessmentHref(set: CurriculumExamSet, title: string) {
  return studentAssessmentHref({
    set,
    kind: 'practice',
    source: '/student/practice',
    title,
    mode: 'PRACTICE',
  });
}

function PracticeStateLabel({ set, attempt }: { set: CurriculumExamSet; attempt: Attempt }) {
  const state = stateFor(set, attempt);

  if (attempt) {
    return (
      <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700">
        <CheckCircle2 size={14} aria-hidden="true" />
        Lần gần nhất {attempt.correct}/{attempt.total}
      </span>
    );
  }

  if (state === 'COMPLETED') {
    return (
      <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700">
        <CheckCircle2 size={14} aria-hidden="true" /> Đã hoàn thành
      </span>
    );
  }

  if (state === 'IN_PROGRESS') {
    return (
      <span className="inline-flex items-center gap-1.5 font-semibold text-violet-700">
        <CircleDot size={14} aria-hidden="true" />
        Đang luyện{set.resumeQuestion ? ` · câu ${set.resumeQuestion}` : ''}
      </span>
    );
  }

  return <span className="font-semibold text-slate-400">Chưa luyện</span>;
}

function PracticeCard({
  set,
  chapter,
  attempt,
}: {
  set: CurriculumExamSet;
  chapter: CurriculumChapter;
  attempt: Attempt;
}) {
  const lesson = chapter.lessons.find((item) => item.id === set.lessonId);
  const title = lesson?.title ?? set.title;
  const state = stateFor(set, attempt);
  const type = typeFor(set);
  const { label: cta, Icon: CtaIcon, className: ctaClassName } = ctaFor(state);

  return (
    <article
      className={`${styles.practiceCard} relative flex min-h-[280px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 sm:p-6`}
    >
      <span className={`absolute inset-x-0 top-0 h-1 ${type.accent}`} aria-hidden="true" />
      <div className="flex items-start justify-between gap-3">
        <span
          className={`rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${type.badge}`}
        >
          {type.label}
        </span>
        <span className="text-xs font-semibold text-slate-400">
          Bài {lesson?.number ?? set.sequence}
        </span>
      </div>

      <div className="mt-5 flex-1">
        <h3 className="text-[17px] font-extrabold leading-6 text-slate-950">{title}</h3>
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">{set.description}</p>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
        <span className="font-bold text-slate-600">{Math.min(set.questionCount, 6)} câu</span>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="min-w-0 text-xs">
          <PracticeStateLabel set={set} attempt={attempt} />
        </div>
        <Link
          href={assessmentHref(set, `${title} · ${set.title}`)}
          className={`inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${ctaClassName}`}
        >
          {cta} <CtaIcon size={15} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}

function LessonLibrary({ attempts }: { attempts: Record<string, Attempt> }) {
  return (
    <div className={`${styles.modeContent} space-y-9`}>
      {PRACTICE_CHAPTERS.map((chapter) => {
        const sets = LESSON_SETS.filter((set) => set.chapterId === chapter.id);
        if (!sets.length) return null;
        const completed = sets.filter(
          (set) => stateFor(set, attempts[set.id]) === 'COMPLETED'
        ).length;

        return (
          <section key={chapter.id} aria-labelledby={`lesson-section-${chapter.id}`}>
            <div className="mb-4 flex items-end justify-between gap-4 border-b border-slate-200 pb-3">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-blue-600">
                  Chương {String(chapter.number).padStart(2, '0')}
                </p>
                <h2
                  id={`lesson-section-${chapter.id}`}
                  className="mt-1 text-lg font-extrabold text-slate-950"
                >
                  {chapter.shortTitle}
                </h2>
              </div>
              <p className="shrink-0 text-xs font-semibold text-slate-500">
                {sets.length} bộ luyện · {completed} đã hoàn thành
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {sets.map((set) => (
                <PracticeCard key={set.id} set={set} chapter={chapter} attempt={attempts[set.id]} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function ChapterLibrary({ attempts }: { attempts: Record<string, Attempt> }) {
  return (
    <div className={`${styles.modeContent} grid gap-5 md:grid-cols-2`}>
      {PRACTICE_CHAPTERS.map((chapter) => {
        const sets = CHAPTER_SETS.filter((set) => set.chapterId === chapter.id);
        if (!sets.length) return null;
        const completed = sets.filter(
          (set) => stateFor(set, attempts[set.id]) === 'COMPLETED'
        ).length;
        const inProgress = sets.find((set) => stateFor(set, attempts[set.id]) === 'IN_PROGRESS');
        const nextSet =
          inProgress ??
          sets.find((set) => stateFor(set, attempts[set.id]) === 'NOT_STARTED') ??
          sets[0];
        const progress = Math.round((completed / sets.length) * 100);
        const cta = inProgress
          ? 'Luyện tiếp chương'
          : completed === sets.length
            ? 'Luyện lại chương'
            : 'Luyện chương này';

        return (
          <article
            key={chapter.id}
            className={`${styles.chapterCard} flex min-h-[320px] flex-col rounded-2xl border border-slate-200 bg-white p-6 sm:p-7`}
          >
            <div className="flex items-start justify-between gap-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                <Layers3 size={19} aria-hidden="true" />
              </span>
              <span className="text-xs font-extrabold uppercase tracking-[0.12em] text-slate-400">
                Chương {String(chapter.number).padStart(2, '0')}
              </span>
            </div>
            <div className="mt-5 flex-1">
              <h2 className="text-xl font-extrabold leading-7 text-slate-950">
                {chapter.shortTitle}
              </h2>
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">{chapter.title}</p>
              <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-slate-500">
                <span>{sets.length} bộ luyện</span>
                <span>{completed} đã hoàn thành</span>
                <span>
                  {sets.reduce((total, set) => total + Math.min(set.questionCount, 6), 0)} câu
                </span>
              </div>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-500">Tiến độ</span>
                <span className="text-slate-800">{progress}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-blue-600 transition-[width] duration-500 motion-reduce:transition-none"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <Link
              href={assessmentHref(nextSet, `${chapter.shortTitle} · ${nextSet.title}`)}
              className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 text-sm font-extrabold text-blue-700 transition-colors hover:border-blue-300 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {cta} <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </article>
        );
      })}
    </div>
  );
}

export default function StudentPracticePage() {
  const [scope, setScope] = React.useState<Scope>('LESSON');
  const [attemptsReady, setAttemptsReady] = React.useState(false);

  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => setAttemptsReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const attempts = React.useMemo(() => {
    if (!attemptsReady) return {};
    return Object.fromEntries(
      [...LESSON_SETS, ...CHAPTER_SETS].map((set) => [set.id, getLatestAttempt('practice', set.id)])
    );
  }, [attemptsReady]);

  return (
    <div className="mx-auto max-w-[1180px] pb-12">
      <header>
        <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-blue-600">
          Toán · Luyện đề
        </p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-[30px]">
          Luyện tập theo kiến thức
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Chọn bài hoặc chương em muốn củng cố.
        </p>
      </header>

      <div
        className="relative mt-6 grid w-full max-w-[390px] grid-cols-2 rounded-2xl border border-slate-200 bg-slate-100/80 p-1.5"
        aria-label="Phạm vi luyện đề"
      >
        <span
          aria-hidden="true"
          className="absolute bottom-1.5 left-1.5 top-1.5 w-[calc((100%-12px)/2)] rounded-xl bg-white shadow-sm ring-1 ring-slate-200/70 transition-transform duration-300 ease-out motion-reduce:transition-none"
          style={{ transform: `translateX(${scope === 'LESSON' ? 0 : 100}%)` }}
        />
        {(['LESSON', 'CHAPTER'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setScope(value)}
            aria-pressed={scope === value}
            className={`relative z-10 min-h-11 rounded-xl px-5 text-sm font-extrabold transition-colors ${
              scope === value ? 'text-blue-700' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {value === 'LESSON' ? 'Theo bài' : 'Theo chương'}
          </button>
        ))}
      </div>

      <div className="mt-8" key={scope}>
        {scope === 'LESSON' ? (
          <LessonLibrary attempts={attempts} />
        ) : (
          <ChapterLibrary attempts={attempts} />
        )}
      </div>
    </div>
  );
}
