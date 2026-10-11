import Link from 'next/link';
import { ArrowRight, CheckCircle2, ClipboardCheck, Clock3, RotateCcw } from 'lucide-react';
import type { LessonPracticeOverview } from '@/lib/practice/practice-service';

/** The end-of-lesson call to action: practise, continue, or see how it went. */
export function LessonPracticeCard({
  lessonId,
  overview,
}: {
  lessonId: string;
  overview: LessonPracticeOverview | null;
}) {
  const href = `/student/lessons/${encodeURIComponent(lessonId)}/practice`;
  if (!overview) {
    return (
      <section
        id="luyen-tap"
        className="mt-6 rounded-[20px] border border-[#E5EBF3] bg-white p-5 text-sm text-slate-500"
      >
        Chưa tải được phần luyện tập. Em tải lại trang sau ít phút nhé.
      </section>
    );
  }
  if (overview.questionCount === 0 && !overview.lastCompleted) {
    return (
      <section
        id="luyen-tap"
        className="mt-6 flex gap-4 rounded-[20px] border border-dashed border-[#D5DEEA] bg-white p-5 sm:p-6"
        data-testid="lesson-practice-card"
        data-state="empty"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-500">
          <ClipboardCheck className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-[17px] font-bold text-[#091224]">Bài này chưa có câu luyện tập</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Thầy cô đang soạn câu hỏi cho bài này. Em có thể học tiếp bài sau và quay lại luyện tập
            khi có câu mới.
          </p>
        </div>
      </section>
    );
  }

  const best = overview.best;
  const inProgress = overview.inProgress;
  return (
    <section
      id="luyen-tap"
      className="mt-6 overflow-hidden rounded-[20px] border border-blue-200 bg-gradient-to-br from-[#F4F8FF] to-white p-5 sm:p-6"
      data-testid="lesson-practice-card"
      data-state={inProgress ? 'in-progress' : best ? 'done' : 'ready'}
    >
      <div className="flex gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#0052FF] text-white">
          <ClipboardCheck className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold tracking-wider text-blue-600 uppercase">
            Luyện tập sau bài học
          </p>
          <h2 className="mt-0.5 text-[19px] font-extrabold leading-snug text-[#091224]">
            {inProgress
              ? `Em đang làm dở: ${inProgress.answeredCount}/${inProgress.totalCount} câu`
              : best
                ? best.passed
                  ? 'Em đã nắm bài này'
                  : 'Luyện thêm để chắc bài hơn'
                : `${overview.questionCount} câu để kiểm tra em đã hiểu bài chưa`}
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            {best ? (
              <>
                Kết quả tốt nhất{' '}
                <strong className="text-[#091224]" data-testid="practice-best">
                  {best.correctCount}/{best.totalCount} câu đúng
                </strong>
                {best.passed ? ' · Đạt' : ' · Cần đạt 80% để hoàn thành'}
                {overview.completedCount > 1 && ` · ${overview.completedCount} lượt`}
              </>
            ) : (
              'Chấm ngay từng câu, có lời giải chi tiết. Kết quả được lưu lại để em theo dõi.'
            )}
          </p>
        </div>
      </div>
      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        {inProgress ? (
          <Link
            href={`${href}?attempt=${inProgress.id}`}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#0052FF] px-6 text-[15px] font-bold text-white hover:bg-[#0044CC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            data-testid="practice-continue"
          >
            <Clock3 className="size-4" aria-hidden="true" /> Làm tiếp
          </Link>
        ) : (
          <Link
            href={href}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#0052FF] px-6 text-[15px] font-bold text-white hover:bg-[#0044CC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            data-testid="practice-start"
          >
            {best ? (
              <>
                <RotateCcw className="size-4" aria-hidden="true" /> Luyện tập lại
              </>
            ) : (
              <>
                Bắt đầu luyện tập <ArrowRight className="size-4" aria-hidden="true" />
              </>
            )}
          </Link>
        )}
        {overview.lastCompleted && (
          <Link
            href={`${href}?attempt=${overview.lastCompleted.id}`}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-[#D5DEEA] bg-white px-5 text-[15px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            <CheckCircle2 className="size-4 text-emerald-600" aria-hidden="true" /> Xem kết quả lần
            trước
          </Link>
        )}
      </div>
    </section>
  );
}
