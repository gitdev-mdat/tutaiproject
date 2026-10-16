import * as React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Clock3,
  FileText,
  Lock,
  PlayCircle,
  Timer,
  ListChecks,
  Eye,
} from 'lucide-react';
import type { ExamCard, StudentExamCatalog } from '@/lib/exams/student-exam-service';
import {
  EXAM_SCOPE_LABELS,
  EXAM_SCOPE_ORDER,
  EXAM_SCOPE_SHORT,
  type ExamScope,
} from '@/lib/exams/student-exam-rules';
import { DifficultyLadder } from './difficulty-ladder';
import { PLUS_SURFACE, PlusRibbon, PlusTag, PlusTexture } from './plus-mark';
import { EXAMS_PAGE, examAttemptHref, examHref } from '../lib/links';
import { formatScore, minutesLeft } from '../lib/format';

const primaryButton =
  'inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#0052FF] px-5 text-[14px] font-bold text-white transition-colors hover:bg-[#0044CC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2';
const quietButton =
  'inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[#D5DEEA] bg-white px-4 text-[14px] font-bold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2';
const textLink =
  'inline-flex h-11 shrink-0 items-center gap-1 rounded-lg px-2 text-[13px] font-bold text-slate-600 hover:text-[#0052FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500';
const plusButton =
  'inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#F5B83D] px-5 text-[14px] font-extrabold text-[#2B1C00] transition-colors hover:bg-[#FFC857] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B83D] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A1F5C]';
const plusQuiet =
  'inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/5 px-5 text-[14px] font-bold text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white';
const plusTextLink =
  'inline-flex h-11 shrink-0 items-center gap-1 rounded-lg px-2 text-[13px] font-bold text-white/80 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white';

type Action = { href: string; label: string; kind: 'start' | 'resume' | 'retry' | 'preview' };

/** One primary action per card, and at most one secondary (the last result). */
function examActions(exam: ExamCard): { primary: Action; secondary: Action | null } {
  if (exam.inProgress && !exam.locked)
    return {
      primary: { href: examAttemptHref(exam.inProgress.id), label: 'Làm tiếp', kind: 'resume' },
      secondary: null,
    };
  const review = exam.lastSubmitted
    ? {
        href: examAttemptHref(exam.lastSubmitted.id),
        label: 'Xem bài làm',
        kind: 'preview' as const,
      }
    : null;
  if (exam.locked)
    return {
      primary: { href: examHref(exam.id), label: 'Xem đề', kind: 'preview' },
      secondary: review,
    };
  return {
    primary: {
      href: examHref(exam.id),
      label: exam.lastSubmitted ? 'Làm lại' : 'Làm đề',
      kind: exam.lastSubmitted ? 'retry' : 'start',
    },
    secondary: review,
  };
}

function examState(exam: ExamCard): { text: string; tone: 'active' | 'done' | 'idle' | 'locked' } {
  if (exam.inProgress)
    return {
      text: `Đang làm · ${exam.inProgress.answered}/${exam.inProgress.total} câu · còn ${minutesLeft(exam.inProgress.deadlineAt)} phút`,
      tone: 'active',
    };
  if (exam.best && exam.best.score !== null)
    return {
      text: `Tốt nhất ${formatScore(exam.best.score)} điểm · ${exam.submittedCount} lần`,
      tone: 'done',
    };
  if (exam.locked) return { text: 'Dành cho Tú Tài Plus', tone: 'locked' };
  return { text: 'Chưa làm', tone: 'idle' };
}

function Meta({ exam, dark = false }: { exam: ExamCard; dark?: boolean }) {
  const tone = dark ? 'text-white/80' : 'text-slate-600';
  return (
    <p
      className={`mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] font-semibold ${tone}`}
    >
      <span className="inline-flex items-center gap-1.5">
        <Clock3 className="size-3.5" aria-hidden="true" /> {exam.facts.durationMinutes} phút
      </span>
      <span className="inline-flex items-center gap-1.5">
        <ListChecks className="size-3.5" aria-hidden="true" /> {exam.facts.questionCount} câu
      </span>
      {exam.facts.parts.length > 1 && (
        <span className="inline-flex items-center gap-1.5">
          <FileText className="size-3.5" aria-hidden="true" /> {exam.facts.parts.length} phần
        </span>
      )}
      <DifficultyLadder mix={exam.facts.mix} tone={dark ? 'dark' : 'light'} />
    </p>
  );
}

function StandardCard({ exam }: { exam: ExamCard }) {
  const { primary, secondary } = examActions(exam);
  const state = examState(exam);
  return (
    <article
      className="flex h-full flex-col rounded-[24px] border border-[#E5EBF3] bg-white p-5 transition-shadow hover:shadow-[0_12px_28px_-20px_rgba(10,31,92,0.45)] sm:p-6"
      data-testid="exam-card"
      data-exam={exam.id}
      data-tier="FREE"
      data-state={state.tone}
    >
      <p className="text-[12px] font-extrabold uppercase tracking-[0.12em] text-[#0052FF]">
        {EXAM_SCOPE_SHORT[exam.scope]}
      </p>
      <h3 className="mt-1 text-[17px] font-extrabold leading-6 text-[#091224] sm:text-[18px]">
        {exam.name}
      </h3>
      <Meta exam={exam} />
      <div className="flex-1" />
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#EEF2F7] pt-4">
        <span
          className={`text-[13px] font-semibold ${state.tone === 'active' ? 'text-[#0052FF]' : state.tone === 'done' ? 'text-emerald-700' : 'text-slate-500'}`}
          data-testid="exam-state"
        >
          {state.text}
        </span>
        <span className="flex items-center gap-1">
          {secondary && (
            <Link href={secondary.href} className={textLink} data-testid="exam-secondary">
              {secondary.label}
            </Link>
          )}
          <Link
            href={primary.href}
            className={primary.kind === 'resume' ? primaryButton : quietButton}
            data-testid="exam-action"
            data-action={primary.kind}
          >
            {primary.label} <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </span>
      </div>
    </article>
  );
}

function PlusCard({ exam }: { exam: ExamCard }) {
  const { primary, secondary } = examActions(exam);
  const state = examState(exam);
  const facts = [
    exam.facts.demandingCount ? `${exam.facts.demandingCount} câu nâng cao` : null,
    exam.facts.chapterCount >= 2 ? `${exam.facts.chapterCount} chương` : null,
    exam.sourceName,
  ].filter((fact): fact is string => Boolean(fact));
  return (
    <article
      className={`${PLUS_SURFACE} flex h-full flex-col p-5 sm:p-6`}
      data-testid="exam-card"
      data-exam={exam.id}
      data-tier="PLUS"
      data-locked={exam.locked}
      data-state={state.tone}
    >
      <PlusTexture />
      <PlusRibbon />
      <div className="relative flex h-full flex-col">
        <p className="text-[12px] font-extrabold uppercase tracking-[0.12em] text-[#F5B83D]">
          Tuyển chọn · {EXAM_SCOPE_SHORT[exam.scope]}
        </p>
        <h3 className="mt-1 pr-12 text-[18px] font-extrabold leading-6 text-white sm:text-[19px]">
          {exam.name}
        </h3>
        <Meta exam={exam} dark />
        {exam.curatorNote && (
          <p
            className="mt-4 border-l-2 border-[#F5B83D] pl-3 text-[14px] leading-6 text-white/85"
            data-testid="curator-note"
          >
            {exam.curatorNote}
          </p>
        )}
        {facts.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2">
            {facts.map((fact) => (
              <li
                key={fact}
                className="rounded-full bg-white/10 px-3 py-1 text-[12px] font-semibold text-white/90 ring-1 ring-white/15"
              >
                {fact}
              </li>
            ))}
          </ul>
        )}
        <div className="flex-1" />
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
          <span
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-white/80"
            data-testid="exam-state"
          >
            {state.tone === 'locked' && <Lock className="size-3.5" aria-hidden="true" />}
            {state.text}
          </span>
          <span className="flex items-center gap-1">
            {secondary && (
              <Link href={secondary.href} className={plusTextLink} data-testid="exam-secondary">
                {secondary.label}
              </Link>
            )}
            <Link
              href={primary.href}
              className={exam.locked ? plusQuiet : plusButton}
              data-testid="exam-action"
              data-action={primary.kind}
            >
              {exam.locked && <Eye className="size-4" aria-hidden="true" />}
              {primary.label}
              {!exam.locked && <ArrowRight className="size-4" aria-hidden="true" />}
            </Link>
          </span>
        </div>
      </div>
    </article>
  );
}

function ResumeExam({ exam }: { exam: ExamCard }) {
  const attempt = exam.inProgress!;
  const left = minutesLeft(attempt.deadlineAt);
  return (
    <section
      className="mt-6 grid gap-4 rounded-[24px] border border-[#CFE0FF] bg-gradient-to-r from-[#F2F7FF] to-white p-5 sm:p-6 md:grid-cols-[1fr_auto_auto] md:items-center md:gap-8"
      aria-label="Bài thi đang làm"
      data-testid="exam-resume"
    >
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-[12px] font-extrabold uppercase tracking-[0.14em] text-[#0052FF]">
          <PlayCircle className="size-4" aria-hidden="true" /> Bài thi đang làm
        </p>
        <h2 className="mt-1 truncate text-[18px] font-extrabold text-[#091224]">{exam.name}</h2>
        <p className="mt-1 text-[13px] text-slate-600">
          Đồng hồ vẫn chạy khi em rời trang; hết giờ bài sẽ được nộp tự động.
        </p>
      </div>
      <div className="flex gap-6">
        <div>
          <p className="text-[12px] font-semibold text-slate-500">Đã trả lời</p>
          <p className="text-[18px] font-extrabold text-[#091224]">
            {attempt.answered}/{attempt.total}
          </p>
        </div>
        <div>
          <p className="text-[12px] font-semibold text-slate-500">Còn lại</p>
          <p
            className={`flex items-center gap-1 text-[18px] font-extrabold ${left <= 5 ? 'text-rose-600' : 'text-[#091224]'}`}
          >
            <Timer className="size-4" aria-hidden="true" /> {left} phút
          </p>
        </div>
      </div>
      <Link
        href={examAttemptHref(attempt.id)}
        className={primaryButton}
        data-testid="exam-resume-action"
      >
        Làm tiếp <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </section>
  );
}

function Filters({ exams, scope }: { exams: ExamCard[]; scope: ExamScope | 'ALL' }) {
  const counts = new Map<ExamScope, number>();
  for (const exam of exams) counts.set(exam.scope, (counts.get(exam.scope) ?? 0) + 1);
  const scopes = EXAM_SCOPE_ORDER.filter((item) => counts.get(item));
  if (scopes.length < 2) return null;
  const chip = (id: ExamScope | 'ALL', label: string, count: number) => {
    const active = id === scope;
    return (
      <Link
        key={id}
        href={id === 'ALL' ? EXAMS_PAGE : `${EXAMS_PAGE}?scope=${id.toLowerCase()}`}
        replace
        scroll={false}
        aria-current={active ? 'page' : undefined}
        className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-[13px] font-bold transition-colors ${
          active
            ? 'bg-[#091224] text-white'
            : 'border border-[#D5DEEA] bg-white text-slate-600 hover:bg-slate-50'
        }`}
        data-testid="exam-filter"
        data-scope={id}
      >
        {label}
        <span className={`text-[12px] ${active ? 'text-white/70' : 'text-slate-400'}`}>
          {count}
        </span>
      </Link>
    );
  };
  return (
    <nav className="mt-7 flex flex-wrap gap-2" aria-label="Lọc đề theo kỳ thi">
      {chip('ALL', 'Tất cả', exams.length)}
      {scopes.map((item) => chip(item, EXAM_SCOPE_LABELS[item], counts.get(item) ?? 0))}
    </nav>
  );
}

export function parseScope(value: string | undefined): ExamScope | 'ALL' {
  const upper = value?.toUpperCase();
  return EXAM_SCOPE_ORDER.find((scope) => scope === upper) ?? 'ALL';
}

export function ExamCatalogView({
  catalog,
  scope,
}: {
  catalog: StudentExamCatalog;
  scope: ExamScope | 'ALL';
}) {
  const visible = catalog.exams.filter((exam) => scope === 'ALL' || exam.scope === scope);
  const plus = visible.filter((exam) => exam.accessTier === 'PLUS');
  const standard = visible.filter((exam) => exam.accessTier === 'FREE');
  const resume = catalog.exams
    .filter((exam) => exam.inProgress && !exam.locked)
    .sort((a, b) => b.inProgress!.startedAt.localeCompare(a.inProgress!.startedAt))[0];

  return (
    <div className="mx-auto w-full max-w-[1080px] pb-14" data-testid="exams-page">
      <header>
        <p className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-[#0052FF] md:flex md:min-h-8 md:items-center md:pl-12 lg:block lg:min-h-0 lg:pl-0">
          Luyện thi
        </p>
        <h1 className="mt-1 text-[28px] font-extrabold tracking-tight text-[#091224] sm:text-[32px]">
          Luyện thi
        </h1>
        <p className="mt-1.5 max-w-[62ch] text-[15px] leading-6 text-slate-600">
          Làm đề như trong phòng thi: tính giờ, nộp bài rồi mới chấm, sau đó xem lại từng câu.
        </p>
        <ul
          className="mt-4 flex flex-wrap gap-2 text-[12px] font-bold text-slate-600"
          aria-label="Cách làm đề"
        >
          {['Tính giờ như thi thật', 'Nộp bài rồi mới chấm', 'Xem lời giải sau khi nộp'].map(
            (item, index) => (
              <li
                key={item}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#EEF2F8] px-3 py-1.5"
              >
                <span className="grid size-4 place-items-center rounded-full bg-[#091224] text-[10px] text-white">
                  {index + 1}
                </span>
                {item}
              </li>
            )
          )}
        </ul>
      </header>

      {resume && <ResumeExam exam={resume} />}

      {catalog.exams.length === 0 ? (
        <section
          className="mt-8 rounded-[24px] border border-[#E5EBF3] bg-white p-8 text-center sm:p-12"
          data-testid="exams-empty"
        >
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#F1F5FB] text-slate-500">
            <FileText className="size-6" aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-[20px] font-extrabold text-[#091224]">
            Chưa có đề thi nào được xuất bản
          </h2>
          <p className="mx-auto mt-2 max-w-[46ch] text-[15px] leading-6 text-slate-600">
            Đề thi sẽ xuất hiện ở đây khi thầy cô xuất bản. Trong lúc chờ, em luyện tập theo bài để
            chuẩn bị nhé.
          </p>
          <Link href="/student/practice" className={`${quietButton} mt-6`}>
            Đi tới Luyện tập
          </Link>
        </section>
      ) : (
        <>
          <Filters exams={catalog.exams} scope={scope} />

          {plus.length > 0 && (
            <section className="mt-8" aria-labelledby="plus-exams" data-testid="plus-shelf">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h2
                  id="plus-exams"
                  className="text-[20px] font-extrabold tracking-tight text-[#091224]"
                >
                  Đề tuyển chọn
                </h2>
                <PlusTag tone="light" />
              </div>
              <p
                className="mt-1 max-w-[70ch] text-[14px] leading-6 text-slate-600"
                data-testid="plus-shelf-note"
              >
                {catalog.hasPlus
                  ? 'Tài khoản của em có Tú Tài Plus: các đề này đã mở.'
                  : 'Đề được Tú Tài chọn riêng cho tài khoản Plus. Em vẫn xem được cấu trúc của từng đề.'}
              </p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {plus.map((exam) => (
                  <PlusCard key={exam.id} exam={exam} />
                ))}
              </div>
            </section>
          )}

          {standard.length > 0 && (
            <section
              className="mt-10"
              aria-labelledby="standard-exams"
              data-testid="standard-shelf"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h2
                  id="standard-exams"
                  className="text-[20px] font-extrabold tracking-tight text-[#091224]"
                >
                  Đề luyện thi
                </h2>
                <p className="text-[13px] font-semibold text-slate-500">
                  {standard.length} đề · miễn phí
                </p>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {standard.map((exam) => (
                  <StandardCard key={exam.id} exam={exam} />
                ))}
              </div>
            </section>
          )}

          {visible.length === 0 && (
            <p className="mt-8 rounded-2xl border border-dashed border-[#D5DEEA] bg-white p-5 text-[14px] text-slate-600">
              Chưa có đề nào trong mục này.{' '}
              <Link href={EXAMS_PAGE} className="font-bold text-[#0052FF]">
                Xem tất cả đề
              </Link>
            </p>
          )}
        </>
      )}
    </div>
  );
}
