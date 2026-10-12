// Shared by the JSON and PostgreSQL auth store suites: linking a Google
// account into a signed-in password account, and every way it must refuse.

import { expect } from 'vitest';
import {
  createSession,
  findOrCreateGoogleUser,
  linkGoogleToUser,
  registerCredential,
  resolveSession,
  saveOnboarding,
} from './auth-service';
import { evaluateAdminAccess } from './admin';
import { ACCOUNT_LINK_REQUIRES_VERIFICATION } from './errors';

const PRODUCTION = { NODE_ENV: 'production' };

export async function runGoogleLinkScenario(tag: string) {
  const env = { ...PRODUCTION, ADMIN_EMAILS: `owner.${tag}@example.com` };
  const register = (username: string, email?: string) =>
    registerCredential({
      username: `${username}_${tag}`,
      email,
      password: 'mat-khau-dung-1',
      fullName: 'Học sinh liên kết',
      phone: '0865689102',
    });

  // A password student with progress, no email, signed in.
  const owner = await register('owner');
  await saveOnboarding(owner.id, {
    fullName: 'Chủ dự án',
    grade: '12',
    provinceCode: '74',
    primarySubject: 'MATH',
    currentScore: 6,
    targetScore: 8,
    acquisitionSource: 'Khác',
    acquisitionSourceOther: 'Kiểm thử',
  });
  const { token } = await createSession(owner.id);
  const before = (await resolveSession(token))!;
  expect(evaluateAdminAccess(before.user, env)).toEqual({ allowed: false, reason: 'forbidden' });

  // Google says the email is unverified: nothing changes.
  await expect(
    linkGoogleToUser(owner.id, {
      subject: `g-owner-${tag}`,
      email: `owner.${tag}@example.com`,
      emailVerified: false,
    })
  ).rejects.toMatchObject({ code: 'UNVERIFIED_GOOGLE_EMAIL' });

  // Linking proves the email; the same account becomes an admin and keeps its profile.
  const linked = await linkGoogleToUser(owner.id, {
    subject: `g-owner-${tag}`,
    email: `Owner.${tag}@Example.com`,
    emailVerified: true,
    displayName: 'Owner',
  });
  expect(linked).toMatchObject({ id: owner.id, email: `owner.${tag}@example.com` });
  expect(linked.emailVerifiedAt).toBeTruthy();
  const after = (await resolveSession(token))!;
  expect(after.profile).toMatchObject({
    id: before.profile.id,
    fullName: 'Chủ dự án',
    onboardingCompletedAt: before.profile.onboardingCompletedAt,
  });
  expect(after.learning).toMatchObject({ targetScore: 8, primarySubject: 'MATH' });
  expect(evaluateAdminAccess(after.user, env)).toMatchObject({ allowed: true, adminId: owner.id });

  // Linking again is a no-op, and a later Google sign-in lands in the same account.
  await expect(
    linkGoogleToUser(owner.id, {
      subject: `g-owner-${tag}`,
      email: `owner.${tag}@example.com`,
      emailVerified: true,
    })
  ).resolves.toMatchObject({ id: owner.id });
  await expect(
    findOrCreateGoogleUser({
      subject: `g-owner-${tag}`,
      email: `owner.${tag}@example.com`,
      emailVerified: true,
    })
  ).resolves.toMatchObject({ user: { id: owner.id }, created: false });

  // One Google account per Tú Tài account, and never someone else's.
  await expect(
    linkGoogleToUser(owner.id, {
      subject: `g-second-${tag}`,
      email: `owner.${tag}@example.com`,
      emailVerified: true,
    })
  ).rejects.toMatchObject({ code: 'ACCOUNT_HAS_OTHER_GOOGLE', status: 409 });
  const other = await register('other');
  await expect(
    linkGoogleToUser(other.id, {
      subject: `g-owner-${tag}`,
      email: `owner.${tag}@example.com`,
      emailVerified: true,
    })
  ).rejects.toMatchObject({ code: 'GOOGLE_LINKED_ELSEWHERE' });

  // A squatter pre-registers the admin's next address with a password.
  const squatter = await register('squatter', `next.${tag}@example.com`);
  // The squatter cannot verify it with their own Google account...
  await expect(
    linkGoogleToUser(squatter.id, {
      subject: `g-squatter-${tag}`,
      email: `squatter.${tag}@example.com`,
      emailVerified: true,
    })
  ).rejects.toMatchObject({ code: 'GOOGLE_EMAIL_MISMATCH' });
  // ...and the real owner of the address neither takes over nor merges with it.
  await expect(
    linkGoogleToUser(other.id, {
      subject: `g-next-${tag}`,
      email: `next.${tag}@example.com`,
      emailVerified: true,
    })
  ).rejects.toMatchObject({ code: 'GOOGLE_EMAIL_IN_USE' });
  await expect(
    findOrCreateGoogleUser({
      subject: `g-next-${tag}`,
      email: `next.${tag}@example.com`,
      emailVerified: true,
    })
  ).rejects.toMatchObject({ code: ACCOUNT_LINK_REQUIRES_VERIFICATION });
  const { token: squatterToken } = await createSession(squatter.id);
  const squatterSession = (await resolveSession(squatterToken))!;
  expect(squatterSession.user.emailVerifiedAt).toBeNull();
  expect(
    evaluateAdminAccess(squatterSession.user, {
      ...PRODUCTION,
      ADMIN_EMAILS: `next.${tag}@example.com`,
    })
  ).toEqual({ allowed: false, reason: 'forbidden' });

  // An email already owned by a Google-created account cannot be linked elsewhere.
  await findOrCreateGoogleUser({
    subject: `g-solo-${tag}`,
    email: `solo.${tag}@example.com`,
    emailVerified: true,
  });
  await expect(
    linkGoogleToUser(other.id, {
      subject: `g-solo-2-${tag}`,
      email: `solo.${tag}@example.com`,
      emailVerified: true,
    })
  ).rejects.toMatchObject({ code: 'GOOGLE_EMAIL_IN_USE' });
}
