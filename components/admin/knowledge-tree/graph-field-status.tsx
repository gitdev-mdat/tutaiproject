'use client';

import * as React from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import {
  analyzeFunction,
  formatInterval,
  formatNumber,
  nonTurningPoints,
} from '@/lib/learning/function-model';
import { practiceRole } from '@/lib/learning/interactive-lesson';
import { listItems, parseExamples } from '@/lib/knowledge-tree/lesson-journey';

/**
 * Feedback under the "Hàm số minh hoạ" field: what the student's graph will
 * show, or why the function cannot be drawn. When the field is empty and the
 * worked example is about a function we can draw, the editor may copy it in
 * with one click; nothing is filled in without the editor choosing to.
 */
export function GraphFieldStatus({
  value,
  example,
  onUse,
}: {
  value: string;
  example: string;
  onUse: (value: string) => void;
}) {
  const trimmed = value.trim();
  const result = React.useMemo(() => (trimmed ? analyzeFunction(trimmed) : null), [trimmed]);
  const suggestion = React.useMemo(() => {
    if (trimmed) return null;
    for (const item of parseExamples(example)) {
      const match = /\$\s*((?:y|f\s*\(\s*x\s*\))\s*=[^$]+)\$/.exec(item.problem);
      if (match && analyzeFunction(match[1]).ok) return match[1].trim();
    }
    return null;
  }, [trimmed, example]);

  if (!trimmed) {
    return suggestion ? (
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-4 py-2.5 text-xs text-slate-600">
        <span>
          Ví dụ của bài dùng <code className="rounded bg-slate-100 px-1">{suggestion}</code>.
        </span>
        <button
          type="button"
          onClick={() => onUse(suggestion)}
          className="rounded-md bg-blue-50 px-2 py-1 font-semibold text-blue-700 hover:bg-blue-100"
          data-testid="graph-use-example"
        >
          Dùng hàm số này
        </button>
      </div>
    ) : null;
  }
  if (!result) return null;
  if (!result.ok) {
    return (
      <p
        className="flex items-start gap-1.5 border-t border-slate-100 px-4 py-2.5 text-xs text-rose-700"
        role="alert"
      >
        <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
        Chưa vẽ được: {result.error} Học sinh sẽ không thấy đồ thị cho đến khi sửa.
      </p>
    );
  }
  const { pieces } = result.analysis;
  return (
    <p
      className="flex items-start gap-1.5 border-t border-slate-100 px-4 py-2.5 text-xs text-emerald-700"
      data-testid="graph-status"
    >
      <CheckCircle2 className="mt-px size-3.5 shrink-0" aria-hidden="true" />
      Đồ thị vẽ được.{' '}
      {pieces
        .map(
          (piece) =>
            `${piece.direction === 'up' ? 'Đồng biến' : 'Nghịch biến'} trên ${formatInterval(piece.from, piece.to)}`
        )
        .join('; ')}
      . Hãy kiểm tra lại với lời giải của bài.
    </p>
  );
}

/**
 * Feedback under "Hàm cho học sinh tự làm": each line, what the interactive
 * lesson will use it for, or why it cannot. Only lessons with the interactive
 * pilot turned on use these functions.
 */
export function PracticeGraphStatus({ value, main }: { value: string; main: string }) {
  const lines = listItems(value);
  if (!lines.length) return null;
  return (
    <ul
      className="space-y-1 border-t border-slate-100 px-4 py-2.5 text-xs"
      data-testid="practice-graph-status"
    >
      {lines.map((line, index) => {
        const role = practiceRole(line, main.trim() || null);
        return (
          <li
            key={index}
            className={`flex items-start gap-1.5 ${role.ok ? 'text-emerald-700' : 'text-rose-700'}`}
          >
            {role.ok ? (
              <CheckCircle2 className="mt-px size-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
            )}
            <span>
              <code className="rounded bg-slate-100 px-1 text-slate-700">{line}</code>{' '}
              {role.ok
                ? role.role === 'flat'
                  ? `dùng cho phần "f′ = 0 thì sao?": y′ = 0 tại x = ${nonTurningPoints(role.analysis).map(formatNumber).join(', ')} nhưng không đổi dấu.`
                  : `dùng cho "Đến lượt em": ${role.analysis.pieces
                      .map(
                        (piece) =>
                          `${piece.direction === 'up' ? 'đồng biến' : 'nghịch biến'} trên ${formatInterval(piece.from, piece.to)}`
                      )
                      .join('; ')}.`
                : role.error}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
