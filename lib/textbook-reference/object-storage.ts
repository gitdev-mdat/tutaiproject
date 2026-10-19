import 'server-only';

import { createHash, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

/**
 * Server-only adapter for the private Supabase Storage bucket that holds source
 * PDFs. The service key never leaves this module; browsers only ever receive a
 * short-lived signed upload token for one object key. No public or signed
 * download URL is ever created.
 */

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

function authHeaders() {
  const { key } = storageConfig();
  return { apikey: key, Authorization: `Bearer ${key}` };
}

function encodedKey(key: string) {
  return safeStorageKey(key).split('/').map(encodeURIComponent).join('/');
}

function objectUrl(key: string, prefix = 'object') {
  const config = storageConfig();
  return `${config.base}/storage/v1/${prefix}/${encodeURIComponent(config.bucket)}/${encodedKey(key)}`;
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

export function documentStorageKey(sha256: string): string {
  if (!/^[0-9a-f]{64}$/.test(sha256)) throw new Error('Invalid SHA-256.');
  return `documents/${sha256}.pdf`;
}

/** Fails closed unless the bucket exists and reports itself private. */
export async function assertPrivateBucket(): Promise<void> {
  const config = storageConfig();
  const response = await fetch(
    `${config.base}/storage/v1/bucket/${encodeURIComponent(config.bucket)}`,
    { headers: authHeaders(), cache: 'no-store' }
  );
  if (!response.ok)
    throw new Error(`Textbook storage bucket is unavailable (HTTP ${response.status}).`);
  const bucket = (await response.json()) as { public?: unknown };
  if (bucket.public !== false) throw new Error('Textbook storage bucket must be private.');
}

/** Creates the private bucket when it does not exist. Never makes an existing bucket public. */
export async function ensurePrivateBucket(fileSizeLimitBytes: number): Promise<'created' | 'exists'> {
  const config = storageConfig();
  const response = await fetch(`${config.base}/storage/v1/bucket`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: config.bucket,
      name: config.bucket,
      public: false,
      file_size_limit: fileSizeLimitBytes,
      allowed_mime_types: ['application/pdf'],
    }),
    cache: 'no-store',
  });
  if (response.ok) return 'created';
  const body = (await response.json().catch(() => ({}))) as { error?: string; statusCode?: string };
  if (body.statusCode === '409' || body.error === 'Duplicate') {
    await assertPrivateBucket();
    return 'exists';
  }
  throw new Error(`Could not create the textbook bucket (HTTP ${response.status}).`);
}

export async function privateObjectInfo(key: string): Promise<{ size: number } | null> {
  await assertPrivateBucket();
  const response = await fetch(objectUrl(key, 'object/info'), {
    headers: authHeaders(),
    cache: 'no-store',
  });
  if (response.status === 404 || response.status === 400) return null;
  if (!response.ok) throw new Error(`Textbook storage lookup failed (HTTP ${response.status}).`);
  const info = (await response.json()) as { size?: unknown };
  return typeof info.size === 'number' ? { size: info.size } : null;
}

/**
 * A token that lets the holder upload exactly this one object (no overwrite)
 * through Storage's resumable (TUS) endpoint until it expires.
 */
export async function createSignedUploadToken(key: string): Promise<{
  token: string;
  endpoint: string;
  bucket: string;
  objectName: string;
}> {
  await assertPrivateBucket();
  const config = storageConfig();
  const response = await fetch(objectUrl(key, 'object/upload/sign'), {
    method: 'POST',
    headers: { ...authHeaders(), 'x-upsert': 'false' },
    cache: 'no-store',
  });
  if (!response.ok)
    throw new Error(`Could not prepare the private upload (HTTP ${response.status}).`);
  const { token } = (await response.json()) as { token?: string };
  if (!token) throw new Error('Storage did not return an upload token.');
  return {
    token,
    endpoint: `${config.base}/storage/v1/upload/resumable/sign`,
    bucket: config.bucket,
    objectName: safeStorageKey(key),
  };
}

export async function uploadPrivateTextbook(key: string, bytes: Buffer): Promise<void> {
  await assertPrivateBucket();
  const response = await fetch(objectUrl(key), {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/pdf', 'x-upsert': 'false' },
    body: new Uint8Array(bytes),
    cache: 'no-store',
  });
  if (response.ok) return;
  const existing = await fetch(objectUrl(key, 'object/authenticated'), {
    headers: authHeaders(),
    cache: 'no-store',
  });
  if (existing.ok) {
    const existingHash = createHash('sha256')
      .update(Buffer.from(await existing.arrayBuffer()))
      .digest('hex');
    if (existingHash === createHash('sha256').update(bytes).digest('hex')) return;
  }
  throw new Error(`Private textbook upload failed (HTTP ${response.status}).`);
}

export async function deletePrivateTextbook(key: string): Promise<void> {
  await assertPrivateBucket();
  const response = await fetch(objectUrl(key), {
    method: 'DELETE',
    headers: authHeaders(),
    cache: 'no-store',
  });
  if (!response.ok && response.status !== 404 && response.status !== 400)
    throw new Error(`Private textbook cleanup failed (HTTP ${response.status}).`);
}

/** Downloads the private PDF into memory and checks it against the SHA-256 in its key. */
export async function downloadPrivateTextbook(key: string): Promise<Buffer> {
  await assertPrivateBucket();
  const response = await fetch(objectUrl(key, 'object/authenticated'), {
    headers: authHeaders(),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Private textbook download failed (HTTP ${response.status}).`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const expected = safeStorageKey(key).match(/^documents\/([0-9a-f]{64})\.pdf$/)?.[1];
  if (expected && createHash('sha256').update(bytes).digest('hex') !== expected)
    throw new TextbookChecksumError();
  return bytes;
}

export class TextbookChecksumError extends Error {
  constructor() {
    super('Stored textbook checksum does not match its document id.');
    this.name = 'TextbookChecksumError';
  }
}

/**
 * Downloads the private PDF to a short-lived scratch file, checks it against the
 * SHA-256 in its key, runs `operation`, and always removes the copy.
 */
export async function withPrivateTextbookFile<T>(
  key: string,
  operation: (filePath: string, bytes: Buffer) => Promise<T>
): Promise<T> {
  await assertPrivateBucket();
  const response = await fetch(objectUrl(key, 'object/authenticated'), {
    headers: authHeaders(),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Private textbook download failed (HTTP ${response.status}).`);
  const root = path.join(os.tmpdir(), 'tutai-textbooks');
  await mkdir(root, { recursive: true });
  const directory = await mkdtemp(path.join(root, 'download-'));
  const filePath = path.join(directory, `${randomUUID()}.pdf`);
  try {
    const bytes = Buffer.from(await response.arrayBuffer());
    const expected = safeStorageKey(key).match(/^documents\/([0-9a-f]{64})\.pdf$/)?.[1];
    if (expected && createHash('sha256').update(bytes).digest('hex') !== expected)
      throw new Error('Stored textbook checksum does not match its document id.');
    await writeFile(filePath, bytes, { flag: 'wx' });
    return await operation(filePath, bytes);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
