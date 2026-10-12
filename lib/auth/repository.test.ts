import { describe, expect, it } from 'vitest';
import { resolveAuthStoreDriver } from './repository';

const URL = 'postgres://user@db.example/app';

describe('auth store driver', () => {
  it('uses PostgreSQL whenever DATABASE_URL is set', () => {
    for (const NODE_ENV of ['development', 'test', 'production']) {
      expect(resolveAuthStoreDriver({ NODE_ENV, DATABASE_URL: URL })).toBe('postgres');
    }
    expect(resolveAuthStoreDriver({ NODE_ENV: 'production', VERCEL: '1', DATABASE_URL: URL })).toBe(
      'postgres'
    );
  });

  it('uses the JSON file only for next dev and tests, or when asked explicitly', () => {
    expect(resolveAuthStoreDriver({ NODE_ENV: 'development' })).toBe('json');
    expect(resolveAuthStoreDriver({ NODE_ENV: 'test' })).toBe('json');
    expect(resolveAuthStoreDriver({ NODE_ENV: 'production', AUTH_STORE_DRIVER: 'json' })).toBe(
      'json'
    );
    expect(
      resolveAuthStoreDriver({
        NODE_ENV: 'development',
        AUTH_STORE_DRIVER: 'json',
        DATABASE_URL: URL,
      })
    ).toBe('json');
  });

  it('fails closed instead of falling back to JSON', () => {
    expect(() => resolveAuthStoreDriver({ NODE_ENV: 'production' })).toThrow(/DATABASE_URL/);
    expect(() => resolveAuthStoreDriver({})).toThrow(/DATABASE_URL/);
    expect(() => resolveAuthStoreDriver({ NODE_ENV: 'development', VERCEL: '1' })).toThrow(
      /Vercel/
    );
    expect(() =>
      resolveAuthStoreDriver({ NODE_ENV: 'production', VERCEL: '1', AUTH_STORE_DRIVER: 'json' })
    ).toThrow(/Vercel/);
    expect(() => resolveAuthStoreDriver({ AUTH_STORE_DRIVER: 'postgres' })).toThrow(/DATABASE_URL/);
    expect(() =>
      resolveAuthStoreDriver({ AUTH_STORE_DRIVER: 'sqlite', DATABASE_URL: URL })
    ).toThrow(/Unknown/);
  });
});
