import 'server-only';

import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { AuthError } from './errors';
import { getAuthRepository, type NewAccount } from './repository';
import { hashPassword, verifyPassword } from './password';
import {
  isValidEmail,
  isValidUsername,
  isValidVietnamesePhone,
  normalizeEmail,
  normalizePhone,
  normalizeUsername,
} from './normalization';
import type { AuthIdentity, AuthUser } from './types';
import { findLegacyProvinceByCode } from '@/data/vietnam-provinces-legacy';
import { findHighSchoolById, normalizeCustomHighSchoolName } from '@/data/vietnam-high-schools';
import {
  isAcquisitionSource,
  isPrimarySubjectCode,
  parseOnboardingScore,
  type AcquisitionSource,
  type PrimarySubjectCode,
} from '@/lib/onboarding/onboarding-model';

const GENERIC_CREDENTIAL_ERROR = 'Tên đăng nhập hoặc mật khẩu không đúng.';

export { AuthError };

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function newAccount(
  user: AuthUser,
  identity: Omit<AuthIdentity, 'userId'>,
  fullName: string,
  phone: string | null = null
): NewAccount {
  const profileId = randomUUID();
  return {
    user,
    identity: { ...identity, userId: user.id },
    profile: {
      id: profileId,
      userId: user.id,
      fullName,
      phone,
      provinceCode: null,
      provinceName: null,
      schoolId: null,
      schoolName: null,
      schoolSource: null,
      grade: null,
      onboardingCompletedAt: null,
      createdAt: user.createdAt,
      updatedAt: user.createdAt,
    },
    learning: {
      studentId: profileId,
      primarySubject: null,
      currentScore: null,
      targetScore: null,
      updatedAt: user.createdAt,
    },
  };
}

export async function registerCredential(input: {
  username: string;
  email?: string;
  password: string;
  fullName?: string;
  phone?: string;
}): Promise<AuthUser> {
  const username = normalizeUsername(input.username);
  const email = input.email?.trim() ? normalizeEmail(input.email) : null;
  const fullName = input.fullName?.trim() ?? '';
  const phone = input.phone?.trim() ? normalizePhone(input.phone) : null;
  if (!isValidUsername(username))
    throw new AuthError(
      'INVALID_USERNAME',
      'Tên đăng nhập gồm 4–24 ký tự: chữ cái, số, hoặc dấu gạch dưới.'
    );
  if (email && !isValidEmail(email)) throw new AuthError('INVALID_EMAIL', 'Email không hợp lệ.');
  if (fullName.length < 2) throw new AuthError('INVALID_FULL_NAME', 'Vui lòng nhập họ và tên.');
  if (!phone || !isValidVietnamesePhone(phone))
    throw new AuthError('INVALID_PHONE', 'Số điện thoại không hợp lệ.');
  if (input.password.length < 8)
    throw new AuthError('INVALID_PASSWORD', 'Mật khẩu phải có ít nhất 8 ký tự.');
  const passwordHash = await hashPassword(input.password);

  const now = new Date().toISOString();
  const user: AuthUser = {
    id: randomUUID(),
    username,
    email,
    emailVerifiedAt: null,
    displayName: null,
    avatarUrl: null,
    createdAt: now,
    updatedAt: now,
  };
  const repository = await getAuthRepository();
  await repository.createPasswordUser(
    newAccount(
      user,
      {
        id: randomUUID(),
        provider: 'password',
        providerAccountId: username,
        passwordHash,
        createdAt: now,
      },
      fullName,
      phone
    )
  );
  return user;
}

export async function authenticateCredential(
  identifierInput: string,
  password: string
): Promise<AuthUser> {
  const identifier = identifierInput.includes('@')
    ? normalizeEmail(identifierInput)
    : normalizeUsername(identifierInput);
  const login = await (await getAuthRepository()).findPasswordLogin(identifier);
  if (!login || !(await verifyPassword(password, login.passwordHash))) {
    throw new AuthError('INVALID_CREDENTIALS', GENERIC_CREDENTIAL_ERROR, 401);
  }
  return login.user;
}

export async function findOrCreateGoogleUser(input: {
  subject: string;
  email: string;
  emailVerified: boolean;
  displayName?: string | null;
  avatarUrl?: string | null;
}): Promise<{ user: AuthUser; created: boolean }> {
  if (!input.emailVerified)
    throw new AuthError('UNVERIFIED_GOOGLE_EMAIL', 'Google chưa xác minh email này.', 403);
  const email = normalizeEmail(input.email);
  const now = new Date().toISOString();
  const displayName = input.displayName?.trim() || null;
  const avatarUrl = input.avatarUrl || null;
  const user: AuthUser = {
    id: randomUUID(),
    username: null,
    email,
    emailVerifiedAt: now,
    displayName,
    avatarUrl,
    createdAt: now,
    updatedAt: now,
  };
  return (await getAuthRepository()).upsertGoogleUser({
    subject: input.subject,
    email,
    displayName,
    avatarUrl,
    now,
    newAccount: newAccount(
      user,
      {
        id: randomUUID(),
        provider: 'google',
        providerAccountId: input.subject,
        passwordHash: null,
        createdAt: now,
      },
      displayName ?? ''
    ),
  });
}

export async function createSession(
  userId: string,
  remember = true,
  replaceExisting = false
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + (remember ? 30 : 1) * 24 * 60 * 60 * 1000);
  await (
    await getAuthRepository()
  ).createSession(
    {
      id: randomUUID(),
      userId,
      tokenHash: tokenHash(token),
      expiresAt: expiresAt.toISOString(),
      createdAt: new Date().toISOString(),
    },
    replaceExisting
  );
  return { token, expiresAt };
}

export async function resolveSession(token: string | undefined) {
  if (!token) return null;
  return (await getAuthRepository()).findSession(tokenHash(token));
}

export async function revokeSession(token: string | undefined): Promise<void> {
  if (!token) return;
  await (await getAuthRepository()).deleteSession(tokenHash(token));
}

export async function saveOnboarding(
  userId: string,
  input: {
    fullName: string;
    grade: string;
    provinceCode: string;
    phone?: string;
    schoolId?: string;
    schoolName?: string;
    schoolSource?: 'dataset' | 'custom';
    primarySubject: PrimarySubjectCode;
    currentScore: number | string;
    targetScore: number | string;
    acquisitionSource: AcquisitionSource;
    acquisitionSourceOther?: string;
  }
): Promise<void> {
  const province = findLegacyProvinceByCode(input.provinceCode);
  const currentScore = parseOnboardingScore(input.currentScore);
  const targetScore = parseOnboardingScore(input.targetScore);
  const selectedSchool = input.schoolId ? findHighSchoolById(input.schoolId) : undefined;
  const hasSchoolInput = Boolean(input.schoolId || input.schoolName?.trim() || input.schoolSource);
  const hasValidDatasetSchool =
    input.schoolSource === 'dataset' &&
    Boolean(selectedSchool) &&
    selectedSchool?.provinceCode === province?.code;
  const hasValidCustomSchool =
    input.schoolSource === 'custom' && !input.schoolId && Boolean(input.schoolName?.trim());
  if (
    !input.fullName?.trim() ||
    !input.grade?.trim() ||
    !province ||
    !isPrimarySubjectCode(input.primarySubject) ||
    currentScore === null ||
    targetScore === null ||
    !isAcquisitionSource(input.acquisitionSource) ||
    (hasSchoolInput && !hasValidDatasetSchool && !hasValidCustomSchool)
  ) {
    throw new AuthError('INCOMPLETE_ONBOARDING', 'Vui lòng hoàn thành các thông tin bắt buộc.');
  }
  const now = new Date().toISOString();
  await (
    await getAuthRepository()
  ).saveOnboarding(userId, {
    profile: {
      fullName: input.fullName.trim(),
      grade: input.grade.trim(),
      provinceCode: province.code,
      provinceName: province.name,
      phone: input.phone ? normalizePhone(input.phone) : null,
      schoolId: hasValidDatasetSchool ? selectedSchool!.id : null,
      schoolName: hasValidDatasetSchool
        ? selectedSchool!.name
        : hasValidCustomSchool
          ? normalizeCustomHighSchoolName(input.schoolName!)
          : null,
      schoolSource: hasValidDatasetSchool ? 'dataset' : hasValidCustomSchool ? 'custom' : null,
      onboardingCompletedAt: now,
      updatedAt: now,
    },
    learning: {
      primarySubject: input.primarySubject,
      currentScore,
      targetScore,
      updatedAt: now,
    },
    acquisition: {
      source: input.acquisitionSource,
      sourceOther:
        input.acquisitionSource === 'Khác' ? input.acquisitionSourceOther?.trim() || null : null,
      recordedAt: now,
    },
  });
}

export async function requestPasswordReset(identifierInput: string): Promise<string | null> {
  const identifier = identifierInput.includes('@')
    ? normalizeEmail(identifierInput)
    : normalizeUsername(identifierInput);
  const token = randomBytes(32).toString('base64url');
  const now = new Date();
  const created = await (
    await getAuthRepository()
  ).createPasswordReset(identifier, {
    id: randomUUID(),
    tokenHash: tokenHash(token),
    expiresAt: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
    usedAt: null,
    createdAt: now.toISOString(),
  });
  return created ? token : null;
}

export async function resetPassword(token: string, password: string): Promise<void> {
  if (password.length < 8)
    throw new AuthError('INVALID_PASSWORD', 'Mật khẩu phải có ít nhất 8 ký tự.');
  const passwordHash = await hashPassword(password);
  await (
    await getAuthRepository()
  ).consumePasswordReset(tokenHash(token), passwordHash, new Date().toISOString());
}

export async function getProfileCount(userId: string): Promise<number> {
  return (await getAuthRepository()).countProfiles(userId);
}

export async function findStudentByUserId(userId: string) {
  return (await getAuthRepository()).findStudentByUserId(userId);
}
