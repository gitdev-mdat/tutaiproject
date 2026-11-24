import { describe, expect, it } from 'vitest';
import type { LearningLesson } from '@/lib/knowledge-tree/learning-visibility';
import type { LessonProgressState } from '@/features/lessons/lib/lesson-progress';
import type { StudyScope } from '@/features/lessons/lib/study-plan';
import { buildLearningPath, openChaptersByDefault } from './learning-path';

const lesson = (id: string, chapterId: string): LearningLesson => ({
  id,
  title: `Bài ${id}`,
  description: '',
  chapterId,
  chapterTitle: `Chương ${chapterId}`,
});

function scope(shape: Record<string, number>): StudyScope {
  const chapters = Object.entries(shape).map(([id, count]) => ({
    id,
    title: `Chương ${id}`,
    lessons: Array.from({ length: count }, (_, i) => lesson(`${id}${i + 1}`, id)),
  }));
  return {
    id: 'math-12',
    title: 'Toán 12',
    subjectId: 'math',
    gradeId: '12',
    chapters,
    lessons: chapters.flatMap((chapter) => chapter.lessons),
  } as StudyScope;
}

const T = '2026-11-20T00:00:00Z';
function progress(learned: string[], started: string[] = [], last: string | null = null) {
  const stages: LessonProgressState['stages'] = {};
  for (const id of learned) stages[id] = { reached: 4, total: 5, completedAt: T };
  for (const id of started) stages[id] = { reached: 1, total: 5, completedAt: null };
  return {
    version: 1,
    viewed: Object.fromEntries(Object.keys(stages).map((id) => [id, T])),
    lastLessonId: last,
    stages,
  } as LessonProgressState;
}

describe('buildLearningPath', () => {
  it('numbers lessons across the whole program and starts a new student at lesson 1', () => {
    const path = buildLearningPath(scope({ a: 2, b: 3 }), progress([]));
    expect(path.chapters.map((c) => c.lessons.map((l) => l.number))).toEqual([
      [1, 2],
      [3, 4, 5],
    ]);
    expect(path.next?.lesson.id).toBe('a1');
    expect(path.after?.id).toBe('a2');
    expect(path.chapters.map((c) => c.state)).toEqual(['current', 'upcoming']);
    expect({ learned: path.learned, total: path.total }).toEqual({ learned: 0, total: 5 });
  });

  it('counts only lessons read to the end and marks the current one', () => {
    const path = buildLearningPath(scope({ a: 2, b: 3 }), progress(['a1', 'a2'], ['b1'], 'b1'));
    expect(path.learned).toBe(2);
    expect(path.chapters.map((c) => [c.state, c.learned, c.total])).toEqual([
      ['done', 2, 2],
      ['current', 0, 3],
    ]);
    expect(path.chapters[1].lessons[0]).toMatchObject({ isCurrent: true, number: 3 });
    expect(path.next?.cta).toBe('Học tiếp');
    expect(path.after?.id).toBe('b2');
    expect(path.currentChapterId).toBe('b');
  });

  it('marks a chapter the student opened but is not in now as started', () => {
    const path = buildLearningPath(scope({ a: 2, b: 2 }), progress([], ['b2'], 'a1'));
    // The last lesson opened (a1) is not started, so reading resumes at b2 first.
    expect(path.next?.lesson.id).toBe('a1');
    expect(path.chapters.map((c) => c.state)).toEqual(['current', 'started']);
  });

  it('has no next lesson once everything is read', () => {
    const path = buildLearningPath(scope({ a: 1, b: 1 }), progress(['a1', 'b1']));
    expect(path.next).toBeNull();
    expect(path.after).toBeNull();
    expect(path.currentChapterId).toBeNull();
    expect(path.chapters.every((c) => c.state === 'done')).toBe(true);
  });

  it('works before the browser progress has loaded', () => {
    const path = buildLearningPath(scope({ a: 1 }), null);
    expect(path.next?.lesson.id).toBe('a1');
    expect(path.learned).toBe(0);
  });
});

describe('openChaptersByDefault', () => {
  it('opens every chapter of a short program', () => {
    const path = buildLearningPath(scope({ a: 2, b: 3 }), progress(['a1']));
    expect([...openChaptersByDefault(path)]).toEqual(['a', 'b']);
  });

  it('opens only the current chapter of a long program', () => {
    const path = buildLearningPath(
      scope({ a: 7, b: 5, c: 10, d: 5 }),
      progress(['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'b1'])
    );
    expect([...openChaptersByDefault(path)]).toEqual(['b']);
  });

  it('keeps a finished long program folded into its chapters', () => {
    const ids = ['a', 'b', 'c'].flatMap((c) => [1, 2, 3].map((i) => `${c}${i}`));
    const path = buildLearningPath(scope({ a: 3, b: 3, c: 3 }), progress(ids));
    expect(openChaptersByDefault(path).size).toBe(0);
  });
});
