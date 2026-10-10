import 'server-only';

import { findOrCreateGoogleUser, saveOnboarding } from './auth-service';
import { setSessionCookie } from './session';
import { readAuthDatabase } from './store';
import { ensureStudentAssignment, resolveStudentLifecycle } from '@/lib/student/lifecycle';

const FIXTURE_SUBJECT = 'tutai-browser-active-student-v1';
const FIXTURE_EMAIL = 'active-student@browser-fixture.invalid';

export type StudentFixtureFailureCode =
  | 'FIXTURE_ENV_MISSING'
  | 'FIXTURE_AUTH_STORE_UNAVAILABLE'
  | 'FIXTURE_USER_CREATE_FAILED'
  | 'FIXTURE_PROFILE_MISSING'
  | 'FIXTURE_ASSIGNMENT_FAILED'
  | 'FIXTURE_LIFECYCLE_INVALID'
  | 'FIXTURE_SESSION_CREATE_FAILED'
  | 'FIXTURE_INTERNAL_ERROR';

export class StudentFixtureError extends Error {
  constructor(
    public readonly code: StudentFixtureFailureCode,
    public readonly stage: string,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'StudentFixtureError';
  }
}

export function redactStudentFixtureError(error: unknown): string {
  const raw = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return raw
    .replace(
      /\b(authorization|cookie|token|secret|password|service[_-]?role(?:[_-]?key)?|supabase[_a-z-]*)\s*[:=]\s*[^\s,;]+/gi,
      '$1=[REDACTED]'
    )
    .replace(/(https?:\/\/[^\s?#]+)[?#][^\s]+/gi, '$1?[REDACTED]')
    .slice(0, 600);
}

export function assertStudentBrowserFixtureEnvironment(
  environment = process.env.NODE_ENV
): asserts environment is 'development' | 'test' {
  if (!environment) {
    throw new StudentFixtureError(
      'FIXTURE_ENV_MISSING',
      'environment',
      'NODE_ENV is required for the student browser fixture.'
    );
  }
  if (!isStudentBrowserFixtureEnabled(environment)) {
    throw new StudentFixtureError(
      'FIXTURE_ENV_MISSING',
      'environment',
      'The student browser fixture is available only in development or test.'
    );
  }
}

export type FixtureDependencies = {
  findOrCreateUser: typeof findOrCreateGoogleUser;
  saveOnboarding: typeof saveOnboarding;
  readDatabase: typeof readAuthDatabase;
  ensureAssignment: typeof ensureStudentAssignment;
  resolveLifecycle: typeof resolveStudentLifecycle;
};

export type FixtureSessionDependencies = FixtureDependencies & {
  setSession: typeof setSessionCookie;
};

const defaultDependencies: FixtureDependencies = {
  findOrCreateUser: findOrCreateGoogleUser,
  saveOnboarding,
  readDatabase: readAuthDatabase,
  ensureAssignment: ensureStudentAssignment,
  resolveLifecycle: resolveStudentLifecycle,
};

const defaultSessionDependencies: FixtureSessionDependencies = {
  ...defaultDependencies,
  setSession: setSessionCookie,
};

async function fixtureStage<T>(
  code: StudentFixtureFailureCode,
  stage: string,
  operation: () => Promise<T>
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof StudentFixtureError) throw error;
    throw new StudentFixtureError(code, stage, `Student fixture failed during ${stage}.`, {
      cause: error,
    });
  }
}

export function isStudentBrowserFixtureEnabled(environment = process.env.NODE_ENV): boolean {
  return environment === 'development' || environment === 'test';
}

/**
 * Idempotently provisions a clearly labelled, passwordless browser-audit identity
 * through the same onboarding, assignment, and roadmap services as a real student.
 */
export async function ensureActiveStudentBrowserFixture(
  dependencies: FixtureDependencies = defaultDependencies
) {
  assertStudentBrowserFixtureEnvironment();

  const { user, created } = await fixtureStage('FIXTURE_USER_CREATE_FAILED', 'user_upsert', () =>
    dependencies.findOrCreateUser({
      subject: FIXTURE_SUBJECT,
      email: FIXTURE_EMAIL,
      emailVerified: true,
      displayName: '[TEST FIXTURE] Học sinh đang học',
    })
  );
  await fixtureStage('FIXTURE_PROFILE_MISSING', 'profile_upsert', () =>
    dependencies.saveOnboarding(user.id, {
      fullName: '[TEST FIXTURE] Học sinh đang học',
      grade: '12',
      provinceCode: '74',
      primarySubject: 'MATH',
      currentScore: 6,
      targetScore: 8,
      acquisitionSource: 'Khác',
      acquisitionSourceOther: 'Automated browser audit fixture',
    })
  );

  const database = await fixtureStage(
    'FIXTURE_AUTH_STORE_UNAVAILABLE',
    'profile_lookup',
    dependencies.readDatabase
  );
  const profile = database.studentProfiles.find((candidate) => candidate.userId === user.id);
  if (!profile) {
    throw new StudentFixtureError(
      'FIXTURE_PROFILE_MISSING',
      'profile_lookup',
      'Fixture student profile was not created.'
    );
  }
  await fixtureStage('FIXTURE_ASSIGNMENT_FAILED', 'assignment', () =>
    dependencies.ensureAssignment(profile.id)
  );

  const refreshed = await fixtureStage(
    'FIXTURE_AUTH_STORE_UNAVAILABLE',
    'profile_refresh',
    dependencies.readDatabase
  );
  const refreshedProfile = refreshed.studentProfiles.find(
    (candidate) => candidate.userId === user.id
  );
  const learning = refreshed.learningProfiles.find(
    (candidate) => candidate.studentId === refreshedProfile?.id
  );
  if (!refreshedProfile) {
    throw new StudentFixtureError(
      'FIXTURE_PROFILE_MISSING',
      'profile_refresh',
      'Fixture student profile disappeared after assignment.'
    );
  }
  const lifecycle = await fixtureStage('FIXTURE_LIFECYCLE_INVALID', 'lifecycle', () =>
    dependencies.resolveLifecycle({
      user,
      profile: refreshedProfile,
      learning: learning ?? null,
    })
  );
  if (lifecycle.state !== 'AUTHENTICATED_ACTIVE_STUDENT') {
    throw new StudentFixtureError(
      'FIXTURE_LIFECYCLE_INVALID',
      'lifecycle',
      `Fixture lifecycle was ${lifecycle.state}.`
    );
  }
  return { userId: user.id, studentId: refreshedProfile.id, lifecycle, created };
}

export async function establishActiveStudentBrowserSession(
  dependencies: FixtureSessionDependencies = defaultSessionDependencies
) {
  const fixture = await ensureActiveStudentBrowserFixture(dependencies);
  await fixtureStage('FIXTURE_SESSION_CREATE_FAILED', 'session', () =>
    dependencies.setSession(fixture.userId, false, true)
  );
  return fixture;
}
