import { describe, expect, it } from 'vitest';

import { CURRICULUM_EXAM_SETS } from './curriculum-data';
import {
  getBrowseDisplayLimits,
  getNextBatchCount,
  getNextVisibleCount,
  getRegularCollectionTitle,
  isNewRelease,
  matchesActiveExamFilter,
  partitionExamSets,
} from './browse-results';

describe('exam-set browse results', () => {
  it.each([
    ['NATIONAL', 'THPT Quốc gia', 'Luyện cấu trúc THPT Quốc gia'],
    ['CHAPTER', 'Tích phân', 'Luyện tập chương Tích phân'],
    ['LESSON', 'Phương pháp đổi biến số', 'Luyện tập Phương pháp đổi biến số'],
    ['SEMESTER', 'Học kỳ 1', 'Luyện tổng hợp Học kỳ 1'],
  ] as const)('resolves the %s collection title', (scope, context, expected) => {
    expect(getRegularCollectionTitle(scope, context)).toBe(expected);
  });

  it('partitions relevant exams into non-overlapping curated and regular results', () => {
    const nationalMath = CURRICULUM_EXAM_SETS.filter((examSet) =>
      matchesActiveExamFilter(examSet, {
        subjectId: 'MATH',
        grade: 12,
        scope: 'NATIONAL',
      })
    );
    const { curated, regular } = partitionExamSets(nationalMath);

    expect(curated).toHaveLength(3);
    expect(regular).toHaveLength(10);
    expect(curated.every((examSet) => examSet.tier === 'SPECIAL')).toBe(true);
    expect(regular.every((examSet) => examSet.tier === 'STANDARD')).toBe(true);
    expect(new Set([...curated, ...regular].map((examSet) => examSet.id)).size).toBe(13);
    expect(regular.map((examSet) => examSet.id)).toEqual([
      'national-structure-01',
      'national-simulation-01',
      'national-structure-02',
      'national-simulation-02',
      'national-structure-03',
      'national-simulation-03',
      'national-simulation-04',
      'national-integration-application',
      'national-simulation-05',
      'national-simulation-06',
    ]);
  });

  it('keeps lesson, chapter, and semester results inside their active sub-scope', () => {
    const filters = [
      { scope: 'CHAPTER' as const, chapterId: 'nguyen-ham-tich-phan' },
      { scope: 'LESSON' as const, lessonId: 'phuong-phap-doi-bien-so' },
      { scope: 'SEMESTER' as const, semester: 1 as const },
    ];

    for (const filter of filters) {
      const matches = CURRICULUM_EXAM_SETS.filter((examSet) =>
        matchesActiveExamFilter(examSet, {
          subjectId: 'MATH',
          grade: 12,
          ...filter,
        })
      );
      expect(matches.length).toBeGreaterThan(0);
      expect(matches.every((examSet) => examSet.scope === filter.scope)).toBe(true);
    }
  });

  it('derives the new badge state from a recent publication date', () => {
    const examSet = CURRICULUM_EXAM_SETS.find(
      (candidate) => candidate.id === 'national-structure-01'
    );
    expect(examSet).toBeDefined();
    expect(isNewRelease(examSet!, Date.parse('2026-08-08T07:00:00+07:00'))).toBe(true);
    expect(isNewRelease(examSet!, Date.parse('2026-09-20T07:00:00+07:00'))).toBe(false);
  });

  it('uses calm desktop and compact responsive preview limits', () => {
    expect(getBrowseDisplayLimits(false)).toEqual({ curated: 3, regular: 6 });
    expect(getBrowseDisplayLimits(true)).toEqual({ curated: 2, regular: 4 });
  });

  it.each([
    [3, 3, 0],
    [6, 6, 0],
    [7, 6, 1],
    [24, 6, 6],
    [100, 96, 4],
  ])('calculates the next batch for %i total exams from %i visible', (total, visible, expected) => {
    expect(getNextBatchCount(visible, total, 6)).toBe(expected);
    expect(getNextVisibleCount(visible, total, 6)).toBe(Math.min(total, visible + 6));
  });

  it.each([7, 24, 100])(
    'progressively reveals all %i exams without exceeding the total',
    (total) => {
      let visible = Math.min(total, 6);
      while (visible < total) {
        visible = getNextVisibleCount(visible, total, 6);
      }
      expect(visible).toBe(total);
      expect(getNextBatchCount(visible, total, 6)).toBe(0);
    }
  );
});
