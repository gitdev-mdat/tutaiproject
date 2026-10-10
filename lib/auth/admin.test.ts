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

  it('keeps local development open when no allowlist is configured', () => {
    expect(evaluateAdminAccess(null, { NODE_ENV: 'development' })).toEqual({
      allowed: true,
      adminId: 'local-development',
      via: 'local-development',
    });
  });

  it('denies everyone in production when no allowlist is configured', () => {
    expect(evaluateAdminAccess(null, { NODE_ENV: 'production' })).toEqual({
      allowed: false,
      reason: 'unauthenticated',
    });
    expect(evaluateAdminAccess(verifiedAdmin, { NODE_ENV: 'production' })).toEqual({
      allowed: false,
      reason: 'forbidden',
    });
  });

  it('allows a verified email on the allowlist', () => {
    expect(
      evaluateAdminAccess(verifiedAdmin, {
        NODE_ENV: 'production',
        ADMIN_EMAILS: 'admin@example.com',
      })
    ).toEqual({ allowed: true, adminId: 'user-admin', via: 'allowlist' });
  });

  it('rejects unverified emails, other emails and anonymous callers once configured', () => {
    const env = { NODE_ENV: 'development', ADMIN_EMAILS: 'admin@example.com' };
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
});
