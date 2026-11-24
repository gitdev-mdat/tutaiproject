'use client';

import * as React from 'react';
import { ArrowRight, MessageCircleQuestion, X } from 'lucide-react';
import type { PracticeQuestion } from '@/lib/practice/grading';
import { QuickCheck } from '../quick-check';

/**
 * The teacher's quick questions after the student's own solution, in a
 * focused window instead of appended to the page: one question at a time,
 * its answers, the check and the feedback, all in view. The window is a
 * native modal dialog (focus kept inside, Esc closes, focus returns to the
 * button). It stays mounted while closed, so answers and feedback survive
 * closing and reopening. On phones it fills the screen.
 *
 * The questions are a check, not a gate: the part opens once the solution
 * is done, as before.
 */
export function TeacherQuestions({
  lessonId,
  questions,
  hint,
}: {
  lessonId: string;
  questions: PracticeQuestion[];
  hint?: { title: string; steps: string[] } | null;
}) {
  const dialog = React.useRef<HTMLDialogElement>(null);
  const opener = React.useRef<HTMLButtonElement>(null);
  const [answered, setAnswered] = React.useState(0);
  const total = questions.length;
  const finished = answered >= total;

  const open = () => {
    dialog.current?.showModal();
    window.requestAnimationFrame(() =>
      dialog.current
        ?.querySelector<HTMLElement>('[data-testid="quick-check"]:not([hidden]) h3')
        ?.focus({ preventScroll: true })
    );
  };
  const close = () => dialog.current?.close();

  return (
    <>
      <div
        className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
        data-testid="lesson-checks"
      >
        <MessageCircleQuestion className="size-5 shrink-0 text-blue-600" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold text-[#091224]">Câu hỏi của thầy cô</p>
          <p className="text-[13px] text-slate-500" data-testid="checks-status">
            {answered === 0
              ? `${total} câu hỏi nhanh, chấm ngay từng câu.`
              : finished
                ? `Em đã làm cả ${total} câu.`
                : `Đã làm ${answered}/${total} câu.`}
          </p>
        </div>
        <button
          ref={opener}
          type="button"
          onClick={open}
          aria-haspopup="dialog"
          className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl px-4 text-[14px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
            finished
              ? 'border border-slate-200 bg-white text-[#091224] hover:border-blue-300'
              : 'bg-[#091224] text-white hover:bg-[#1c2740]'
          }`}
          data-testid="checks-open"
        >
          {answered === 0 ? 'Làm ngay' : finished ? 'Xem lại' : 'Làm tiếp'}
          <ArrowRight className="size-4" aria-hidden="true" />
        </button>
      </div>

      <dialog
        ref={dialog}
        aria-labelledby={`${lessonId}-checks-title`}
        onClose={() => opener.current?.focus()}
        onClick={(event) => {
          // A click on the backdrop (outside the panel) closes it.
          if (event.target === dialog.current) close();
        }}
        className="m-0 h-full max-h-none w-full max-w-none bg-transparent p-0 backdrop:bg-[#091224]/45 backdrop:backdrop-blur-[2px] sm:m-auto sm:h-auto sm:max-h-[min(88vh,760px)] sm:w-[min(92vw,880px)] sm:rounded-3xl"
        data-testid="checks-dialog"
      >
        <div className="flex h-full max-h-[inherit] flex-col bg-[#F8FAFD] sm:rounded-3xl">
          <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:rounded-t-3xl sm:px-6">
            <div className="min-w-0 flex-1">
              <h2
                id={`${lessonId}-checks-title`}
                className="text-[17px] font-extrabold text-[#091224]"
              >
                Câu hỏi của thầy cô
              </h2>
              <p className="text-[13px] text-slate-500">
                {answered}/{total} câu đã làm · chấm ngay, không tính điểm
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Đóng, quay lại bài"
              className="grid size-11 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              data-testid="checks-close"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </header>
          <div className="@container min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
            <QuickCheck
              lessonId={lessonId}
              questions={questions}
              hint={hint}
              onAnswered={setAnswered}
            />
          </div>
          <footer className="flex items-center justify-end gap-3 border-t border-slate-200 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:rounded-b-3xl sm:px-6">
            <span className="mr-auto hidden text-[13px] text-slate-500 sm:inline">
              {finished
                ? 'Xong rồi. Quay lại bài để sang phần cuối.'
                : 'Câu trả lời được giữ khi em đóng cửa sổ này.'}
            </span>
            <button
              type="button"
              onClick={close}
              className={`inline-flex min-h-11 items-center whitespace-nowrap rounded-xl px-4 text-[14px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                finished
                  ? 'bg-[#0052FF] text-white hover:bg-[#0044CC]'
                  : 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              }`}
              data-testid="checks-done"
            >
              Quay lại bài
            </button>
          </footer>
        </div>
      </dialog>
    </>
  );
}
