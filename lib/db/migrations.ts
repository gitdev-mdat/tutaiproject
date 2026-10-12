import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type postgres from 'postgres';

/**
 * Applies the pending db/migrations/*.sql files in name order, all in one
 * transaction, so a failure leaves the database unchanged. Applied files are
 * recorded with a checksum; editing an applied file is an error, so changes
 * always go in a new file.
 */

type Sql = postgres.Sql;

export const MIGRATIONS_DIR = path.join(process.cwd(), 'db', 'migrations');

export type MigrationResult = { applied: string[]; skipped: string[] };

export async function runMigrations(
  sql: Sql,
  { directory = MIGRATIONS_DIR, dryRun = false } = {}
): Promise<MigrationResult> {
  const files = (await readdir(directory)).filter((file) => file.endsWith('.sql')).sort();
  const result: MigrationResult = { applied: [], skipped: [] };
  const rollback = new Error('dry run');
  await sql
    .begin(async (tx) => {
      // One runner at a time, for concurrent deploys.
      await tx`select pg_advisory_xact_lock(hashtext('tutai.schema_migrations'))`;
      await tx`create schema if not exists tutai`;
      await tx`
      create table if not exists tutai.schema_migrations (
        name text primary key,
        checksum text not null,
        applied_at timestamptz not null default now()
      )`;
      const applied = new Map(
        (await tx`select name, checksum from tutai.schema_migrations`).map((row) => [
          row.name as string,
          row.checksum as string,
        ])
      );
      for (const file of files) {
        const body = await readFile(path.join(directory, file), 'utf8');
        const checksum = createHash('sha256').update(body).digest('hex');
        const previous = applied.get(file);
        if (previous) {
          if (previous !== checksum) {
            throw new Error(`Migration ${file} was edited after it was applied.`);
          }
          result.skipped.push(file);
          continue;
        }
        // A dry run applies the files too, so SQL errors show up, then rolls back.
        await tx.unsafe(body);
        await tx`insert into tutai.schema_migrations (name, checksum) values (${file}, ${checksum})`;
        result.applied.push(file);
      }
      if (dryRun) throw rollback;
    })
    .catch((error) => {
      if (error !== rollback) throw error;
    });
  return result;
}
