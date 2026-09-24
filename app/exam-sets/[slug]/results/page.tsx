import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Flame,
  RotateCcw,
  Sparkles,
  Target,
  XCircle,
} from 'lucide-react';

import { getDemoStudentSession } from '@/lib/auth/demo-session';
import { CURRICULUM_EXAM_SETS } from '@/lib/exam-sets/curriculum-data';
import { DEFAULT_FIXTURE_QUESTIONS } from '@/components/exam-sets/practice-session';
import { PublicHeader, PublicFooter } from '@/components/layout';

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ source?: string }>;
}

export default async function ExamResultsPage({ params, searchParams }: Props) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const examSet = CURRICULUM_EXAM_SETS.find((item) => item.slug === slug);
  if (!examSet) notFound();

  const session = await getDemoStudentSession();
  if (!session) {
    const returnTo = `/exam-sets/${slug}/results`;
    redirect(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  }

  const source = query.source?.startsWith('/') ? query.source : '/student/dashboard';

  // Deterministic realistic score calculation based on fixture questions
  const totalQuestions = Math.min(examSet.questionCount, DEFAULT_FIXTURE_QUESTIONS.length);
  // Realistic mock: student gets ~70% correct (4 out of 6 or equivalent)
  const mockCorrectIndices = new Set([0, 1, 3, 4]); // questions 1, 2, 4, 5 correct
  const correctCount = Array.from({ length: totalQuestions }, (_, i) => i).filter((i) =>
    mockCorrectIndices.has(i % 6)
  ).length;
  const incorrectCount = totalQuestions - correctCount;
  const accuracy = Math.round((correctCount / totalQuestions) * 100);

  // Group weak knowledge areas
  const weakAreasMap = new Map<
    string,
    { nodeId: string; title: string; path: string[]; count: number; questions: number[] }
  >();

  for (let i = 0; i < totalQuestions; i++) {
    if (!mockCorrectIndices.has(i % 6)) {
      const q = DEFAULT_FIXTURE_QUESTIONS[i % DEFAULT_FIXTURE_QUESTIONS.length];
      const nodeId = q.primaryKnowledgeNodeId || 'node-calculus-minmax';
      const existing = weakAreasMap.get(nodeId);
      if (existing) {
        existing.count += 1;
        existing.questions.push(i + 1);
      } else {
        weakAreasMap.set(nodeId, {
          nodeId,
          title: q.knowledgePath?.at(-1) ?? 'Chưa phân loại kiến thức',
          path: q.knowledgePath ? [...q.knowledgePath] : ['Toán học', 'Lớp 12'],
          count: 1,
          questions: [i + 1],
        });
      }
    }
  }

  const sortedWeakAreas = Array.from(weakAreasMap.values()).sort(
    (a, b) => b.count - a.count || a.title.localeCompare(b.title, 'vi')
  );

  const practiceAgainHref = `/exam-sets/${examSet.slug}/practice?source=${encodeURIComponent(source)}&mode=PRACTICE&restart=1`;

  return (
    <div className="flex min-h-screen flex-col bg-[#F7F9FC] text-[#0A1628]">
      {/* Light navigation bar */}
      <div className="border-b border-[#E2E8F0] bg-white">
        <PublicHeader />
      </div>

      <main id="main-content" className="flex-1 px-4 py-8 sm:py-12" tabIndex={-1}>
        <div className="mx-auto w-full max-w-4xl">
          {/* Breadcrumb / Back button */}
          <div className="mb-6 flex items-center justify-between">
            <Link
              href={source}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#DCE5F2] bg-white px-4 py-2 text-sm font-bold text-[#1768FF] shadow-sm transition hover:bg-blue-50"
            >
              <ArrowLeft size={16} aria-hidden="true" />
              Quay lại lộ trình
            </Link>
            <div className="flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
              <Flame size={14} className="text-amber-500" />
              12 ngày streak
            </div>
          </div>

          {/* Results Hero Header */}
          <section className="rounded-3xl border border-[#DCE5F2] bg-white p-6 shadow-[0_12px_36px_rgba(28,57,98,0.06)] sm:p-9">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-extrabold uppercase tracking-wider text-[#1768FF]">
                  <Sparkles size={13} />
                  Kết quả luyện tập
                </div>
                <h1 className="mt-2 text-2xl font-black tracking-tight text-[#0F172A] sm:text-3xl">
                  {examSet.title}
                </h1>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  Toán {examSet.grade} · {examSet.difficultyLabel} · Hoàn thành vừa xong
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                <Link
                  href={practiceAgainHref}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#1768FF] px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-500/20 transition hover:bg-blue-600"
                >
                  <RotateCcw size={16} />
                  Luyện lại đề này
                </Link>
                <Link
                  href="/exam-sets"
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#E2E8F0] bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
                >
                  Tìm đề khác
                </Link>
              </div>
            </div>

            {/* Metric Score Cards */}
            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 text-center">
                <div className="text-2xl font-black text-emerald-700 sm:text-3xl">
                  {correctCount}/{totalQuestions}
                </div>
                <div className="mt-1 text-xs font-bold uppercase tracking-wider text-emerald-600">
                  Câu đúng
                </div>
              </div>

              <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4 text-center">
                <div className="text-2xl font-black text-[#1768FF] sm:text-3xl">{accuracy}%</div>
                <div className="mt-1 text-xs font-bold uppercase tracking-wider text-[#1768FF]">
                  Độ chính xác
                </div>
              </div>

              <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-4 text-center">
                <div className="text-2xl font-black text-rose-600 sm:text-3xl">
                  {incorrectCount}
                </div>
                <div className="mt-1 text-xs font-bold uppercase tracking-wider text-rose-500">
                  Cần xem lại
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-center">
                <div className="text-2xl font-black text-slate-700 sm:text-3xl">
                  {examSet.durationMinutes}
                  <span className="text-sm font-semibold text-slate-400">p</span>
                </div>
                <div className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Thời lượng
                </div>
              </div>
            </div>
          </section>

          {/* ═════════ WEAK KNOWLEDGE SECTION ("Bạn cần cải thiện") ═════════ */}
          {sortedWeakAreas.length > 0 && (
            <section
              aria-labelledby="weak-knowledge-heading"
              className="mt-8 rounded-3xl border border-amber-200/70 bg-gradient-to-b from-amber-50/40 to-white p-6 shadow-sm sm:p-8"
            >
              <div className="flex items-center gap-2 text-amber-900">
                <AlertTriangle size={20} className="text-amber-600" />
                <h2 id="weak-knowledge-heading" className="text-lg font-bold text-slate-900">
                  Bạn cần cải thiện
                </h2>
              </div>
              <p className="mt-1 text-sm text-slate-600">
                Hệ thống nhận thấy bạn gặp khó khăn ở các dạng kiến thức sau trong lần làm bài vừa
                rồi:
              </p>

              <div className="mt-5 grid gap-4">
                {sortedWeakAreas.map((area) => (
                  <div
                    key={area.nodeId}
                    className="flex flex-col justify-between gap-4 rounded-2xl border border-amber-200/80 bg-white p-5 shadow-sm transition hover:border-blue-300 sm:flex-row sm:items-center"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex size-6 items-center justify-center rounded-full bg-rose-100 text-xs font-bold text-rose-700">
                          {area.count}
                        </span>
                        <h3 className="text-base font-bold text-slate-900">{area.title}</h3>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {area.path.join(' › ')} · Sai ở câu{' '}
                        {area.questions.map((q) => `#${q}`).join(', ')}
                      </p>
                    </div>

                    <Link
                      href={`${practiceAgainHref}&knowledgeNodeId=${encodeURIComponent(area.nodeId)}`}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-blue-50 px-4 py-2 text-sm font-bold text-[#1768FF] transition hover:bg-[#1768FF] hover:text-white"
                    >
                      Luyện phần này
                      <ChevronRight size={16} />
                    </Link>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ═════════ DETAILED QUESTION REVIEW ═════════ */}
          <section
            aria-labelledby="question-review-heading"
            className="mt-8 rounded-3xl border border-[#DCE5F2] bg-white p-6 shadow-sm sm:p-8"
          >
            <div className="flex items-center gap-2">
              <BookOpen size={20} className="text-[#1768FF]" />
              <h2 id="question-review-heading" className="text-lg font-bold text-slate-900">
                Chi tiết câu hỏi & Lời giải
              </h2>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Xem lại từng câu, đáp án bạn chọn và đối chiếu với lời giải chi tiết.
            </p>

            <div className="mt-6 space-y-4">
              {Array.from({ length: totalQuestions }, (_, index) => {
                const isCorrectQuestion = mockCorrectIndices.has(index % 6);
                const q = DEFAULT_FIXTURE_QUESTIONS[index % DEFAULT_FIXTURE_QUESTIONS.length];
                const studentAnswer = isCorrectQuestion
                  ? q.correctAnswer
                  : (q.options.find((o) => o.id !== q.correctAnswer)?.id ?? 'a');

                return (
                  <article
                    key={index}
                    className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-slate-300"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <span className="text-sm font-extrabold text-slate-700">Câu {index + 1}</span>
                      {isCorrectQuestion ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                          <CheckCircle2 size={13} />
                          Đúng
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700">
                          <XCircle size={13} />
                          Sai
                        </span>
                      )}
                    </div>

                    <p className="mt-3 font-medium text-slate-900">{q.content}</p>

                    <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-bold">
                      <div className="rounded-lg bg-slate-100 px-3 py-1.5 text-slate-700">
                        Bạn chọn: <span className="uppercase text-slate-900">{studentAnswer}</span>
                      </div>
                      <div className="rounded-lg bg-emerald-50 px-3 py-1.5 text-emerald-800">
                        Đáp án đúng:{' '}
                        <span className="uppercase text-emerald-900">{q.correctAnswer}</span>
                      </div>
                    </div>

                    {q.explanationParts && q.explanationParts.length > 0 && (
                      <div className="mt-4 rounded-xl bg-slate-50 p-3.5 text-xs text-slate-600">
                        <span className="font-bold text-slate-800">Lời giải chi tiết: </span>
                        {q.explanationParts
                          .map((p) => ('content' in p ? p.content : ''))
                          .filter(Boolean)
                          .join(' ')}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>

          {/* Bottom Next Step Suggestion */}
          <div className="mt-8 flex flex-col items-center justify-between gap-4 rounded-2xl border border-blue-100 bg-blue-50/60 p-6 text-center sm:flex-row sm:text-left">
            <div className="flex items-center gap-3.5">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#1768FF] text-white">
                <Target size={22} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Sẵn sàng nâng cao điểm số?</h3>
                <p className="text-xs text-slate-600">
                  Luyện tập các phần yếu để củng cố phản xạ trước khi bắt đầu đề mới.
                </p>
              </div>
            </div>
            <Link
              href="/student/roadmap"
              className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-[#1768FF] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-blue-600"
            >
              Xem lộ trình học
              <ChevronRight size={16} />
            </Link>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
