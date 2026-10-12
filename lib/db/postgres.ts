import 'server-only';

import net from 'node:net';

import postgres from 'postgres';

type Sql = ReturnType<typeof postgres>;
type DatabaseOptions = NonNullable<Parameters<typeof postgres>[1]>;
type DatabaseEnv = {
  DATABASE_URL?: string;
  DATABASE_POOL_MAX?: string;
  DATABASE_CA_CERT?: string;
};

const globalForDb = globalThis as unknown as {
  tutaiSql?: Sql;
  tutaiHeartbeat?: number;
  tutaiHeartbeatTimer?: ReturnType<typeof setInterval>;
};

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/**
 * Connection settings for PostgreSQL behind Supabase's transaction pooler
 * (Supavisor, port 6543) on serverless functions:
 *
 * - `prepare: false`: a transaction-mode pooler hands each transaction to any
 *   server connection, so named prepared statements cannot be reused.
 * - `max_pipeline: 1`: extra concurrent queries wait for a free connection
 *   instead of being pipelined behind a slow one.
 * - TLS is required for every non-local host. With DATABASE_CA_CERT (the
 *   Supabase root certificate, PEM) the server certificate and host name are
 *   verified; without it the connection is encrypted but not verified. An
 *   explicit `sslmode` in the URL wins.
 * - Vercel freezes a function between invocations. A socket that was open
 *   across a freeze can be dead on the far side while Node still thinks it is
 *   alive, and a query sent on it waits for an answer that never comes, until
 *   the function's 300 s limit. So idle connections close after a second, and
 *   every socket is destroyed after SOCKET_INACTIVITY_MS without any traffic,
 *   which fails the query with ETIMEDOUT (retried by `withDatabaseRetry` for
 *   reads) instead of hanging the page. getSql() also replaces the client when
 *   a heartbeat timer shows the function was just frozen, so a request after
 *   a pause starts on fresh connections instead of waiting out the watchdog.
 * - Each instance holds at most DATABASE_POOL_MAX (default 3, capped at 10)
 *   connections.
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
    idle_timeout: 1,
    max_lifetime: 5 * 60,
    connect_timeout: 10,
    prepare: false,
    ...(ssl ? { ssl } : {}),
    onnotice: () => {},
    // Supported by postgres.js at runtime but missing from its type definitions.
    ...({ max_pipeline: 1, socket: watchedSocket } as DatabaseOptions),
  };
}

export const SOCKET_INACTIVITY_MS = 12_000;

/**
 * A TCP socket that destroys itself after SOCKET_INACTIVITY_MS without reads
 * or writes. postgres.js strips all listeners from the raw socket before it
 * upgrades to TLS, so the timeout listener is put back whenever that happens.
 */
class WatchedSocket extends net.Socket {
  constructor() {
    super();
    this.setTimeout(SOCKET_INACTIVITY_MS);
    this.watch();
  }

  private watch() {
    this.on('timeout', () => {
      const error = Object.assign(new Error('Database socket stopped responding.'), {
        code: 'ETIMEDOUT',
      });
      this.destroy(error);
    });
  }

  override removeAllListeners(event?: string | symbol): this {
    super.removeAllListeners(event);
    if (event === undefined || event === 'timeout') this.watch();
    return this;
  }
}

function watchedSocket(options: { host: string[]; port: number[] }): net.Socket {
  const socket = new WatchedSocket();
  // postgres.js reads `host` to set the TLS server name.
  Object.assign(socket, { host: options.host[0] });
  return socket.connect(options.port[0], options.host[0]);
}

// A timer that ticks while the process runs. If the last tick is much older
// than its interval, the function was frozen, and every pooled socket may be
// dead without Node knowing.
const HEARTBEAT_MS = 250;
const FROZEN_AFTER_MS = 1_000;

export function getSql(): Sql {
  const now = Date.now();
  const frozen =
    globalForDb.tutaiHeartbeat !== undefined && now - globalForDb.tutaiHeartbeat > FROZEN_AFTER_MS;
  if (globalForDb.tutaiSql && !frozen) return globalForDb.tutaiSql;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set.');
  // Queries already running on the old client may finish; new ones get fresh
  // connections instead of sockets that went quiet during the freeze.
  void globalForDb.tutaiSql?.end({ timeout: 15 }).catch(() => {});
  globalForDb.tutaiSql = postgres(url, databaseOptions());
  globalForDb.tutaiHeartbeat = now;
  if (!globalForDb.tutaiHeartbeatTimer) {
    globalForDb.tutaiHeartbeatTimer = setInterval(() => {
      globalForDb.tutaiHeartbeat = Date.now();
    }, HEARTBEAT_MS);
    globalForDb.tutaiHeartbeatTimer.unref();
  }
  return globalForDb.tutaiSql;
}

export async function closeSql(): Promise<void> {
  const sql = globalForDb.tutaiSql;
  globalForDb.tutaiSql = undefined;
  clearInterval(globalForDb.tutaiHeartbeatTimer);
  globalForDb.tutaiHeartbeatTimer = undefined;
  globalForDb.tutaiHeartbeat = undefined;
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
