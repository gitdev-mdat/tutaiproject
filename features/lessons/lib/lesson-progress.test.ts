import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  readLessonProgress,
  recordActivityOutcome,
  recordLessonStage,
  recordLessonViewed,
} from './lesson-progress';

// The progress lives in the browser; a small stand-in for window.localStorage.
const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
    },
    dispatchEvent: () => true,
  };
});
afterEach(() => {
  delete (globalThis as unknown as { window?: unknown }).window;
});

const STUDENT = 'student-1';
const LESSON = 'knowledge-p1';
const KEY = `tutai:lesson-progress:${STUDENT}`;

describe('lesson progress with interactive outcomes', () => {
  it('reads a save made before outcomes existed, unchanged', () => {
    const legacy = {
      version: 1,
      viewed: { [LESSON]: '2026-10-19T00:00:00.000Z' },
      lastLessonId: LESSON,
      stages: {
        [LESSON]: {
          reached: 6,
          total: 7,
          stageId: 'tong-ket',
          completedAt: '2026-10-19T00:05:00.000Z',
        },
      },
    };
    store.set(KEY, JSON.stringify(legacy));
    expect(readLessonProgress(STUDENT)).toEqual(legacy);
  });

  it('keeps the best result for an activity', () => {
    recordActivityOutcome(STUDENT, LESSON, 'thu-suc/dao-ham', 'revealed');
    recordActivityOutcome(STUDENT, LESSON, 'thu-suc/dao-ham', 'first-try');
    recordActivityOutcome(STUDENT, LESSON, 'thu-suc/dao-ham', 'with-help');
    expect(readLessonProgress(STUDENT).outcomes).toEqual({
      [LESSON]: { 'thu-suc/dao-ham': 'first-try' },
    });
  });

  it('outcomes survive the other progress writes, and never touch completion', () => {
    const ids = ['bat-dau', 'kham-pha', 'mo-rong', 'vi-du', 'thu-suc', 'tong-ket'];
    recordLessonStage(STUDENT, LESSON, 5, ids);
    const completedAt = readLessonProgress(STUDENT).stages[LESSON].completedAt;
    expect(completedAt).not.toBeNull();
    recordActivityOutcome(STUDENT, LESSON, 'bat-dau/doi-chieu', 'with-help');
    recordLessonViewed(STUDENT, LESSON);
    recordLessonStage(STUDENT, LESSON, 1, ids);
    const state = readLessonProgress(STUDENT);
    expect(state.outcomes?.[LESSON]).toEqual({ 'bat-dau/doi-chieu': 'with-help' });
    expect(state.stages[LESSON]).toMatchObject({ reached: 5, stageId: 'tong-ket', completedAt });
  });

  it('a lesson saved by the text journey keeps its completion when reopened interactively', () => {
    store.set(
      KEY,
      JSON.stringify({
        version: 1,
        viewed: {},
        lastLessonId: LESSON,
        stages: {
          [LESSON]: {
            reached: 6,
            total: 7,
            stageId: 'tong-ket',
            completedAt: '2026-10-19T00:05:00Z',
          },
        },
      })
    );
    recordLessonStage(STUDENT, LESSON, 2, [
      'bat-dau',
      'kham-pha',
      'mo-rong',
      'vi-du',
      'thu-suc',
      'tong-ket',
    ]);
    expect(readLessonProgress(STUDENT).stages[LESSON].completedAt).toBe('2026-10-19T00:05:00Z');
  });
});
