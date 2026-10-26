import * as React from 'react';

/** For the result panel inside the stage: side by side, the stage draws the card around it. */
export const STAGE_FEEDBACK_CLASS = '@min-[880px]/stage:border-0';

/**
 * One practice question on screen. Where the content area is wide enough, the
 * question, its answers and the action sit in one card on the left and the
 * result with the worked solution in a card on the right. The two cards are
 * always the same height: the question card's, and at least a comfortable
 * height for the screen, so a short question does not leave a stub beside a
 * long solution. A solution longer than that scrolls inside its card.
 * Narrower, everything stacks: question, result, then the action.
 *
 * The split starts at 880px of content width (a container query, not the
 * window's width, since the sidebar takes part of the window on desktop).
 * Styles that only apply to one layout carry its query, so the two never
 * compete for the same property.
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
      <div className="grid grid-cols-1 [grid-template-areas:'q'_'f'_'a'] @min-[880px]/stage:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] @min-[880px]/stage:gap-x-6 @min-[880px]/stage:[grid-template-areas:'q_f']">
        {/* Side by side: one card holding the question and its action. Stacked: no box of its own. */}
        <div className="contents @min-[880px]/stage:flex @min-[880px]/stage:min-h-[min(640px,calc(100dvh-11rem))] @min-[880px]/stage:min-w-0 @min-[880px]/stage:flex-col @min-[880px]/stage:gap-6 @min-[880px]/stage:rounded-[24px] @min-[880px]/stage:border @min-[880px]/stage:border-[#E5EBF3] @min-[880px]/stage:bg-white @min-[880px]/stage:p-6 @min-[880px]/stage:[grid-area:q]">
          <div className="min-w-0 [grid-area:q] @max-[879px]/stage:rounded-[24px] @max-[879px]/stage:border @max-[879px]/stage:border-[#E5EBF3] @max-[879px]/stage:bg-white @max-[879px]/stage:p-5 sm:@max-[879px]/stage:p-7">
            {question}
          </div>
          <div className="[grid-area:a] sm:sticky sm:bottom-4 sm:z-10 sm:@max-[879px]/stage:mt-4 sm:@max-[879px]/stage:self-start sm:@max-[879px]/stage:justify-self-end @min-[880px]/stage:mt-auto @min-[880px]/stage:border-t @min-[880px]/stage:border-[#EEF2F7] @min-[880px]/stage:bg-white @min-[880px]/stage:pt-5">
            {actions}
          </div>
        </div>
        <div
          className={`min-w-0 [grid-area:f] ${feedback ? '@max-[879px]/stage:mt-4' : ''} @min-[880px]/stage:relative @min-[880px]/stage:overflow-hidden @min-[880px]/stage:rounded-[24px] @min-[880px]/stage:border @min-[880px]/stage:border-[#E5EBF3] @min-[880px]/stage:bg-white`}
          data-testid="practice-solution-pane"
        >
          <div
            key={questionId}
            className="overscroll-contain @min-[880px]/stage:absolute @min-[880px]/stage:inset-0 @min-[880px]/stage:overflow-y-auto"
            data-testid="practice-solution-scroll"
          >
            {feedback ?? (
              <p
                className="hidden p-6 text-sm text-slate-400 @min-[880px]/stage:block"
                data-testid="solution-placeholder"
              >
                Lời giải hiện ở đây sau khi em kiểm tra.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
