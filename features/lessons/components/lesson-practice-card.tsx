'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useStudentShell } from '@/components/student/student-shell';
import type { LessonPracticeOverview } from '@/lib/practice/practice-service';
import { useLessonProgress } from '../lib/lesson-progress';
import { practiceState } from '../lib/practice-state';
import {
  lessonHref,
  nextLessonToRead,
  pickNextStep,
  practiceHref,
  programHref,
  type NextStep,
  type StudyScope,
  type Summaries,
} from '../lib/study-plan';

type Action = { href: string; label: string; testId?: string };

const primaryClass =
  'inline-flex min-h-12 w-full items-center justify-between gap-3 rounded-xl bg-[#0052FF] px-5 py-3 text-left text-[15px] font-bold leading-snug text-white shadow-[0_8px_20px_rgba(0,82,255,0.2)] transition hover:bg-[#0044CC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2';
const linkClass =
  'inline-flex min-h-10 items-center gap-1 rounded-lg text-[14px] font-semibold text-slate-600 underline-offset-4 hover:text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500';

/** The label of a button that takes the student to the plan's next step. */
export function nextStepLabel(step: NextStep) {
  return `${step.cta}: ${step.lesson.title}`;
}

/**
 * The end of the lesson, about this lesson only: its practice, with one
 * primary action and at most one quiet alternative. Practice comes first until
 * it is passed; then the plan's next step does, chosen by the Roadmap's rule
 * (features/lessons/lib/study-plan). The journey as a whole (progress across
 * lessons, what else is open) belongs to the Roadmap and is not repeated here:
 * the lesson's header already leads back to it.
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
  // Practice opened from here comes back here (the lesson's summary).
  const practice = (attemptId?: string) => practiceHref(lessonId, attemptId, 'lesson');
  const lessons = program?.lessons ?? [];
  const plan = progress
    ? pickNextStep(lessons, progress, summaries, {
        exclude: lessonId,
        currentScore: model.learning?.currentScore,
      })
    : null;
  const nextStep: Action = plan
    ? { href: plan.href, label: nextStepLabel(plan), testId: 'next-lesson-link' }
    : { href: programHref(program), label: 'Về lộ trình học', testId: 'next-roadmap-link' };
  // While this lesson's practice comes first, the next lesson to read stays one tap away.
  const reading = progress
    ? nextLessonToRead(
        lessons.filter((lesson) => lesson.id !== lessonId),
        progress
      )
    : null;
  const readNext: Action | null = reading
    ? {
        href: lessonHref(reading.lesson.id),
        label: `Học bài tiếp: ${reading.lesson.title}`,
        testId: 'next-reading-link',
      }
    : null;

  const inProgress = overview?.inProgress ?? null;
  const state = practiceState(overview);

  let eyebrow = 'Luyện tập bài này';
  let title: string;
  let detail: React.ReactNode;
  let primary: Action;
  const links: Action[] = [];

  switch (state) {
    case 'opened':
      // A session exists but nothing is answered: it is not "unfinished work".
      title = 'Bài luyện tập đang chờ em';
      detail = `${inProgress!.totalCount} câu, chưa trả lời câu nào. Chấm ngay từng câu, đạt 80% là hoàn thành bài.`;
      primary = {
        href: practice(inProgress!.id),
        label: 'Bắt đầu làm bài',
        testId: 'practice-continue',
      };
      if (readNext) links.push(readNext);
      break;
    case 'in-progress':
      title = 'Em đang luyện tập dở';
      detail = `Đã làm ${inProgress!.answeredCount}/${inProgress!.totalCount} câu. Bài làm được lưu, em làm tiếp từ câu đang dừng.`;
      primary = {
        href: practice(inProgress!.id),
        label: 'Làm tiếp luyện tập',
        testId: 'practice-continue',
      };
      if (readNext) links.push(readNext);
      break;
    case 'ready':
      title = 'Luyện tập để hoàn thành bài';
      detail = `${overview!.questionCount} câu, chấm ngay từng câu và có lời giải. Đạt 80% là hoàn thành bài.`;
      primary = { href: practice(), label: 'Bắt đầu luyện tập', testId: 'practice-start' };
      if (readNext) links.push(readNext);
      break;
    case 'retry':
      // Failed: try again, or first look at what went wrong.
      title = 'Luyện thêm để hoàn thành bài';
      detail = (
        <>
          Tốt nhất <BestScore overview={overview!} /> · cần đạt 80%.
        </>
      );
      primary = { href: practice(), label: 'Luyện tập lại', testId: 'practice-start' };
      if (overview!.lastCompleted)
        links.push({
          href: practice(overview!.lastCompleted.id),
          label: 'Xem lại bài đã làm',
          testId: 'practice-review',
        });
      if (readNext) links.push(readNext);
      break;
    case 'passed':
      eyebrow = 'Bước tiếp theo';
      title = plan ? 'Sẵn sàng cho bài tiếp theo' : 'Em đã xong các bài trong lộ trình';
      detail = (
        <>
          Luyện tập bài này đạt <BestScore overview={overview!} />.
        </>
      );
      primary = nextStep;
      links.push({ href: practice(), label: 'Luyện tập lại', testId: 'practice-start' });
      break;
    case 'empty':
      eyebrow = 'Bước tiếp theo';
      title = plan ? 'Sẵn sàng cho bài tiếp theo' : 'Em đã xong các bài trong lộ trình';
      detail = 'Bài này không có phần luyện tập, học xong bài là hoàn thành.';
      primary = nextStep;
      break;
    default:
      title = 'Chưa tải được phần luyện tập';
      detail = 'Em tải lại trang sau ít phút nhé. Bài học của em vẫn được lưu.';
      primary = nextStep;
  }

  const counted = state === 'in-progress';
  return (
    <section
      id="luyen-tap"
      aria-labelledby="next-step-title"
      className="scroll-mt-24"
      data-testid="lesson-practice-card"
      data-state={state === 'passed' || state === 'retry' ? 'done' : state}
      data-practice={state}
    >
      <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-blue-600">{eyebrow}</p>
      <h3
        id="next-step-title"
        className="mt-1.5 text-[19px] font-extrabold leading-snug text-[#091224]"
      >
        {title}
      </h3>
      <p className="mt-1 text-[15px] leading-6 text-slate-600">{detail}</p>
      {counted && (
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
      <Link href={primary.href} className={`${primaryClass} mt-5`} data-testid={primary.testId}>
        <span className="min-w-0">{primary.label}</span>
        <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
      </Link>
      {links.length > 0 && (
        <p className="mt-2 flex flex-col items-start gap-x-4">
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
