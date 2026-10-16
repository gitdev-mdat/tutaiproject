'use client';

import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { useStudentShell } from '@/components/student/student-shell';
import type { LessonPracticeOverview } from '@/lib/practice/practice-service';
import { JourneyCheckpoint } from '@/features/roadmap/components/journey-checkpoint';
import { useLessonProgress } from '../lib/lesson-progress';
import {
  pickNextStep,
  programHref,
  type NextStep,
  type StudyScope,
  type Summaries,
} from '../lib/study-plan';

type Action = { href: string; label: string; testId?: string };

const primaryClass =
  'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0052FF] px-6 text-center text-[15px] font-bold text-white shadow-[0_8px_20px_rgba(0,82,255,0.2)] transition hover:bg-[#0044CC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 sm:w-auto';
const linkClass =
  'inline-flex min-h-10 items-center gap-1 rounded-lg text-[14px] font-semibold text-slate-600 underline-offset-4 hover:text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500';

const later = (action: Action): Action => ({
  ...action,
  label: `Để sau, ${action.label.charAt(0).toLocaleLowerCase('vi-VN')}${action.label.slice(1)}`,
});

/** The label of a button that takes the student to the plan's next step. */
export function nextStepLabel(step: NextStep) {
  return `${step.cta}: ${step.lesson.title}`;
}

/**
 * What to do after the lesson, as one decision: where the lesson leaves the
 * student on their journey (the Roadmap's progress, updated), a status line
 * about the lesson's practice, one primary action and at most one quiet
 * alternative. Practice comes first until it is passed; then the plan's next
 * step does, chosen by the same rule as the Roadmap
 * (features/lessons/lib/study-plan).
 */
export function LessonNextStep({
  lessonId,
  overview,
  program,
  summaries,
}: {
  lessonId: string;
  overview: LessonPracticeOverview | null;
  /** The lesson's program on the Roadmap: the next step is chosen from its lessons. */
  program: StudyScope | null;
  summaries: Summaries;
}) {
  const { model } = useStudentShell();
  const progress = useLessonProgress(model.identity.id);
  const practiceHref = `/student/lessons/${encodeURIComponent(lessonId)}/practice`;
  const lessons = program?.lessons ?? [];
  const plan = progress ? pickNextStep(lessons, progress, summaries, { exclude: lessonId }) : null;
  const nextStep: Action = plan
    ? { href: plan.href, label: nextStepLabel(plan), testId: 'next-lesson-link' }
    : { href: programHref(program), label: 'Xem lộ trình của em', testId: 'next-roadmap-link' };

  const inProgress = overview?.inProgress ?? null;
  const best = overview?.best ?? null;
  const hasQuestions = !!overview && overview.questionCount > 0;

  let state: 'unavailable' | 'empty' | 'ready' | 'in-progress' | 'passed' | 'retry';
  if (!overview) state = 'unavailable';
  else if (inProgress) state = 'in-progress';
  else if (best?.passed) state = 'passed';
  else if (best) state = 'retry';
  else if (hasQuestions) state = 'ready';
  else state = 'empty';

  let title: string;
  let detail: React.ReactNode;
  let primary: Action;
  const links: Action[] = [];

  switch (state) {
    case 'in-progress':
      title = 'Em đang luyện tập dở';
      detail = `Đã làm ${inProgress!.answeredCount}/${inProgress!.totalCount} câu. Bài làm được lưu, em làm tiếp từ câu đang dừng.`;
      primary = {
        href: `${practiceHref}?attempt=${inProgress!.id}`,
        label: 'Làm tiếp luyện tập',
        testId: 'practice-continue',
      };
      if (plan) links.push(later(nextStep));
      break;
    case 'ready':
      title = 'Luyện tập để hoàn thành bài';
      detail = `${overview!.questionCount} câu, chấm ngay từng câu và có lời giải. Đạt 80% là bài này hoàn thành.`;
      primary = { href: practiceHref, label: 'Bắt đầu luyện tập', testId: 'practice-start' };
      if (plan) links.push(later(nextStep));
      break;
    case 'retry':
      // Failed: try again, or first look at what went wrong. Moving on stays
      // one tap away on the Roadmap, but it is not what this moment calls for.
      title = 'Luyện thêm để hoàn thành bài';
      detail = (
        <>
          Tốt nhất <BestScore overview={overview!} /> · cần đạt 80%.
        </>
      );
      primary = { href: practiceHref, label: 'Luyện tập lại', testId: 'practice-start' };
      if (overview!.lastCompleted)
        links.push({
          href: `${practiceHref}?attempt=${overview!.lastCompleted.id}`,
          label: 'Xem lại bài đã làm',
          testId: 'practice-review',
        });
      break;
    case 'passed':
      title = 'Em đã hoàn thành bài này';
      detail = (
        <>
          Luyện tập đạt <BestScore overview={overview!} />.
        </>
      );
      primary = nextStep;
      links.push({ href: practiceHref, label: 'Luyện tập lại', testId: 'practice-start' });
      break;
    case 'empty':
      title = 'Em đã học xong bài này';
      detail = 'Bài này chưa có câu luyện tập, nên học hết bài là hoàn thành.';
      primary = nextStep;
      break;
    default:
      title = 'Em đã học xong bài này';
      detail = 'Chưa tải được phần luyện tập. Em tải lại trang sau ít phút nhé.';
      primary = nextStep;
  }

  return (
    <section
      id="luyen-tap"
      aria-labelledby="next-step-title"
      className="scroll-mt-24 overflow-hidden rounded-2xl border border-[#DCE6F7] bg-[#F4F8FF]"
      data-testid="lesson-practice-card"
      data-state={state === 'passed' || state === 'retry' ? 'done' : state}
    >
      {program && progress && (
        <JourneyCheckpoint
          program={program}
          progress={progress}
          summaries={summaries}
          lessonId={lessonId}
        />
      )}
      <div className="p-5 sm:p-6">
        <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-blue-600">
          Bước tiếp theo
        </p>
        <h3
          id="next-step-title"
          className="mt-1 flex items-center gap-2 text-[19px] font-extrabold leading-snug text-[#091224]"
        >
          {state === 'passed' && (
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-emerald-600 text-white">
              <Check className="size-3.5" aria-hidden="true" />
            </span>
          )}
          {title}
        </h3>
        <p className="mt-1 text-[15px] leading-6 text-slate-600">{detail}</p>
        {state === 'in-progress' && (
          <div
            className="mt-3 h-1.5 overflow-hidden rounded-full bg-blue-100"
            role="progressbar"
            aria-label="Tiến độ luyện tập"
            aria-valuemin={0}
            aria-valuemax={inProgress!.totalCount}
            aria-valuenow={inProgress!.answeredCount}
          >
            <div
              className="h-full rounded-full bg-[#0052FF]"
              style={{
                width: `${Math.round((inProgress!.answeredCount / Math.max(1, inProgress!.totalCount)) * 100)}%`,
              }}
            />
          </div>
        )}
        {primary && (
          <Link href={primary.href} className={`${primaryClass} mt-5`} data-testid={primary.testId}>
            {primary.label}
            <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
          </Link>
        )}
        {links.length > 0 && (
          <p className="mt-3 flex flex-col items-start gap-x-4 sm:flex-row sm:flex-wrap">
            {links.map((link) => (
              <Link
                key={link.href + link.label}
                href={link.href}
                className={linkClass}
                data-testid={link.testId}
              >
                {link.label}
              </Link>
            ))}
          </p>
        )}
      </div>
    </section>
  );
}

function BestScore({ overview }: { overview: LessonPracticeOverview }) {
  const best = overview.best!;
  return (
    <strong className="text-[#091224]" data-testid="practice-best">
      {best.correctCount}/{best.totalCount} câu đúng
      {overview.completedCount > 1 ? ` sau ${overview.completedCount} lượt` : ''}
    </strong>
  );
}
