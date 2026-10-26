'use client';

import * as React from 'react';
import {
  BookOpen,
  Calculator,
  ChevronDown,
  FileText,
  ShieldCheck,
  Sigma,
  TriangleAlert,
} from 'lucide-react';
import { QuestionMath } from '@/components/shared/question-content-renderer';
import { KEYS, replay, screenText } from '@/lib/calculator-tutor/fx570vn-plus';
import type {
  GuideLevel,
  SolutionGuide,
  SolutionGuidePayload,
  SourceNote,
} from '@/lib/calculator-tutor/types';
import { CalculatorTutor } from './calculator-tutor';
import { GuidedSteps } from './guided-steps';

type Tab = 'derivative' | 'calculator';

const NOTE_STYLE: Record<SourceNote['tone'], { label: string; className: string }> = {
  error: { label: 'Sai', className: 'bg-rose-100 text-rose-800' },
  caution: { label: 'Lưu ý', className: 'bg-amber-100 text-amber-900' },
  missing: { label: 'Thiếu', className: 'bg-slate-200 text-slate-700' },
};

export const LEVEL_LABEL: Record<GuideLevel, { short: string; long: string; className: string }> = {
  A: {
    short: 'Mô phỏng từng phím',
    long: 'Mức A · mô phỏng: em bấm từng phím, màn hình do bản mô phỏng tính',
    className: 'bg-blue-100 text-blue-800',
  },
  B: {
    short: 'Minh hoạ có hướng dẫn',
    long: 'Mức B · minh hoạ: phím được tô sáng, không mô phỏng màn hình',
    className: 'bg-violet-100 text-violet-800',
  },
  C: {
    short: 'Hướng dẫn từng bước',
    long: 'Mức C · từng bước theo lời giải, đánh dấu chỗ nguồn còn thiếu',
    className: 'bg-amber-100 text-amber-900',
  },
};

function SignTable({ table }: { table: NonNullable<SolutionGuide['derivative']['signTable']> }) {
  // Breaks and intervals alternate: 0 | (0;1) | 1 | (1;e) | e | (e;+∞) | +∞.
  const cells = table.breaks.flatMap((value, index) =>
    index < table.signs.length ? [index * 2, index * 2 + 1] : [index * 2]
  );
  const columns = cells.length;
  const row = (
    label: React.ReactNode,
    render: (cell: number) => React.ReactNode,
    testId: string
  ) => (
    <>
      <div
        className={`border-r border-slate-200 px-2 py-1.5 font-serif font-semibold ${testId === 'x' ? '' : 'border-t'}`}
      >
        {label}
      </div>
      {cells.map((cell) => (
        <div
          key={cell}
          className={`px-1 py-1.5 text-center ${testId === 'x' ? '' : 'border-t border-slate-100'}`}
          data-testid={`${testId}-${cell}`}
        >
          {render(cell)}
        </div>
      ))}
    </>
  );
  return (
    <div className="overflow-x-auto" data-testid="sign-table">
      <div
        className="grid min-w-[320px] rounded-xl border border-slate-200 bg-white text-[14px]"
        style={{ gridTemplateColumns: `2.5rem repeat(${columns}, minmax(0, 1fr))` }}
      >
        {row(
          'x',
          (cell) => (cell % 2 === 0 ? <QuestionMath text={`$${table.breaks[cell / 2]}$`} /> : null),
          'x'
        )}
        {row(
          "y'",
          (cell) =>
            cell % 2 === 0 ? (
              <span className="font-bold text-slate-500">{table.marks[cell / 2]}</span>
            ) : (
              <span
                className={`font-bold ${table.signs[(cell - 1) / 2] === '+' ? 'text-emerald-700' : 'text-rose-700'}`}
              >
                {table.signs[(cell - 1) / 2]}
              </span>
            ),
          'sign'
        )}
        {row(
          'y',
          (cell) =>
            cell % 2 === 0 ? (
              table.marks[cell / 2] === '‖' ? (
                <span className="font-bold text-slate-500">‖</span>
              ) : null
            ) : (
              <span className="text-lg">{table.trend[(cell - 1) / 2]}</span>
            ),
          'trend'
        )}
      </div>
    </div>
  );
}

function DerivativeMethod({ derivative }: { derivative: SolutionGuide['derivative'] }) {
  return (
    <div className="space-y-3" data-testid="method-derivative">
      <ol className="space-y-2">
        {derivative.lines.map((line, index) => (
          <li
            key={line.text}
            className={`flex gap-2.5 rounded-xl text-[15px] leading-7 text-slate-800 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-left-1 motion-safe:fill-mode-both motion-safe:duration-300 ${
              line.emphasis ? 'bg-emerald-50 px-3 py-2 ring-1 ring-emerald-200' : ''
            }`}
            style={{ animationDelay: `${index * 120}ms` }}
          >
            <span
              className={`mt-1.5 grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ring-1 ${
                line.emphasis
                  ? 'bg-emerald-600 text-white ring-emerald-600'
                  : 'bg-white text-slate-500 ring-black/10'
              }`}
              aria-hidden="true"
            >
              {index + 1}
            </span>
            <span className="min-w-0 flex-1">
              <QuestionMath text={line.text} />
            </span>
          </li>
        ))}
      </ol>
      {derivative.signTable && <SignTable table={derivative.signTable} />}
    </div>
  );
}

/** For Admin: the whole sequence, every key and the screen it must leave, to check before students see it. */
function SequenceReview({
  tutorial,
}: {
  tutorial: NonNullable<SolutionGuidePayload['calculator']>;
}) {
  const screens = tutorial.steps.map((_, index) =>
    screenText(replay(tutorial.steps.slice(0, index + 1).flatMap((step) => step.keys)))
  );
  return (
    <details className="mt-2 rounded-lg bg-white/70 px-3 py-2" data-testid="sequence-review">
      <summary className="cursor-pointer text-[12px] font-bold text-slate-700">
        Kiểm tra toàn bộ trình tự ({tutorial.steps.length} bước,{' '}
        {tutorial.steps.reduce((sum, step) => sum + step.keys.length, 0)} phím)
      </summary>
      <ol className="mt-2 space-y-2 text-[12px] text-slate-700">
        {tutorial.steps.map((step, index) => {
          const screen = screens[index];
          const ok = screen === step.expect.text;
          return (
            <li key={step.id} className="rounded-md border border-slate-200 bg-white p-2">
              <p className="font-bold">
                {index + 1}. {step.title}
              </p>
              <p className="mt-1 font-mono">{step.keys.map((key) => KEYS[key].label).join('  ')}</p>
              <p
                className={`mt-1 ${ok ? 'text-emerald-700' : 'text-rose-700'}`}
                data-testid="sequence-check"
                data-ok={ok}
              >
                {ok ? '✓' : '✗'} Màn hình: {screen}
              </p>
            </li>
          );
        })}
      </ol>
      <ul className="mt-2 space-y-1 text-[12px]">
        {tutorial.references.map((reference) => (
          <li key={reference.url}>
            <a
              href={reference.url}
              target="_blank"
              rel="noreferrer"
              className="text-blue-700 underline"
            >
              {reference.label}
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** For Admin: what was detected and decided, before any student sees it. */
function AdminGuidePanel({ guide }: { guide: SolutionGuidePayload }) {
  const admin = guide.admin;
  const reference = guide.origin === 'reference';
  return (
    <div
      className={`rounded-xl border p-3 text-[13px] ${reference || guide.verification.status === 'ACCEPTED' ? 'border-emerald-200 bg-emerald-50' : 'border-blue-200 bg-blue-50'}`}
      data-testid="guide-verification"
      data-origin={guide.origin}
    >
      <p className="flex items-center gap-1.5 font-bold text-slate-900">
        <ShieldCheck className="size-4" />
        {reference
          ? `Hướng dẫn đã kiểm chứng · ${guide.calculator?.model.name} · mô phỏng dạy học`
          : `Hướng dẫn tạo tự động · ${LEVEL_LABEL[guide.level].long}`}
      </p>
      <p className="mt-0.5 text-slate-700">
        {guide.operation.label}
        {guide.calculator
          ? ` · ${guide.calculator.steps.length} bước, ${guide.calculator.steps.reduce((sum, step) => sum + step.keys.length, 0)} phím`
          : ` · ${guide.steps.length} bước`}
        {' · '}
        {guide.verification.by}
        {guide.verification.on ? `, ${guide.verification.on}` : ''}. Học sinh chỉ thấy phần này sau
        khi đã trả lời câu hỏi.
      </p>
      {admin && (
        <p
          className={`mt-1 font-semibold ${admin.visibleToStudents ? 'text-emerald-800' : 'text-amber-900'}`}
          data-testid="guide-visibility"
          data-visible={admin.visibleToStudents}
        >
          {admin.visibleToStudents
            ? 'Học sinh đang thấy hướng dẫn này.'
            : admin.review?.status === 'DISABLED' || admin.review?.status === 'ORIGINAL_ONLY'
              ? 'Đã tắt: học sinh chỉ thấy lời giải gốc.'
              : 'Chưa hiện cho học sinh: cần Admin chấp nhận (xem cảnh báo).'}
        </p>
      )}
      {admin && admin.warnings.length > 0 && !reference && (
        <ul className="mt-1.5 space-y-0.5" data-testid="guide-admin-warnings">
          {admin.warnings.map((warning) => (
            <li
              key={warning.code + warning.text}
              className={`flex gap-1.5 ${warning.severity === 'review' ? 'text-amber-900' : 'text-slate-700'}`}
              data-severity={warning.severity}
            >
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
              <span>
                <QuestionMath text={warning.text} />
              </span>
            </li>
          ))}
        </ul>
      )}
      <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-slate-700">
        {guide.verification.checks.map((check) => (
          <li key={check}>{check}</li>
        ))}
      </ul>
      {guide.calculator && <SequenceReview tutorial={guide.calculator} />}
    </div>
  );
}

/**
 * The solution of a question with a verified guide: the methods as separate
 * tabs, and the imported source text underneath, unchanged, with notes on where
 * it is wrong or incomplete.
 */
export function SolutionGuideView({
  guide,
  explanation,
  audience = 'student',
  renderSource,
}: {
  guide: SolutionGuidePayload;
  /** The imported explanation, shown as it is. */
  explanation: string;
  audience?: 'student' | 'admin';
  renderSource: (text: string) => React.ReactNode;
}) {
  const hasMath = Boolean(guide.derivative || guide.mathText);
  const [tab, setTab] = React.useState<Tab>(hasMath ? 'derivative' : 'calculator');
  const tabs: { id: Tab; label: string; Icon: typeof Sigma }[] = [
    {
      id: 'derivative',
      label: guide.derivative ? 'Cách 1: Giải bằng đạo hàm' : 'Cách 1: Lời giải toán học',
      Icon: guide.derivative ? Sigma : BookOpen,
    },
    { id: 'calculator', label: 'Cách 2: Thực hành bằng máy tính', Icon: Calculator },
  ];
  const calculator = (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex h-6 items-center rounded-full px-2.5 text-[12px] font-bold ${LEVEL_LABEL[guide.level].className}`}
          data-testid="guide-level"
          data-level={guide.level}
        >
          {LEVEL_LABEL[guide.level].short}
        </span>
        <span className="text-[12px] text-slate-500">{guide.operation.label}</span>
      </div>
      {guide.calculator ? (
        <CalculatorTutor tutorial={guide.calculator} />
      ) : (
        <GuidedSteps
          steps={guide.steps}
          level={guide.level === 'A' ? 'B' : guide.level}
          modelNote={guide.model.note}
        />
      )}
    </div>
  );
  return (
    <div className="mt-2 space-y-3" data-testid="solution-guide">
      {audience === 'admin' && <AdminGuidePanel guide={guide} />}
      {hasMath ? (
        <>
          <div
            role="tablist"
            aria-label="Cách giải"
            className="grid grid-cols-2 gap-1 rounded-xl bg-white/70 p-1 ring-1 ring-black/5"
          >
            {tabs.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                id={`guide-tab-${id}`}
                aria-selected={tab === id}
                aria-controls={`guide-panel-${id}`}
                onClick={() => setTab(id)}
                data-testid={`guide-tab-${id}`}
                className={`flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-2 text-center text-[13px] leading-tight font-bold transition-colors sm:text-[14px] ${
                  tab === id ? 'bg-blue-700 text-white shadow-sm' : 'text-slate-600 hover:bg-white'
                }`}
              >
                <Icon className="size-4 shrink-0" />
                {label}
              </button>
            ))}
          </div>
          <div
            role="tabpanel"
            id={`guide-panel-${tab}`}
            aria-labelledby={`guide-tab-${tab}`}
            className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
          >
            {tab === 'calculator' ? (
              calculator
            ) : guide.derivative ? (
              <DerivativeMethod derivative={guide.derivative} />
            ) : (
              <div
                className="rounded-xl border border-slate-200 bg-white p-4 text-[15px] leading-7"
                data-testid="guide-math-text"
              >
                <p className="mb-1 text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                  Theo lời giải đã nhập
                </p>
                {renderSource(guide.mathText!)}
              </div>
            )}
          </div>
        </>
      ) : (
        <section aria-label="Thực hành bằng máy tính" data-testid="guide-calculator-only">
          <h3 className="mb-2 flex items-center gap-1.5 text-[15px] font-bold text-slate-900">
            <Calculator className="size-4 text-blue-700" /> Thực hành bằng máy tính
          </h3>
          {calculator}
        </section>
      )}
      <details
        className="group rounded-xl border border-slate-200 bg-white/70"
        data-testid="guide-source"
      >
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-[13px] font-bold text-slate-700 [&::-webkit-details-marker]:hidden">
          <FileText className="size-4 shrink-0 text-slate-500" />
          <span className="flex-1">{guide.source.label}</span>
          {guide.source.notes.length > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-900">
              {guide.source.notes.length} điểm cần lưu ý
            </span>
          )}
          <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-3 border-t border-slate-200 px-3 py-3">
          <ul className="space-y-1.5" data-testid="guide-source-notes">
            {guide.source.notes.map((note) => (
              <li key={note.text} className="flex gap-2 text-[13px] leading-6 text-slate-700">
                <span
                  className={`mt-0.5 h-fit shrink-0 rounded px-1.5 text-[11px] font-bold ${NOTE_STYLE[note.tone].className}`}
                >
                  {NOTE_STYLE[note.tone].label}
                </span>
                <span>
                  <QuestionMath text={note.text} />
                </span>
              </li>
            ))}
          </ul>
          <div className="rounded-lg bg-slate-50 p-3" data-testid="guide-source-text">
            <p className="mb-1 text-[11px] font-bold tracking-wider text-slate-500 uppercase">
              Nguyên văn bản nhập
            </p>
            {renderSource(explanation)}
          </div>
        </div>
      </details>
    </div>
  );
}
