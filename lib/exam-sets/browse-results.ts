import { sortExamSetsNewestFirst } from './sorting';
import type { CurriculumExamSet, ExamSetScope, SubjectId } from './types';

const NEW_RELEASE_WINDOW_DAYS = 30;

export type BrowseDisplayLimits = {
  curated: number;
  regular: number;
};

export function getBrowseDisplayLimits(isCompact: boolean): BrowseDisplayLimits {
  return isCompact ? { curated: 2, regular: 4 } : { curated: 3, regular: 6 };
}

export function getNextBatchCount(current: number, total: number, batchSize: number): number {
  return Math.max(0, Math.min(batchSize, total - current));
}

export function getNextVisibleCount(current: number, total: number, batchSize: number): number {
  return Math.min(total, current + batchSize);
}

export type ActiveExamFilter = {
  subjectId: SubjectId;
  grade: number;
  scope: ExamSetScope;
  chapterId?: string;
  lessonId?: string;
  semester?: 1 | 2;
};

export function matchesActiveExamFilter(
  examSet: CurriculumExamSet,
  filter: ActiveExamFilter
): boolean {
  if (
    examSet.subjectId !== filter.subjectId ||
    examSet.grade !== filter.grade ||
    examSet.scope !== filter.scope
  ) {
    return false;
  }

  switch (filter.scope) {
    case 'CHAPTER':
      return examSet.chapterId === filter.chapterId;
    case 'LESSON':
      return examSet.lessonId === filter.lessonId;
    case 'SEMESTER':
      return examSet.semester === filter.semester;
    case 'NATIONAL':
      return true;
  }
}

export function partitionExamSets(examSets: CurriculumExamSet[]): {
  curated: CurriculumExamSet[];
  regular: CurriculumExamSet[];
} {
  const sorted = sortExamSetsNewestFirst(examSets);
  return {
    curated: sorted.filter((examSet) => examSet.tier === 'SPECIAL'),
    regular: sorted.filter((examSet) => examSet.tier !== 'SPECIAL'),
  };
}

export function getRegularCollectionTitle(scope: ExamSetScope, contextLabel?: string): string {
  switch (scope) {
    case 'NATIONAL':
      return 'Luyện cấu trúc THPT Quốc gia';
    case 'CHAPTER':
      return `Luyện tập chương ${contextLabel ?? ''}`.trim();
    case 'LESSON':
      return `Luyện tập ${contextLabel ?? ''}`.trim();
    case 'SEMESTER':
      return `Luyện tổng hợp ${contextLabel ?? ''}`.trim();
  }
}

export function isNewRelease(
  examSet: CurriculumExamSet,
  now = Date.now(),
  windowDays = NEW_RELEASE_WINDOW_DAYS
): boolean {
  if (!examSet.publishedAt) return false;
  const publishedAt = Date.parse(examSet.publishedAt);
  if (Number.isNaN(publishedAt) || publishedAt > now) return false;
  return now - publishedAt <= windowDays * 24 * 60 * 60 * 1000;
}
