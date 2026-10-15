import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import type { LessonPracticeOverview } from '@/lib/practice/practice-service';

type Action = { href: string; label: string; testId?: string };

const primaryClass =
  'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0052FF] px-6 text-center text-[15px] font-bold text-white shadow-[0_8px_20px_rgba(0,82,255,0.2)] transition hover:bg-[#0044CC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 sm:w-auto';
const linkClass =
  'inline-flex min-h-10 items-center gap-1 rounded-lg text-[14px] font-semibold text-slate-600 underline-offset-4 hover:text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500';

/**
 * What to do after the lesson, as one decision: a status line about the
 * lesson's practice, a single primary action and at most two quiet links.
 * Practice comes first until it is passed; then the next lesson does.
 */
export function LessonNextStep({
  lessonId,
  overview,
  next,
  backHref,
}: {
  lessonId: string;
  overview: LessonPracticeOverview | null;
  next: { id: string; title: string } | null;
  backHref: string | null;
}) {
  const practiceHref = `/student/lessons/${encodeURIComponent(lessonId)}/practice`;
  const nextLesson: Action | null = next
    ? {
        href: `/student/lessons/${encodeURIComponent(next.id)}`,
        label: next.title,
        testId: 'next-lesson-link',
      }
    : null;
  const toList: Action | null = backHref ? { href: backHref, label: 'Về danh sách bài học' } : null;

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
  let primary: Action | null;
  const links: Action[] = [];

  switch (state) {
    case 'in-progress':
      title = 'Em đang luyện tập dở';
      detail = `Đã làm ${inProgress!.answeredCount}/${inProgress!.totalCount} câu. Kết quả được lưu, em làm tiếp từ câu đang dừng.`;
      primary = {
        href: `${practiceHref}?attempt=${inProgress!.id}`,
        label: 'Làm tiếp luyện tập',
        testId: 'practice-continue',
      };
      if (nextLesson) links.push({ ...nextLesson, label: `Để sau, học bài tiếp: ${next!.title}` });
      break;
    case 'ready':
      title = 'Luyện tập để chắc bài';
      detail = `${overview!.questionCount} câu, chấm ngay từng câu và có lời giải. Đạt 80% là em đã nắm bài.`;
      primary = { href: practiceHref, label: 'Bắt đầu luyện tập', testId: 'practice-start' };
      if (nextLesson) links.push({ ...nextLesson, label: `Để sau, học bài tiếp: ${next!.title}` });
      break;
    case 'retry':
      title = 'Luyện thêm để chắc bài hơn';
      detail = (
        <>
          Tốt nhất <BestScore overview={overview!} /> · cần đạt 80%.
        </>
      );
      primary = { href: practiceHref, label: 'Luyện tập lại', testId: 'practice-start' };
      if (overview!.lastCompleted)
        links.push({
          href: `${practiceHref}?attempt=${overview!.lastCompleted.id}`,
          label: 'Xem bài đã làm',
        });
      if (nextLesson) links.push({ ...nextLesson, label: `Học bài tiếp: ${next!.title}` });
      break;
    case 'passed':
      title = 'Em đã nắm bài này';
      detail = (
        <>
          Luyện tập đạt <BestScore overview={overview!} />.
        </>
      );
      primary = nextLesson ? { ...nextLesson, label: `Học bài tiếp: ${next!.title}` } : toList;
      links.push({ href: practiceHref, label: 'Luyện tập lại', testId: 'practice-start' });
      if (overview!.lastCompleted)
        links.push({
          href: `${practiceHref}?attempt=${overview!.lastCompleted.id}`,
          label: 'Xem bài đã làm',
        });
      break;
    case 'empty':
      title = nextLesson ? 'Học tiếp bài sau' : 'Em đã học xong bài này';
      detail = 'Bài này chưa có câu luyện tập. Khi thầy cô thêm câu mới, em quay lại luyện nhé.';
      primary = nextLesson ? { ...nextLesson, label: `Học bài tiếp: ${next!.title}` } : toList;
      break;
    default:
      title = nextLesson ? 'Học tiếp bài sau' : 'Em đã học xong bài này';
      detail = 'Chưa tải được phần luyện tập. Em tải lại trang sau ít phút nhé.';
      primary = nextLesson ? { ...nextLesson, label: `Học bài tiếp: ${next!.title}` } : toList;
  }

  return (
    <section
      id="luyen-tap"
      aria-labelledby="next-step-title"
      className="scroll-mt-24 rounded-2xl bg-[#F4F8FF] p-5 sm:p-6"
      data-testid="lesson-practice-card"
      data-state={state === 'passed' || state === 'retry' ? 'done' : state}
    >
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
