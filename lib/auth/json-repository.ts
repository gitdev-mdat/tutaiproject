import 'server-only';

import { AuthError, googleLinkError, unverifiedAccountLinkError } from './errors';
import type { AuthRepository } from './repository';
import { authTransaction, readAuthDatabase } from './store';
import type { AuthDatabase } from './types';

/** The original file store (data/runtime/auth-store.json). Local development and tests only. */

function findByIdentifier(database: AuthDatabase, identifier: string) {
  return database.users.find(
    (candidate) => candidate.username === identifier || candidate.email === identifier
  );
}

// Rate-limit counters stay in memory: the file store serves one local process.
const rateLimits = new Map<string, { count: number; windowStartedAt: number }>();

export const jsonAuthRepository: AuthRepository = {
  async consumeRateLimit(key, windowMs) {
    const now = Date.now();
    const current = rateLimits.get(key);
    const next =
      current && now - current.windowStartedAt < windowMs
        ? { count: current.count + 1, windowStartedAt: current.windowStartedAt }
        : { count: 1, windowStartedAt: now };
    rateLimits.set(key, next);
    return next.count;
  },

  async resetRateLimit(key) {
    rateLimits.delete(key);
  },

  async createPasswordUser({ user, identity, profile, learning }) {
    await authTransaction((database) => {
      if (user.username && database.users.some((item) => item.username === user.username)) {
        throw new AuthError('DUPLICATE_USERNAME', 'Tên đăng nhập đã được sử dụng.', 409);
      }
      if (user.email && database.users.some((item) => item.email === user.email)) {
        throw new AuthError('DUPLICATE_EMAIL', 'Email đã được sử dụng.', 409);
      }
      database.users.push(user);
      database.identities.push(identity);
      database.studentProfiles.push(profile);
      database.learningProfiles.push(learning);
    });
  },

  async findPasswordLogin(identifier) {
    const database = await readAuthDatabase();
    const user = findByIdentifier(database, identifier);
    const identity =
      user &&
      database.identities.find(
        (candidate) => candidate.userId === user.id && candidate.provider === 'password'
      );
    if (!user || !identity?.passwordHash) return null;
    return { user, passwordHash: identity.passwordHash };
  },

  async upsertGoogleUser({ subject, email, displayName, avatarUrl, now, newAccount }) {
    return authTransaction((database) => {
      const existingIdentity = database.identities.find(
        (identity) => identity.provider === 'google' && identity.providerAccountId === subject
      );
      if (existingIdentity) {
        const user = database.users.find((candidate) => candidate.id === existingIdentity.userId);
        if (!user) throw new AuthError('BROKEN_IDENTITY', 'Không thể khôi phục tài khoản.', 500);
        return { user, created: false };
      }
      let user = database.users.find((candidate) => candidate.email === email);
      let created = false;
      if (!user) {
        created = true;
        user = newAccount.user;
        database.users.push(user);
        database.studentProfiles.push(newAccount.profile);
        database.learningProfiles.push(newAccount.learning);
      } else {
        if (!user.emailVerifiedAt) throw unverifiedAccountLinkError();
        user.displayName = user.displayName || displayName;
        user.avatarUrl = user.avatarUrl || avatarUrl;
        user.updatedAt = now;
      }
      database.identities.push({ ...newAccount.identity, userId: user.id });
      return { user, created };
    });
  },

  async linkGoogleIdentity({ userId, subject, email, identityId, displayName, avatarUrl, now }) {
    return authTransaction((database) => {
      const user = database.users.find((candidate) => candidate.id === userId);
      if (!user) throw new AuthError('SESSION_EXPIRED', 'Phiên đăng nhập đã hết hạn.', 401);
      const linked = database.identities.find(
        (identity) => identity.provider === 'google' && identity.providerAccountId === subject
      );
      if (linked && linked.userId !== userId) throw googleLinkError('GOOGLE_LINKED_ELSEWHERE');
      if (linked) return user;
      if (database.identities.some((i) => i.userId === userId && i.provider === 'google'))
        throw googleLinkError('ACCOUNT_HAS_OTHER_GOOGLE');
      if (user.email && user.email !== email) throw googleLinkError('GOOGLE_EMAIL_MISMATCH');
      if (database.users.some((candidate) => candidate.email === email && candidate.id !== userId))
        throw googleLinkError('GOOGLE_EMAIL_IN_USE');
      user.email = email;
      user.emailVerifiedAt = user.emailVerifiedAt ?? now;
      user.displayName = user.displayName || displayName;
      user.avatarUrl = user.avatarUrl || avatarUrl;
      user.updatedAt = now;
      database.identities.push({
        id: identityId,
        userId,
        provider: 'google',
        providerAccountId: subject,
        passwordHash: null,
        createdAt: now,
      });
      return user;
    });
  },

  async createSession(record, replaceExisting) {
    await authTransaction((database) => {
      database.sessions = database.sessions.filter(
        (session) =>
          new Date(session.expiresAt) > new Date() &&
          (!replaceExisting || session.userId !== record.userId)
      );
      database.sessions.push(record);
    });
  },

  async findSession(tokenHash) {
    const database = await readAuthDatabase();
    const session = database.sessions.find(
      (candidate) => candidate.tokenHash === tokenHash && new Date(candidate.expiresAt) > new Date()
    );
    if (!session) return null;
    const user = database.users.find((candidate) => candidate.id === session.userId);
    const profile = database.studentProfiles.find(
      (candidate) => candidate.userId === session.userId
    );
    if (!user || !profile) return null;
    const learning = database.learningProfiles.find(
      (candidate) => candidate.studentId === profile.id
    );
    return { user, profile, learning: learning ?? null };
  },

  async deleteSession(tokenHash) {
    await authTransaction((database) => {
      database.sessions = database.sessions.filter((session) => session.tokenHash !== tokenHash);
    });
  },

  async saveOnboarding(userId, update) {
    await authTransaction((database) => {
      const profile = database.studentProfiles.find((candidate) => candidate.userId === userId);
      if (!profile) throw new AuthError('PROFILE_NOT_FOUND', 'Không tìm thấy hồ sơ.', 404);
      const learning = database.learningProfiles.find(
        (candidate) => candidate.studentId === profile.id
      );
      if (!learning)
        throw new AuthError('PROFILE_INCOMPLETE', 'Hồ sơ chưa được khởi tạo đầy đủ.', 500);
      Object.assign(profile, update.profile);
      Object.assign(learning, update.learning);
      const acquisitionData = { ...update.acquisition, studentId: profile.id };
      const acquisition = database.studentAcquisitions.find(
        (candidate) => candidate.studentId === profile.id
      );
      if (acquisition) Object.assign(acquisition, acquisitionData);
      else database.studentAcquisitions.push(acquisitionData);
    });
  },

  async saveLearningGoals(userId, { grade, learning }) {
    await authTransaction((database) => {
      const profile = database.studentProfiles.find((candidate) => candidate.userId === userId);
      if (!profile) throw new AuthError('PROFILE_NOT_FOUND', 'Không tìm thấy hồ sơ.', 404);
      const current = database.learningProfiles.find(
        (candidate) => candidate.studentId === profile.id
      );
      if (!current)
        throw new AuthError('PROFILE_INCOMPLETE', 'Hồ sơ chưa được khởi tạo đầy đủ.', 500);
      profile.grade = grade;
      profile.updatedAt = learning.updatedAt;
      Object.assign(current, learning);
    });
  },

  async createPasswordReset(identifier, record) {
    return authTransaction((database) => {
      const user = findByIdentifier(database, identifier);
      if (
        !user ||
        !database.identities.some(
          (identity) => identity.userId === user.id && identity.provider === 'password'
        )
      )
        return false;
      database.passwordResets.push({ ...record, userId: user.id });
      return true;
    });
  },

  async consumePasswordReset(tokenHash, passwordHash, usedAt) {
    await authTransaction((database) => {
      const record = database.passwordResets.find(
        (candidate) =>
          candidate.tokenHash === tokenHash &&
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
      record.usedAt = usedAt;
      database.sessions = database.sessions.filter((session) => session.userId !== record.userId);
    });
  },

  async countProfiles(userId) {
    const database = await readAuthDatabase();
    return database.studentProfiles.filter((profile) => profile.userId === userId).length;
  },

  async findStudentByUserId(userId) {
    const database = await readAuthDatabase();
    const profile = database.studentProfiles.find((candidate) => candidate.userId === userId);
    if (!profile) return null;
    const learning = database.learningProfiles.find(
      (candidate) => candidate.studentId === profile.id
    );
    return { profile, learning: learning ?? null };
  },

  async ensureAssignment(studentId, plan) {
    return authTransaction((database) => {
      const result = plan({
        profile: database.studentProfiles.find((item) => item.id === studentId) ?? null,
        learning: database.learningProfiles.find((item) => item.studentId === studentId) ?? null,
        enrollment:
          database.enrollments.find(
            (item) => item.studentId === studentId && item.status === 'active'
          ) ?? null,
        attempts: database.assignmentAttempts.filter((item) => item.studentId === studentId),
      });
      if (result.kind === 'enroll') {
        database.enrollments.push(result.enrollment);
        database.assignmentAttempts = database.assignmentAttempts.filter(
          (item) => item.studentId !== studentId
        );
      } else if (result.kind === 'blocked') {
        database.assignmentAttempts = database.assignmentAttempts.filter(
          (item) =>
            item.studentId !== studentId ||
            item.profileFingerprint === result.blocked.profileFingerprint
        );
        if (
          !database.assignmentAttempts.some(
            (item) =>
              item.studentId === studentId &&
              item.profileFingerprint === result.blocked.profileFingerprint
          )
        )
          database.assignmentAttempts.push(result.blocked);
      }
      return result;
    });
  },

  async findAssignment(studentId) {
    const database = await readAuthDatabase();
    return {
      enrollment:
        database.enrollments.find(
          (item) => item.studentId === studentId && item.status === 'active'
        ) ?? null,
      latestAttempt:
        database.assignmentAttempts.filter((item) => item.studentId === studentId).at(-1) ?? null,
    };
  },
};
