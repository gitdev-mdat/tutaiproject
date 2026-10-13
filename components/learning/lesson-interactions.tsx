'use client';

import * as React from 'react';
import { ArrowDown, Check, ChevronDown, Eye, HelpCircle, RotateCcw } from 'lucide-react';

/**
 * Small interactive moments inside a lesson. Content arrives already rendered
 * from the server; these components only decide what is shown when.
 */

export function WorkedExampleSteps({
  steps,
}: {
  steps: Array<{ label: string; content: React.ReactNode; after?: React.ReactNode }>;
}) {
  const [shown, setShown] = React.useState(1);
  const all = shown >= steps.length;
  const nextRef = React.useRef<HTMLLIElement>(null);
  const reveal = (count: number) => {
    setShown(count);
    window.requestAnimationFrame(() => nextRef.current?.focus());
  };

  return (
    <div>
      <ol className="relative space-y-3">
        {steps.slice(0, shown).map((step, index) => (
          <li
            key={step.label + index}
            ref={index === shown - 1 && index > 0 ? nextRef : undefined}
            tabIndex={-1}
            className="relative pl-11 focus:outline-none"
          >
            <span
              aria-hidden="true"
              className="absolute left-0 top-0 grid size-8 place-items-center rounded-full bg-indigo-600 text-[13px] font-bold text-white"
            >
              {index + 1}
            </span>
            {index < steps.length - 1 && (
              <span
                aria-hidden="true"
                className="absolute bottom-[-14px] left-[15px] top-9 w-0.5 bg-indigo-100"
              />
            )}
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-[13px] font-bold uppercase tracking-wide text-indigo-600">
                {step.label}
              </p>
              <div className="mt-1">{step.content}</div>
            </div>
            {step.after && <div className="mt-3">{step.after}</div>}
          </li>
        ))}
      </ol>
      {!all ? (
        <div className="mt-4 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/60 p-4">
          <p className="flex items-start gap-2 text-[14px] leading-6 text-indigo-900">
            <HelpCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Em thử tự làm {steps[shown].label.toLowerCase()} trước, rồi bấm xem để so sánh.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => reveal(shown + 1)}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-[14px] font-bold text-white hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              <ArrowDown className="size-4" aria-hidden="true" /> Xem{' '}
              {steps[shown].label.toLowerCase()}
            </button>
            <button
              type="button"
              onClick={() => reveal(steps.length)}
              className="inline-flex h-10 items-center rounded-xl px-3 text-[14px] font-semibold text-indigo-700 hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              Hiện toàn bộ lời giải
            </button>
          </div>
          <p className="sr-only" aria-live="polite">
            Đang hiện {shown} trên {steps.length} bước.
          </p>
        </div>
      ) : (
        steps.length > 1 && (
          <button
            type="button"
            onClick={() => setShown(1)}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[13px] font-semibold text-slate-500 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" /> Làm lại từng bước
          </button>
        )
      )}
    </div>
  );
}

export function MistakeCard({ trap, fix }: { trap: React.ReactNode; fix: React.ReactNode | null }) {
  const [open, setOpen] = React.useState(false);
  const id = React.useId();
  return (
    <li className="rounded-xl border border-amber-200 bg-white p-4">
      <p className="text-[15px] leading-7 text-slate-800">{trap}</p>
      {fix && (
        <>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={id}
            onClick={() => setOpen((value) => !value)}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-[13px] font-bold text-amber-800 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          >
            <Eye className="size-3.5" aria-hidden="true" />
            {open ? 'Ẩn cách tránh' : 'Em sẽ tránh thế nào? Xem gợi ý'}
            <ChevronDown
              className={`size-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>
          <div
            id={id}
            hidden={!open}
            className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-[15px] leading-7 text-emerald-900"
          >
            <span className="font-bold">Cách tránh: </span>
            {fix}
          </div>
        </>
      )}
    </li>
  );
}

type Answer = 'yes' | 'unsure';

/**
 * The "Check" beat: the student rates each of the lesson's own objectives.
 * Nothing is stored; the answers only steer what to do next.
 */
export function SelfCheck({
  objectives,
  practiceHref,
}: {
  objectives: React.ReactNode[];
  practiceHref: string | null;
}) {
  const [answers, setAnswers] = React.useState<Record<number, Answer>>({});
  const answered = Object.keys(answers).length;
  const unsure = Object.values(answers).filter((answer) => answer === 'unsure').length;
  const done = answered === objectives.length;

  return (
    <div>
      <ul className="space-y-2.5">
        {objectives.map((objective, index) => {
          const answer = answers[index];
          return (
            <li
              key={index}
              className={`rounded-xl border p-3.5 transition-colors ${
                answer === 'yes'
                  ? 'border-emerald-200 bg-emerald-50/70'
                  : answer === 'unsure'
                    ? 'border-amber-200 bg-amber-50/70'
                    : 'border-slate-200 bg-white'
              }`}
            >
              <p className="text-[15px] leading-7 text-slate-800">{objective}</p>
              <div
                className="mt-2 flex flex-wrap gap-2"
                role="group"
                aria-label={`Mục tiêu ${index + 1}`}
              >
                {(
                  [
                    ['yes', 'Em làm được rồi'],
                    ['unsure', 'Em chưa chắc'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={answer === value}
                    onClick={() => setAnswers((current) => ({ ...current, [index]: value }))}
                    className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                      answer === value
                        ? value === 'yes'
                          ? 'border-emerald-600 bg-emerald-600 text-white'
                          : 'border-amber-500 bg-amber-500 text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {answer === value && <Check className="size-3.5" aria-hidden="true" />}
                    {label}
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
      <div aria-live="polite">
        {done && (
          <div
            className={`mt-4 rounded-xl p-4 text-[15px] leading-7 ${
              unsure ? 'bg-amber-50 text-amber-900' : 'bg-emerald-50 text-emerald-900'
            }`}
          >
            {unsure ? (
              <>
                Em còn {unsure} ý chưa chắc. Đọc lại{' '}
                <a className="font-bold underline underline-offset-2" href="#kien-thuc">
                  kiến thức chính
                </a>{' '}
                và làm lại{' '}
                <a className="font-bold underline underline-offset-2" href="#vi-du">
                  ví dụ
                </a>{' '}
                từng bước trước khi luyện tập nhé.
              </>
            ) : (
              <>
                Tốt lắm! Em đã sẵn sàng.{' '}
                {practiceHref ? (
                  <a className="font-bold underline underline-offset-2" href={practiceHref}>
                    Làm bài luyện tập để kiểm chứng
                  </a>
                ) : (
                  'Xem lại phần ghi nhớ rồi chuyển sang bài tiếp theo.'
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
