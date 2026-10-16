import 'server-only';

import type {
  AssignmentAttempt,
  AuthIdentity,
  AuthSessionRecord,
  AuthUser,
  PasswordResetRecord,
  StoredStudentProfile,
  StudentAcquisition,
  StudentEnrollment,
  StudentLearningProfile,
} from './types';

/**
 * Persistence for accounts, sessions and student profiles. Validation and
 * hashing stay in auth-service; a repository only stores and looks up, and
 * keeps each operation atomic.
 *
 * Two drivers:
 * - `postgres`: the durable store (DATABASE_URL).
 * - `json`: the original file store, for local development and tests only.
 */
export interface AuthRepository {
  /** Throws AuthError DUPLICATE_USERNAME / DUPLICATE_EMAIL. */
  createPasswordUser(record: NewAccount): Promise<void>;
  findPasswordLogin(identifier: string): Promise<{ user: AuthUser; passwordHash: string } | null>;
  /** Finds the user for a Google subject, else links or creates one by verified email. */
  upsertGoogleUser(input: GoogleAccount): Promise<{ user: AuthUser; created: boolean }>;
  /**
   * Attaches a Google account to an existing user and marks the Google email
   * as verified on it. Throws AuthError with a GOOGLE_LINK_ERRORS code when the
   * Google account or its email belongs to someone else.
   */
  linkGoogleIdentity(input: GoogleLink): Promise<AuthUser>;
  createSession(record: AuthSessionRecord, replaceExisting: boolean): Promise<void>;
  findSession(tokenHash: string): Promise<SessionContext | null>;
  deleteSession(tokenHash: string): Promise<void>;
  saveOnboarding(userId: string, update: OnboardingUpdate): Promise<void>;
  /** Updates a finished profile's grade and learning goals (subject, scores). */
  saveLearningGoals(userId: string, update: LearningGoalsUpdate): Promise<void>;
  /** Returns false when no account with a password matches the identifier. */
  createPasswordReset(
    identifier: string,
    record: Omit<PasswordResetRecord, 'userId'>
  ): Promise<boolean>;
  /** Consumes the token, sets the new password and signs the user out everywhere. */
  consumePasswordReset(tokenHash: string, passwordHash: string, usedAt: string): Promise<void>;
  countProfiles(userId: string): Promise<number>;
  findStudentByUserId(
    userId: string
  ): Promise<{ profile: StoredStudentProfile; learning: StudentLearningProfile | null } | null>;
  /** Runs `plan` against the student's current state and applies the result atomically. */
  ensureAssignment(
    studentId: string,
    plan: (state: AssignmentState) => AssignmentPlan
  ): Promise<AssignmentPlan>;
  /**
   * Counts one attempt against `key` in a fixed window that starts at the
   * first attempt, and returns the count so far, this attempt included.
   */
  consumeRateLimit(key: string, windowMs: number): Promise<number>;
  resetRateLimit(key: string): Promise<void>;
  findAssignment(studentId: string): Promise<{
    enrollment: StudentEnrollment | null;
    latestAttempt: AssignmentAttempt | null;
  }>;
}

export type NewAccount = {
  user: AuthUser;
  identity: AuthIdentity;
  profile: StoredStudentProfile;
  learning: StudentLearningProfile;
};

export type GoogleAccount = {
  subject: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  now: string;
  newAccount: NewAccount;
};

export type GoogleLink = {
  userId: string;
  subject: string;
  email: string;
  identityId: string;
  displayName: string | null;
  avatarUrl: string | null;
  now: string;
};

export type SessionContext = {
  user: AuthUser;
  profile: StoredStudentProfile;
  learning: StudentLearningProfile | null;
};

export type LearningGoalsUpdate = {
  grade: string;
  learning: Pick<
    StudentLearningProfile,
    'primarySubject' | 'currentScore' | 'targetScore' | 'updatedAt'
  >;
};

export type OnboardingUpdate = {
  profile: Pick<
    StoredStudentProfile,
    | 'fullName'
    | 'grade'
    | 'provinceCode'
    | 'provinceName'
    | 'phone'
    | 'schoolId'
    | 'schoolName'
    | 'schoolSource'
    | 'onboardingCompletedAt'
    | 'updatedAt'
  >;
  learning: Pick<
    StudentLearningProfile,
    'primarySubject' | 'currentScore' | 'targetScore' | 'updatedAt'
  >;
  acquisition: Omit<StudentAcquisition, 'studentId'>;
};

export type AssignmentState = {
  profile: StoredStudentProfile | null;
  learning: StudentLearningProfile | null;
  enrollment: StudentEnrollment | null;
  attempts: AssignmentAttempt[];
};

export type AssignmentPlan =
  | { kind: 'existing'; enrollment: StudentEnrollment; targetScore: number }
  | { kind: 'enroll'; enrollment: StudentEnrollment; targetScore: number }
  | { kind: 'blocked'; blocked: AssignmentAttempt };

export type AuthStoreDriver = 'postgres' | 'json';

export class AuthStoreConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthStoreConfigError';
  }
}

type DriverEnv = {
  AUTH_STORE_DRIVER?: string;
  DATABASE_URL?: string;
  NODE_ENV?: string;
  VERCEL?: string;
};

/**
 * Picks the store explicitly. PostgreSQL is used whenever DATABASE_URL is set.
 * The JSON file store is never used on Vercel, and outside `next dev` and tests
 * it needs AUTH_STORE_DRIVER=json. There is no automatic fallback from
 * PostgreSQL to JSON.
 */
export function resolveAuthStoreDriver(env: DriverEnv = process.env): AuthStoreDriver {
  const configured = env.AUTH_STORE_DRIVER?.trim();
  if (configured && configured !== 'postgres' && configured !== 'json') {
    throw new AuthStoreConfigError(`Unknown AUTH_STORE_DRIVER "${configured}".`);
  }
  const driver: AuthStoreDriver =
    (configured as AuthStoreDriver | undefined) ?? (env.DATABASE_URL ? 'postgres' : 'json');
  if (driver === 'postgres' && !env.DATABASE_URL) {
    throw new AuthStoreConfigError('DATABASE_URL is required for the PostgreSQL auth store.');
  }
  if (driver === 'json' && env.VERCEL) {
    throw new AuthStoreConfigError(
      'The JSON auth store is not durable on Vercel. Set DATABASE_URL.'
    );
  }
  if (
    driver === 'json' &&
    !configured &&
    env.NODE_ENV !== 'development' &&
    env.NODE_ENV !== 'test'
  ) {
    throw new AuthStoreConfigError(
      'DATABASE_URL is not set. Set it, or set AUTH_STORE_DRIVER=json to use the local file store.'
    );
  }
  return driver;
}

const globalForRepository = globalThis as unknown as {
  tutaiAuthRepository?: { driver: AuthStoreDriver; repository: AuthRepository };
};

export async function getAuthRepository(): Promise<AuthRepository> {
  const driver = resolveAuthStoreDriver();
  const cached = globalForRepository.tutaiAuthRepository;
  if (cached?.driver === driver) return cached.repository;
  const repository =
    driver === 'postgres'
      ? (await import('./postgres-repository')).postgresAuthRepository
      : (await import('./json-repository')).jsonAuthRepository;
  globalForRepository.tutaiAuthRepository = { driver, repository };
  return repository;
}
