import * as React from 'react';

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
            <p
              className="hidden pt-6 text-sm text-slate-400 @min-[880px]/stage:block"
              data-testid="solution-placeholder"
            >
              Lời giải hiện ở đây sau khi em kiểm tra.
            </p>
          )}
        </div>
        <div className="[grid-area:a] sm:sticky sm:bottom-4 sm:z-10 sm:mt-4 sm:self-start sm:justify-self-end">
          {actions}
        </div>
      </div>
    </div>
  );
}
