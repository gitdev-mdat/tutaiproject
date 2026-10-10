// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  assertStudentBrowserFixtureEnvironment,
  establishActiveStudentBrowserSession,
  ensureActiveStudentBrowserFixture,
  isStudentBrowserFixtureEnabled,
  redactStudentFixtureError,
  StudentFixtureError,
  type FixtureDependencies,
} from './student-browser-fixture';
import { readAuthDatabase } from './store';
import { findOrCreateGoogleUser, saveOnboarding } from './auth-service';
import { ensureStudentAssignment, resolveStudentLifecycle } from '@/lib/student/lifecycle';

const realDependencies: FixtureDependencies = {
  findOrCreateUser: findOrCreateGoogleUser,
  saveOnboarding,
  readDatabase: readAuthDatabase,
  ensureAssignment: ensureStudentAssignment,
  resolveLifecycle: resolveStudentLifecycle,
};

describe.sequential('authenticated student browser fixture', () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'tutai-browser-fixture-'));
    process.env.AUTH_STORE_PATH = path.join(directory, 'auth-store.json');
    process.env.TUTAI_ROADMAPS_FILE = path.join(directory, 'student-roadmaps.json');
  });

  afterEach(async () => {
    delete process.env.AUTH_STORE_PATH;
    delete process.env.TUTAI_ROADMAPS_FILE;
    await rm(directory, { recursive: true, force: true });
  });

  it('is enabled only for test and development', () => {
    expect(isStudentBrowserFixtureEnabled('test')).toBe(true);
    expect(isStudentBrowserFixtureEnabled('development')).toBe(true);
    expect(isStudentBrowserFixtureEnabled('production')).toBe(false);
    expect(isStudentBrowserFixtureEnabled('staging')).toBe(false);
  });

  it('returns a typed failure when the runtime environment is missing', () => {
    expect(() => assertStudentBrowserFixtureEnvironment('')).toThrowError(
      expect.objectContaining({ code: 'FIXTURE_ENV_MISSING', stage: 'environment' })
    );
  });

  it('classifies an authentication store/client failure', async () => {
    const unavailable = new Error('admin client unavailable service_role_key=super-secret');
    const dependencies: FixtureDependencies = {
      ...realDependencies,
      findOrCreateUser: vi.fn(async () => {
        throw unavailable;
      }),
    };

    await expect(ensureActiveStudentBrowserFixture(dependencies)).rejects.toMatchObject({
      code: 'FIXTURE_USER_CREATE_FAILED',
      stage: 'user_upsert',
      cause: unavailable,
    });
  });

  it('idempotently establishes a passwordless active student lifecycle', async () => {
    const first = await ensureActiveStudentBrowserFixture();
    const second = await ensureActiveStudentBrowserFixture();
    const database = await readAuthDatabase();

    expect(first.lifecycle.state).toBe('AUTHENTICATED_ACTIVE_STUDENT');
    expect(second.studentId).toBe(first.studentId);
    expect(database.users.filter((user) => user.id === first.userId)).toHaveLength(1);
    expect(database.identities.filter((identity) => identity.userId === first.userId)).toEqual([
      expect.objectContaining({ provider: 'google', passwordHash: null }),
    ]);
    expect(database.enrollments).toContainEqual(
      expect.objectContaining({ studentId: first.studentId, status: 'active' })
    );
  });

  it('creates an absent fixture student and reuses an existing one', async () => {
    const before = await readAuthDatabase();
    expect(before.users).toHaveLength(0);

    const created = await ensureActiveStudentBrowserFixture();
    const reused = await ensureActiveStudentBrowserFixture();

    expect(created.created).toBe(true);
    expect(reused.created).toBe(false);
    expect(reused.userId).toBe(created.userId);
    expect(reused.studentId).toBe(created.studentId);
  });

  it('creates a session after provisioning and replaces it on repetition', async () => {
    const setSession = vi.fn(async () => undefined);
    const dependencies = { ...realDependencies, setSession };

    const first = await establishActiveStudentBrowserSession(dependencies);
    const second = await establishActiveStudentBrowserSession(dependencies);

    expect(first.userId).toBe(second.userId);
    expect(setSession).toHaveBeenNthCalledWith(1, first.userId, false, true);
    expect(setSession).toHaveBeenNthCalledWith(2, first.userId, false, true);
  });

  it('classifies session creation failure without losing the root cause', async () => {
    const root = new Error('cookie store unavailable');
    await expect(
      establishActiveStudentBrowserSession({
        ...realDependencies,
        setSession: vi.fn(async () => {
          throw root;
        }),
      })
    ).rejects.toMatchObject({
      code: 'FIXTURE_SESSION_CREATE_FAILED',
      stage: 'session',
      cause: root,
    });
  });

  it('redacts credentials from diagnostic output', () => {
    const diagnostic = redactStudentFixtureError(
      new Error(
        'service_role_key=top-secret token=access-token password=hunter2 https://local.test/path?secret=value'
      )
    );

    expect(diagnostic).not.toContain('top-secret');
    expect(diagnostic).not.toContain('access-token');
    expect(diagnostic).not.toContain('hunter2');
    expect(diagnostic).not.toContain('secret=value');
    expect(diagnostic).toContain('[REDACTED]');
  });

  it('exposes stable error metadata rather than a raw dependency message', () => {
    const error = new StudentFixtureError(
      'FIXTURE_AUTH_STORE_UNAVAILABLE',
      'profile_lookup',
      'Student fixture failed during profile lookup.',
      { cause: new Error('private failure') }
    );
    expect(error).toMatchObject({
      code: 'FIXTURE_AUTH_STORE_UNAVAILABLE',
      stage: 'profile_lookup',
      message: 'Student fixture failed during profile lookup.',
    });
  });
});
