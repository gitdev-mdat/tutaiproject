import 'server-only';

import { createHash, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { textbookPrivateFile, textbookStoreRoot } from './repository';

export function hasPrivateTextbookStorage(env = process.env): boolean {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY && env.TEXTBOOK_STORAGE_BUCKET);
}

function storageConfig() {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TEXTBOOK_STORAGE_BUCKET } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !TEXTBOOK_STORAGE_BUCKET) {
    throw new Error(
      'Private textbook storage needs SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and TEXTBOOK_STORAGE_BUCKET.'
    );
  }
  const bucket = TEXTBOOK_STORAGE_BUCKET.trim();
  if (!/^[a-z0-9][a-z0-9._-]{1,62}$/.test(bucket)) throw new Error('Invalid textbook bucket name.');
  return { base: SUPABASE_URL.replace(/\/+$/, ''), key: SUPABASE_SERVICE_ROLE_KEY, bucket };
}

function objectUrl(key: string) {
  const config = storageConfig();
  const safe = safeStorageKey(key);
  const encoded = safe.split('/').map(encodeURIComponent).join('/');
  return `${config.base}/storage/v1/object/${encodeURIComponent(config.bucket)}/${encoded}`;
}

async function assertPrivateBucket() {
  const config = storageConfig();
  const response = await fetch(
    `${config.base}/storage/v1/bucket/${encodeURIComponent(config.bucket)}`,
    {
      headers: { apikey: config.key, Authorization: `Bearer ${config.key}` },
      cache: 'no-store',
    }
  );
  if (!response.ok)
    throw new Error(`Textbook storage bucket is unavailable (HTTP ${response.status}).`);
  const bucket = (await response.json()) as { public?: unknown };
  if (bucket.public !== false) throw new Error('Textbook storage bucket must be private.');
}

export function safeStorageKey(key: string): string {
  const normalized = key.replaceAll('\\', '/');
  const parts = normalized.split('/');
  if (
    !key ||
    parts.some((part) => !part || part === '.' || part === '..') ||
    normalized.startsWith('/') ||
    /^[a-zA-Z]:\//.test(normalized)
  ) {
    throw new Error('Invalid textbook storage key.');
  }
  return parts.join('/');
}

export async function uploadPrivateTextbook(key: string, bytes: Buffer): Promise<void> {
  const config = storageConfig();
  await assertPrivateBucket();
  const response = await fetch(objectUrl(key), {
    method: 'POST',
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      'Content-Type': 'application/pdf',
      'x-upsert': 'false',
    },
    body: new Uint8Array(bytes),
    cache: 'no-store',
  });
  if (response.ok) return;
  const existing = await fetch(objectUrl(key), {
    headers: { apikey: config.key, Authorization: `Bearer ${config.key}` },
    cache: 'no-store',
  });
  if (existing.ok) {
    const existingHash = createHash('sha256')
      .update(Buffer.from(await existing.arrayBuffer()))
      .digest('hex');
    const sourceHash = createHash('sha256').update(bytes).digest('hex');
    if (existingHash === sourceHash) return;
  }
  throw new Error(`Private textbook upload failed (HTTP ${response.status}).`);
}

export async function deletePrivateTextbook(key: string): Promise<void> {
  const config = storageConfig();
  await assertPrivateBucket();
  const response = await fetch(objectUrl(key), {
    method: 'DELETE',
    headers: { apikey: config.key, Authorization: `Bearer ${config.key}` },
    cache: 'no-store',
  });
  if (!response.ok && response.status !== 404)
    throw new Error(`Private textbook cleanup failed (HTTP ${response.status}).`);
}

export async function withPrivateTextbookFile<T>(
  key: string,
  operation: (filePath: string) => Promise<T>
): Promise<T> {
  if (!process.env.DATABASE_URL) return operation(textbookPrivateFile(key));
  const config = storageConfig();
  await assertPrivateBucket();
  const response = await fetch(objectUrl(key), {
    headers: { apikey: config.key, Authorization: `Bearer ${config.key}` },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Private textbook download failed (HTTP ${response.status}).`);
  await mkdir(textbookStoreRoot(), { recursive: true });
  const directory = await mkdtemp(path.join(textbookStoreRoot(), 'download-'));
  const filePath = path.join(directory, `${randomUUID()}.pdf`);
  try {
    const bytes = Buffer.from(await response.arrayBuffer());
    const expected = safeStorageKey(key).match(/^documents\/([0-9a-f]{64})\.pdf$/)?.[1];
    if (expected && createHash('sha256').update(bytes).digest('hex') !== expected)
      throw new Error('Stored textbook checksum does not match its document id.');
    await writeFile(filePath, bytes, { flag: 'wx' });
    return await operation(filePath);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
