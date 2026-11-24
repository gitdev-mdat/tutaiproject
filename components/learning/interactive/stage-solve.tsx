'use client';

import * as React from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { PracticeQuestion } from '@/lib/practice/grading';
import type { InteractivePlan } from '@/lib/learning/interactive-lesson';
import { VariationTable, useAnalysis, type PieceTone } from '../function-graph';
import { InlineText } from '../rich-text';
import { RuntimeContext } from './beats';
import { TeacherQuestions } from './teacher-questions';
import { ExploreGraph } from './explore-graph';
import { GuidedSolver, type SolverStep } from './guided-solver';
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
    <StageLayout graph={graph} balance="even">
      <Problem label={plan.example?.title ?? 'Ví dụ'} text={problem} />
      <GuidedSolver
        source={plan.main}
        example={plan.example}
        activity="vi-du"
        onProgress={report}
        method={plan.method}
        finishLabel="Bảng biến thiên"
        framedFinish={false}
        finish={
          // The solver said it is right and the graph says "Khớp đồ thị": the
          // table that gathers the four steps needs no third note.
          <VariationTable source={plan.main} animate={!review} />
        }
      />
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
    <StageLayout graph={graph} graphBelowOnPhones={!solved} balance="even">
      <Problem
        label="Thử thách"
        text={`Tìm các khoảng đồng biến và nghịch biến của hàm số $y = ${expression}$.`}
        note="Lần này không có lời giải mẫu. Em làm được!"
      />
      <GuidedSolver
        source={source}
        example={null}
        activity="thu-suc"
        onProgress={report}
        method={plan.method}
        finishLabel="Kiểm tra"
        finish={
          <>
            <p className="flex items-start gap-2 text-[15px] leading-6 text-[#091224]">
              <CheckCircle2
                className="mt-0.5 size-5 shrink-0 text-emerald-600"
                aria-hidden="true"
              />
              <span>
                <strong className="font-bold">Đồ thị vừa hiện ra khớp với kết luận của em.</strong>{' '}
                Xanh là các khoảng đồng biến, đỏ là các khoảng nghịch biến.
              </span>
            </p>
            {checks.length > 0 && (
              <TeacherQuestions lessonId={lessonId} questions={checks} hint={plan.method} />
            )}
          </>
        }
      />
    </StageLayout>
  );
}

/** The task, in one short card above the workspace. */
function Problem({ label, text, note }: { label: string; text: string; note?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3" data-testid="problem">
      <p className="text-[15px] leading-7 text-[#091224] sm:text-[16px]">
        <span className="mr-1.5 text-[12px] font-bold uppercase tracking-[0.12em] text-slate-500">
          {label}
        </span>
        <span className="font-semibold">
          <InlineText text={text} />
        </span>
      </p>
      {note && <p className="text-[13px] text-slate-500">{note}</p>}
    </div>
  );
}
