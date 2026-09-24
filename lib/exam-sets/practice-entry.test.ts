import { describe, expect, it } from 'vitest';

import { safeReturnPath } from '@/lib/auth/safe-return-path';
import {
  FREE_DAILY_EXAM_LIMIT,
  parseDailyExamUsage,
  recordExamStart,
  serializeDailyExamUsage,
} from './free-usage';

describe('exam practice entry', () => {
  it('keeps only safe internal return paths', () => {
    expect(
      safeReturnPath('/exam-sets/toan/practice?source=%2Fexam-sets%3Fscope%3Dlesson')
    ).toContain('/exam-sets/toan/practice');
    expect(safeReturnPath('https://example.com/steal')).toBe('/student/dashboard');
    expect(safeReturnPath('//example.com/steal')).toBe('/student/dashboard');
    expect(safeReturnPath('/\\example.com/steal')).toBe('/student/dashboard');
  });

  it('allows continuing an existing exam without consuming another daily slot', () => {
    const today = new Date('2026-07-29T08:00:00.000Z');
    const initial = parseDailyExamUsage(undefined, today);
    const first = recordExamStart(initial, 'exam-1');
    const continued = recordExamStart(first.usage, 'exam-1');

    expect(first.limitReached).toBe(false);
    expect(continued.limitReached).toBe(false);
    expect(continued.usage.examIds).toEqual(['exam-1']);
  });

  it('uses a soft limit after three distinct free exams in one day', () => {
    let usage = parseDailyExamUsage(undefined, new Date('2026-07-29T08:00:00.000Z'));

    for (let index = 1; index <= FREE_DAILY_EXAM_LIMIT; index += 1) {
      const next = recordExamStart(usage, `exam-${index}`);
      expect(next.limitReached).toBe(false);
      usage = next.usage;
    }

    expect(recordExamStart(usage, 'exam-4').limitReached).toBe(true);
    expect(
      parseDailyExamUsage(serializeDailyExamUsage(usage), new Date('2026-07-29T09:00:00.000Z'))
    ).toEqual(usage);
  });
});
