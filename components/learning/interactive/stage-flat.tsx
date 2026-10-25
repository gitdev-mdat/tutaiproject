'use client';

import * as React from 'react';
import {
  derivative,
  formatNumber,
  formatPolynomial,
  nonTurningPoints,
} from '@/lib/learning/function-model';
import type { InteractivePlan } from '@/lib/learning/interactive-lesson';
import { useAnalysis } from '../function-graph';
import { InlineText, RichText } from '../rich-text';
import {
  Beat,
  DiscoveryCard,
  Feedback,
  Outcome,
  Prompt,
  RuntimeContext,
  useAttempt,
  type Choice,
} from './beats';
import { ExploreGraph } from './explore-graph';
import { StageLayout } from './stage-layout';
import { Question, useScan } from './stage-slope';

/**
 * Part 3, "f′ = 0 thì sao?": a function whose derivative vanishes at a point
 * where the graph keeps going the same way (y = x³). The student predicts,
 * checks by dragging across that point, then meets the extension in the
 * admin's words.
 */
export function FlatStage({
  plan,
  height,
  onReady,
}: {
  plan: InteractivePlan;
  height: number;
  onReady: () => void;
}) {
  const data = useAnalysis(plan.flat ?? '');
  const { review } = React.useContext(RuntimeContext);
  const a = data?.analysis ?? null;
  const view = data?.view ?? null;
  const scan = useScan(a, view, review);
  const predict = useAttempt('mo-rong/du-doan');
  const explored = useAttempt('mo-rong/keo-qua-diem');
  const conclude = useAttempt('mo-rong/ket-luan');

  React.useEffect(() => {
    if (scan.complete && predict.done && !explored.done) explored.complete();
  }, [scan.complete, predict.done, explored]);
  const ready = a ? conclude.done : true;
  React.useEffect(() => {
    if (ready) onReady();
  }, [ready, onReady]);

  const extension = plan.extension ? (
    <DiscoveryCard title={plan.extension.title.replace(/[:：]\s*$/, '')} testId="discovery-flat">
      <RichText content={plan.extension.body} className="[&_p]:my-1" />
    </DiscoveryCard>
  ) : null;

  if (!a || !view) return <StageLayout graph={null}>{extension}</StageLayout>;

  const flatAt = nonTurningPoints(a);
  const at = flatAt.map(formatNumber).join(', ');
  const fPrime = formatPolynomial(derivative(a.fn).num);
  const direction = a.pieces[0]?.direction === 'down' ? 'down' : 'up';
  const word = direction === 'up' ? 'đi lên' : 'đi xuống';
  const verb = direction === 'up' ? 'đồng biến' : 'nghịch biến';

  const predictChoices: Choice[] = [
    {
      id: 'doi-chieu',
      label: `Có, đồ thị đổi chiều tại x = ${at}`,
      correct: false,
      why: 'f′ = 0 chỉ nói tiếp tuyến nằm ngang tại đó. Đồ thị có đổi chiều hay không còn tuỳ dấu của f′ hai bên.',
    },
    { id: 'giu-chieu', label: `Không, đồ thị vẫn ${word}`, correct: true },
  ];
  const conclusionChoices: Choice[] = [
    { id: 'ca-truc', label: `Hàm số ${verb} trên ℝ`, correct: true },
    {
      id: 'tach',
      label: `Chỉ ${verb} trên từng khoảng, bỏ điểm x = ${at}`,
      correct: false,
      why: `f′ chỉ bằng 0 tại hữu hạn điểm và không đổi dấu, nên hàm số vẫn ${verb} trên cả ℝ.`,
    },
    {
      id: 'khong',
      label: `Không ${verb} vì f′(${at}) = 0`,
      correct: false,
      why: 'Một vài điểm có f′ = 0 không làm hàm số ngừng tăng (hoặc giảm). Nhìn lại đồ thị em vừa kéo.',
    },
  ];

  const graph = (
    <ExploreGraph
      source={plan.flat!}
      height={height}
      marks={predict.done ? flatAt : []}
      paint={explored.done ? a.pieces.map((piece) => piece.direction) : undefined}
      point={
        predict.done
          ? { x: scan.x, onChange: scan.move, tangent: true, slope: true }
          : { x: flatAt[0] ?? 0, onChange: () => undefined, tangent: true, slope: true }
      }
      snapTo={a.criticalPoints}
      trail={predict.done ? { visited: scan.visited, zeros: scan.zeros } : null}
      slider={predict.done}
      testId="graph-flat"
    />
  );

  return (
    <StageLayout graph={graph}>
      <Beat
        number={1}
        title="Dự đoán"
        status={predict.done ? 'done' : 'active'}
        summary={`Tại x = ${at}, f′ = 0 nhưng đồ thị vẫn ${word}.`}
        testId="beat-flat-predict"
      >
        <Prompt>
          <InlineText
            text={`Với $${plan.flat!.replace(/^\s*y\s*=\s*/, 'y = ')}$, ta có $y' = ${fPrime}$.`}
          />{' '}
          Tại x = {at}, f′ = 0 và tiếp tuyến nằm ngang (như trên hình).
          <br />
          Đồ thị có <span className="text-blue-700">đổi chiều</span> tại x = {at} không?
        </Prompt>
        <Question
          choices={predictChoices}
          attempt={predict}
          testId="flat-predict"
          hints={[
            'Đồ thị chỉ đổi chiều khi f′ đổi dấu: từ + sang − hoặc ngược lại.',
            `Thử một số âm và một số dương: f′ có cùng dấu ở hai bên x = ${at} không?`,
          ]}
        />
        {predict.done && (
          <Outcome
            attempt={predict}
            right="Mình kiểm chứng ngay trên đồ thị nhé."
            shown="Đồ thị không đổi chiều. Mình kiểm chứng ngay trên đồ thị nhé."
          />
        )}
      </Beat>

      {predict.done && (
        <Beat
          number={2}
          title="Kiểm chứng"
          status={explored.done ? 'done' : 'active'}
          summary={`Hai bên x = ${at}, f′ cùng dấu ${direction === 'up' ? '+' : '−'}.`}
          testId="beat-flat-scan"
        >
          <Prompt>
            <span className="text-blue-700">Kéo M đi qua x = {at}</span>, từ bên trái sang bên phải.
            Dấu của f′ có đổi không?
          </Prompt>
          {!explored.done && (
            <p className="mt-2 text-[14px] text-slate-500" data-testid="flat-scan-status">
              Đã quét {scan.intervalsSeen}/{a.intervals.length} phía
              {scan.zeros.length ? `, đã chạm x = ${at}` : `, chưa chạm x = ${at}`}.
            </p>
          )}
          {explored.done && !review && (
            <Feedback tone="right" title="Đúng như em thấy:">
              f′ chỉ chạm 0 tại một điểm rồi lại {direction === 'up' ? 'dương' : 'âm'}. Đồ thị không
              quay đầu.
            </Feedback>
          )}
        </Beat>
      )}

      {explored.done && (
        <Beat
          number={3}
          title="Kết luận"
          status={conclude.done ? 'done' : 'active'}
          summary={`Hàm số ${verb} trên ℝ.`}
          testId="beat-flat-conclude"
        >
          <Prompt>Vậy với hàm số này, kết luận nào đúng?</Prompt>
          <Question
            choices={conclusionChoices}
            attempt={conclude}
            testId="flat-conclude"
            hints={[
              'Nhìn đồ thị: có đoạn nào đi ngược chiều không?',
              'Điểm có f′ = 0 chỉ là một điểm "nghỉ" trên đường đi, không phải một khoảng.',
            ]}
          />
        </Beat>
      )}

      {conclude.done && extension}
    </StageLayout>
  );
}
