'use client';

import * as React from 'react';

/**
 * Per-student "viewed" markers for lessons, kept in this browser like the rest of
 * the student state (see lib/student/student-service.ts). It records only that a
 * lesson was opened; it does not claim completion or mastery.
 */

const VERSION = 1;
const keyFor = (studentId: string) => `tutai:lesson-progress:${studentId}`;
const EVENT = 'tutai:lesson-progress';

export interface LessonProgressState {
  version: 1;
  viewed: Record<string, string>;
  lastLessonId: string | null;
}

const EMPTY: LessonProgressState = { version: VERSION, viewed: {}, lastLessonId: null };

export function readLessonProgress(studentId: string): LessonProgressState {
  try {
    const raw = window.localStorage.getItem(keyFor(studentId));
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as LessonProgressState;
    if (parsed.version !== VERSION || typeof parsed.viewed !== 'object' || !parsed.viewed) {
      return EMPTY;
    }
    return { version: VERSION, viewed: parsed.viewed, lastLessonId: parsed.lastLessonId ?? null };
  } catch {
    return EMPTY;
  }
}

export function recordLessonViewed(studentId: string, lessonId: string) {
  const current = readLessonProgress(studentId);
  const next: LessonProgressState = {
    version: VERSION,
    viewed: { ...current.viewed, [lessonId]: current.viewed[lessonId] ?? new Date().toISOString() },
    lastLessonId: lessonId,
  };
  try {
    window.localStorage.setItem(keyFor(studentId), JSON.stringify(next));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    // Storage may be unavailable (private mode); reading still works without markers.
  }
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
