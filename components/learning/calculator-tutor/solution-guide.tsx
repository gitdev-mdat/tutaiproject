'use client';

import * as React from 'react';
import { Calculator, ChevronDown, FileText, ShieldCheck, Sigma } from 'lucide-react';
import { QuestionMath } from '@/components/shared/question-content-renderer';
import { KEYS, replay, screenText } from '@/lib/calculator-tutor/fx570vn-plus';
import type { SolutionGuidePayload, SourceNote } from '@/lib/calculator-tutor/types';
import { CalculatorTutor } from './calculator-tutor';

type Tab = 'derivative' | 'calculator';

const NOTE_STYLE: Record<SourceNote['tone'], { label: string; className: string }> = {
  error: { label: 'Sai', className: 'bg-rose-100 text-rose-800' },
  caution: { label: 'Lưu ý', className: 'bg-amber-100 text-amber-900' },
  missing: { label: 'Thiếu', className: 'bg-slate-200 text-slate-700' },
};

function SignTable({
  table,
}: {
  table: NonNullable<SolutionGuidePayload['derivative']['signTable']>;
}) {
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

function DerivativeMethod({ guide }: { guide: SolutionGuidePayload }) {
  const { derivative } = guide;
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
function SequenceReview({ guide }: { guide: SolutionGuidePayload }) {
  const tutorial = guide.calculator;
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
  const [tab, setTab] = React.useState<Tab>('derivative');
  const tabs: { id: Tab; label: string; Icon: typeof Sigma }[] = [
    { id: 'derivative', label: 'Cách 1: Giải bằng đạo hàm', Icon: Sigma },
    { id: 'calculator', label: 'Cách 2: Thực hành máy tính', Icon: Calculator },
  ];
  return (
    <div className="mt-2 space-y-3" data-testid="solution-guide">
      {audience === 'admin' && (
        <div
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[13px]"
          data-testid="guide-verification"
        >
          <p className="flex items-center gap-1.5 font-bold text-emerald-900">
            <ShieldCheck className="size-4" /> Hướng dẫn đã kiểm chứng ·{' '}
            {guide.calculator.model.name} · mô phỏng dạy học
          </p>
          <p className="mt-0.5 text-emerald-900/80">
            {guide.verification.by}, {guide.verification.on}. Học sinh chỉ thấy phần này sau khi đã
            trả lời câu hỏi.
          </p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-slate-700">
            {guide.verification.checks.map((check) => (
              <li key={check}>{check}</li>
            ))}
          </ul>
          <SequenceReview guide={guide} />
        </div>
      )}
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
        {tab === 'derivative' ? (
          <DerivativeMethod guide={guide} />
        ) : (
          <CalculatorTutor tutorial={guide.calculator} />
        )}
      </div>
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
