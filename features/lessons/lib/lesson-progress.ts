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
  /** Id of that stage ("vi-du"), so progress survives stages being regrouped. Absent in older saves. */
  stageId?: string;
  /** Set when the student reached the last stage. */
  completedAt: string | null;
}

export interface LessonProgressState {
  version: 1;
  viewed: Record<string, string>;
  lastLessonId: string | null;
  stages: Record<string, LessonStageProgress>;
  /**
   * Interactive lessons only: how each activity went, by lesson then activity
   * id ("kham-pha/quy-tac"). Absent in older saves; never needed to resume.
   */
  outcomes?: Record<string, Record<string, ActivityOutcome>>;
}

/** How a student got an activity right: alone, after a hint, or by being shown. */
export type ActivityOutcome = 'first-try' | 'with-help' | 'revealed';

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
      ...(typeof parsed.outcomes === 'object' && parsed.outcomes
        ? { outcomes: parsed.outcomes }
        : {}),
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

/**
 * Records that the student opened stage `reached` of `total`; never moves
 * progress backwards. `stageIds` are the lesson's current stage ids.
 */
export function recordLessonStage(
  studentId: string,
  lessonId: string,
  reached: number,
  stageIds: string[]
) {
  const total = stageIds.length;
  const current = readLessonProgress(studentId);
  const previous = current.stages[lessonId];
  // A save from an older stage layout is compared by where it maps to now.
  const before =
    previous && previous.total === total && !previous.stageId
      ? previous.reached
      : previous?.stageId
        ? Math.max(stageIds.indexOf(previous.stageId), 0)
        : 0;
  const furthest = Math.min(Math.max(reached, before), total - 1);
  const done = furthest >= total - 1;
  write(studentId, {
    ...current,
    stages: {
      ...current.stages,
      [lessonId]: {
        reached: furthest,
        total,
        stageId: stageIds[furthest],
        completedAt: previous?.completedAt ?? (done ? new Date().toISOString() : null),
      },
    },
  });
}

const OUTCOME_RANK: Record<ActivityOutcome, number> = {
  revealed: 0,
  'with-help': 1,
  'first-try': 2,
};

/** Records how an activity went, keeping the student's best result for it. */
export function recordActivityOutcome(
  studentId: string,
  lessonId: string,
  activityId: string,
  outcome: ActivityOutcome
) {
  const current = readLessonProgress(studentId);
  const lesson = current.outcomes?.[lessonId] ?? {};
  const previous = lesson[activityId];
  if (previous && OUTCOME_RANK[previous] >= OUTCOME_RANK[outcome]) return;
  write(studentId, {
    ...current,
    outcomes: { ...current.outcomes, [lessonId]: { ...lesson, [activityId]: outcome } },
  });
}

/**
 * Where to reopen a lesson: the stage the student had reached, found by id,
 * or through the older layout's order for saves made before stages were
 * regrouped (`legacyStageIds[i]` is the stage that now holds old stage i).
 */
export function restoreStageIndex(
  saved: LessonStageProgress | undefined,
  stageIds: string[],
  legacyStageIds: string[]
): number {
  const last = stageIds.length - 1;
  if (!saved) return 0;
  if (saved.completedAt) return last;
  if (saved.stageId) {
    const index = stageIds.indexOf(saved.stageId);
    if (index >= 0) return index;
  }
  if (saved.total === stageIds.length) return Math.min(saved.reached, last);
  if (saved.total === legacyStageIds.length) {
    const index = stageIds.indexOf(legacyStageIds[saved.reached] ?? '');
    if (index >= 0) return index;
  }
  return saved.total > 1 ? Math.round((saved.reached / (saved.total - 1)) * last) : 0;
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
