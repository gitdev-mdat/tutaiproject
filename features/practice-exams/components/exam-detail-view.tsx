import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Clock3, ListChecks, Lock, Timer } from 'lucide-react';
import type { StudentExamDetail } from '@/lib/exams/student-exam-service';
import { EXAM_SCOPE_LABELS } from '@/lib/exams/student-exam-rules';
import { DifficultyLadder } from './difficulty-ladder';
import { PLUS_SURFACE, PlusRibbon, PlusTexture } from './plus-mark';
import { StartExamButton } from './start-exam-button';
import { EXAMS_PAGE, examAttemptHref } from '../lib/links';
import { formatDate, formatScore, minutesLeft } from '../lib/format';

export function ExamDetailView({ detail }: { detail: StudentExamDetail }) {
  const { exam, history } = detail;
  const plus = exam.accessTier === 'PLUS';
  const submitted = history.filter((attempt) => attempt.status === 'SUBMITTED');
  const perQuestion = Math.round((exam.facts.durationMinutes * 60) / exam.facts.questionCount);
  return (
    <div
      className="mx-auto w-full max-w-[760px] pb-14"
      data-testid="exam-detail"
      data-tier={exam.accessTier}
    >
      <p className="-mt-12 ml-12 flex min-h-10 items-center md:mt-0 lg:ml-0 lg:min-h-0">
        <Link
          href={EXAMS_PAGE}
          className="inline-flex min-h-8 items-center gap-1.5 rounded-lg py-1 text-[13px] font-semibold text-slate-500 hover:text-blue-600"
          data-testid="exam-back"
        >
          <ArrowLeft className="size-4" aria-hidden="true" /> Luyện thi
        </Link>
      </p>

      <section
        className={
          plus
            ? `${PLUS_SURFACE} mt-4 p-6 sm:p-8`
            : 'relative mt-4 overflow-hidden rounded-[24px] border border-[#DCE6F7] bg-white p-6 sm:p-8'
        }
      >
        {plus ? (
          <>
            <PlusTexture />
            <PlusRibbon />
          </>
        ) : (
          <span className="absolute inset-y-0 left-0 w-1.5 bg-[#0052FF]" aria-hidden="true" />
        )}
        <div className="relative">
          <p
            className={`text-[12px] font-extrabold uppercase tracking-[0.14em] ${plus ? 'text-[#F5B83D]' : 'text-[#0052FF]'}`}
          >
            {plus ? 'Đề tuyển chọn · Tú Tài Plus' : EXAM_SCOPE_LABELS[exam.scope]}
          </p>
          <h1
            className={`mt-1.5 pr-10 text-[24px] font-extrabold leading-tight tracking-tight sm:text-[30px] ${plus ? 'text-white' : 'text-[#091224]'}`}
          >
            {exam.name}
          </h1>
          {exam.curatorNote && (
            <p
              className="mt-3 border-l-2 border-[#F5B83D] pl-3 text-[15px] leading-7 text-white/85"
              data-testid="curator-note"
            >
              {exam.curatorNote}
            </p>
          )}
          {exam.sourceName && (
            <p className={`mt-2 text-[13px] ${plus ? 'text-white/65' : 'text-slate-500'}`}>
              Nguồn: {exam.sourceName}
            </p>
          )}
          <dl className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {[
              [
                <Clock3 key="c" className="size-4" aria-hidden="true" />,
                'Thời gian',
                `${exam.facts.durationMinutes} phút`,
              ],
              [
                <ListChecks key="l" className="size-4" aria-hidden="true" />,
                'Số câu',
                `${exam.facts.questionCount} câu`,
              ],
              [
                <Timer key="t" className="size-4" aria-hidden="true" />,
                'Trung bình',
                `~${perQuestion >= 60 ? `${Math.round(perQuestion / 60)} phút` : `${perQuestion} giây`}/câu`,
              ],
            ].map(([icon, label, value]) => (
              <div
                key={label as string}
                className={`rounded-2xl p-3.5 ${plus ? 'bg-white/10 ring-1 ring-white/10' : 'bg-[#F4F8FF]'}`}
              >
                <dt
                  className={`flex items-center gap-1.5 text-[12px] font-semibold ${plus ? 'text-white/65' : 'text-slate-500'}`}
                >
                  {icon} {label}
                </dt>
                <dd
                  className={`mt-0.5 text-[17px] font-extrabold ${plus ? 'text-white' : 'text-[#091224]'}`}
                >
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-4">
            <DifficultyLadder mix={exam.facts.mix} tone={plus ? 'dark' : 'light'} />
          </div>
        </div>
      </section>

      <section className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-[24px] border border-[#E5EBF3] bg-white p-5 sm:p-6">
          <h2 className="text-[15px] font-extrabold text-[#091224]">Cấu trúc đề</h2>
          <ol className="mt-3 space-y-2" data-testid="exam-parts">
            {exam.facts.parts.map((part, index) => (
              <li key={part.type} className="flex items-center justify-between gap-3 text-[14px]">
                <span className="text-slate-700">
                  <span className="font-bold text-[#091224]">
                    Phần {['I', 'II', 'III', 'IV'][index]}.
                  </span>{' '}
                  {part.label}
                </span>
                <span className="shrink-0 font-bold text-slate-600">{part.count} câu</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="rounded-[24px] border border-[#E5EBF3] bg-white p-5 sm:p-6">
          <h2 className="text-[15px] font-extrabold text-[#091224]">Khi làm bài</h2>
          <ul className="mt-3 space-y-2 text-[14px] leading-6 text-slate-700">
            <li>Đồng hồ bắt đầu khi em bấm bắt đầu và vẫn chạy nếu em rời trang.</li>
            <li>Câu trả lời được lưu ngay; mở lại trên máy khác vẫn làm tiếp được.</li>
            <li>Hết giờ, bài được nộp tự động. Đáp án và lời giải hiện sau khi nộp.</li>
          </ul>
        </div>
      </section>

      <section className="mt-4 rounded-[24px] border border-[#E5EBF3] bg-white p-5 sm:p-6">
        {exam.locked ? (
          <div data-testid="exam-locked">
            <p className="flex items-center gap-2 text-[16px] font-bold text-[#5C3B00]">
              <Lock className="size-4" aria-hidden="true" /> Đề này dành cho tài khoản Tú Tài Plus
            </p>
            <p className="mt-1.5 text-[14px] leading-6 text-slate-600">
              Tài khoản của em chưa có Plus nên chưa mở được câu hỏi của đề. Các đề miễn phí vẫn làm
              được đầy đủ, có tính giờ và lời giải.
            </p>
            <Link
              href={`${EXAMS_PAGE}?scope=${exam.scope.toLowerCase()}`}
              className="mt-4 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#0052FF] px-6 text-[15px] font-bold text-white hover:bg-[#0044CC]"
              data-testid="exam-free-alternative"
            >
              Xem đề miễn phí cùng loại <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        ) : exam.inProgress ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[14px] text-slate-700">
              Em đang làm đề này: {exam.inProgress.answered}/{exam.inProgress.total} câu, còn{' '}
              {minutesLeft(exam.inProgress.deadlineAt)} phút.
            </p>
            <Link
              href={examAttemptHref(exam.inProgress.id)}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#0052FF] px-6 text-[15px] font-bold text-white hover:bg-[#0044CC]"
              data-testid="exam-start"
            >
              Làm tiếp <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[14px] text-slate-700">
              {submitted.length
                ? `Em đã làm ${submitted.length} lần. Lần mới sẽ tính giờ lại từ đầu.`
                : `Chuẩn bị giấy nháp và ${exam.facts.durationMinutes} phút không bị gián đoạn.`}
            </p>
            <StartExamButton
              examId={exam.id}
              plus={plus}
              label={submitted.length ? 'Làm lại đề' : 'Bắt đầu làm bài'}
            />
          </div>
        )}
      </section>

      {submitted.length > 0 && (
        <section
          className="mt-4 rounded-[24px] border border-[#E5EBF3] bg-white p-5 sm:p-6"
          data-testid="exam-history"
        >
          <h2 className="text-[15px] font-extrabold text-[#091224]">Các lần đã làm</h2>
          <ul className="mt-3 divide-y divide-[#EEF2F7]">
            {submitted.map((attempt) => (
              <li
                key={attempt.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3"
              >
                <span className="text-[14px] text-slate-700">
                  <span className="font-extrabold text-[#091224]">
                    {formatScore(attempt.score ?? 0)} điểm
                  </span>{' '}
                  · {attempt.correct}/{attempt.total} câu đúng ·{' '}
                  {formatDate(attempt.submittedAt ?? attempt.startedAt)}
                  {attempt.autoSubmitted ? ' · nộp tự động khi hết giờ' : ''}
                </span>
                <Link
                  href={examAttemptHref(attempt.id)}
                  className="text-[13px] font-bold text-[#0052FF] hover:underline"
                  data-testid="exam-history-review"
                >
                  Xem bài làm
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
