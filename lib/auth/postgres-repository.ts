import 'server-only';

import type postgres from 'postgres';
import { getSql, withDatabaseRetry } from '@/lib/db/postgres';
import { AuthError, unverifiedAccountLinkError } from './errors';
import type { AuthRepository, NewAccount } from './repository';
import type {
  AssignmentAttempt,
  AuthUser,
  StoredStudentProfile,
  StudentEnrollment,
  StudentLearningProfile,
} from './types';

/** Durable store: the tutai schema created by db/migrations. */

type Row = Record<string, unknown>;
type Tx = postgres.TransactionSql;

const iso = (value: unknown) => (value == null ? null : new Date(value as string).toISOString());

function toUser(row: Row): AuthUser {
  return {
    id: row.id as string,
    username: row.username as string | null,
    email: row.email as string | null,
    emailVerifiedAt: iso(row.email_verified_at),
    displayName: row.display_name as string | null,
    avatarUrl: row.avatar_url as string | null,
    createdAt: iso(row.created_at)!,
    updatedAt: iso(row.updated_at)!,
  };
}

function toProfile(row: Row): StoredStudentProfile {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    fullName: row.full_name as string,
    phone: row.phone as string | null,
    provinceCode: row.province_code as string | null,
    provinceName: row.province_name as string | null,
    schoolId: row.school_id as string | null,
    schoolName: row.school_name as string | null,
    schoolSource: row.school_source as StoredStudentProfile['schoolSource'],
    grade: row.grade as string | null,
    onboardingCompletedAt: iso(row.onboarding_completed_at),
    createdAt: iso(row.created_at)!,
    updatedAt: iso(row.updated_at)!,
  };
}

function toLearning(row: Row): StudentLearningProfile {
  return {
    studentId: row.student_id as string,
    primarySubject: row.primary_subject as StudentLearningProfile['primarySubject'],
    currentScore: row.current_score as number | null,
    targetScore: row.target_score as number | null,
    updatedAt: iso(row.updated_at)!,
  };
}

function toEnrollment(row: Row): StudentEnrollment {
  return {
    id: row.id as string,
    studentId: row.student_id as string,
    programVersionId: row.program_version_id as string,
    status: 'active',
    assignedAt: iso(row.assigned_at)!,
  };
}

function toAttempt(row: Row): AssignmentAttempt {
  return {
    studentId: row.student_id as string,
    profileFingerprint: row.profile_fingerprint as string,
    status: 'blocked',
    code: row.code as AssignmentAttempt['code'],
    retryable: row.retryable as boolean,
    incidentId: row.incident_id as string,
    attemptedAt: iso(row.attempted_at)!,
  };
}

function uniqueViolation(error: unknown): string | null {
  const pgError = error as { code?: string; constraint_name?: string };
  return pgError?.code === '23505' ? (pgError.constraint_name ?? '') : null;
}

async function insertAccount(tx: Tx, { user, identity, profile, learning }: NewAccount) {
  await tx`
    insert into tutai.users (id, username, email, email_verified_at, display_name, avatar_url, created_at, updated_at)
    values (${user.id}, ${user.username}, ${user.email}, ${user.emailVerifiedAt}, ${user.displayName},
            ${user.avatarUrl}, ${user.createdAt}, ${user.updatedAt})`;
  await tx`
    insert into tutai.identities (id, user_id, provider, provider_account_id, password_hash, created_at)
    values (${identity.id}, ${identity.userId}, ${identity.provider}, ${identity.providerAccountId},
            ${identity.passwordHash}, ${identity.createdAt})`;
  await tx`
    insert into tutai.student_profiles (id, user_id, full_name, phone, province_code, province_name,
      school_id, school_name, school_source, grade, onboarding_completed_at, created_at, updated_at)
    values (${profile.id}, ${profile.userId}, ${profile.fullName}, ${profile.phone}, ${profile.provinceCode},
            ${profile.provinceName}, ${profile.schoolId}, ${profile.schoolName}, ${profile.schoolSource},
            ${profile.grade}, ${profile.onboardingCompletedAt}, ${profile.createdAt}, ${profile.updatedAt})`;
  await tx`
    insert into tutai.learning_profiles (student_id, primary_subject, current_score, target_score, updated_at)
    values (${learning.studentId}, ${learning.primarySubject}, ${learning.currentScore},
            ${learning.targetScore}, ${learning.updatedAt})`;
}

const repository: AuthRepository = {
  async createPasswordUser(account) {
    try {
      await getSql().begin((tx) => insertAccount(tx, account));
    } catch (error) {
      const constraint = uniqueViolation(error);
      if (
        constraint === 'users_username_key' ||
        constraint === 'identities_provider_provider_account_id_key'
      )
        throw new AuthError('DUPLICATE_USERNAME', 'Tên đăng nhập đã được sử dụng.', 409);
      if (constraint === 'users_email_key')
        throw new AuthError('DUPLICATE_EMAIL', 'Email đã được sử dụng.', 409);
      throw error;
    }
  },

  async findPasswordLogin(identifier) {
    const [row] = await getSql()`
      select u.*, i.password_hash
      from tutai.users u
      join tutai.identities i on i.user_id = u.id and i.provider = 'password'
      where u.username = ${identifier} or u.email = ${identifier}
      order by (u.username = ${identifier}) desc
      limit 1`;
    if (!row?.password_hash) return null;
    return { user: toUser(row), passwordHash: row.password_hash as string };
  },

  async upsertGoogleUser({ subject, email, displayName, avatarUrl, now, newAccount }) {
    // Two first-time sign-ins for the same person can race. The unique
    // constraints make one of them fail; retrying then finds the winner's rows.
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await getSql().begin(async (tx) => {
          const [linked] = await tx`
            select u.* from tutai.identities i join tutai.users u on u.id = i.user_id
            where i.provider = 'google' and i.provider_account_id = ${subject}`;
          if (linked) return { user: toUser(linked), created: false };

          const [owner] = await tx`
            select email_verified_at from tutai.users where email = ${email} for update`;
          if (owner && !owner.email_verified_at) throw unverifiedAccountLinkError();
          const [existing] = owner
            ? await tx`
                update tutai.users set
                  display_name = coalesce(nullif(display_name, ''), ${displayName}),
                  avatar_url = coalesce(nullif(avatar_url, ''), ${avatarUrl}),
                  updated_at = ${now}
                where email = ${email}
                returning *`
            : [];
          if (existing) {
            await tx`
              insert into tutai.identities (id, user_id, provider, provider_account_id, password_hash, created_at)
              values (${newAccount.identity.id}, ${existing.id}, 'google', ${subject}, null, ${now})`;
            return { user: toUser(existing), created: false };
          }
          await insertAccount(tx, newAccount);
          return { user: newAccount.user, created: true };
        });
      } catch (error) {
        if (attempt < 2 && uniqueViolation(error) !== null) continue;
        throw error;
      }
    }
  },

  async consumeRateLimit(key, windowMs) {
    const sql = getSql();
    const [row] = await sql`
      insert into tutai.rate_limits as r (key, count, window_started_at)
      values (${key}, 1, now())
      on conflict (key) do update set
        count = case when r.window_started_at <= now() - ${windowMs} * interval '1 millisecond'
          then 1 else r.count + 1 end,
        window_started_at = case when r.window_started_at <= now() - ${windowMs} * interval '1 millisecond'
          then now() else r.window_started_at end
      returning count`;
    // Windows are at most a day long; drop old counters now and then.
    if (Math.random() < 0.01) {
      await sql`delete from tutai.rate_limits where window_started_at < now() - interval '1 day'`.catch(
        () => undefined
      );
    }
    return row.count as number;
  },

  async resetRateLimit(key) {
    await getSql()`delete from tutai.rate_limits where key = ${key}`;
  },

  async createSession(record, replaceExisting) {
    await getSql().begin(async (tx) => {
      await tx`
        delete from tutai.sessions
        where expires_at <= now() or (${replaceExisting} and user_id = ${record.userId})`;
      await tx`
        insert into tutai.sessions (id, user_id, token_hash, expires_at, created_at)
        values (${record.id}, ${record.userId}, ${record.tokenHash}, ${record.expiresAt}, ${record.createdAt})`;
    });
  },

  async findSession(tokenHash) {
    // Every page starts with this lookup. On Vercel it sometimes stalled after
    // the pooler had parsed it, waiting for the second half of a parameterised
    // query (bind/execute) that never arrived. A sha256 hex digest can be
    // inlined safely, which lets it go out as one simple-protocol message.
    if (!/^[0-9a-f]{64}$/.test(tokenHash)) return null;
    const [row] = await getSql().unsafe(`
      select
        to_jsonb(u) as "user",
        to_jsonb(p) as profile,
        to_jsonb(l) as learning
      from tutai.sessions s
      join tutai.users u on u.id = s.user_id
      join tutai.student_profiles p on p.user_id = s.user_id
      left join tutai.learning_profiles l on l.student_id = p.id
      where s.token_hash = '${tokenHash}' and s.expires_at > now()`);
    if (!row) return null;
    return {
      user: toUser(row.user as Row),
      profile: toProfile(row.profile as Row),
      learning: row.learning ? toLearning(row.learning as Row) : null,
    };
  },

  async deleteSession(tokenHash) {
    await getSql()`delete from tutai.sessions where token_hash = ${tokenHash}`;
  },

  async saveOnboarding(userId, { profile, learning, acquisition }) {
    await getSql().begin(async (tx) => {
      const [updated] = await tx`
        update tutai.student_profiles set
          full_name = ${profile.fullName}, grade = ${profile.grade},
          province_code = ${profile.provinceCode}, province_name = ${profile.provinceName},
          phone = ${profile.phone}, school_id = ${profile.schoolId}, school_name = ${profile.schoolName},
          school_source = ${profile.schoolSource},
          onboarding_completed_at = ${profile.onboardingCompletedAt}, updated_at = ${profile.updatedAt}
        where user_id = ${userId}
        returning id`;
      if (!updated) throw new AuthError('PROFILE_NOT_FOUND', 'Không tìm thấy hồ sơ.', 404);
      const studentId = updated.id as string;
      const [learningRow] = await tx`
        update tutai.learning_profiles set
          primary_subject = ${learning.primarySubject}, current_score = ${learning.currentScore},
          target_score = ${learning.targetScore}, updated_at = ${learning.updatedAt}
        where student_id = ${studentId}
        returning student_id`;
      if (!learningRow)
        throw new AuthError('PROFILE_INCOMPLETE', 'Hồ sơ chưa được khởi tạo đầy đủ.', 500);
      await tx`
        insert into tutai.student_acquisitions (student_id, source, source_other, recorded_at)
        values (${studentId}, ${acquisition.source}, ${acquisition.sourceOther}, ${acquisition.recordedAt})
        on conflict (student_id) do update set
          source = excluded.source, source_other = excluded.source_other,
          recorded_at = excluded.recorded_at`;
    });
  },

  async createPasswordReset(identifier, record) {
    const rows = await getSql()`
      insert into tutai.password_resets (id, user_id, token_hash, expires_at, used_at, created_at)
      select ${record.id}, u.id, ${record.tokenHash}, ${record.expiresAt}, null, ${record.createdAt}
      from tutai.users u
      join tutai.identities i on i.user_id = u.id and i.provider = 'password'
      where u.username = ${identifier} or u.email = ${identifier}
      order by (u.username = ${identifier}) desc
      limit 1
      returning id`;
    return rows.length > 0;
  },

  async consumePasswordReset(tokenHash, passwordHash, usedAt) {
    await getSql().begin(async (tx) => {
      // The conditional update makes the token single-use even under concurrent requests.
      const [reset] = await tx`
        update tutai.password_resets set used_at = ${usedAt}
        where token_hash = ${tokenHash} and used_at is null and expires_at > now()
        returning user_id`;
      if (!reset)
        throw new AuthError(
          'INVALID_RESET_TOKEN',
          'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.',
          400
        );
      const [identity] = await tx`
        update tutai.identities set password_hash = ${passwordHash}
        where user_id = ${reset.user_id} and provider = 'password'
        returning id`;
      if (!identity)
        throw new AuthError('PASSWORD_IDENTITY_NOT_FOUND', 'Tài khoản không hỗ trợ mật khẩu.', 400);
      await tx`delete from tutai.sessions where user_id = ${reset.user_id}`;
    });
  },

  async countProfiles(userId) {
    const [row] = await getSql()`
      select count(*)::int as count from tutai.student_profiles where user_id = ${userId}`;
    return row.count as number;
  },

  async findStudentByUserId(userId) {
    const [row] = await getSql()`
      select to_jsonb(p) as profile, to_jsonb(l) as learning
      from tutai.student_profiles p
      left join tutai.learning_profiles l on l.student_id = p.id
      where p.user_id = ${userId}`;
    if (!row) return null;
    return {
      profile: toProfile(row.profile as Row),
      learning: row.learning ? toLearning(row.learning as Row) : null,
    };
  },

  async ensureAssignment(studentId, plan) {
    return getSql().begin(async (tx) => {
      // Locking the profile row serialises concurrent assignments for one student.
      const [profile] = await tx`
        select * from tutai.student_profiles where id = ${studentId} for update`;
      const [learning] = await tx`
        select * from tutai.learning_profiles where student_id = ${studentId}`;
      const [enrollment] = await tx`
        select * from tutai.enrollments where student_id = ${studentId} and status = 'active'`;
      const attempts = await tx`
        select * from tutai.assignment_attempts where student_id = ${studentId}
        order by attempted_at`;
      const result = plan({
        profile: profile ? toProfile(profile) : null,
        learning: learning ? toLearning(learning) : null,
        enrollment: enrollment ? toEnrollment(enrollment) : null,
        attempts: attempts.map(toAttempt),
      });
      if (result.kind === 'enroll') {
        const e = result.enrollment;
        await tx`
          insert into tutai.enrollments (id, student_id, program_version_id, status, assigned_at)
          values (${e.id}, ${e.studentId}, ${e.programVersionId}, ${e.status}, ${e.assignedAt})`;
        await tx`delete from tutai.assignment_attempts where student_id = ${studentId}`;
      } else if (result.kind === 'blocked') {
        const b = result.blocked;
        await tx`
          delete from tutai.assignment_attempts
          where student_id = ${studentId} and profile_fingerprint <> ${b.profileFingerprint}`;
        await tx`
          insert into tutai.assignment_attempts (student_id, profile_fingerprint, status, code,
            retryable, incident_id, attempted_at)
          values (${b.studentId}, ${b.profileFingerprint}, ${b.status}, ${b.code}, ${b.retryable},
                  ${b.incidentId}, ${b.attemptedAt})
          on conflict (student_id, profile_fingerprint) do nothing`;
      }
      return result;
    });
  },

  async findAssignment(studentId) {
    const sql = getSql();
    const [[enrollment], [attempt]] = await Promise.all([
      sql`select * from tutai.enrollments where student_id = ${studentId} and status = 'active'`,
      sql`select * from tutai.assignment_attempts where student_id = ${studentId}
          order by attempted_at desc limit 1`,
    ]);
    return {
      enrollment: enrollment ? toEnrollment(enrollment) : null,
      latestAttempt: attempt ? toAttempt(attempt) : null,
    };
  },
};

// Methods that only read, or whose effect is the same when repeated. The
// others each run one statement or one transaction, and are retried only when
// that never reached the server (see withDatabaseRetry).
const IDEMPOTENT = new Set<keyof AuthRepository>([
  'findPasswordLogin',
  'findSession',
  'deleteSession',
  'resetRateLimit',
  'countProfiles',
  'findStudentByUserId',
  'findAssignment',
]);

export const postgresAuthRepository = Object.fromEntries(
  Object.entries(repository).map(([name, method]) => [
    name,
    (...args: unknown[]) =>
      withDatabaseRetry(() => (method as (...a: unknown[]) => Promise<unknown>)(...args), {
        idempotent: IDEMPOTENT.has(name as keyof AuthRepository),
      }),
  ])
) as unknown as AuthRepository;
