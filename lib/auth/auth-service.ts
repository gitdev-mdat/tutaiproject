import 'server-only';

import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { authTransaction, readAuthDatabase } from './store';
import { hashPassword, verifyPassword } from './password';
import {
  isValidEmail,
  isValidUsername,
  isValidVietnamesePhone,
  normalizeEmail,
  normalizePhone,
  normalizeUsername,
} from './normalization';
import type { AuthDatabase, AuthUser, StoredStudentProfile } from './types';
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

export class AuthError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400
  ) {
    super(message);
  }
}

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function createProfile(
  database: AuthDatabase,
  userId: string,
  fullName = '',
  phone: string | null = null
): StoredStudentProfile {
  const now = new Date().toISOString();
  const profile: StoredStudentProfile = {
    id: randomUUID(),
    userId,
    fullName,
    phone,
    provinceCode: null,
    provinceName: null,
    schoolId: null,
    schoolName: null,
    schoolSource: null,
    grade: null,
    onboardingCompletedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  database.studentProfiles.push(profile);
  database.learningProfiles.push({
    studentId: profile.id,
    primarySubject: null,
    currentScore: null,
    targetScore: null,
    updatedAt: now,
  });
  return profile;
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

  return authTransaction((database) => {
    if (database.users.some((user) => user.username === username)) {
      throw new AuthError('DUPLICATE_USERNAME', 'Tên đăng nhập đã được sử dụng.', 409);
    }
    if (email && database.users.some((user) => user.email === email)) {
      throw new AuthError('DUPLICATE_EMAIL', 'Email đã được sử dụng.', 409);
    }
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
    database.users.push(user);
    database.identities.push({
      id: randomUUID(),
      userId: user.id,
      provider: 'password',
      providerAccountId: username,
      passwordHash,
      createdAt: now,
    });
    createProfile(database, user.id, fullName, phone);
    return user;
  });
}

export async function authenticateCredential(
  identifierInput: string,
  password: string
): Promise<AuthUser> {
  const identifier = identifierInput.includes('@')
    ? normalizeEmail(identifierInput)
    : normalizeUsername(identifierInput);
  const database = await readAuthDatabase();
  const user = database.users.find(
    (candidate) => candidate.username === identifier || candidate.email === identifier
  );
  const identity =
    user &&
    database.identities.find(
      (candidate) => candidate.userId === user.id && candidate.provider === 'password'
    );
  if (
    !user ||
    !identity?.passwordHash ||
    !(await verifyPassword(password, identity.passwordHash))
  ) {
    throw new AuthError('INVALID_CREDENTIALS', GENERIC_CREDENTIAL_ERROR, 401);
  }
  return user;
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
  return authTransaction((database) => {
    const existingIdentity = database.identities.find(
      (identity) => identity.provider === 'google' && identity.providerAccountId === input.subject
    );
    if (existingIdentity) {
      const user = database.users.find((candidate) => candidate.id === existingIdentity.userId);
      if (!user) throw new AuthError('BROKEN_IDENTITY', 'Không thể khôi phục tài khoản.', 500);
      return { user, created: false };
    }
    let user = database.users.find((candidate) => candidate.email === email);
    const now = new Date().toISOString();
    let created = false;
    if (!user) {
      created = true;
      user = {
        id: randomUUID(),
        username: null,
        email,
        emailVerifiedAt: now,
        displayName: input.displayName?.trim() || null,
        avatarUrl: input.avatarUrl || null,
        createdAt: now,
        updatedAt: now,
      };
      database.users.push(user);
      createProfile(database, user.id, input.displayName?.trim() || '');
    } else {
      user.emailVerifiedAt = user.emailVerifiedAt ?? now;
      user.displayName = user.displayName || input.displayName?.trim() || null;
      user.avatarUrl = user.avatarUrl || input.avatarUrl || null;
      user.updatedAt = now;
    }
    database.identities.push({
      id: randomUUID(),
      userId: user.id,
      provider: 'google',
      providerAccountId: input.subject,
      passwordHash: null,
      createdAt: now,
    });
    return { user, created };
  });
}

export async function createSession(
  userId: string,
  remember = true,
  replaceExisting = false
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + (remember ? 30 : 1) * 24 * 60 * 60 * 1000);
  await authTransaction((database) => {
    const now = new Date().toISOString();
    database.sessions = database.sessions.filter(
      (session) =>
        new Date(session.expiresAt) > new Date() && (!replaceExisting || session.userId !== userId)
    );
    database.sessions.push({
      id: randomUUID(),
      userId,
      tokenHash: tokenHash(token),
      expiresAt: expiresAt.toISOString(),
      createdAt: now,
    });
  });
  return { token, expiresAt };
}

export async function resolveSession(token: string | undefined) {
  if (!token) return null;
  const database = await readAuthDatabase();
  const session = database.sessions.find(
    (candidate) =>
      candidate.tokenHash === tokenHash(token) && new Date(candidate.expiresAt) > new Date()
  );
  if (!session) return null;
  const user = database.users.find((candidate) => candidate.id === session.userId);
  const profile = database.studentProfiles.find((candidate) => candidate.userId === session.userId);
  if (!user || !profile) return null;
  const learning = database.learningProfiles.find(
    (candidate) => candidate.studentId === profile.id
  );
  return { user, profile, learning: learning ?? null };
}

export async function revokeSession(token: string | undefined): Promise<void> {
  if (!token) return;
  await authTransaction((database) => {
    database.sessions = database.sessions.filter(
      (session) => session.tokenHash !== tokenHash(token)
    );
  });
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
  await authTransaction((database) => {
    const profile = database.studentProfiles.find((candidate) => candidate.userId === userId);
    if (!profile) throw new AuthError('PROFILE_NOT_FOUND', 'Không tìm thấy hồ sơ.', 404);
    const learning = database.learningProfiles.find(
      (candidate) => candidate.studentId === profile.id
    );
    if (!learning)
      throw new AuthError('PROFILE_INCOMPLETE', 'Hồ sơ chưa được khởi tạo đầy đủ.', 500);
    const now = new Date().toISOString();
    Object.assign(profile, {
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
    });
    Object.assign(learning, {
      primarySubject: input.primarySubject,
      currentScore,
      targetScore,
      updatedAt: now,
    });
    const acquisition = database.studentAcquisitions.find(
      (candidate) => candidate.studentId === profile.id
    );
    const acquisitionData = {
      studentId: profile.id,
      source: input.acquisitionSource,
      sourceOther:
        input.acquisitionSource === 'Khác' ? input.acquisitionSourceOther?.trim() || null : null,
      recordedAt: now,
    };
    if (acquisition) Object.assign(acquisition, acquisitionData);
    else database.studentAcquisitions.push(acquisitionData);
  });
}

export async function requestPasswordReset(identifierInput: string): Promise<string | null> {
  const identifier = identifierInput.includes('@')
    ? normalizeEmail(identifierInput)
    : normalizeUsername(identifierInput);
  return authTransaction((database) => {
    const user = database.users.find(
      (candidate) => candidate.username === identifier || candidate.email === identifier
    );
    if (
      !user ||
      !database.identities.some(
        (identity) => identity.userId === user.id && identity.provider === 'password'
      )
    )
      return null;
    const token = randomBytes(32).toString('base64url');
    const now = new Date();
    database.passwordResets.push({
      id: randomUUID(),
      userId: user.id,
      tokenHash: tokenHash(token),
      expiresAt: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
      usedAt: null,
      createdAt: now.toISOString(),
    });
    return token;
  });
}

export async function resetPassword(token: string, password: string): Promise<void> {
  if (password.length < 8)
    throw new AuthError('INVALID_PASSWORD', 'Mật khẩu phải có ít nhất 8 ký tự.');
  const passwordHash = await hashPassword(password);
  await authTransaction((database) => {
    const record = database.passwordResets.find(
      (candidate) =>
        candidate.tokenHash === tokenHash(token) &&
        !candidate.usedAt &&
        new Date(candidate.expiresAt) > new Date()
    );
    if (!record)
      throw new AuthError(
        'INVALID_RESET_TOKEN',
        'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.',
        400
      );
    const identity = database.identities.find(
      (candidate) => candidate.userId === record.userId && candidate.provider === 'password'
    );
    if (!identity)
      throw new AuthError('PASSWORD_IDENTITY_NOT_FOUND', 'Tài khoản không hỗ trợ mật khẩu.', 400);
    identity.passwordHash = passwordHash;
    record.usedAt = new Date().toISOString();
    database.sessions = database.sessions.filter((session) => session.userId !== record.userId);
  });
}

export async function getProfileCount(userId: string): Promise<number> {
  const database = await readAuthDatabase();
  return database.studentProfiles.filter((profile) => profile.userId === userId).length;
}
