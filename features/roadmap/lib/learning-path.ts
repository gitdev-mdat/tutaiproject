import type { LearningLesson } from '@/lib/knowledge-tree/learning-visibility';
import {
  lessonLearningState,
  type LessonLearningState,
  type LessonProgressState,
} from '@/features/lessons/lib/lesson-progress';
import {
  nextLessonToRead,
  type ReadingStep,
  type StudyScope,
} from '@/features/lessons/lib/study-plan';

/**
 * The Học page as a path: the program's chapters in curriculum order, each
 * lesson numbered across the whole program, with how far it has been read
 * and where the student is now. Pure, built only from the published
 * curriculum and the reading progress the browser keeps, so every number on
 * the page can be checked against them. Nothing is locked: any lesson can be
 * opened at any time, as before.
 */

export type ChapterState = 'done' | 'current' | 'started' | 'upcoming';

export interface PathLesson {
  lesson: LearningLesson;
  /** Position in the whole program, from 1. */
  number: number;
  reading: LessonLearningState;
  /** The lesson the page suggests reading now. */
  isCurrent: boolean;
}

export interface PathChapter {
  id: string;
  title: string;
  /** Position in the program, from 1. */
  number: number;
  lessons: PathLesson[];
  learned: number;
  total: number;
  state: ChapterState;
}

export interface LearningPath {
  chapters: PathChapter[];
  learned: number;
  total: number;
  /** The lesson to read now; null once every lesson is read. */
  next: ReadingStep | null;
  /** The lesson after `next` in curriculum order, what the student reads after it. */
  after: LearningLesson | null;
  currentChapterId: string | null;
}

export function buildLearningPath(
  scope: StudyScope,
  progress: LessonProgressState | null
): LearningPath {
  const next = nextLessonToRead(scope.lessons, progress);
  const currentId = next?.lesson.id ?? null;
  let number = 0;
  const chapters = scope.chapters.map((chapter, index): PathChapter => {
    const lessons = chapter.lessons.map((lesson): PathLesson => {
      number += 1;
      return {
        lesson,
        number,
        reading: lessonLearningState(progress, lesson.id),
        isCurrent: lesson.id === currentId,
      };
    });
    const learned = lessons.filter((item) => item.reading.kind === 'learned').length;
    const state: ChapterState =
      learned === lessons.length
        ? 'done'
        : lessons.some((item) => item.isCurrent)
          ? 'current'
          : lessons.some((item) => item.reading.kind !== 'new')
            ? 'started'
            : 'upcoming';
    return {
      id: chapter.id,
      title: chapter.title,
      number: index + 1,
      lessons,
      learned,
      total: lessons.length,
      state,
    };
  });
  const position = currentId ? scope.lessons.findIndex((lesson) => lesson.id === currentId) : -1;
  return {
    chapters,
    learned: chapters.reduce((sum, chapter) => sum + chapter.learned, 0),
    total: scope.lessons.length,
    next,
    after: position >= 0 ? (scope.lessons[position + 1] ?? null) : null,
    currentChapterId: chapters.find((chapter) => chapter.state === 'current')?.id ?? null,
  };
}

/**
 * Which chapters start open. A short program shows everything. A long one
 * opens only the chapter the student is in (or the first, before they start),
 * so the page stays one screen of decisions however many lessons are published.
 */
export function openChaptersByDefault(path: LearningPath): Set<string> {
  const lessons = path.chapters.reduce((sum, chapter) => sum + chapter.total, 0);
  if (path.chapters.length <= 2 || lessons <= 8)
    return new Set(path.chapters.map((chapter) => chapter.id));
  if (path.currentChapterId) return new Set([path.currentChapterId]);
  return new Set();
}
