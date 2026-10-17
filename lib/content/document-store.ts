import 'server-only';

import { getSql } from '@/lib/db/postgres';

/**
 * Where admin-edited content (knowledge tree, lesson articles, question bank)
 * is kept. With DATABASE_URL each document is a row in
 * tutai.content_documents, so edits made on Vercel survive redeploys.
 * Without it the existing JSON files under data/ are used, which is only
 * durable on a machine with a persistent disk (local development).
 *
 * With DATABASE_URL a document that has no row reads as `empty()`, never
 * from the git-tracked seed files: an emptied or freshly migrated database
 * must not bring old sample curriculum back.
 */
export type ContentDocumentSource<T> = {
  key: string;
  readFile: () => Promise<T>;
  writeFile: (value: T) => Promise<void>;
  /** The document's value when the database has no row for it yet. */
  empty: () => T;
};

export function usesDatabaseContentStore(
  env: { DATABASE_URL?: string } = process.env as { DATABASE_URL?: string }
): boolean {
  return Boolean(env.DATABASE_URL);
}

export async function readContentDocument<T>(source: ContentDocumentSource<T>): Promise<T> {
  if (!usesDatabaseContentStore()) return source.readFile();
  const sql = getSql();
  const [row] = await sql`select body from tutai.content_documents where key = ${source.key}`;
  return row ? (row.body as T) : source.empty();
}

export async function writeContentDocument<T>(
  source: ContentDocumentSource<T>,
  value: T
): Promise<void> {
  if (!usesDatabaseContentStore()) return source.writeFile(value);
  const sql = getSql();
  await sql`
    insert into tutai.content_documents (key, body, updated_at)
    values (${source.key}, ${sql.json(value as never)}, now())
    on conflict (key) do update set body = excluded.body, updated_at = excluded.updated_at`;
}

/**
 * Read, change and write one document. In the database the row is locked for
 * the duration, so two admins saving at once cannot drop each other's change.
 */
export async function updateContentDocument<T>(
  source: ContentDocumentSource<T>,
  change: (current: T) => T | Promise<T>
): Promise<T> {
  if (!usesDatabaseContentStore()) {
    const next = await change(await source.readFile());
    await source.writeFile(next);
    return next;
  }
  const sql = getSql();
  return sql.begin(async (tx) => {
    await tx`
      insert into tutai.content_documents (key, body)
      values (${source.key}, ${tx.json(source.empty() as never)})
      on conflict (key) do nothing`;
    const [row] = await tx`
      select body from tutai.content_documents where key = ${source.key} for update`;
    const next = await change(row.body as T);
    await tx`
      update tutai.content_documents set body = ${tx.json(next as never)}, updated_at = now()
      where key = ${source.key}`;
    return next;
  }) as Promise<T>;
}
