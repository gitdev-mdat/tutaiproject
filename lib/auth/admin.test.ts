import { describe, expect, it } from 'vitest';
import { evaluateAdminAccess, parseAdminEmails } from './admin';

const verifiedAdmin = {
  id: 'user-admin',
  email: 'Admin@Example.com',
  emailVerifiedAt: '2026-10-01T00:00:00.000Z',
};

describe('admin access', () => {
  it('parses a comma-separated allowlist case-insensitively', () => {
    expect([...parseAdminEmails(' a@x.vn, B@X.vn ,,')]).toEqual(['a@x.vn', 'b@x.vn']);
    expect(parseAdminEmails(undefined).size).toBe(0);
  });

  it('denies everyone when nothing is configured, in every environment', () => {
    for (const NODE_ENV of ['development', 'test', 'production', undefined]) {
      expect(evaluateAdminAccess(null, { NODE_ENV })).toEqual({
        allowed: false,
        reason: 'unauthenticated',
      });
      expect(evaluateAdminAccess(verifiedAdmin, { NODE_ENV })).toEqual({
        allowed: false,
        reason: 'forbidden',
      });
    }
  });

  it('opens the admin area only with the explicit opt-in under next dev', () => {
    expect(evaluateAdminAccess(null, { NODE_ENV: 'development', ADMIN_DEV_BYPASS: '1' })).toEqual({
      allowed: true,
      adminId: 'local-development',
      via: 'local-development',
    });
    for (const NODE_ENV of ['production', 'test', undefined]) {
      expect(evaluateAdminAccess(null, { NODE_ENV, ADMIN_DEV_BYPASS: '1' })).toEqual({
        allowed: false,
        reason: 'unauthenticated',
      });
    }
    expect(
      evaluateAdminAccess(null, { NODE_ENV: 'development', ADMIN_DEV_BYPASS: 'true' })
    ).toEqual({ allowed: false, reason: 'unauthenticated' });
  });

  it('allows a verified email on the allowlist', () => {
    expect(
      evaluateAdminAccess(verifiedAdmin, {
        NODE_ENV: 'production',
        ADMIN_EMAILS: 'admin@example.com',
      })
    ).toEqual({ allowed: true, adminId: 'user-admin', via: 'allowlist' });
  });

  it('rejects unverified emails, other emails and anonymous callers', () => {
    const env = { NODE_ENV: 'production', ADMIN_EMAILS: 'admin@example.com' };
    expect(evaluateAdminAccess({ ...verifiedAdmin, emailVerifiedAt: null }, env)).toEqual({
      allowed: false,
      reason: 'forbidden',
    });
    expect(evaluateAdminAccess({ ...verifiedAdmin, email: 'student@example.com' }, env)).toEqual({
      allowed: false,
      reason: 'forbidden',
    });
    expect(evaluateAdminAccess(null, env)).toEqual({ allowed: false, reason: 'unauthenticated' });
  });

  it('honours preview admin account ids only on Vercel Preview, for that signed-in account', () => {
    const passwordAccount = { id: 'user-preview', email: null, emailVerifiedAt: null };
    const preview = {
      NODE_ENV: 'production',
      VERCEL_ENV: 'preview',
      PREVIEW_ADMIN_USER_IDS: ' x, user-preview ',
    };
    expect(evaluateAdminAccess(passwordAccount, preview)).toEqual({
      allowed: true,
      adminId: 'user-preview',
      via: 'preview-account',
    });
    expect(evaluateAdminAccess({ ...passwordAccount, id: 'user-other' }, preview)).toEqual({
      allowed: false,
      reason: 'forbidden',
    });
    expect(evaluateAdminAccess(null, preview)).toEqual({
      allowed: false,
      reason: 'unauthenticated',
    });
    for (const VERCEL_ENV of ['production', 'development', undefined]) {
      expect(evaluateAdminAccess(passwordAccount, { ...preview, VERCEL_ENV })).toEqual({
        allowed: false,
        reason: 'forbidden',
      });
    }
    expect(
      evaluateAdminAccess(passwordAccount, { ...preview, PREVIEW_ADMIN_USER_IDS: ' , ' })
    ).toEqual({ allowed: false, reason: 'forbidden' });
  });
});
