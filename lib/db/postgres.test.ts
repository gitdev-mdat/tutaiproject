// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { databaseOptions, isRetryableDatabaseError, withDatabaseRetry } from './postgres';

const POOLER = 'postgres://app.ref:secret@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres';

describe('databaseOptions', () => {
  it('requires TLS for remote hosts and verifies it when a CA is given', () => {
    expect(databaseOptions({ DATABASE_URL: POOLER })).toMatchObject({
      ssl: 'require',
      prepare: false,
      max_pipeline: 0,
      max: 3,
      max_lifetime: 300,
    });
    expect(
      databaseOptions({ DATABASE_URL: POOLER, DATABASE_CA_CERT: 'line1\\nline2' }).ssl
    ).toEqual({
      ca: 'line1\nline2',
      rejectUnauthorized: true,
      servername: 'aws-0-ap-northeast-2.pooler.supabase.com',
    });
  });

  it('leaves local databases and an explicit sslmode alone', () => {
    expect(databaseOptions({ DATABASE_URL: 'postgres://u@localhost:5432/db' })).not.toHaveProperty(
      'ssl'
    );
    expect(databaseOptions({ DATABASE_URL: `${POOLER}?sslmode=verify-full` })).not.toHaveProperty(
      'ssl'
    );
  });

  it('bounds the pool size per instance', () => {
    expect(databaseOptions({ DATABASE_URL: POOLER, DATABASE_POOL_MAX: '50' }).max).toBe(10);
    expect(databaseOptions({ DATABASE_URL: POOLER, DATABASE_POOL_MAX: '0' }).max).toBe(1);
    expect(databaseOptions({ DATABASE_URL: POOLER, DATABASE_POOL_MAX: 'x' }).max).toBe(3);
  });
});

describe('withDatabaseRetry', () => {
  const failure = (code: string) => Object.assign(new Error(code), { code });

  it('retries a write only when the statement never reached the server', async () => {
    expect(isRetryableDatabaseError(failure('CONNECT_TIMEOUT'), false)).toBe(true);
    expect(isRetryableDatabaseError(failure('ECONNRESET'), false)).toBe(false);
    expect(isRetryableDatabaseError(failure('23505'), true)).toBe(false);

    const write = vi.fn().mockRejectedValue(failure('ECONNRESET'));
    await expect(withDatabaseRetry(write, { idempotent: false })).rejects.toMatchObject({
      code: 'ECONNRESET',
    });
    expect(write).toHaveBeenCalledTimes(1);

    const connect = vi.fn().mockRejectedValueOnce(failure('ECONNREFUSED')).mockResolvedValue('ok');
    await expect(withDatabaseRetry(connect, { idempotent: false })).resolves.toBe('ok');
    expect(connect).toHaveBeenCalledTimes(2);
  });

  it('retries a read once after a dropped connection', async () => {
    const read = vi.fn().mockRejectedValueOnce(failure('CONNECTION_CLOSED')).mockResolvedValue(1);
    await expect(withDatabaseRetry(read, { idempotent: true })).resolves.toBe(1);
    const broken = vi.fn().mockRejectedValue(failure('ECONNRESET'));
    await expect(withDatabaseRetry(broken, { idempotent: true })).rejects.toThrow();
    expect(broken).toHaveBeenCalledTimes(2);
  });
});
