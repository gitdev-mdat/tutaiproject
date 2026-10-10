// @vitest-environment node

/**
 * Runs against a real PostgreSQL database named in TEST_DATABASE_URL, which
 * must be a throwaway database whose name ends in "_test": the suite drops and
 * recreates the tutai schema. Skipped when the variable is not set.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import postgres from 'postgres';
import {
  AuthError,
  authenticateCredential,
  createSession,
  findOrCreateGoogleUser,
  getProfileCount,
  registerCredential,
  requestPasswordReset,
  resetPassword,
  resolveSession,
  revokeSession,
  saveOnboarding,
} from './auth-service';
import { importAuthSnapshot, parseSnapshot, validateSnapshot } from './import-json';
import { readAuthDatabase } from './store';
import { closeSql } from '@/lib/db/postgres';
import { runMigrations } from '@/lib/db/migrations';
import { ensureStudentAssignment, resolveStudentLifecycle } from '@/lib/student/lifecycle';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

const onboarding = {
  fullName: 'Học sinh PG',
  grade: '12',
  provinceCode: '74',
  primarySubject: 'MATH' as const,
  currentScore: 6,
  targetScore: 8,
  acquisitionSource: 'Khác' as const,
  acquisitionSourceOther: 'Kiểm thử',
};

let counter = 0;
const uniqueName = (prefix: string) => `${prefix}_${Date.now() % 100000}_${(counter += 1)}`;

async function register(username = uniqueName('pg')) {
  return registerCredential({
    username,
    password: 'mat-khau-dung-1',
    fullName: 'Học sinh PG',
    phone: '0865689102',
  });
}

describe.skipIf(!TEST_DATABASE_URL).sequential('PostgreSQL auth store', () => {
  let admin: postgres.Sql;
  let directory: string;

  beforeAll(async () => {
    if (!new URL(TEST_DATABASE_URL!).pathname.endsWith('_test')) {
      throw new Error('TEST_DATABASE_URL must name a database ending in _test.');
    }
    admin = postgres(TEST_DATABASE_URL!, { max: 2, onnotice: () => {} });
    await admin`drop schema if exists tutai cascade`;
    await runMigrations(admin);
    directory = await mkdtemp(path.join(tmpdir(), 'tutai-pg-'));
    // Proves nothing is written to the JSON store while PostgreSQL is in use.
    process.env.AUTH_STORE_PATH = path.join(directory, 'auth-store.json');
  });

  beforeEach(async () => {
    await closeSql();
    process.env.DATABASE_URL = TEST_DATABASE_URL;
    process.env.TUTAI_ROADMAPS_FILE = path.join(directory, 'student-roadmaps.json');
  });

  afterAll(async () => {
    await closeSql();
    delete process.env.DATABASE_URL;
    delete process.env.AUTH_STORE_PATH;
    delete process.env.TUTAI_ROADMAPS_FILE;
    await admin?.end();
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  it('registers, signs in, restores the session after a reconnect, and signs out', async () => {
    const user = await register('pg_lifecycle');
    expect((await authenticateCredential('PG_Lifecycle', 'mat-khau-dung-1')).id).toBe(user.id);
    await expect(authenticateCredential('pg_lifecycle', 'sai-mat-khau')).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
      status: 401,
    });

    const { token } = await createSession(user.id);
    expect((await resolveSession(token))?.user.id).toBe(user.id);

    await closeSql(); // a new server instance with a fresh connection
    const restored = await resolveSession(token);
    expect(restored).toMatchObject({
      user: { id: user.id, username: 'pg_lifecycle', emailVerifiedAt: null },
      profile: { userId: user.id, fullName: 'Học sinh PG', phone: '+84865689102' },
      learning: { primarySubject: null, currentScore: null },
    });

    await revokeSession(token);
    expect(await resolveSession(token)).toBeNull();
    const [row] =
      await admin`select password_hash from tutai.identities where user_id = ${user.id}`;
    expect(row.password_hash).toMatch(/^scrypt\$/);
    await expect(access(process.env.AUTH_STORE_PATH!)).rejects.toThrow();
  });

  it('rejects duplicate usernames and emails', async () => {
    await registerCredential({
      username: 'pg_dupe',
      email: 'Dupe@Example.com',
      password: 'mat-khau-dung-1',
      fullName: 'Dupe',
      phone: '0865689102',
    });
    await expect(register('pg_dupe')).rejects.toMatchObject({ code: 'DUPLICATE_USERNAME' });
    await expect(
      registerCredential({
        username: 'pg_dupe_2',
        email: 'dupe@example.com',
        password: 'mat-khau-dung-1',
        fullName: 'Dupe',
        phone: '0865689102',
      })
    ).rejects.toMatchObject({ code: 'DUPLICATE_EMAIL', status: 409 });
  });

  it('expires sessions and replaces them on request', async () => {
    const user = await register();
    const first = await createSession(user.id);
    const second = await createSession(user.id, false, true);
    expect(await resolveSession(first.token)).toBeNull();
    expect((await resolveSession(second.token))?.user.id).toBe(user.id);
    await admin`update tutai.sessions set expires_at = now() - interval '1 second' where user_id = ${user.id}`;
    expect(await resolveSession(second.token)).toBeNull();
  });

  it('creates, reuses and links Google accounts by verified email', async () => {
    await expect(
      findOrCreateGoogleUser({
        subject: 'g-unverified',
        email: 'x@example.com',
        emailVerified: false,
      })
    ).rejects.toMatchObject({ code: 'UNVERIFIED_GOOGLE_EMAIL' });

    const created = await findOrCreateGoogleUser({
      subject: 'g-1',
      email: 'Google.User@Example.com',
      emailVerified: true,
      displayName: 'Google User',
    });
    expect(created.created).toBe(true);
    expect(created.user).toMatchObject({ email: 'google.user@example.com', username: null });
    expect(created.user.emailVerifiedAt).not.toBeNull();
    const again = await findOrCreateGoogleUser({
      subject: 'g-1',
      email: 'google.user@example.com',
      emailVerified: true,
    });
    expect(again).toMatchObject({ created: false, user: { id: created.user.id } });

    const passwordUser = await registerCredential({
      username: 'pg_linked',
      email: 'linked@example.com',
      password: 'mat-khau-dung-1',
      fullName: 'Linked',
      phone: '0865689102',
    });
    const linked = await findOrCreateGoogleUser({
      subject: 'g-2',
      email: 'linked@example.com',
      emailVerified: true,
      displayName: 'Linked Google',
    });
    expect(linked).toMatchObject({ created: false, user: { id: passwordUser.id } });
    expect(linked.user.emailVerifiedAt).not.toBeNull();
    expect(await getProfileCount(passwordUser.id)).toBe(1);
    const identities = await admin`
      select provider from tutai.identities where user_id = ${passwordUser.id} order by provider`;
    expect(identities.map((row) => row.provider)).toEqual(['google', 'password']);
  });

  it('saves onboarding and assigns a programme once', async () => {
    const user = await register();
    await saveOnboarding(user.id, onboarding);
    const { token } = await createSession(user.id);
    const session = await resolveSession(token);
    expect(session?.profile.onboardingCompletedAt).not.toBeNull();
    expect(session?.learning).toMatchObject({
      primarySubject: 'MATH',
      currentScore: 6,
      targetScore: 8,
    });

    const results = await Promise.all(
      Array.from({ length: 8 }, () => ensureStudentAssignment(session!.profile.id))
    );
    expect(results.every((result) => 'enrollment' in result)).toBe(true);
    const enrollments = await admin`
      select * from tutai.enrollments where student_id = ${session!.profile.id}`;
    expect(enrollments).toHaveLength(1);
    const lifecycle = await resolveStudentLifecycle(session);
    expect(lifecycle.state).toBe('AUTHENTICATED_ACTIVE_STUDENT');
    expect(lifecycle.enrollmentId).toBe(`enrollment:${session!.profile.id}:math-12-v1`);
  });

  it('records a blocked assignment and clears it when the profile changes', async () => {
    const user = await register();
    await saveOnboarding(user.id, { ...onboarding, grade: '11' });
    const { token } = await createSession(user.id);
    const session = await resolveSession(token);
    const first = await ensureStudentAssignment(session!.profile.id);
    const second = await ensureStudentAssignment(session!.profile.id);
    expect(first).toEqual(second);
    expect((await resolveStudentLifecycle(session)).state).toBe('ASSIGNMENT_BLOCKED');

    await saveOnboarding(user.id, onboarding);
    await ensureStudentAssignment(session!.profile.id);
    const attempts = await admin`
      select * from tutai.assignment_attempts where student_id = ${session!.profile.id}`;
    expect(attempts).toHaveLength(0);
  });

  it('resets a password once and signs the user out everywhere', async () => {
    const user = await register('pg_reset');
    const { token: sessionToken } = await createSession(user.id);
    expect(await requestPasswordReset('nobody_here')).toBeNull();
    const resetToken = await requestPasswordReset('pg_reset');
    expect(resetToken).toBeTruthy();

    const outcomes = await Promise.allSettled([
      resetPassword(resetToken!, 'mat-khau-moi-1'),
      resetPassword(resetToken!, 'mat-khau-moi-2'),
      resetPassword(resetToken!, 'mat-khau-moi-3'),
    ]);
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    expect(await resolveSession(sessionToken)).toBeNull();
    await expect(authenticateCredential('pg_reset', 'mat-khau-dung-1')).rejects.toBeInstanceOf(
      AuthError
    );
    const winner = outcomes.findIndex((outcome) => outcome.status === 'fulfilled') + 1;
    expect((await authenticateCredential('pg_reset', `mat-khau-moi-${winner}`)).id).toBe(user.id);
  });

  it('keeps every write under concurrent requests', async () => {
    const sameName = await Promise.allSettled(
      Array.from({ length: 12 }, () => register('pg_race'))
    );
    expect(sameName.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    expect(
      sameName.filter(
        (outcome) => outcome.status === 'rejected' && outcome.reason.code === 'DUPLICATE_USERNAME'
      )
    ).toHaveLength(11);

    const google = await Promise.all(
      Array.from({ length: 8 }, () =>
        findOrCreateGoogleUser({
          subject: 'g-race',
          email: 'race@example.com',
          emailVerified: true,
        })
      )
    );
    expect(new Set(google.map((result) => result.user.id)).size).toBe(1);
    const [{ count }] = await admin`
      select count(*)::int as count from tutai.identities where provider_account_id = 'g-race'`;
    expect(count).toBe(1);

    const users = await Promise.all(Array.from({ length: 10 }, () => register()));
    const sessions = await Promise.all(users.map((user) => createSession(user.id)));
    const resolved = await Promise.all(sessions.map((session) => resolveSession(session.token)));
    expect(resolved.map((session) => session?.user.id)).toEqual(users.map((user) => user.id));
  });

  it('fails loudly when the database is unreachable and writes nothing to JSON', async () => {
    process.env.DATABASE_URL = 'postgres://postgres@127.0.0.1:1/unreachable_test';
    await expect(resolveSession('any-token')).rejects.toThrow();
    await expect(register()).rejects.not.toBeInstanceOf(AuthError);
    await expect(access(process.env.AUTH_STORE_PATH!)).rejects.toThrow();
  });

  describe('import from auth-store.json', () => {
    let snapshotRaw: string;
    let token: string;

    beforeAll(async () => {
      // Build a realistic snapshot with the JSON store, the way production data was written.
      const jsonDir = await mkdtemp(path.join(tmpdir(), 'tutai-import-'));
      const saved = { url: process.env.DATABASE_URL, store: process.env.AUTH_STORE_PATH };
      delete process.env.DATABASE_URL;
      process.env.AUTH_STORE_PATH = path.join(jsonDir, 'auth-store.json');
      const user = await registerCredential({
        username: 'imported_user',
        email: 'imported@example.com',
        password: 'mat-khau-cu-1',
        fullName: 'Học sinh cũ',
        phone: '0865689102',
      });
      await saveOnboarding(user.id, onboarding);
      token = (await createSession(user.id)).token;
      const database = await readAuthDatabase();
      await ensureStudentAssignment(database.studentProfiles[0].id);
      await findOrCreateGoogleUser({
        subject: 'g-import',
        email: 'g-import@example.com',
        emailVerified: true,
      });
      await requestPasswordReset('imported_user');
      snapshotRaw = JSON.stringify(await readAuthDatabase());
      process.env.DATABASE_URL = saved.url;
      process.env.AUTH_STORE_PATH = saved.store;
      await rm(jsonDir, { recursive: true, force: true });
    });

    it('dry-runs without writing, then imports, and is idempotent', async () => {
      const snapshot = parseSnapshot(snapshotRaw);
      const before = await admin`select count(*)::int as count from tutai.users`;

      const dryRun = await importAuthSnapshot(admin, snapshot, { dryRun: true });
      expect(dryRun).toMatchObject({ committed: false, errors: [] });
      expect(dryRun.tables.find((table) => table.table === 'users')?.inserted).toBe(2);
      expect(await admin`select count(*)::int as count from tutai.users`).toEqual(before);

      const applied = await importAuthSnapshot(admin, snapshot, { dryRun: false });
      expect(applied).toMatchObject({ committed: true, errors: [] });
      for (const table of applied.tables) expect(table.inserted).toBe(table.source);

      const again = await importAuthSnapshot(admin, snapshot, { dryRun: false });
      expect(again.committed).toBe(true);
      for (const table of again.tables) {
        expect(table).toMatchObject({ inserted: 0, unchanged: table.source, conflicts: [] });
      }
    });

    it('keeps passwords, sessions and enrolments working after import', async () => {
      const user = await authenticateCredential('imported@example.com', 'mat-khau-cu-1');
      const session = await resolveSession(token);
      expect(session?.user.id).toBe(user.id);
      expect(session?.learning).toMatchObject({ primarySubject: 'MATH', targetScore: 8 });
      expect((await resolveStudentLifecycle(session)).enrollmentId).toBe(
        `enrollment:${session!.profile.id}:math-12-v1`
      );
    });

    it('refuses to overwrite rows that changed after import', async () => {
      await admin`update tutai.users set display_name = 'Đã đổi' where username = 'imported_user'`;
      const report = await importAuthSnapshot(admin, parseSnapshot(snapshotRaw), { dryRun: false });
      expect(report.committed).toBe(false);
      expect(report.tables.find((table) => table.table === 'users')?.conflicts).toHaveLength(1);
      const [row] =
        await admin`select display_name from tutai.users where username = 'imported_user'`;
      expect(row.display_name).toBe('Đã đổi');
    });

    it('rejects broken snapshots before touching the database', async () => {
      const snapshot = parseSnapshot(snapshotRaw);
      snapshot.sessions.push({
        ...snapshot.sessions[0],
        id: 'orphan',
        userId: 'missing',
        tokenHash: 'x',
      });
      snapshot.users.push({ ...snapshot.users[0], id: 'copy' });
      const { errors } = validateSnapshot(snapshot);
      expect(errors).toEqual(
        expect.arrayContaining([
          'sessions orphan: unknown user',
          'users.username: 1 duplicate value(s)',
          'users.email: 1 duplicate value(s)',
        ])
      );
      expect(errors.join(' ')).not.toContain('@');
      const report = await importAuthSnapshot(admin, snapshot, { dryRun: false });
      expect(report).toMatchObject({ committed: false, tables: [] });
    });
  });
});
