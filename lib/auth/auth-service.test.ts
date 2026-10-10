// @vitest-environment node

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  AuthError,
  authenticateCredential,
  createSession,
  findOrCreateGoogleUser,
  getProfileCount,
  registerCredential,
  resolveSession,
  saveOnboarding,
} from './auth-service';
import { readAuthDatabase } from './store';

describe.sequential('canonical authentication lifecycle', () => {
  let directory: string;

  beforeAll(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'tutai-auth-'));
    process.env.AUTH_STORE_PATH = path.join(directory, 'auth-store.json');
  });

  afterAll(async () => {
    delete process.env.AUTH_STORE_PATH;
    await rm(directory, { recursive: true, force: true });
  });

  it('Fixture A: registers, hashes the password, authenticates, and creates a session', async () => {
    const registered = await registerCredential({
      fullName: 'Thi Minh Đạt - TSSGN10',
      phone: '0865689102',
      username: 'minhdat',
      password: '12345678',
    });
    const authenticated = await authenticateCredential('minhdat', '12345678');
    expect(authenticated.id).toBe(registered.id);
    const { token } = await createSession(registered.id);
    expect((await resolveSession(token))?.user.id).toBe(registered.id);
    const database = await readAuthDatabase();
    const passwordIdentity = database.identities.find(
      (identity) => identity.userId === registered.id && identity.provider === 'password'
    );
    expect(passwordIdentity?.passwordHash).toMatch(/^scrypt\$/);
    expect(
      database.studentProfiles.find((candidate) => candidate.userId === registered.id)
    ).toMatchObject({ fullName: 'Thi Minh Đạt - TSSGN10', phone: '+84865689102' });
    expect(JSON.stringify(database)).not.toContain('12345678');
  });

  it('Fixture B: normalizes uppercase and whitespace in email consistently', async () => {
    const user = await registerCredential({
      username: 'case_test_01',
      email: '  Student.Case@Example.COM ',
      password: 'Valid-test-password-02!',
      fullName: 'Case Test',
      phone: '0865689102',
    });
    expect(user.email).toBe('student.case@example.com');
    expect(
      (await authenticateCredential(' STUDENT.CASE@EXAMPLE.COM ', 'Valid-test-password-02!')).id
    ).toBe(user.id);
  });

  it('Fixture C: rejects duplicate username and email without modifying the account', async () => {
    const original = await registerCredential({
      username: 'duplicate_01',
      email: 'duplicate@example.com',
      password: 'Original-password-03!',
      fullName: 'Duplicate Test',
      phone: '0865689102',
    });
    await expect(
      registerCredential({
        username: ' DUPLICATE_01 ',
        email: 'other@example.com',
        password: 'Different-password-03!',
        fullName: 'Duplicate Test',
        phone: '0865689102',
      })
    ).rejects.toMatchObject({ code: 'DUPLICATE_USERNAME' });
    await expect(
      registerCredential({
        username: 'other_name_01',
        email: ' DUPLICATE@EXAMPLE.COM ',
        password: 'Different-password-03!',
        fullName: 'Duplicate Test',
        phone: '0865689102',
      })
    ).rejects.toMatchObject({ code: 'DUPLICATE_EMAIL' });
    expect((await authenticateCredential('duplicate_01', 'Original-password-03!')).id).toBe(
      original.id
    );
  });

  it('Fixture D: rejects wrong passwords with the same generic error', async () => {
    await expect(authenticateCredential('duplicate_01', 'wrong-password')).rejects.toEqual(
      expect.objectContaining<AuthError>({
        code: 'INVALID_CREDENTIALS',
        message: 'Tên đăng nhập hoặc mật khẩu không đúng.',
      })
    );
    await expect(authenticateCredential('missing-user', 'wrong-password')).rejects.toEqual(
      expect.objectContaining<AuthError>({
        code: 'INVALID_CREDENTIALS',
        message: 'Tên đăng nhập hoặc mật khẩu không đúng.',
      })
    );
  });

  it('Fixture E: creates one profile and never duplicates it during login, session restore, or Google linking', async () => {
    const user = await registerCredential({
      username: 'profile_once',
      email: 'profile.once@example.com',
      password: 'Valid-test-password-05!',
      fullName: 'Profile Once',
      phone: '0865689102',
    });
    await authenticateCredential('profile_once', 'Valid-test-password-05!');
    const { token } = await createSession(user.id);
    await resolveSession(token);
    const linked = await findOrCreateGoogleUser({
      subject: 'google-subject-05',
      email: ' PROFILE.ONCE@EXAMPLE.COM ',
      emailVerified: true,
      displayName: 'Google Name',
    });
    expect(linked.user.id).toBe(user.id);
    expect(linked.created).toBe(false);
    expect(await getProfileCount(user.id)).toBe(1);
  });

  it('persists the simplified onboarding model without fabricating consent', async () => {
    const user = await registerCredential({
      username: 'onboarding_01',
      email: 'onboarding@example.com',
      password: 'Valid-test-password-06!',
      fullName: 'Onboarding Test',
      phone: '0865689102',
    });
    await saveOnboarding(user.id, {
      fullName: 'Nguyễn An',
      grade: '12',
      provinceCode: '67',
      phone: '090 123 4567',
      schoolId: 'vn-67-gia-nghia',
      schoolName: 'A stale client label that must not be trusted',
      schoolSource: 'dataset',
      primarySubject: 'PHYSICS',
      currentScore: 6.5,
      targetScore: 8.5,
      acquisitionSource: 'TikTok',
    });
    const database = await readAuthDatabase();
    const profile = database.studentProfiles.find((candidate) => candidate.userId === user.id)!;
    expect(profile.onboardingCompletedAt).toBeTruthy();
    expect(profile).toMatchObject({
      provinceCode: '67',
      provinceName: 'Đắk Nông',
      schoolId: 'vn-67-gia-nghia',
      schoolName: 'THPT Gia Nghĩa',
      schoolSource: 'dataset',
    });
    expect(
      database.learningProfiles.find((candidate) => candidate.studentId === profile.id)
    ).toMatchObject({ primarySubject: 'PHYSICS', currentScore: 6.5, targetScore: 8.5 });
    expect(database.studentAcquisitions).toContainEqual(
      expect.objectContaining({ studentId: profile.id, source: 'TikTok', sourceOther: null })
    );
    expect(
      database.communicationPreferences.find((candidate) => candidate.studentId === profile.id)
    ).toBeUndefined();
  });

  it('stores custom schools separately and rejects a dataset school from another province', async () => {
    const user = await registerCredential({
      username: 'school_source_01',
      password: 'Valid-test-password-08!',
      fullName: 'School Source',
      phone: '0865689102',
    });
    const common = {
      fullName: 'School Source',
      grade: '12',
      primarySubject: 'MATH' as const,
      currentScore: 6,
      targetScore: 8,
      acquisitionSource: 'Google' as const,
    };
    await expect(
      saveOnboarding(user.id, {
        ...common,
        provinceCode: '74',
        schoolId: 'vn-67-gia-nghia',
        schoolName: 'THPT Gia Nghĩa',
        schoolSource: 'dataset',
      })
    ).rejects.toMatchObject({ code: 'INCOMPLETE_ONBOARDING' });

    await saveOnboarding(user.id, {
      ...common,
      provinceCode: '74',
      schoolName: 'THPT Tương Lai',
      schoolSource: 'custom',
    });
    const database = await readAuthDatabase();
    expect(
      database.studentProfiles.find((candidate) => candidate.userId === user.id)
    ).toMatchObject({
      schoolId: null,
      schoolName: 'THPT Tương Lai',
      schoolSource: 'custom',
    });
  });

  it('rejects scores outside the supported 0–10 range', async () => {
    const user = await registerCredential({
      username: 'invalid_score_01',
      password: 'Valid-test-password-07!',
      fullName: 'Invalid Score',
      phone: '0865689102',
    });
    await expect(
      saveOnboarding(user.id, {
        fullName: 'Invalid Score',
        grade: '12',
        provinceCode: '74',
        primarySubject: 'MATH',
        currentScore: 6.5,
        targetScore: 11,
        acquisitionSource: 'Google',
      })
    ).rejects.toMatchObject({ code: 'INCOMPLETE_ONBOARDING' });
  });

  it('does not persist plaintext secrets in the store file', async () => {
    const raw = await readFile(process.env.AUTH_STORE_PATH!, 'utf8');
    expect(raw).not.toContain('Valid-test-password');
  });
});
