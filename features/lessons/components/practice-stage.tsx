import * as React from 'react';
import { ListChecks } from 'lucide-react';

/**
 * One practice question on screen. Where the content area is wide enough, the
 * question and its answers sit on the left and the result with the worked
 * solution on the right, kept in view while the solution scrolls on its own,
 * so the student reads the solution beside the question instead of scrolling
 * down to it. Narrower, everything stacks: question, result, then the action.
 *
 * The split starts at 880px of content width (a container query, not the
 * window's width, since the sidebar takes part of the window on desktop).
 */
export function PracticeStage({
  questionId,
  question,
  feedback,
  actions,
}: {
  /** The question on screen: the solution panel starts over at the top for each one. */
  questionId: string;
  question: React.ReactNode;
  /** The result and solution, once the answer is checked. */
  feedback: React.ReactNode | null;
  actions: React.ReactNode;
}) {
  return (
    <div className="@container/stage mt-4" data-testid="practice-stage">
      <div
        className={`grid grid-cols-1 [grid-template-areas:'q'_'f'_'a'] @min-[880px]/stage:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] @min-[880px]/stage:grid-rows-[auto_1fr] @min-[880px]/stage:gap-x-6 @min-[880px]/stage:[grid-template-areas:'q_f'_'a_f']`}
      >
        <div className="min-w-0 [grid-area:q]">{question}</div>
        <div
          key={questionId}
          className={`min-w-0 overscroll-contain [grid-area:f] ${feedback ? 'mt-4' : ''} @min-[880px]/stage:sticky @min-[880px]/stage:top-6 @min-[880px]/stage:mt-0 @min-[880px]/stage:max-h-[calc(100dvh-3rem)] @min-[880px]/stage:self-start @min-[880px]/stage:overflow-y-auto @min-[880px]/stage:rounded-2xl`}
          data-testid="practice-solution-pane"
        >
          {feedback ?? (
            <div
              className="hidden rounded-[24px] border border-dashed border-[#D5DEEA] bg-white/60 p-6 text-center @min-[880px]/stage:block"
              data-testid="solution-placeholder"
            >
              <span className="mx-auto grid size-11 place-items-center rounded-2xl bg-[#F4F8FF] text-[#0052FF]">
                <ListChecks className="size-5" aria-hidden="true" />
              </span>
              <p className="mt-3 text-[15px] font-bold text-[#091224]">Kết quả và lời giải</p>
              <p className="mx-auto mt-1 max-w-[280px] text-sm leading-6 text-slate-500">
                Chọn đáp án rồi bấm Kiểm tra, lời giải từng bước sẽ hiện ở đây.
              </p>
            </div>
          )}
        </div>
        <div className="[grid-area:a] sm:sticky sm:bottom-4 sm:z-10 sm:mt-4 sm:self-start sm:justify-self-end">
          {actions}
        </div>
      </div>
    </div>
  );
}
