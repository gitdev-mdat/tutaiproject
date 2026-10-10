import 'server-only';

import postgres from 'postgres';

/**
 * The single PostgreSQL client for server code. Reads DATABASE_URL, which must
 * never be exposed to the browser (no NEXT_PUBLIC_ prefix).
 *
 * Settings suit Vercel functions in front of a pooler such as Supabase's
 * transaction pooler (port 6543): few connections per instance, short idle
 * time, and no prepared statements, which transaction pooling does not support.
 */

type Sql = ReturnType<typeof postgres>;

const globalForDb = globalThis as unknown as { tutaiSql?: Sql };

export function getSql(): Sql {
  if (globalForDb.tutaiSql) return globalForDb.tutaiSql;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set.');
  globalForDb.tutaiSql = postgres(url, {
    max: Number(process.env.DATABASE_POOL_MAX ?? 3),
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
    onnotice: () => {},
  });
  return globalForDb.tutaiSql;
}

/** For tests and scripts: closes the shared client. */
export async function closeSql(): Promise<void> {
  const sql = globalForDb.tutaiSql;
  globalForDb.tutaiSql = undefined;
  await sql?.end({ timeout: 5 });
}
