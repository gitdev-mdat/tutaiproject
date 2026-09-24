import { describe, expect, it } from 'vitest';

import { CURRICULUM_EXAM_SETS } from './curriculum-data';
import {
  assertSpecialExamSetsAreLast,
  groupKey,
  sortExamSets,
  sortExamSetsNewestFirst,
} from './sorting';

describe('exam-set pedagogical ordering', () => {
  it('renders standard exams before special exams in every curriculum group', () => {
    const groups = new Map<string, typeof CURRICULUM_EXAM_SETS>();
    CURRICULUM_EXAM_SETS.forEach((examSet) => {
      const key = groupKey(examSet);
      groups.set(key, [...(groups.get(key) ?? []), examSet]);
    });

    for (const examSets of groups.values()) {
      const sorted = sortExamSets(examSets);
      expect(() => assertSpecialExamSetsAreLast(sorted)).not.toThrow();

      const firstSpecialIndex = sorted.findIndex((examSet) => examSet.tier === 'SPECIAL');
      if (firstSpecialIndex >= 0) {
        expect(sorted.slice(firstSpecialIndex).every((examSet) => examSet.tier === 'SPECIAL')).toBe(
          true
        );
      }
    }
  });
});

describe('exam-set release ordering', () => {
  it('sorts pinned items first and then by publication date', () => {
    const source = CURRICULUM_EXAM_SETS.filter((examSet) => examSet.scope === 'NATIONAL').slice(
      0,
      3
    );
    const ordered = sortExamSetsNewestFirst([
      { ...source[0], publishedAt: '2026-08-01T00:00:00Z' },
      { ...source[1], publishedAt: '2026-08-08T00:00:00Z' },
      { ...source[2], publishedAt: '2026-07-01T00:00:00Z', isPinned: true },
    ]);

    expect(ordered.map((examSet) => examSet.id)).toEqual([
      source[2].id,
      source[1].id,
      source[0].id,
    ]);
  });
});
