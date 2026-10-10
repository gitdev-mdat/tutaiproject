import type postgres from 'postgres';
import { migrateDatabase } from './store';
import type { AuthDatabase } from './types';

/**
 * Copies an auth-store.json snapshot into the tutai PostgreSQL schema.
 *
 * - Validates the whole snapshot first and imports nothing if it has errors.
 * - Keeps every id, so cookies, links and other data that point at them keep working.
 * - Idempotent: rows already present and identical are left alone. A row whose
 *   id exists with different content is a conflict; conflicts abort the import,
 *   so data written after cutover is never overwritten.
 * - Runs in one transaction. A dry run does the same work and rolls back.
 * - Reports counts and ids only; never emails, phone numbers, hashes or tokens.
 */

type Sql = postgres.Sql;
type Tx = postgres.TransactionSql;
type Value = string | number | boolean | null;

type Column = { name: string; get: (row: never) => unknown; timestamp?: boolean };
type TableSpec = {
  key: keyof Omit<AuthDatabase, 'version'>;
  table: string;
  primaryKey: string[];
  columns: Column[];
};

const col = <T>(name: string, get: (row: T) => unknown, timestamp = false): Column => ({
  name,
  get: get as (row: never) => unknown,
  timestamp,
});

// Parent tables first, so foreign keys hold at every step.
export const TABLES: TableSpec[] = [
  {
    key: 'users',
    table: 'users',
    primaryKey: ['id'],
    columns: [
      col<AuthDatabase['users'][number]>('id', (r) => r.id),
      col<AuthDatabase['users'][number]>('username', (r) => r.username),
      col<AuthDatabase['users'][number]>('email', (r) => r.email),
      col<AuthDatabase['users'][number]>('email_verified_at', (r) => r.emailVerifiedAt, true),
      col<AuthDatabase['users'][number]>('display_name', (r) => r.displayName),
      col<AuthDatabase['users'][number]>('avatar_url', (r) => r.avatarUrl),
      col<AuthDatabase['users'][number]>('created_at', (r) => r.createdAt, true),
      col<AuthDatabase['users'][number]>('updated_at', (r) => r.updatedAt, true),
    ],
  },
  {
    key: 'identities',
    table: 'identities',
    primaryKey: ['id'],
    columns: [
      col<AuthDatabase['identities'][number]>('id', (r) => r.id),
      col<AuthDatabase['identities'][number]>('user_id', (r) => r.userId),
      col<AuthDatabase['identities'][number]>('provider', (r) => r.provider),
      col<AuthDatabase['identities'][number]>('provider_account_id', (r) => r.providerAccountId),
      col<AuthDatabase['identities'][number]>('password_hash', (r) => r.passwordHash),
      col<AuthDatabase['identities'][number]>('created_at', (r) => r.createdAt, true),
    ],
  },
  {
    key: 'studentProfiles',
    table: 'student_profiles',
    primaryKey: ['id'],
    columns: [
      col<AuthDatabase['studentProfiles'][number]>('id', (r) => r.id),
      col<AuthDatabase['studentProfiles'][number]>('user_id', (r) => r.userId),
      col<AuthDatabase['studentProfiles'][number]>('full_name', (r) => r.fullName),
      col<AuthDatabase['studentProfiles'][number]>('phone', (r) => r.phone),
      col<AuthDatabase['studentProfiles'][number]>('province_code', (r) => r.provinceCode),
      col<AuthDatabase['studentProfiles'][number]>('province_name', (r) => r.provinceName),
      col<AuthDatabase['studentProfiles'][number]>('school_id', (r) => r.schoolId),
      col<AuthDatabase['studentProfiles'][number]>('school_name', (r) => r.schoolName),
      col<AuthDatabase['studentProfiles'][number]>('school_source', (r) => r.schoolSource),
      col<AuthDatabase['studentProfiles'][number]>('grade', (r) => r.grade),
      col<AuthDatabase['studentProfiles'][number]>(
        'onboarding_completed_at',
        (r) => r.onboardingCompletedAt,
        true
      ),
      col<AuthDatabase['studentProfiles'][number]>('created_at', (r) => r.createdAt, true),
      col<AuthDatabase['studentProfiles'][number]>('updated_at', (r) => r.updatedAt, true),
    ],
  },
  {
    key: 'learningProfiles',
    table: 'learning_profiles',
    primaryKey: ['student_id'],
    columns: [
      col<AuthDatabase['learningProfiles'][number]>('student_id', (r) => r.studentId),
      col<AuthDatabase['learningProfiles'][number]>('primary_subject', (r) => r.primarySubject),
      col<AuthDatabase['learningProfiles'][number]>('current_score', (r) => r.currentScore),
      col<AuthDatabase['learningProfiles'][number]>('target_score', (r) => r.targetScore),
      col<AuthDatabase['learningProfiles'][number]>('updated_at', (r) => r.updatedAt, true),
    ],
  },
  {
    key: 'studentAcquisitions',
    table: 'student_acquisitions',
    primaryKey: ['student_id'],
    columns: [
      col<AuthDatabase['studentAcquisitions'][number]>('student_id', (r) => r.studentId),
      col<AuthDatabase['studentAcquisitions'][number]>('source', (r) => r.source),
      col<AuthDatabase['studentAcquisitions'][number]>('source_other', (r) => r.sourceOther),
      col<AuthDatabase['studentAcquisitions'][number]>('recorded_at', (r) => r.recordedAt, true),
    ],
  },
  {
    key: 'communicationPreferences',
    table: 'communication_preferences',
    primaryKey: ['student_id'],
    columns: [
      col<AuthDatabase['communicationPreferences'][number]>('student_id', (r) => r.studentId),
      col<AuthDatabase['communicationPreferences'][number]>(
        'consultation_consent',
        (r) => r.consultationConsent
      ),
      col<AuthDatabase['communicationPreferences'][number]>(
        'marketing_consent',
        (r) => r.marketingConsent
      ),
      col<AuthDatabase['communicationPreferences'][number]>(
        'consent_updated_at',
        (r) => r.consentUpdatedAt,
        true
      ),
    ],
  },
  {
    key: 'sessions',
    table: 'sessions',
    primaryKey: ['id'],
    columns: [
      col<AuthDatabase['sessions'][number]>('id', (r) => r.id),
      col<AuthDatabase['sessions'][number]>('user_id', (r) => r.userId),
      col<AuthDatabase['sessions'][number]>('token_hash', (r) => r.tokenHash),
      col<AuthDatabase['sessions'][number]>('expires_at', (r) => r.expiresAt, true),
      col<AuthDatabase['sessions'][number]>('created_at', (r) => r.createdAt, true),
    ],
  },
  {
    key: 'passwordResets',
    table: 'password_resets',
    primaryKey: ['id'],
    columns: [
      col<AuthDatabase['passwordResets'][number]>('id', (r) => r.id),
      col<AuthDatabase['passwordResets'][number]>('user_id', (r) => r.userId),
      col<AuthDatabase['passwordResets'][number]>('token_hash', (r) => r.tokenHash),
      col<AuthDatabase['passwordResets'][number]>('expires_at', (r) => r.expiresAt, true),
      col<AuthDatabase['passwordResets'][number]>('used_at', (r) => r.usedAt, true),
      col<AuthDatabase['passwordResets'][number]>('created_at', (r) => r.createdAt, true),
    ],
  },
  {
    key: 'enrollments',
    table: 'enrollments',
    primaryKey: ['id'],
    columns: [
      col<AuthDatabase['enrollments'][number]>('id', (r) => r.id),
      col<AuthDatabase['enrollments'][number]>('student_id', (r) => r.studentId),
      col<AuthDatabase['enrollments'][number]>('program_version_id', (r) => r.programVersionId),
      col<AuthDatabase['enrollments'][number]>('status', (r) => r.status),
      col<AuthDatabase['enrollments'][number]>('assigned_at', (r) => r.assignedAt, true),
    ],
  },
  {
    key: 'assignmentAttempts',
    table: 'assignment_attempts',
    primaryKey: ['student_id', 'profile_fingerprint'],
    columns: [
      col<AuthDatabase['assignmentAttempts'][number]>('student_id', (r) => r.studentId),
      col<AuthDatabase['assignmentAttempts'][number]>(
        'profile_fingerprint',
        (r) => r.profileFingerprint
      ),
      col<AuthDatabase['assignmentAttempts'][number]>('status', (r) => r.status),
      col<AuthDatabase['assignmentAttempts'][number]>('code', (r) => r.code),
      col<AuthDatabase['assignmentAttempts'][number]>('retryable', (r) => r.retryable),
      col<AuthDatabase['assignmentAttempts'][number]>('incident_id', (r) => r.incidentId),
      col<AuthDatabase['assignmentAttempts'][number]>('attempted_at', (r) => r.attemptedAt, true),
    ],
  },
];

export type TableReport = {
  table: string;
  source: number;
  inserted: number;
  unchanged: number;
  conflicts: string[];
};

export type ImportReport = {
  dryRun: boolean;
  committed: boolean;
  errors: string[];
  warnings: string[];
  tables: TableReport[];
};

function normalize(value: unknown, timestamp: boolean): Value {
  if (value === undefined || value === null) return null;
  if (timestamp) return new Date(value as string | Date).toISOString();
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
    return value;
  return JSON.stringify(value);
}

const keyOf = (spec: TableSpec, row: Record<string, Value>) =>
  spec.primaryKey.map((name) => String(row[name])).join('|');

function toRows(spec: TableSpec, database: AuthDatabase): Record<string, Value>[] {
  return (database[spec.key] as never[]).map((item) =>
    Object.fromEntries(
      spec.columns.map((column) => [column.name, normalize(column.get(item), !!column.timestamp)])
    )
  );
}

/** Structural checks the database would also enforce, reported all at once and without PII. */
export function validateSnapshot(database: AuthDatabase): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const duplicates = (label: string, values: (string | null)[]) => {
    const seen = new Set<string>();
    let count = 0;
    for (const value of values) {
      if (value === null) continue;
      if (seen.has(value)) count += 1;
      seen.add(value);
    }
    if (count) errors.push(`${label}: ${count} duplicate value(s)`);
  };

  for (const spec of TABLES) {
    const rows = toRows(spec, database);
    duplicates(
      `${spec.table} primary key`,
      rows.map((row) => keyOf(spec, row))
    );
    for (const row of rows) {
      for (const column of spec.columns) {
        const raw = row[column.name];
        if (column.timestamp && raw !== null && Number.isNaN(Date.parse(String(raw)))) {
          errors.push(`${spec.table} ${keyOf(spec, row)}: ${column.name} is not a valid time`);
        }
      }
    }
  }

  const userIds = new Set(database.users.map((user) => user.id));
  const studentIds = new Set(database.studentProfiles.map((profile) => profile.id));
  duplicates(
    'users.username',
    database.users.map((user) => user.username)
  );
  duplicates(
    'users.email',
    database.users.map((user) => user.email)
  );
  duplicates(
    'identities (provider, account)',
    database.identities.map((identity) => `${identity.provider}:${identity.providerAccountId}`)
  );
  duplicates(
    'password identities per user',
    database.identities
      .filter((identity) => identity.provider === 'password')
      .map((identity) => identity.userId)
  );
  duplicates(
    'student profiles per user',
    database.studentProfiles.map((profile) => profile.userId)
  );
  duplicates(
    'sessions.token_hash',
    database.sessions.map((session) => session.tokenHash)
  );
  duplicates(
    'password_resets.token_hash',
    database.passwordResets.map((reset) => reset.tokenHash)
  );
  duplicates(
    'active enrollments per student',
    database.enrollments
      .filter((enrollment) => enrollment.status === 'active')
      .map((enrollment) => enrollment.studentId)
  );

  for (const user of database.users) {
    if (!user.username && !user.email) errors.push(`users ${user.id}: no username and no email`);
    if (user.username && user.username !== user.username.toLowerCase())
      errors.push(`users ${user.id}: username is not lower case`);
    if (user.email && user.email !== user.email.toLowerCase())
      errors.push(`users ${user.id}: email is not lower case`);
  }
  for (const identity of database.identities) {
    if (!userIds.has(identity.userId)) errors.push(`identities ${identity.id}: unknown user`);
    if (identity.provider !== 'password' && identity.provider !== 'google')
      errors.push(`identities ${identity.id}: unknown provider`);
    if ((identity.provider === 'password') !== Boolean(identity.passwordHash))
      errors.push(`identities ${identity.id}: password hash does not match provider`);
    if (identity.passwordHash && !identity.passwordHash.startsWith('scrypt$'))
      errors.push(`identities ${identity.id}: unrecognised password hash format`);
  }
  for (const profile of database.studentProfiles) {
    if (!userIds.has(profile.userId)) errors.push(`student_profiles ${profile.id}: unknown user`);
  }
  const studentTables = [
    ['learning_profiles', database.learningProfiles],
    ['student_acquisitions', database.studentAcquisitions],
    ['communication_preferences', database.communicationPreferences],
    ['enrollments', database.enrollments],
    ['assignment_attempts', database.assignmentAttempts],
  ] as const;
  for (const [table, rows] of studentTables) {
    for (const row of rows) {
      if (!studentIds.has(row.studentId))
        errors.push(`${table} for ${row.studentId}: unknown student`);
    }
  }
  for (const [table, rows] of [
    ['sessions', database.sessions],
    ['password_resets', database.passwordResets],
  ] as const) {
    for (const row of rows) {
      if (!userIds.has(row.userId)) errors.push(`${table} ${row.id}: unknown user`);
    }
  }
  for (const learning of database.learningProfiles) {
    for (const score of [learning.currentScore, learning.targetScore]) {
      if (score !== null && (typeof score !== 'number' || score < 0 || score > 10))
        errors.push(`learning_profiles ${learning.studentId}: score out of range`);
    }
  }

  const profileUsers = new Set(database.studentProfiles.map((profile) => profile.userId));
  const withoutProfile = database.users.filter((user) => !profileUsers.has(user.id)).length;
  if (withoutProfile)
    warnings.push(`${withoutProfile} user(s) have no student profile and cannot sign in`);
  const learningStudents = new Set(database.learningProfiles.map((item) => item.studentId));
  const withoutLearning = database.studentProfiles.filter(
    (p) => !learningStudents.has(p.id)
  ).length;
  if (withoutLearning) warnings.push(`${withoutLearning} profile(s) have no learning profile`);
  const expired = database.sessions.filter((s) => Date.parse(s.expiresAt) <= Date.now()).length;
  if (expired) warnings.push(`${expired} session(s) already expired (imported as-is)`);
  return { errors, warnings };
}

export function parseSnapshot(raw: string): AuthDatabase {
  return migrateDatabase(JSON.parse(raw));
}

class RollbackForDryRun extends Error {}

async function importTable(tx: Tx, spec: TableSpec, rows: Record<string, Value>[]) {
  const report: TableReport = {
    table: spec.table,
    source: rows.length,
    inserted: 0,
    unchanged: 0,
    conflicts: [],
  };
  const names = spec.columns.map((column) => column.name);
  for (let start = 0; start < rows.length; start += 500) {
    const chunk = rows.slice(start, start + 500);
    const inserted = await tx`
      insert into ${tx('tutai.' + spec.table)} ${tx(chunk, names)}
      on conflict do nothing
      returning ${tx(spec.primaryKey)}`;
    report.inserted += inserted.length;
    const insertedKeys = new Set(inserted.map((row) => keyOf(spec, row as never)));
    const rest = chunk.filter((row) => !insertedKeys.has(keyOf(spec, row)));
    for (const row of rest) {
      const where = spec.primaryKey.map((name, index) => `${name} = $${index + 1}`).join(' and ');
      const [existing] = await tx.unsafe(
        `select * from tutai.${spec.table} where ${where}`,
        spec.primaryKey.map((name) => row[name]) as never[]
      );
      const same =
        existing &&
        spec.columns.every(
          (column) => normalize(existing[column.name], !!column.timestamp) === row[column.name]
        );
      if (same) report.unchanged += 1;
      else report.conflicts.push(keyOf(spec, row));
    }
  }
  return report;
}

export async function importAuthSnapshot(
  sql: Sql,
  database: AuthDatabase,
  { dryRun = true } = {}
): Promise<ImportReport> {
  const { errors, warnings } = validateSnapshot(database);
  const report: ImportReport = { dryRun, committed: false, errors, warnings, tables: [] };
  if (errors.length) return report;
  try {
    await sql.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(hashtext('tutai.auth-import'))`;
      for (const spec of TABLES) {
        report.tables.push(await importTable(tx, spec, toRows(spec, database)));
      }
      const conflicts = report.tables.reduce((total, table) => total + table.conflicts.length, 0);
      if (conflicts) {
        report.errors.push(
          `${conflicts} row(s) already exist with different content; nothing was imported`
        );
        throw new RollbackForDryRun();
      }
      if (dryRun) throw new RollbackForDryRun();
    });
    report.committed = true;
  } catch (error) {
    if (!(error instanceof RollbackForDryRun)) throw error;
  }
  return report;
}

/** Row counts per table, for reconciliation after an import. */
export async function countAuthTables(sql: Sql): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const spec of TABLES) {
    const [row] = await sql.unsafe(`select count(*)::int as count from tutai.${spec.table}`);
    counts[spec.table] = row.count as number;
  }
  return counts;
}
