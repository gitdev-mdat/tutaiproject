import type { AdminAccess } from '@/lib/auth/admin';

/**
 * Who may open Tú Tài Plus learning content, and why.
 *
 * - PLUS: the student has an active Tú Tài Plus membership.
 * - ADMIN_PREVIEW: the signed-in account is a server-verified admin, previewing
 *   and testing the content it manages. This is not a membership: nothing is
 *   written to subscriptions, and it only opens content that is already
 *   published to students.
 *
 * Everyone else gets no access.
 */
export type PremiumAccessVia = 'PLUS' | 'ADMIN_PREVIEW';
export type PremiumAccess = { allowed: boolean; via: PremiumAccessVia | null };

/**
 * Pure rule. Admin preview counts only for a real admin account (the email
 * allowlist, or a listed account on Vercel Preview), never for the
 * local-development bypass, and only when the student being served is that
 * admin's own profile.
 */
export function resolvePremiumAccess(input: {
  plus: boolean;
  admin: AdminAccess;
  ownProfile: boolean;
}): PremiumAccess {
  if (input.plus) return { allowed: true, via: 'PLUS' };
  if (input.ownProfile && input.admin.allowed && input.admin.via !== 'local-development') {
    return { allowed: true, via: 'ADMIN_PREVIEW' };
  }
  return { allowed: false, via: null };
}
