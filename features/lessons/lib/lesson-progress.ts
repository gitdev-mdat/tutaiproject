'use client';

import * as React from 'react';

/**
 * Per-student lesson progress, kept in this browser like the rest of the
 * student state (see lib/student/student-service.ts):
 * - `viewed`: the lesson was opened (it does not mean learned);
 * - `stages`: how far through the lesson journey the student got, and when
 *   they reached its end. Practice results are not here; they live in the
 *   database and come from the server.
 */

const VERSION = 1;
const keyFor = (studentId: string) => `tutai:lesson-progress:${studentId}`;
const EVENT = 'tutai:lesson-progress';

export interface LessonStageProgress {
  /** Index of the furthest stage the student has opened (0 = first stage). */
  reached: number;
  /** Number of stages the lesson had at that time. */
  total: number;
  /** Set when the student reached the last stage. */
  completedAt: string | null;
}

export interface LessonProgressState {
  version: 1;
  viewed: Record<string, string>;
  lastLessonId: string | null;
  stages: Record<string, LessonStageProgress>;
}

const EMPTY: LessonProgressState = { version: VERSION, viewed: {}, lastLessonId: null, stages: {} };

export function readLessonProgress(studentId: string): LessonProgressState {
  try {
    const raw = window.localStorage.getItem(keyFor(studentId));
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<LessonProgressState>;
    if (parsed.version !== VERSION || typeof parsed.viewed !== 'object' || !parsed.viewed) {
      return EMPTY;
    }
    return {
      version: VERSION,
      viewed: parsed.viewed,
      lastLessonId: parsed.lastLessonId ?? null,
      stages: typeof parsed.stages === 'object' && parsed.stages ? parsed.stages : {},
    };
  } catch {
    return EMPTY;
  }
}

function write(studentId: string, next: LessonProgressState) {
  try {
    window.localStorage.setItem(keyFor(studentId), JSON.stringify(next));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    // Storage may be unavailable (private mode); the lesson still works without it.
  }
}

export function recordLessonViewed(studentId: string, lessonId: string) {
  const current = readLessonProgress(studentId);
  write(studentId, {
    ...current,
    viewed: { ...current.viewed, [lessonId]: current.viewed[lessonId] ?? new Date().toISOString() },
    lastLessonId: lessonId,
  });
}

/** Records that the student opened stage `reached` of `total`; never moves progress backwards. */
export function recordLessonStage(
  studentId: string,
  lessonId: string,
  reached: number,
  total: number
) {
  const current = readLessonProgress(studentId);
  const previous = current.stages[lessonId];
  const furthest = Math.max(reached, previous?.reached ?? 0);
  const done = furthest >= total - 1;
  write(studentId, {
    ...current,
    stages: {
      ...current.stages,
      [lessonId]: {
        reached: Math.min(furthest, total - 1),
        total,
        completedAt: previous?.completedAt ?? (done ? new Date().toISOString() : null),
      },
    },
  });
}

export type LessonLearningState =
  | { kind: 'new' }
  | { kind: 'started'; stage: number; total: number }
  | { kind: 'learned'; completedAt: string };

/** What the student has done with a lesson's content (practice is reported separately). */
export function lessonLearningState(
  progress: LessonProgressState | null,
  lessonId: string
): LessonLearningState {
  const stages = progress?.stages[lessonId];
  if (stages?.completedAt) return { kind: 'learned', completedAt: stages.completedAt };
  if (stages) return { kind: 'started', stage: stages.reached + 1, total: stages.total };
  if (progress?.viewed[lessonId]) return { kind: 'started', stage: 1, total: 0 };
  return { kind: 'new' };
}

/** Returns null until mounted so server and first client render match. */
export function useLessonProgress(studentId: string): LessonProgressState | null {
  const [state, setState] = React.useState<LessonProgressState | null>(null);
  React.useEffect(() => {
    const sync = () => setState(readLessonProgress(studentId));
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, [studentId]);
  return state;
}
