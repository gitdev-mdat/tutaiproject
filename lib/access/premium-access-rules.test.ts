import { describe, expect, it } from 'vitest';
import type { AdminAccess } from '@/lib/auth/admin';
import { resolvePremiumAccess } from './premium-access-rules';

const denied: AdminAccess = { allowed: false, reason: 'forbidden' };
const anonymous: AdminAccess = { allowed: false, reason: 'unauthenticated' };
const allowlisted: AdminAccess = { allowed: true, adminId: 'u1', via: 'allowlist' };
const previewAccount: AdminAccess = { allowed: true, adminId: 'u1', via: 'preview-account' };
const localDev: AdminAccess = { allowed: true, adminId: 'u1', via: 'local-development' };

describe('resolvePremiumAccess', () => {
  it('lets Plus members in as members, whatever their admin status', () => {
    expect(resolvePremiumAccess({ plus: true, admin: denied, ownProfile: true })).toEqual({
      allowed: true,
      via: 'PLUS',
    });
    expect(resolvePremiumAccess({ plus: true, admin: allowlisted, ownProfile: true }).via).toBe(
      'PLUS'
    );
  });

  it('opens a preview for a verified admin on their own profile', () => {
    for (const admin of [allowlisted, previewAccount]) {
      expect(resolvePremiumAccess({ plus: false, admin, ownProfile: true })).toEqual({
        allowed: true,
        via: 'ADMIN_PREVIEW',
      });
    }
  });

  it('keeps ordinary students locked', () => {
    for (const admin of [denied, anonymous]) {
      expect(resolvePremiumAccess({ plus: false, admin, ownProfile: true })).toEqual({
        allowed: false,
        via: null,
      });
    }
  });

  it('never extends an admin preview to another student profile', () => {
    expect(resolvePremiumAccess({ plus: false, admin: allowlisted, ownProfile: false })).toEqual({
      allowed: false,
      via: null,
    });
  });

  it('does not treat the local development bypass as a real admin', () => {
    expect(resolvePremiumAccess({ plus: false, admin: localDev, ownProfile: true }).allowed).toBe(
      false
    );
  });
});
