import type { CurriculumExamSet } from './types';

function publicationTime(examSet: CurriculumExamSet): number {
  if (!examSet.publishedAt) return 0;
  const timestamp = Date.parse(examSet.publishedAt);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function compareNewestFirst(a: CurriculumExamSet, b: CurriculumExamSet): number {
  if (Boolean(a.isPinned) !== Boolean(b.isPinned)) return a.isPinned ? -1 : 1;

  const publishedDifference = publicationTime(b) - publicationTime(a);
  if (publishedDifference !== 0) return publishedDifference;

  const sequenceDifference = a.sequence - b.sequence;
  if (sequenceDifference !== 0) return sequenceDifference;

  return a.id.localeCompare(b.id);
}

/** Pinned releases first, then newest releases, with stable curriculum fallbacks. */
export function sortExamSetsNewestFirst(examSets: CurriculumExamSet[]): CurriculumExamSet[] {
  return [...examSets].sort(compareNewestFirst);
}

export function sortExamSets(examSets: CurriculumExamSet[]): CurriculumExamSet[] {
  return [...examSets].sort((a, b) => {
    if (a.tier !== b.tier) {
      return a.tier === 'SPECIAL' ? 1 : -1;
    }

    return compareNewestFirst(a, b);
  });
}

export function assertSpecialExamSetsAreLast(examSets: CurriculumExamSet[]): void {
  const sorted = sortExamSets(examSets);
  const firstSpecialIndex = sorted.findIndex((examSet) => examSet.tier === 'SPECIAL');

  if (
    firstSpecialIndex >= 0 &&
    sorted.slice(firstSpecialIndex).some((examSet) => examSet.tier === 'STANDARD')
  ) {
    throw new Error('Invalid exam sequence: a standard exam appears after a special exam.');
  }
}

export function groupKey(examSet: CurriculumExamSet): string {
  switch (examSet.scope) {
    case 'LESSON':
      return examSet.lessonId ?? 'missing-lesson';
    case 'CHAPTER':
      return examSet.chapterId ?? 'missing-chapter';
    case 'SEMESTER':
      return `semester-${examSet.semester ?? 'missing'}`;
    case 'NATIONAL':
      return `${examSet.subjectId}-${examSet.grade}-${examSet.nationalGroupId ?? 'default'}`;
  }
}

if (process.env.NODE_ENV !== 'production') {
  import('./curriculum-data').then(({ CURRICULUM_EXAM_SETS }) => {
    const groups = new Map<string, CurriculumExamSet[]>();
    CURRICULUM_EXAM_SETS.forEach((examSet) => {
      const key = groupKey(examSet);
      groups.set(key, [...(groups.get(key) ?? []), examSet]);
    });
    groups.forEach(assertSpecialExamSetsAreLast);
  });
}
