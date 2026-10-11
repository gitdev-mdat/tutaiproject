import 'server-only';

import postgres from 'postgres';

type Sql = ReturnType<typeof postgres>;
type DatabaseOptions = NonNullable<Parameters<typeof postgres>[1]>;
type DatabaseEnv = {
  DATABASE_URL?: string;
  DATABASE_POOL_MAX?: string;
  DATABASE_CA_CERT?: string;
};

const globalForDb = globalThis as unknown as { tutaiSql?: Sql };

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/**
 * Connection settings for PostgreSQL behind Supabase's transaction pooler
 * (Supavisor, port 6543) on serverless functions:
 *
 * - `prepare: false`: a transaction-mode pooler hands each transaction to any
 *   server connection, so named prepared statements cannot be reused.
 * - TLS is required for every non-local host. With DATABASE_CA_CERT (the
 *   Supabase root certificate, PEM) the server certificate and host name are
 *   verified; without it the connection is encrypted but not verified. An
 *   explicit `sslmode` in the URL wins.
 * - Connections are short-lived (`idle_timeout`, `max_lifetime`) so a function
 *   instance that was frozen does not keep reusing sockets the pooler has
 *   already dropped, and each instance holds at most DATABASE_POOL_MAX
 *   (default 3, capped at 10) connections.
 */
export function databaseOptions(env: DatabaseEnv = process.env as DatabaseEnv): DatabaseOptions {
  const url = env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set.');
  const parsed = new URL(url);
  const requested = Number(env.DATABASE_POOL_MAX ?? 3);
  const max = Number.isInteger(requested) ? Math.min(Math.max(requested, 1), 10) : 3;
  let ssl: DatabaseOptions['ssl'] = false;
  if (!parsed.searchParams.has('sslmode') && !LOCAL_HOSTS.has(parsed.hostname)) {
    const ca = env.DATABASE_CA_CERT?.replace(/\\n/g, '\n').trim();
    ssl = ca ? { ca, rejectUnauthorized: true, servername: parsed.hostname } : 'require';
  }
  return {
    max,
    idle_timeout: 20,
    max_lifetime: 5 * 60,
    connect_timeout: 10,
    prepare: false,
    ...(ssl ? { ssl } : {}),
    onnotice: () => {},
  };
}

export function getSql(): Sql {
  if (globalForDb.tutaiSql) return globalForDb.tutaiSql;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set.');
  globalForDb.tutaiSql = postgres(url, databaseOptions());
  return globalForDb.tutaiSql;
}

export async function closeSql(): Promise<void> {
  const sql = globalForDb.tutaiSql;
  globalForDb.tutaiSql = undefined;
  await sql?.end({ timeout: 5 });
}

function errorCode(error: unknown): string | undefined {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : undefined;
}

// The server never saw the statement: connecting failed or was refused.
const NOT_SENT = new Set([
  'CONNECT_TIMEOUT',
  'ECONNREFUSED',
  'ENOTFOUND',
  'EAI_AGAIN',
  '53300', // too_many_connections, raised at startup
  '57P03', // cannot_connect_now
]);

// The connection dropped; the statement may or may not have run.
const CONNECTION_LOST = new Set([
  'ECONNRESET',
  'EPIPE',
  'ETIMEDOUT',
  'CONNECTION_CLOSED',
  'CONNECTION_DESTROYED',
  '57P01', // admin_shutdown
  '08003',
  '08006',
]);

export function isRetryableDatabaseError(error: unknown, idempotent: boolean): boolean {
  const code = errorCode(error);
  if (!code) return false;
  return NOT_SENT.has(code) || (idempotent && CONNECTION_LOST.has(code));
}

/**
 * Runs `operation` and retries it once after a transient connection failure.
 *
 * Reads and other idempotent operations are retried after any dropped
 * connection. Writes are retried only when the statement certainly never
 * reached the server; after an ambiguous failure the error is thrown, because
 * a commit may already have happened.
 */
export async function withDatabaseRetry<T>(
  operation: () => Promise<T>,
  { idempotent }: { idempotent: boolean }
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isRetryableDatabaseError(error, idempotent)) throw error;
    await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 200));
    return operation();
  }
}
