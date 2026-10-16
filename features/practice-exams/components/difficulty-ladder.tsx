import * as React from 'react';
import type { DifficultyMix } from '@/lib/practice/practice-sets';

const STEPS = [
  { key: 'FOUNDATIONAL', label: 'Nền tảng' },
  { key: 'INTERMEDIATE', label: 'Vận dụng' },
  { key: 'ADVANCED', label: 'Nâng cao' },
  { key: 'HIGH_DISCRIMINATION', label: 'Phân hoá' },
] as const;

/** "Nền tảng → Nâng cao": the easiest and hardest level the questions actually have. */
export function difficultyRange(mix: DifficultyMix): string | null {
  const present = STEPS.filter((step) => mix[step.key] > 0);
  if (!present.length) return null;
  const first = present[0].label;
  const last = present[present.length - 1].label;
  return first === last ? first : `${first} → ${last}`;
}

/**
 * Four rising steps, one per difficulty level; a step is filled when the set
 * has questions at that level. Counted from the questions' stored difficulty.
 */
export function DifficultyLadder({
  mix,
  tone = 'light',
  showLabel = true,
}: {
  mix: DifficultyMix;
  tone?: 'light' | 'dark';
  showLabel?: boolean;
}) {
  const range = difficultyRange(mix);
  if (!range) return null;
  const detail = STEPS.filter((step) => mix[step.key] > 0)
    .map((step) => `${step.label} ${mix[step.key]}`)
    .join(', ');
  return (
    <span
      className="inline-flex items-center gap-2"
      title={`Độ khó: ${detail}`}
      data-testid="difficulty-ladder"
    >
      <span className="flex items-end gap-[3px]" aria-hidden="true">
        {STEPS.map((step, index) => {
          const filled = mix[step.key] > 0;
          return (
            <span
              key={step.key}
              className={`w-[5px] rounded-[2px] ${
                filled
                  ? tone === 'dark'
                    ? index >= 2
                      ? 'bg-[#F5B83D]'
                      : 'bg-white'
                    : index >= 2
                      ? 'bg-[#0A1F5C]'
                      : 'bg-[#0052FF]'
                  : tone === 'dark'
                    ? 'bg-white/20'
                    : 'bg-[#DCE4F0]'
              }`}
              style={{ height: 6 + index * 3 }}
            />
          );
        })}
      </span>
      {showLabel && (
        <span
          className={`text-[12px] font-semibold ${tone === 'dark' ? 'text-white/80' : 'text-slate-500'}`}
        >
          <span className="sr-only">Độ khó: </span>
          {range}
        </span>
      )}
    </span>
  );
}
