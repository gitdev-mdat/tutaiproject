'use client';

import * as React from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { PracticeQuestion } from '@/lib/practice/grading';
import type { InteractivePlan } from '@/lib/learning/interactive-lesson';
import { VariationTable, useAnalysis, type PieceTone } from '../function-graph';
import { QuickCheck } from '../quick-check';
import { InlineText } from '../rich-text';
import { Feedback, RuntimeContext } from './beats';
import { ExploreGraph } from './explore-graph';
import { GuidedSolver, MethodSteps, type SolverStep } from './guided-solver';
import { StageLayout } from './stage-layout';

const AFTER = (step: SolverStep, target: SolverStep) => {
  const order: SolverStep[] = ['domain', 'derivative', 'roots', 'signs', 'conclusion', 'solved'];
  return order.indexOf(step) > order.indexOf(target);
};

/**
 * Part 4, "Tự giải bài mẫu": the admin's worked example, solved by the
 * student. The graph follows: the zeros of y′ appear once found, the pieces
 * take their colour once the signs are right.
 */
export function SolveStage({
  plan,
  height,
  onReady,
}: {
  plan: InteractivePlan;
  height: number;
  onReady: () => void;
}) {
  const data = useAnalysis(plan.main);
  const { review } = React.useContext(RuntimeContext);
  const [step, setStep] = React.useState<SolverStep>(review ? 'solved' : 'domain');
  const report = React.useCallback((next: SolverStep) => setStep(next), []);
  React.useEffect(() => {
    if (step === 'solved') onReady();
  }, [step, onReady]);
  if (!data) return null;
  const a = data.analysis;
  const paint: PieceTone[] | undefined = AFTER(step, 'signs')
    ? a.pieces.map((piece) => piece.direction)
    : undefined;
  const problem =
    plan.example?.problem ?? `Tìm các khoảng đồng biến và nghịch biến của hàm số $${plan.main}$.`;

  const graph = (
    <ExploreGraph
      source={plan.main}
      height={height}
      marks={AFTER(step, 'roots') ? a.criticalPoints : []}
      paint={paint}
      bands={
        AFTER(step, 'signs') && !AFTER(step, 'conclusion')
          ? a.intervals.map((interval) => ({
              from: interval.from,
              to: interval.to,
              tone: interval.sign > 0 ? ('up' as const) : ('down' as const),
            }))
          : []
      }
      pulse={step === 'signs' ? a.criticalPoints : undefined}
      testId="graph-solve"
      badge={
        step === 'solved' ? (
          <span className="tt-pop inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[13px] font-bold text-emerald-700">
            <CheckCircle2 className="size-4" aria-hidden="true" /> Khớp đồ thị
          </span>
        ) : null
      }
    />
  );

  return (
    <StageLayout graph={graph}>
      <div
        className="rounded-2xl border border-slate-200 bg-white px-4 py-3.5"
        data-testid="problem"
      >
        <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-slate-500">
          {plan.example?.title ?? 'Ví dụ'}
        </p>
        <p className="mt-1 text-[16px] font-semibold leading-7 text-[#091224]">
          <InlineText text={problem} />
        </p>
      </div>
      <MethodSteps method={plan.method} step={step} />
      <GuidedSolver
        source={plan.main}
        example={plan.example}
        activity="vi-du"
        onProgress={report}
      />
      {step === 'solved' && (
        <>
          {!review && (
            <Feedback tone="right" title="Kết luận của em khớp với đồ thị.">
              Đây là bảng biến thiên gom lại cả bốn bước.
            </Feedback>
          )}
          <VariationTable source={plan.main} animate={!review} />
        </>
      )}
    </StageLayout>
  );
}

/**
 * Part 5, "Đến lượt em": a new function, with its graph locked until the
 * student has solved it, then drawn as the check. The lesson's own practice
 * questions follow when there are any.
 */
export function ChallengeStage({
  plan,
  height,
  checks,
  lessonId,
  onReady,
}: {
  plan: InteractivePlan;
  height: number;
  checks: PracticeQuestion[];
  lessonId: string;
  onReady: () => void;
}) {
  const source = plan.practice!;
  const data = useAnalysis(source);
  const { review } = React.useContext(RuntimeContext);
  const [step, setStep] = React.useState<SolverStep>(review ? 'solved' : 'domain');
  const report = React.useCallback((next: SolverStep) => setStep(next), []);
  React.useEffect(() => {
    if (step === 'solved') onReady();
  }, [step, onReady]);
  if (!data) return null;
  const a = data.analysis;
  const solved = step === 'solved';
  const expression = source.replace(/^\s*y\s*=\s*/, '');

  const graph = (
    <ExploreGraph
      source={source}
      height={height}
      hidden={
        solved ? null : (
          <>
            <strong className="block text-[15px] text-[#091224]">Đồ thị đang được giấu</strong>
            Giải xong 4 bước, đồ thị sẽ hiện ra để em tự kiểm tra kết luận.
          </>
        )
      }
      drawIn={!review}
      marks={a.criticalPoints}
      paint={a.pieces.map((piece) => piece.direction)}
      testId="graph-challenge"
      badge={
        solved ? (
          <span className="tt-pop inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[13px] font-bold text-emerald-700">
            <CheckCircle2 className="size-4" aria-hidden="true" /> Đồ thị xác nhận
          </span>
        ) : null
      }
    />
  );

  return (
    <StageLayout graph={graph} graphBelowOnPhones={!solved}>
      <div
        className="rounded-2xl border border-slate-200 bg-white px-4 py-3.5"
        data-testid="problem"
      >
        <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-slate-500">
          Thử thách
        </p>
        <p className="mt-1 text-[16px] font-semibold leading-7 text-[#091224]">
          <InlineText
            text={`Tìm các khoảng đồng biến và nghịch biến của hàm số $y = ${expression}$.`}
          />
        </p>
        <p className="mt-1 text-[14px] text-slate-500">
          Lần này không có lời giải mẫu. Em làm được!
        </p>
      </div>
      <MethodSteps method={plan.method} step={step} />
      <GuidedSolver source={source} example={null} activity="thu-suc" onProgress={report} />
      {solved && (
        <>
          {!review && (
            <Feedback tone="right" title="Đồ thị vừa hiện ra khớp với kết luận của em.">
              Xanh là các khoảng đồng biến, đỏ là các khoảng nghịch biến.
            </Feedback>
          )}
          {checks.length > 0 && (
            <div className="pt-2" data-testid="lesson-checks">
              <h3 className="text-[15px] font-bold text-[#091224]">Câu hỏi của thầy cô</h3>
              <div className="mt-2">
                <QuickCheck lessonId={lessonId} questions={checks} hint={plan.method} />
              </div>
            </div>
          )}
        </>
      )}
    </StageLayout>
  );
}
