import Link from 'next/link';
import type { PremiumReadiness } from '@/lib/practice/premium-readiness';
import { EXAM_PUBLISH_STATUS_LABELS } from '@/lib/exams/exam-types';
import { Chip } from './practice-labels';

const OPEN = 'bg-emerald-50 text-emerald-700 ring-emerald-200';
const WAITING = 'bg-amber-50 text-amber-700 ring-amber-200';
const CLOSED = 'bg-slate-100 text-slate-600 ring-slate-200';
const PLUS = 'bg-amber-100 text-amber-900 ring-amber-300';

function Metric({ value, label, detail }: { value: number; label: string; detail?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xl font-bold text-slate-900">{value}</p>
      <p className="mt-0.5 text-xs text-slate-500">{label}</p>
      {detail && <p className="mt-0.5 text-[11px] text-slate-400">{detail}</p>}
    </div>
  );
}

/**
 * Why each chapter set and exam is open to students or not. Read-only: the
 * fixes happen in the question bank and the exam editor, linked from here.
 */
export function PremiumReadinessPanel({ readiness }: { readiness: PremiumReadiness }) {
  const { questions, chapters, exams } = readiness;
  const takeable = exams.filter((exam) => exam.takeable);
  return (
    <section id="premium" className="scroll-mt-6 space-y-4" data-testid="premium-readiness">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900">
            Ôn chương, Tổng hợp (Plus) và đề thi
          </h2>
          <p className="mt-0.5 max-w-3xl text-sm text-slate-500">
            Ôn chương mở khi chương có từ 2 bài có câu luyện tập. Tổng hợp mở khi chương có từ 3 câu
            đã xuất bản, quyền truy cập <b>Tú Tài Plus</b>, ngữ cảnh <b>Plus đặc biệt</b> và chấm tự
            động được. Đề thi hiện cho học sinh khi đã xuất bản, có thời gian làm bài và mọi câu
            chấm tự động được.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link
            href="/student/practice?view=chapter"
            className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 font-semibold text-slate-700 hover:bg-slate-50"
          >
            Xem trang Luyện tập
          </Link>
          <Link
            href="/student/exams"
            className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 font-semibold text-slate-700 hover:bg-slate-50"
          >
            Xem trang Luyện thi
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric
          value={questions.published}
          label="Câu đã xuất bản"
          detail={`${questions.publishedOpen} miễn phí · ${questions.publishedPlus} Plus`}
        />
        <Metric
          value={questions.plusSpecialEligible}
          label="Câu Plus đặc biệt dùng được"
          detail={
            questions.plusSpecialOutsideOpenChapters
              ? `${questions.plusSpecialOutsideOpenChapters} câu nằm ngoài chương đang mở`
              : undefined
          }
        />
        <Metric value={questions.plusSpecialUnpublished} label="Câu Plus đặc biệt đang soạn" />
        <Metric
          value={takeable.length}
          label="Đề học sinh làm được"
          detail={`${takeable.filter((e) => e.accessTier === 'FREE').length} miễn phí · ${takeable.filter((e) => e.accessTier === 'PLUS').length} Plus`}
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <h3 className="border-b border-slate-100 bg-slate-50/60 px-4 py-2.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
          Theo chương đang mở cho học sinh
        </h3>
        {chapters.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">
            Chưa có chương nào mở cho học sinh, nên chưa có bộ Ôn chương hay Tổng hợp.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {chapters.map((chapter) => (
              <li
                key={chapter.id}
                className="grid gap-3 px-4 py-3.5 text-sm md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.3fr)]"
                data-testid="readiness-chapter"
                data-synthesis={chapter.synthesis.ready ? 'open' : 'missing'}
              >
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{chapter.title}</p>
                  <p className="text-xs text-slate-500">
                    {chapter.programTitle} · {chapter.lessonsWithPractice}/{chapter.lessonCount} bài
                    có câu luyện tập
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Ôn chương (miễn phí)</p>
                  <div className="mt-1">
                    {chapter.review.ready ? (
                      <Chip tone={OPEN}>Học sinh đang làm được</Chip>
                    ) : (
                      <Chip tone={CLOSED}>
                        {chapter.review.lessonsNeeded > 0
                          ? `Cần thêm ${chapter.review.lessonsNeeded} bài có câu luyện tập`
                          : 'Cần thêm câu luyện tập'}
                      </Chip>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Tổng hợp (Plus)</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {chapter.synthesis.ready ? (
                      <Chip tone={OPEN}>Đã mở · {chapter.synthesis.eligible} câu</Chip>
                    ) : (
                      <Chip tone={chapter.synthesis.eligible ? WAITING : CLOSED}>
                        {chapter.synthesis.eligible}/3 câu · cần thêm {chapter.synthesis.needed}
                      </Chip>
                    )}
                    {chapter.synthesis.unpublished > 0 && (
                      <Chip tone={WAITING}>{chapter.synthesis.unpublished} câu đang soạn</Chip>
                    )}
                    {chapter.synthesis.notGradable > 0 && (
                      <Chip tone={WAITING}>
                        {chapter.synthesis.notGradable} câu chưa chấm tự động được
                      </Chip>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">
          Gắn câu vào Tổng hợp trong{' '}
          <Link href="/admin/question-bank" className="font-semibold text-blue-700 hover:underline">
            Ngân hàng câu hỏi
          </Link>
          : chọn quyền truy cập Tú Tài Plus, thêm ngữ cảnh Plus đặc biệt, gắn vào một bài của chương
          rồi xuất bản. Câu miễn phí không tự chuyển sang Plus.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <h3 className="border-b border-slate-100 bg-slate-50/60 px-4 py-2.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
          Đề thi
        </h3>
        {exams.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500" data-testid="readiness-no-exams">
            Chưa có đề nào trong hệ thống.{' '}
            <Link href="/admin/exams/new" className="font-semibold text-blue-700 hover:underline">
              Tạo đề
            </Link>{' '}
            từ câu hỏi đã xuất bản, rồi chọn Miễn phí hoặc Tú Tài Plus.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {exams.map((exam) => (
              <li
                key={exam.id}
                className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm"
                data-testid="readiness-exam"
              >
                <Link
                  href={`/admin/exams/${exam.id}`}
                  className="min-w-0 flex-1 font-semibold text-blue-700 hover:underline"
                >
                  {exam.name}
                </Link>
                <span className="text-xs text-slate-500">{exam.questionCount} câu</span>
                {exam.accessTier === 'PLUS' && <Chip tone={PLUS}>Plus</Chip>}
                {exam.takeable ? (
                  <Chip tone={OPEN}>Học sinh làm được</Chip>
                ) : exam.status === 'PUBLISHED' ? (
                  <Chip tone={WAITING}>Đã xuất bản, chưa làm được trên web</Chip>
                ) : (
                  <Chip tone={CLOSED}>{EXAM_PUBLISH_STATUS_LABELS[exam.status]}</Chip>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
