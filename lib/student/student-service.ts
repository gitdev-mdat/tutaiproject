import { getStudentShellModel } from '@/lib/mock-data/demo-student';
import { DEMO_ROADMAP_STEPS } from '@/lib/mock-data/demo-roadmap';
import type {
  CompletedActivity,
  ExamResult,
  PracticeResult,
  StudentDestination,
  StudentNotification,
  StudentProfile,
  StudentProgress,
  StudentServiceResult,
  StudentShellModel,
  StudentState,
} from '@/lib/student/types';

const STATE_VERSION = 1;
const STORAGE_KEY_PREFIX = 'tutai:student-state:';

function storageKeyFor(studentId: string): string {
  return `${STORAGE_KEY_PREFIX}${studentId}`;
}

function isBrowserStorageAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  } catch {
    return false;
  }
}

function totalActivityCount(): number {
  return DEMO_ROADMAP_STEPS.length;
}

/**
 * Builds a fresh default StudentState for a given profile. Always returns a
 * deep-cloned object so fixture data is never mutated in place.
 */
function createDefaultState(profile: StudentProfile): StudentState {
  const shellModel = getStudentShellModel(profile);

  return {
    version: STATE_VERSION,
    profile: { ...profile },
    progress: {
      completedActivityCount: 0,
      totalActivityCount: totalActivityCount(),
      streakDays: 0,
      studyMinutes: 0,
    },
    completedActivities: [],
    practiceResults: [],
    examResults: [],
    notifications: shellModel.notifications.map((notification) => ({ ...notification })),
    updatedAt: new Date().toISOString(),
  };
}

function isValidProfile(value: unknown): value is StudentProfile {
  if (!value || typeof value !== 'object') return false;
  const profile = value as Record<string, unknown>;
  return (
    typeof profile.id === 'string' &&
    typeof profile.name === 'string' &&
    typeof profile.email === 'string' &&
    typeof profile.grade === 'number' &&
    typeof profile.targetScore === 'number' &&
    typeof profile.examBlock === 'string'
  );
}

function isValidProgress(value: unknown): value is StudentProgress {
  if (!value || typeof value !== 'object') return false;
  const progress = value as Record<string, unknown>;
  return (
    typeof progress.completedActivityCount === 'number' &&
    typeof progress.totalActivityCount === 'number' &&
    typeof progress.streakDays === 'number' &&
    typeof progress.studyMinutes === 'number'
  );
}

function isValidCompletedActivity(value: unknown): value is CompletedActivity {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.activityId === 'string' &&
    typeof item.stepId === 'string' &&
    typeof item.completedAt === 'string'
  );
}

function isValidPracticeResult(value: unknown): value is PracticeResult {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === 'string' &&
    typeof item.topicId === 'string' &&
    typeof item.topicTitle === 'string' &&
    typeof item.correctCount === 'number' &&
    typeof item.totalCount === 'number' &&
    typeof item.accuracy === 'number' &&
    typeof item.durationSeconds === 'number' &&
    typeof item.completedAt === 'string'
  );
}

function isValidExamResult(value: unknown): value is ExamResult {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === 'string' &&
    typeof item.examId === 'string' &&
    typeof item.examTitle === 'string' &&
    typeof item.score === 'number' &&
    typeof item.maxScore === 'number' &&
    typeof item.completedAt === 'string'
  );
}

function isValidNotification(value: unknown): value is StudentNotification {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === 'string' &&
    typeof item.title === 'string' &&
    typeof item.description === 'string' &&
    typeof item.timestamp === 'string' &&
    typeof item.read === 'boolean'
  );
}

/**
 * Validates an arbitrary parsed JSON value against the StudentState schema,
 * returning null when the payload is malformed, stale (wrong version), or
 * otherwise untrustworthy. Consumers must fall back to defaults on null.
 */
function validateState(value: unknown): StudentState | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;

  if (candidate.version !== STATE_VERSION) return null;
  if (!isValidProfile(candidate.profile)) return null;
  if (!isValidProgress(candidate.progress)) return null;
  if (!Array.isArray(candidate.completedActivities)) return null;
  if (!candidate.completedActivities.every(isValidCompletedActivity)) return null;
  if (!Array.isArray(candidate.practiceResults)) return null;
  if (!candidate.practiceResults.every(isValidPracticeResult)) return null;
  if (!Array.isArray(candidate.examResults)) return null;
  if (!candidate.examResults.every(isValidExamResult)) return null;
  if (!Array.isArray(candidate.notifications)) return null;
  if (!candidate.notifications.every(isValidNotification)) return null;
  if (typeof candidate.updatedAt !== 'string') return null;

  return candidate as unknown as StudentState;
}

function readRawState(studentId: string): StudentState | null {
  if (!isBrowserStorageAvailable()) return null;

  try {
    const raw = window.localStorage.getItem(storageKeyFor(studentId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return validateState(parsed);
  } catch {
    return null;
  }
}

function writeRawState(state: StudentState): boolean {
  if (!isBrowserStorageAvailable()) return false;

  try {
    window.localStorage.setItem(storageKeyFor(state.profile.id), JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

/**
 * Loads persisted state for a student, falling back to a freshly cloned
 * default state when storage is empty, unavailable, or contains malformed /
 * stale data. Never throws.
 */
export function loadStudentState(profile: StudentProfile): StudentState {
  const stored = readRawState(profile.id);
  if (stored) {
    // Keep profile fresh from the authenticated session while preserving
    // persisted mutable fields (progress, results, notifications).
    return { ...stored, profile: { ...profile } };
  }
  return createDefaultState(profile);
}

/**
 * Persists the given state. Returns false (without throwing) when the
 * browser storage mechanism is unavailable or write fails (e.g. quota
 * exceeded), so callers can degrade gracefully.
 */
export function persistStudentState(state: StudentState): boolean {
  const next: StudentState = { ...state, updatedAt: new Date().toISOString() };
  return writeRawState(next);
}

/** Resets and persists a fresh default state for the given profile. */
export function resetStudentState(profile: StudentProfile): StudentState {
  const fresh = createDefaultState(profile);
  writeRawState(fresh);
  return fresh;
}

/**
 * Validates and applies a partial profile update. Returns the updated state
 * (persisted) or throws a descriptive error on invalid input, letting
 * callers surface a service-boundary error outcome.
 */
export function updateStudentProfile(
  state: StudentState,
  patch: Partial<StudentProfile>
): StudentState {
  const nextProfile: StudentProfile = { ...state.profile, ...patch };

  if (!nextProfile.name || !nextProfile.name.trim()) {
    throw new Error('Tên học sinh không được để trống');
  }
  if (!/^\S+@\S+\.\S+$/.test(nextProfile.email)) {
    throw new Error('Email không hợp lệ');
  }
  if (!Number.isFinite(nextProfile.grade) || nextProfile.grade < 1 || nextProfile.grade > 12) {
    throw new Error('Khối lớp không hợp lệ');
  }
  if (
    !Number.isFinite(nextProfile.targetScore) ||
    nextProfile.targetScore < 0 ||
    nextProfile.targetScore > 30
  ) {
    throw new Error('Điểm mục tiêu không hợp lệ');
  }
  if (!nextProfile.examBlock || !nextProfile.examBlock.trim()) {
    throw new Error('Khối thi không được để trống');
  }

  const nextState: StudentState = {
    ...state,
    profile: nextProfile,
    updatedAt: new Date().toISOString(),
  };
  persistStudentState(nextState);
  return nextState;
}

/**
 * Marks a roadmap activity complete. Idempotent: calling twice with the
 * same activityId does not duplicate the completion record or inflate the
 * progress counter.
 */
export function completeRoadmapActivity(
  state: StudentState,
  activity: { activityId: string; stepId: string }
): StudentState {
  const alreadyCompleted = state.completedActivities.some(
    (item) => item.activityId === activity.activityId
  );

  if (alreadyCompleted) {
    return state;
  }

  const completedActivities: CompletedActivity[] = [
    ...state.completedActivities,
    {
      activityId: activity.activityId,
      stepId: activity.stepId,
      completedAt: new Date().toISOString(),
    },
  ];

  const nextState: StudentState = {
    ...state,
    completedActivities,
    progress: {
      ...state.progress,
      completedActivityCount: completedActivities.length,
    },
    updatedAt: new Date().toISOString(),
  };
  persistStudentState(nextState);
  return nextState;
}

/**
 * Records a practice result. Deterministic by topicId: a repeated attempt
 * for the same topic replaces the prior record rather than appending a
 * duplicate.
 */
export function recordPracticeResult(
  state: StudentState,
  result: Omit<PracticeResult, 'id' | 'completedAt'> & { completedAt?: string }
): StudentState {
  const id = `practice-${result.topicId}`;
  const completedAt = result.completedAt ?? new Date().toISOString();
  const record: PracticeResult = { ...result, id, completedAt };

  const practiceResults = [
    ...state.practiceResults.filter((existing) => existing.id !== id),
    record,
  ];

  const nextState: StudentState = {
    ...state,
    practiceResults,
    updatedAt: new Date().toISOString(),
  };
  persistStudentState(nextState);
  return nextState;
}

/** Records an exam result, appending a new entry keyed by examId + timestamp. */
export function recordExamResult(
  state: StudentState,
  result: Omit<ExamResult, 'id' | 'completedAt'> & { completedAt?: string }
): StudentState {
  const completedAt = result.completedAt ?? new Date().toISOString();
  const id = `exam-${result.examId}-${completedAt}`;
  const record: ExamResult = { ...result, id, completedAt };

  const nextState: StudentState = {
    ...state,
    examResults: [...state.examResults, record],
    updatedAt: new Date().toISOString(),
  };
  persistStudentState(nextState);
  return nextState;
}

/** Marks a single notification as read (idempotent). */
export function markNotificationRead(state: StudentState, notificationId: string): StudentState {
  let changed = false;
  const notifications = state.notifications.map((notification) => {
    if (notification.id === notificationId && !notification.read) {
      changed = true;
      return { ...notification, read: true };
    }
    return notification;
  });

  if (!changed) return state;

  const nextState: StudentState = { ...state, notifications, updatedAt: new Date().toISOString() };
  persistStudentState(nextState);
  return nextState;
}

/** Derives the one verified shell metric from persisted student data. */
export function deriveShellMetricsFromState(state: StudentState): StudentShellModel['metrics'] {
  return [
    {
      id: 'target-score',
      label: 'Điểm mục tiêu',
      value: state.profile.targetScore.toString(),
    },
  ];
}

/**
 * Resolves the serializable shell model (identity, metrics, notifications,
 * destinations) for an authenticated student profile, merged with any
 * persisted state (metrics/notifications reflect real progress instead of
 * static fixture values).
 *
 * This is the sole abstraction boundary between student shell UI components
 * and the underlying mock data implementation. Swapping the mock
 * implementation for a real backend integration only requires changing the
 * imports inside this module.
 */
export function resolveStudentShellModel(profile: StudentProfile): StudentShellModel {
  const baseModel = getStudentShellModel(profile);
  const state = loadStudentState(profile);

  return {
    ...baseModel,
    metrics: deriveShellMetricsFromState(state),
    notifications: state.notifications,
  };
}

/**
 * Filters verified student destinations by a free-text query, matching
 * against title, description, and keywords. An empty (or whitespace-only)
 * query returns every destination unchanged.
 */
export function searchStudentDestinations(
  destinations: StudentDestination[],
  query: string
): StudentDestination[] {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return destinations;
  }

  return destinations.filter((destination) => {
    const haystack = [
      destination.title,
      destination.description ?? '',
      ...(destination.keywords ?? []),
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(normalized);
  });
}

/**
 * Loading-state-aware wrapper for callers (e.g. hooks/components) that need
 * an explicit loading/success/empty/error result rather than a thrown
 * exception. `loadStudentState` never throws, so this can only ever return
 * success or empty (when there are truly no completed activities/results at
 * all, useful for onboarding empty states).
 */
export function getStudentStateResult(profile: StudentProfile): StudentServiceResult<StudentState> {
  try {
    const state = loadStudentState(profile);
    const hasAnyActivity =
      state.completedActivities.length > 0 ||
      state.practiceResults.length > 0 ||
      state.examResults.length > 0;

    if (!hasAnyActivity) {
      return { status: 'empty' };
    }

    return { status: 'success', data: state };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Không thể tải dữ liệu học sinh',
    };
  }
}
