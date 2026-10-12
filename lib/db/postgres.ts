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

const globalForDb = globalThis as unknown as { tutaiSql?: Sql };

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/**
 * Connection settings for PostgreSQL behind Supabase's transaction pooler
 * (Supavisor, port 6543) on serverless functions:
 *
 * - `prepare: false`: a transaction-mode pooler hands each transaction to any
 *   server connection, so named prepared statements cannot be reused.
 * - `max_pipeline: 0`: a connection carries one statement at a time. When a
 *   page ran more queries than it had connections, postgres.js pipelined the
 *   extra one behind a running query on the same socket, and through the
 *   pooler that second statement never got an answer. Extra queries now wait
 *   for a free connection.
 * - TLS is required for every non-local host. With DATABASE_CA_CERT (the
 *   Supabase root certificate, PEM) the server certificate and host name are
 *   verified; without it the connection is encrypted but not verified. An
 *   explicit `sslmode` in the URL wins.
 * - Every socket is destroyed after SOCKET_INACTIVITY_MS without any traffic,
 *   so a statement that gets no answer (for example on a socket that died
 *   while Vercel froze the function) fails with ETIMEDOUT, retried by
 *   `withDatabaseRetry` for reads, instead of hanging until the function's
 *   300 s limit. Connections are also short-lived (`idle_timeout`,
 *   `max_lifetime`).
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
    idle_timeout: 20,
    max_lifetime: 5 * 60,
    connect_timeout: 10,
    prepare: false,
    ...(ssl ? { ssl } : {}),
    onnotice: () => {},
    // Supported by postgres.js at runtime but missing from its type definitions.
    ...({ max_pipeline: 0, socket: watchedSocket } as DatabaseOptions),
  };
}

export const SOCKET_INACTIVITY_MS = 12_000;

/**
 * A TCP socket that destroys itself after SOCKET_INACTIVITY_MS without reads
 * or writes. postgres.js strips all listeners from the raw socket before it
 * upgrades to TLS, so the timeout listener is put back whenever that happens.
 *
 * On Vercel a frozen function wakes with this timeout and postgres.js's own
 * idle timeout both due in the same tick. Closing the socket in that tick
 * pulls the file descriptor out from under the goodbye message postgres.js
 * is writing, and the resulting EBADF reaches no listener and kills the
 * process. So the socket closes one tick later, and keeps a listener for
 * errors of its own after TLS has taken it over.
 */
class WatchedSocket extends net.Socket {
  constructor(inactivityMs: number) {
    super();
    this.setTimeout(inactivityMs);
    this.watch();
    this.on('error', ignoreError);
  }

  private watch() {
    this.on('timeout', () => {
      console.warn('[db] no traffic on a database socket; closing it');
      const error = Object.assign(new Error('Database socket stopped responding.'), {
        code: 'ETIMEDOUT',
      });
      setImmediate(() => this.destroy(error));
    });
  }

  override removeAllListeners(...args: [event?: string | symbol]): this {
    // Forward the call as made: removeAllListeners(undefined) only clears an
    // event named "undefined", not every event.
    super.removeAllListeners(...args);
    const [event] = args;
    if (args.length === 0 || event === 'timeout') this.watch();
    if (args.length === 0 || event === 'error') this.on('error', ignoreError);
    return this;
  }
}

function ignoreError() {}

export function watchedSocket(
  options: { host: string[]; port: number[] },
  inactivityMs = SOCKET_INACTIVITY_MS
): net.Socket {
  const socket = new WatchedSocket(inactivityMs);
  // postgres.js reads `host` to set the TLS server name.
  Object.assign(socket, { host: options.host[0] });
  return socket.connect(options.port[0], options.host[0]);
}

export function getSql(): Sql {
  if (globalForDb.tutaiSql) return globalForDb.tutaiSql;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set.');
  const sql = postgres(url, databaseOptions());
  // postgres.js begins a transaction through a hook that it skips when
  // pipelining is off (max_pipeline: 0), so run transactions on a reserved
  // connection instead. Same API for callers, begin(fn) or begin(mode, fn),
  // except that savepoints are not supported.
  sql.begin = ((mode: string | TransactionBody, body?: TransactionBody) =>
    reservedTransaction(sql, mode, body)) as unknown as Sql['begin'];
  globalForDb.tutaiSql = sql;
  return sql;
}

type TransactionBody = (tx: postgres.ReservedSql) => unknown;

async function reservedTransaction(
  sql: Sql,
  mode: string | TransactionBody,
  body?: TransactionBody
): Promise<unknown> {
  const fn = typeof mode === 'function' ? mode : body;
  if (!fn) throw new Error('begin() needs a transaction function.');
  const options = typeof mode === 'string' ? mode.replace(/[^a-z ]/gi, '') : '';
  const tx = await sql.reserve();
  try {
    await tx.unsafe(`begin ${options}`);
    try {
      const result = fn(tx);
      const value = await (Array.isArray(result) ? Promise.all(result) : result);
      await tx.unsafe('commit');
      return value;
    } catch (error) {
      await tx.unsafe('rollback').catch(() => {});
      throw error;
    }
  } finally {
    tx.release();
  }
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
