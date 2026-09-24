'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  PlayCircle,
  RotateCcw,
  Target,
} from 'lucide-react';
import {
  completeLesson,
  completedLessonPracticeQuestions,
  getAdaptiveLearningState,
  practiceQuestions,
  retryQuestions,
  saveLessonProgress,
  savePracticeAnswers,
  saveRetryAnswers,
  startPractice,
  startRetry,
  startTargetedReview,
  submitPractice,
  submitLessonRetake,
  submitRetry,
} from '@/features/roadmap/lib/adaptive-learning-service';
import type {
  AdaptiveLearningState,
  AdaptiveQuestion,
  CompletionOutcome,
  PracticeAttempt,
  PracticeAnalysis,
} from '@/features/roadmap/lib/types';
import { CompletionCelebration } from '@/features/roadmap/components/completion-celebration';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const ROADMAP_HREF = '/student/roadmap';

function SessionFrame({
  step,
  stepLabel,
  eyebrow,
  title,
  progress,
  children,
  confirmExit = false,
}: {
  step: number;
  stepLabel: string;
  eyebrow: string;
  title: string;
  progress: number;
  children: React.ReactNode;
  confirmExit?: boolean;
}) {
  return (
    <div className="mx-auto max-w-[860px] pb-10">
      <div className="mb-5 flex items-center justify-between gap-3">
        {confirmExit ? (
          <Dialog>
            <DialogTrigger className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-blue-600">
              <ArrowLeft size={16} aria-hidden="true" /> Lộ trình
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Bài luyện chưa được nộp</DialogTitle>
                <DialogDescription>
                  Câu trả lời của em đã được lưu. Em có muốn rời khỏi phiên này?
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-600">
                  Ở lại
                </DialogClose>
                <Link
                  href={ROADMAP_HREF}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-center font-bold text-white"
                >
                  Về lộ trình
                </Link>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : (
          <Link
            href={ROADMAP_HREF}
            className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-blue-600"
          >
            <ArrowLeft size={16} aria-hidden="true" /> Lộ trình
          </Link>
        )}
        <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
          {stepLabel} · {step} / 4
        </span>
      </div>

      <header className="mb-5">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-600">{eyebrow}</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-[30px]">
          {title}
        </h1>
        <div className="mt-4 flex items-center gap-3" aria-label={`Tiến độ ${progress}%`}>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-blue-600 transition-[width] duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <strong className="w-10 text-right text-xs text-slate-600">{progress}%</strong>
        </div>
      </header>
      {children}
    </div>
  );
}

function LessonSession({
  state,
  onChange,
}: {
  state: AdaptiveLearningState;
  onChange: (state: AdaptiveLearningState) => void;
}) {
  const [checkpointAnswer, setCheckpointAnswer] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const chooseCheckpoint = async (answer: string) => {
    setCheckpointAnswer(answer);
    const next = await saveLessonProgress(75);
    onChange(next);
  };

  const finish = async () => {
    setSaving(true);
    const next = await completeLesson();
    onChange(next);
    setSaving(false);
  };

  return (
    <SessionFrame
      step={1}
      stepLabel="Học"
      eyebrow="Toán 12 · Bài học"
      title="Phương pháp đổi biến số"
      progress={state.lessonProgress}
    >
      <div className="space-y-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex items-center gap-2 text-blue-600">
            <BookOpen size={19} aria-hidden="true" />
            <h2 className="font-extrabold">Ý tưởng cốt lõi</h2>
          </div>
          <p className="mt-3 text-[15px] leading-7 text-slate-700">
            Đổi biến số giúp đưa một tích phân phức tạp về dạng quen thuộc. Em chọn một biểu thức
            lặp lại làm <strong>u</strong>, sau đó đổi cả vi phân và cận tích phân theo biến mới.
          </p>
          <div className="mt-4 rounded-xl bg-blue-50 p-4 font-medium text-slate-700">
            ∫ f(g(x)) · g′(x) dx &nbsp;→&nbsp; đặt u = g(x), du = g′(x)dx
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-[1fr_0.9fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="font-extrabold text-slate-900">Ví dụ có hướng dẫn</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Tính I = tích phân từ 0 đến x của 2t(t² + 1)³ dt.
            </p>
            <ol className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
              <li>
                <strong>1.</strong> Đặt u = t² + 1 ⇒ du = 2t dt.
              </li>
              <li>
                <strong>2.</strong> Đổi cận: t = 0 ⇒ u = 1; t = x ⇒ u = x² + 1.
              </li>
              <li>
                <strong>3.</strong> Khi đó I = ∫₁ˣ²⁺¹ u³ du.
              </li>
            </ol>
          </div>
          <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-5">
            <h2 className="font-extrabold text-slate-900">Kiểm tra nhanh</h2>
            <p className="mt-2 text-sm text-slate-600">Nếu u = x² + 1 thì du bằng gì?</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {['x dx', '2x dx', '2 dx', 'x² dx'].map((answer) => (
                <button
                  key={answer}
                  type="button"
                  onClick={() => void chooseCheckpoint(answer)}
                  className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${checkpointAnswer === answer ? 'border-blue-500 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300'}`}
                >
                  {answer}
                </button>
              ))}
            </div>
          </div>
        </section>

        <div className="flex justify-end">
          <button
            type="button"
            disabled={!checkpointAnswer || saving}
            onClick={() => void finish()}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {saving ? 'Đang lưu...' : 'Hoàn thành bài học'}{' '}
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </SessionFrame>
  );
}

function LessonComplete({
  onPractice,
  eventId,
}: {
  onPractice: () => Promise<void>;
  eventId: string;
}) {
  return (
    <SessionFrame
      step={1}
      stepLabel="Học"
      eyebrow="Một bước nhỏ đã hoàn thành"
      title="Hoàn thành bài học!"
      progress={100}
    >
      <section className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-white p-6 text-center sm:p-8">
        <CompletionCelebration eventId={eventId} />
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <CheckCircle2 size={27} aria-hidden="true" />
        </span>
        <h2 className="mt-3 text-lg font-extrabold text-slate-900">
          Em vừa hoàn thành “Phương pháp đổi biến số”
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-600">
          Bước tiếp theo đã được mở khóa. Làm 5 câu trọng tâm để củng cố phần em vừa học.
        </p>
        <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => void onPractice()}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white hover:bg-blue-700"
          >
            Luyện ngay <ArrowRight size={16} aria-hidden="true" />
          </button>
          <Link
            href={ROADMAP_HREF}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 px-5 text-sm font-bold text-slate-600 hover:bg-slate-50"
          >
            Về lộ trình
          </Link>
        </div>
      </section>
    </SessionFrame>
  );
}

function QuestionSession({
  title,
  eyebrow,
  questions,
  initialAnswers,
  step,
  stepLabel,
  onSave,
  onSubmit,
}: {
  title: string;
  eyebrow: string;
  questions: AdaptiveQuestion[];
  initialAnswers: Record<string, string>;
  step: number;
  stepLabel: string;
  onSave: (answers: Record<string, string>) => Promise<unknown>;
  onSubmit: (answers: Record<string, string>) => Promise<void>;
}) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState(initialAnswers);
  const [submitting, setSubmitting] = useState(false);
  const question = questions[index];
  const selected = answers[question.id];
  const answeredCount = Object.keys(answers).length;

  const choose = async (answerId: string) => {
    const next = { ...answers, [question.id]: answerId };
    setAnswers(next);
    await onSave(next);
  };

  const submit = async () => {
    setSubmitting(true);
    await onSubmit(answers);
    setSubmitting(false);
  };

  return (
    <SessionFrame
      step={step}
      stepLabel={stepLabel}
      eyebrow={eyebrow}
      title={title}
      progress={Math.round((answeredCount / questions.length) * 100)}
      confirmExit={answeredCount > 0}
    >
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
        <div className="flex items-center justify-between gap-3 text-xs font-bold text-slate-500">
          <span>
            Câu {index + 1} / {questions.length}
          </span>
          <span>
            {answeredCount}/{questions.length} đã trả lời
          </span>
        </div>
        <h2 className="mt-5 text-lg font-extrabold leading-7 text-slate-900 sm:text-xl">
          {question.prompt}
        </h2>
        <div className="mt-5 grid gap-3">
          {question.options.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => void choose(option.id)}
              className={`flex min-h-12 items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${selected === option.id ? 'border-blue-500 bg-blue-50 text-blue-800 ring-1 ring-blue-200' : 'border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-slate-50'}`}
            >
              <span
                className={`flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-extrabold ${selected === option.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}
              >
                {option.id.toUpperCase()}
              </span>
              {option.label}
            </button>
          ))}
        </div>
        <div className="mt-6 flex items-center justify-between gap-3 border-t border-slate-100 pt-5">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => setIndex((current) => current - 1)}
            className="inline-flex min-h-10 items-center gap-1 rounded-xl px-3 text-sm font-bold text-slate-500 hover:bg-slate-50 disabled:opacity-30"
          >
            <ChevronLeft size={17} /> Câu trước
          </button>
          {index < questions.length - 1 ? (
            <button
              type="button"
              disabled={!selected}
              onClick={() => setIndex((current) => current + 1)}
              className="inline-flex min-h-10 items-center gap-1 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-40"
            >
              Câu tiếp <ChevronRight size={17} />
            </button>
          ) : (
            <button
              type="button"
              disabled={answeredCount !== questions.length || submitting}
              onClick={() => void submit()}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-40"
            >
              {submitting ? 'Đang nộp...' : 'Nộp bài'} <Check size={16} />
            </button>
          )}
        </div>
      </section>
    </SessionFrame>
  );
}

function AnalysisScreen({
  analysis,
  onReview,
}: {
  analysis: PracticeAnalysis;
  onReview: () => Promise<void>;
}) {
  const weakness = analysis.detectedWeaknesses[0];
  return (
    <SessionFrame
      step={3}
      stepLabel="Phân tích"
      eyebrow="Kết quả luyện tập"
      title={`${analysis.score.correct}/${analysis.score.total} câu đúng`}
      progress={100}
    >
      <div className="grid gap-4 sm:grid-cols-[0.8fr_1.2fr]">
        <section className="rounded-2xl border border-blue-200 bg-blue-50/60 p-5">
          <BarChart3 className="text-blue-600" size={23} />
          <h2 className="mt-3 font-extrabold text-slate-900">
            Tú Tài đã tìm thấy điểm cần củng cố
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Kết quả này không phải điểm kết thúc. Nó giúp lộ trình chọn chính xác phần em nên ôn
            ngay lúc này.
          </p>
        </section>
        <section className="rounded-2xl border border-amber-200 bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-amber-600">
            Điểm kiến thức cần củng cố
          </p>
          <h2 className="mt-2 text-lg font-extrabold text-slate-900">{weakness.title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{weakness.description}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {weakness.evidenceQuestionIds.map((id) => (
              <span
                key={id}
                className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700"
              >
                Câu {id.slice(1)} · Chưa chính xác
              </span>
            ))}
          </div>
        </section>
      </div>
      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={() => void onReview()}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white hover:bg-blue-700"
        >
          Ôn đúng chỗ yếu <ArrowRight size={16} />
        </button>
      </div>
    </SessionFrame>
  );
}

function PracticePassedResult({
  outcome,
}: {
  outcome: Extract<CompletionOutcome, { type: 'practice_passed' }>;
}) {
  return (
    <SessionFrame
      step={3}
      stepLabel="Kết quả"
      eyebrow="Bài luyện hoàn thành"
      title="Làm tốt lắm!"
      progress={100}
    >
      <section className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-white p-6 sm:p-8">
        <CompletionCelebration eventId={outcome.id} />
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 size={31} aria-hidden="true" />
          </span>
          <div className="flex-1">
            <h2 className="text-lg font-extrabold text-slate-900">
              {outcome.attempt.correct}/{outcome.attempt.total} câu đúng
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Em đã nắm khá chắc phần Phương pháp đổi biến số.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <span className="text-sm font-bold text-slate-400">{outcome.masteryBefore}%</span>
              <ArrowRight size={16} className="text-emerald-500" aria-hidden="true" />
              <strong className="text-xl text-emerald-600">{outcome.masteryAfter}%</strong>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-emerald-50">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-[width] duration-700"
                  style={{ width: `${outcome.masteryAfter}%` }}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <Link
            href={ROADMAP_HREF}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white hover:bg-blue-700"
          >
            Tiếp tục lộ trình <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </SessionFrame>
  );
}

function ReviewSession({ onRetry }: { onRetry: () => Promise<void> }) {
  return (
    <SessionFrame
      step={4}
      stepLabel="Ôn đúng chỗ yếu"
      eyebrow="Ôn nhanh · 6 phút"
      title="Quy tắc dấu của đạo hàm"
      progress={65}
    >
      <div className="space-y-4">
        <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
          <div className="flex items-center gap-2 text-amber-700">
            <Target size={19} />
            <h2 className="font-extrabold">Điểm em đang nhầm</h2>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-700">
            Dấu của f′(x) mô tả chiều chuyển động của hàm số: dấu dương nghĩa là giá trị đang tăng,
            dấu âm nghĩa là giá trị đang giảm.
          </p>
        </section>
        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="font-extrabold text-slate-900">Ví dụ</h2>
            <div className="mt-3 rounded-xl bg-slate-50 p-4 text-center font-bold text-slate-700">
              f′(x): &nbsp; + &nbsp; 0 &nbsp; −
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Hàm số tăng, đạt cực đại tại điểm đổi dấu, rồi giảm.
            </p>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-5">
            <div className="flex items-center gap-2 text-blue-700">
              <Lightbulb size={18} />
              <h2 className="font-extrabold">Mẹo ghi nhớ</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-700">
              <strong>“Dương đi lên, âm đi xuống.”</strong> Hãy đọc bảng dấu từ trái sang phải trước
              khi kết luận cực trị.
            </p>
          </div>
        </section>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void onRetry()}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white hover:bg-blue-700"
          >
            Hiểu rồi — Luyện lại <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </SessionFrame>
  );
}

function RetryNeedsReview({ onRetry }: { onRetry: () => Promise<void> }) {
  return (
    <SessionFrame
      step={4}
      stepLabel="Luyện lại"
      eyebrow="Chưa vững hoàn toàn"
      title="Mình thử lại một lượt nhé"
      progress={100}
    >
      <section className="rounded-2xl border border-blue-200 bg-white p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <RotateCcw size={24} aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-extrabold text-slate-900">Em đã tiến gần hơn tới đáp án đúng</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Xem lại quy tắc dấu một lần nữa rồi thử 3 câu mới. Kết quả này không làm mất tiến độ
              em đã đạt được.
            </p>
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={() => void onRetry()}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white hover:bg-blue-700"
          >
            Luyện lại <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      </section>
    </SessionFrame>
  );
}

function MasteryResult({
  outcome,
}: {
  outcome: Extract<CompletionOutcome, { type: 'retry_passed' }>;
}) {
  return (
    <SessionFrame
      step={4}
      stepLabel="Cập nhật năng lực"
      eyebrow="Luyện lại hoàn thành"
      title="Củng cố thành công!"
      progress={100}
    >
      <section className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-white p-6 sm:p-8">
        <CompletionCelebration eventId={outcome.id} />
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 size={31} />
          </span>
          <div className="flex-1">
            <h2 className="text-lg font-extrabold text-slate-900">Quy tắc dấu của đạo hàm</h2>
            <p className="mt-1 text-sm text-slate-500">
              {outcome.attempt.correct}/{outcome.attempt.total} câu tương tự chính xác · Năng lực đã
              được tính lại
            </p>
            <div className="mt-4 flex items-center gap-3">
              <span className="text-sm font-bold text-slate-400">{outcome.masteryBefore}%</span>
              <ArrowRight size={16} className="text-emerald-500" />
              <strong className="text-xl text-emerald-600">{outcome.masteryAfter}%</strong>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-emerald-50">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-[width] duration-700"
                  style={{ width: `${outcome.masteryAfter}%` }}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <Link
            href={ROADMAP_HREF}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white hover:bg-blue-700"
          >
            Tiếp tục lộ trình <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </SessionFrame>
  );
}

function NextLessonPreview() {
  return (
    <SessionFrame
      step={1}
      stepLabel="Học"
      eyebrow="Toán 12 · Bài học tiếp theo"
      title="Tính đơn điệu của hàm số"
      progress={0}
    >
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-2 text-blue-600">
          <BookOpen size={20} />
          <h2 className="font-extrabold">Mục tiêu bài học</h2>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Nhận biết khoảng đồng biến, nghịch biến từ dấu của đạo hàm và vận dụng vào bảng biến
          thiên.
        </p>
        <div className="mt-4 rounded-xl bg-blue-50 p-4 text-sm font-medium text-slate-700">
          Bài học mới đã sẵn sàng. Tiến độ sẽ được lưu khi nội dung tiếp theo được triển khai.
        </div>
      </section>
    </SessionFrame>
  );
}

const REVIEW_LESSONS = {
  'review-basic-derivative': {
    id: 'basic-derivative',
    title: 'Đạo hàm cơ bản',
    summary:
      'Ôn lại các quy tắc đạo hàm cơ bản và cách áp dụng công thức vào những biểu thức quen thuộc.',
    coreTitle: 'Quy tắc cần nhớ',
    content:
      'Với n là số thực, đạo hàm của xⁿ là n·xⁿ⁻¹. Đạo hàm của một hằng số bằng 0, và đạo hàm của một tổng bằng tổng các đạo hàm.',
    example: '(x³ + 2x − 5)′ = 3x² + 2',
    checkpoint: {
      prompt: 'Đạo hàm của x⁴ là gì?',
      options: ['4x³', 'x³', '4x', 'x⁵/5'],
      correct: '4x³',
    },
    practiceHref: '/student/learn/retake-basic-derivative',
  },
  'review-substitution': {
    id: 'substitution',
    title: 'Phương pháp đổi biến số',
    summary:
      'Ôn lại cách chọn ẩn phụ, biến đổi vi phân và nhận diện những biểu thức phù hợp với phương pháp đổi biến số.',
    coreTitle: 'Ý tưởng cốt lõi',
    content:
      'Chọn biểu thức lặp lại làm u, sau đó đổi cả vi phân và cận tích phân theo biến mới để đưa bài toán về dạng quen thuộc.',
    example: '∫ f(g(x))·g′(x) dx → đặt u = g(x), du = g′(x)dx',
    checkpoint: {
      prompt: 'Nếu u = x² + 1 thì du bằng gì?',
      options: ['x dx', '2x dx', '2 dx', 'x² dx'],
      correct: '2x dx',
    },
    practiceHref: '/student/learn/retake-substitution',
  },
} as const;

function CompletedLessonReview({
  lesson,
  currentLesson,
}: {
  lesson: (typeof REVIEW_LESSONS)[keyof typeof REVIEW_LESSONS];
  currentLesson: { title: string; href: string };
}) {
  const [view, setView] = useState<'landing' | 'content' | 'complete'>('landing');
  const [checkpointAnswer, setCheckpointAnswer] = useState<string | null>(null);

  if (view === 'content') {
    const sessionProgress = checkpointAnswer ? 85 : 35;
    return (
      <SessionFrame
        step={1}
        stepLabel="Đang ôn lại"
        eyebrow="Bài đã hoàn thành · Đang xem lại"
        title={lesson.title}
        progress={sessionProgress}
      >
        <div className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="flex items-center gap-2 text-blue-600">
              <BookOpen size={19} aria-hidden="true" />
              <h2 className="font-extrabold">{lesson.coreTitle}</h2>
            </div>
            <p className="mt-3 text-[15px] leading-7 text-slate-700">{lesson.content}</p>
            <div className="mt-4 rounded-xl bg-blue-50 p-4 font-medium text-slate-700">
              {lesson.example}
            </div>
          </section>

          <section className="rounded-2xl border border-violet-200 bg-violet-50/60 p-5">
            <h2 className="font-extrabold text-slate-900">Kiểm tra lại nhanh</h2>
            <p className="mt-2 text-sm text-slate-600">{lesson.checkpoint.prompt}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {lesson.checkpoint.options.map((answer) => (
                <button
                  key={answer}
                  type="button"
                  onClick={() => setCheckpointAnswer(answer)}
                  className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${checkpointAnswer === answer ? 'border-blue-500 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300'}`}
                >
                  {answer}
                </button>
              ))}
            </div>
            {checkpointAnswer ? (
              <p className="mt-3 text-xs font-semibold text-slate-500">
                {checkpointAnswer === lesson.checkpoint.correct
                  ? 'Chính xác — em vẫn nhớ phần này.'
                  : `Đáp án đúng là ${lesson.checkpoint.correct}. Em có thể xem lại ví dụ phía trên.`}
              </p>
            ) : null}
          </section>

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setView('landing')}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold text-slate-500 hover:bg-slate-100"
            >
              <ArrowLeft size={16} aria-hidden="true" /> Quay lại
            </button>
            <button
              type="button"
              disabled={!checkpointAnswer}
              onClick={() => setView('complete')}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-45"
            >
              Hoàn thành ôn lại <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      </SessionFrame>
    );
  }

  if (view === 'complete') {
    return (
      <SessionFrame
        step={1}
        stepLabel="Ôn lại"
        eyebrow="Bài đã hoàn thành"
        title="Ôn lại xong"
        progress={100}
      >
        <section className="rounded-2xl border border-emerald-200 bg-white p-6 text-center sm:p-8">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 size={27} aria-hidden="true" />
          </span>
          <h2 className="mt-3 text-lg font-extrabold text-slate-900">Kiến thức đã được xem lại</h2>
          <p className="mt-2 text-sm text-slate-500">
            Tiến độ hoàn thành của bài vẫn được giữ nguyên.
          </p>
          <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href={currentLesson.href}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white hover:bg-blue-700"
            >
              Quay lại bài đang học <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link
              href={lesson.practiceHref}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 text-sm font-bold text-slate-600 hover:bg-slate-50"
            >
              Làm lại bài luyện
            </Link>
          </div>
          <Link
            href={ROADMAP_HREF}
            className="mt-4 inline-flex text-sm font-bold text-slate-500 hover:text-blue-600"
          >
            Về lộ trình
          </Link>
        </section>
      </SessionFrame>
    );
  }

  return (
    <SessionFrame
      step={1}
      stepLabel="Ôn lại"
      eyebrow="Bài đã hoàn thành"
      title={lesson.title}
      progress={100}
    >
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <p className="text-sm font-semibold text-slate-600">Em đã học xong nội dung này.</p>
            <p className="mt-1 text-xs text-slate-500">
              Ôn lại không làm thay đổi tiến độ hiện tại.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
            <CheckCircle2 size={14} aria-hidden="true" /> Hoàn thành
          </span>
        </div>

        <h2 className="mt-5 font-extrabold text-slate-900">Em muốn làm gì?</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setView('content')}
            className="rounded-xl bg-blue-600 p-4 text-left text-white transition hover:bg-blue-700"
          >
            <span className="flex items-center gap-2 font-extrabold">
              <PlayCircle size={18} aria-hidden="true" /> Học lại từ đầu
            </span>
            <span className="mt-1.5 block text-xs leading-5 text-blue-100">{lesson.summary}</span>
          </button>
          <Link
            href={lesson.practiceHref}
            className="rounded-xl border border-slate-200 p-4 text-left transition hover:border-violet-200 hover:bg-violet-50/50"
          >
            <span className="flex items-center gap-2 font-extrabold text-slate-800">
              <RotateCcw size={18} className="text-violet-600" aria-hidden="true" /> Làm lại bài
              luyện
            </span>
            <span className="mt-1.5 block text-xs leading-5 text-slate-500">
              Tạo một lượt làm mới mà không ghi đè kết quả trước.
            </span>
          </Link>
        </div>

        <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
              Bài hiện tại của em
            </p>
            <p className="mt-1 text-sm font-extrabold text-slate-800">{currentLesson.title}</p>
          </div>
          <Link
            href={currentLesson.href}
            className="inline-flex min-h-10 items-center gap-2 self-start rounded-xl px-3 text-sm font-bold text-blue-600 hover:bg-blue-50 sm:self-auto"
          >
            Quay lại bài đang học <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </SessionFrame>
  );
}

function RetakeResult({
  attempt,
  lessonTitle,
  onAgain,
  currentLesson,
}: {
  attempt: PracticeAttempt;
  lessonTitle: string;
  onAgain: () => void;
  currentLesson: { title: string; href: string };
}) {
  return (
    <SessionFrame
      step={2}
      stepLabel="Làm lại"
      eyebrow="Kết quả lượt làm lại"
      title={`${attempt.correct}/${attempt.total} câu đúng`}
      progress={100}
    >
      <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <span
            className={`flex size-12 shrink-0 items-center justify-center rounded-full ${attempt.passed ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}
          >
            {attempt.passed ? <CheckCircle2 size={27} /> : <RotateCcw size={24} />}
          </span>
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">
              {attempt.passed ? 'Em vẫn nắm chắc phần này' : 'Thử lại thêm một lượt nhé'}
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Lượt làm lại “{lessonTitle}” đã được lưu riêng. Kết quả hoàn thành ban đầu vẫn được
              giữ nguyên.
            </p>
          </div>
        </div>
        <div className="mt-6 flex flex-col justify-end gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onAgain}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 text-sm font-bold text-slate-600 hover:bg-slate-50"
          >
            <RotateCcw size={16} aria-hidden="true" /> Làm lại bài luyện
          </button>
          <Link
            href={currentLesson.href}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white hover:bg-blue-700"
          >
            Quay lại bài đang học <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </SessionFrame>
  );
}

function RetakeSession({
  lessonId,
  lessonTitle,
  currentLesson,
}: {
  lessonId: string;
  lessonTitle: string;
  currentLesson: { title: string; href: string };
}) {
  const [attempt, setAttempt] = useState<PracticeAttempt | null>(null);
  const questions = completedLessonPracticeQuestions[lessonId];

  if (attempt) {
    return (
      <RetakeResult
        attempt={attempt}
        lessonTitle={lessonTitle}
        currentLesson={currentLesson}
        onAgain={() => setAttempt(null)}
      />
    );
  }

  return (
    <QuestionSession
      title={`Làm lại bài luyện · ${lessonTitle}`}
      eyebrow="Lượt làm mới · Không thay đổi tiến độ"
      questions={questions}
      initialAnswers={{}}
      step={2}
      stepLabel="Làm lại"
      onSave={async () => undefined}
      onSubmit={async (answers) => setAttempt(await submitLessonRetake(lessonId, answers))}
    />
  );
}

export function AdaptiveLearningSession() {
  const params = useParams<{ activityId: string }>();
  const router = useRouter();
  const activityId = params.activityId;
  const [state, setState] = useState<AdaptiveLearningState | null>(null);

  useEffect(() => {
    void getAdaptiveLearningState().then(async (loaded) => {
      if (activityId === 'daily-focused-practice' && loaded.stage === 'lesson_complete')
        loaded = await startPractice();
      if (activityId === 'daily-sign-review' && loaded.stage !== 'review')
        loaded = await startTargetedReview();
      setState(loaded);
    });
  }, [activityId]);

  const analysis = useMemo(() => state?.analysis, [state?.analysis]);
  if (!state)
    return (
      <div
        className="mx-auto h-72 max-w-[860px] animate-pulse rounded-2xl bg-slate-100"
        aria-label="Đang tải phiên học"
      />
    );

  const currentLesson =
    state.stage === 'mastery_complete' || state.stage === 'practice_passed'
      ? {
          title: 'Tính đơn điệu của hàm số',
          href: '/student/learn/daily-monotonicity',
        }
      : {
          title: 'Phương pháp đổi biến số',
          href: '/student/learn/daily-substitution-method',
        };
  const reviewLesson = REVIEW_LESSONS[activityId as keyof typeof REVIEW_LESSONS];
  if (reviewLesson)
    return <CompletedLessonReview lesson={reviewLesson} currentLesson={currentLesson} />;
  const retakeLessonId = activityId.startsWith('retake-')
    ? activityId.slice('retake-'.length)
    : null;
  const retakeLesson = retakeLessonId
    ? REVIEW_LESSONS[`review-${retakeLessonId}` as keyof typeof REVIEW_LESSONS]
    : null;
  if (retakeLessonId && retakeLesson) {
    return (
      <RetakeSession
        lessonId={retakeLessonId}
        lessonTitle={retakeLesson.title}
        currentLesson={currentLesson}
      />
    );
  }
  if (activityId === 'daily-monotonicity') return <NextLessonPreview />;
  if (state.stage === 'lesson') return <LessonSession state={state} onChange={setState} />;
  if (state.stage === 'lesson_complete') {
    return (
      <LessonComplete
        eventId={
          state.outcome?.type === 'lesson_completed'
            ? state.outcome.id
            : 'lesson-completed-substitution'
        }
        onPractice={async () => {
          const next = await startPractice();
          setState(next);
          router.push('/student/learn/daily-focused-practice');
        }}
      />
    );
  }
  if (state.stage === 'practice') {
    return (
      <QuestionSession
        title="5 câu luyện trọng tâm"
        eyebrow="Toán 12 · Luyện tập"
        questions={practiceQuestions}
        initialAnswers={state.practiceAnswers}
        step={2}
        stepLabel="Luyện"
        onSave={savePracticeAnswers}
        onSubmit={async (answers) => setState(await submitPractice(answers))}
      />
    );
  }
  if (state.stage === 'practice_passed' && state.outcome?.type === 'practice_passed') {
    return <PracticePassedResult outcome={state.outcome} />;
  }
  if (state.stage === 'analysis' && analysis) {
    return (
      <AnalysisScreen
        analysis={analysis}
        onReview={async () => {
          const next = await startTargetedReview();
          setState(next);
          router.push('/student/learn/daily-sign-review');
        }}
      />
    );
  }
  if (state.stage === 'review') {
    return (
      <ReviewSession
        onRetry={async () => {
          const next = await startRetry();
          setState(next);
          router.push('/student/learn/daily-sign-retry');
        }}
      />
    );
  }
  if (state.stage === 'retry') {
    return (
      <QuestionSession
        title="3 câu luyện lại tương tự"
        eyebrow="Toán 12 · Luyện lại"
        questions={retryQuestions}
        initialAnswers={state.retryAnswers}
        step={4}
        stepLabel="Ôn đúng chỗ yếu"
        onSave={saveRetryAnswers}
        onSubmit={async (answers) => setState(await submitRetry(answers))}
      />
    );
  }
  if (state.stage === 'retry_needs_review') {
    return <RetryNeedsReview onRetry={async () => setState(await startRetry())} />;
  }
  const retryOutcome: Extract<CompletionOutcome, { type: 'retry_passed' }> =
    state.outcome?.type === 'retry_passed'
      ? state.outcome
      : {
          id: 'retry-passed-legacy',
          type: 'retry_passed',
          masteryBefore: 52,
          masteryAfter: 78,
          attempt: {
            id: 'legacy-retry',
            activityId: 'daily-sign-retry',
            type: 'retry',
            correct: 3,
            total: 3,
            passed: true,
            completedAt: state.updatedAt,
          },
        };
  return <MasteryResult outcome={retryOutcome} />;
}
