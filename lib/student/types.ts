export interface StudentProfile {
  id: string;
  name: string;
  email: string;
  grade: number;
  targetScore: number;
  examBlock: string;
}

export interface StudentIdentity {
  id: string;
  name: string;
  email: string;
  initials: string;
}

export interface StudentMetric {
  id: string;
  label: string;
  value: string;
}

export interface StudentNotification {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
}

export interface StudentDestination {
  id: string;
  title: string;
  href: string;
  description?: string;
  keywords?: string[];
}

export interface StudentShellModel {
  identity: StudentIdentity;
  metrics: StudentMetric[];
  notifications: StudentNotification[];
  destinations: StudentDestination[];
}

/**
 * A single completed or in-progress roadmap activity, keyed by the activity
 * id used inside centralized roadmap fixtures (lib/mock-data/demo-roadmap.ts).
 */
export interface CompletedActivity {
  activityId: string;
  stepId: string;
  completedAt: string;
}

/**
 * A recorded practice-session result. `id` is deterministic (derived from
 * the practice/topic identifier) so repeated attempts replace rather than
 * duplicate prior records.
 */
export interface PracticeResult {
  id: string;
  topicId: string;
  topicTitle: string;
  correctCount: number;
  totalCount: number;
  accuracy: number;
  durationSeconds: number;
  completedAt: string;
}

/** A recorded full/mock exam result. */
export interface ExamResult {
  id: string;
  examId: string;
  examTitle: string;
  score: number;
  maxScore: number;
  completedAt: string;
}

/** Aggregate, derived-friendly progress snapshot for the student. */
export interface StudentProgress {
  completedActivityCount: number;
  totalActivityCount: number;
  streakDays: number;
  studyMinutes: number;
}

/**
 * The full persisted student state. This is the single source of truth
 * that is serialized to localStorage; all mutations flow through
 * lib/student/student-service.ts so persistence stays consistent.
 */
export interface StudentState {
  version: number;
  profile: StudentProfile;
  progress: StudentProgress;
  completedActivities: CompletedActivity[];
  practiceResults: PracticeResult[];
  examResults: ExamResult[];
  notifications: StudentNotification[];
  updatedAt: string;
}

/** Discriminated result wrapper used by service-boundary reads. */
export type StudentServiceResult<T> =
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'empty' }
  | { status: 'error'; message: string };
