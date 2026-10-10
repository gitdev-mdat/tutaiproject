import 'server-only';

import { NextResponse } from 'next/server';
import { notFound, redirect } from 'next/navigation';
import { getAuthSession } from './session';

/**
 * Server-side admin authorization.
 *
 * Admins are the signed-in users whose verified email is listed in the
 * comma-separated ADMIN_EMAILS environment variable. A verified email today
 * means the account signed in with Google; password accounts never have one,
 * so registering someone else's address does not grant access.
 *
 * When ADMIN_EMAILS is not set, local development stays open (as it was
 * before this guard existed) and production denies every request.
 */

type AdminEnv = { NODE_ENV?: string; ADMIN_EMAILS?: string };

type SessionUser = { id: string; email: string | null; emailVerifiedAt: string | null };

export type AdminAccess =
  | { allowed: true; adminId: string; via: 'allowlist' | 'local-development' }
  | { allowed: false; reason: 'unauthenticated' | 'forbidden' };

export function parseAdminEmails(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function evaluateAdminAccess(
  user: SessionUser | null,
  env: AdminEnv = process.env
): AdminAccess {
  const allowlist = parseAdminEmails(env.ADMIN_EMAILS);

  if (allowlist.size === 0) {
    if (env.NODE_ENV !== 'production') {
      return { allowed: true, adminId: user?.id ?? 'local-development', via: 'local-development' };
    }
    return { allowed: false, reason: user ? 'forbidden' : 'unauthenticated' };
  }

  if (!user) return { allowed: false, reason: 'unauthenticated' };

  const email = user.email?.trim().toLowerCase();
  if (email && user.emailVerifiedAt && allowlist.has(email)) {
    return { allowed: true, adminId: user.id, via: 'allowlist' };
  }
  return { allowed: false, reason: 'forbidden' };
}

export async function getAdminAccess(): Promise<AdminAccess> {
  const session = await getAuthSession();
  return evaluateAdminAccess(session?.user ?? null);
}

/**
 * For Route Handlers: returns a 401/403 response to send back, or null when
 * the caller is an admin.
 */
export async function adminApiGuard(): Promise<NextResponse | null> {
  const access = await getAdminAccess();
  if (access.allowed) return null;
  return access.reason === 'unauthenticated'
    ? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    : NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

/** For Server Actions: throws unless the caller is an admin. Returns the admin id. */
export async function requireAdmin(): Promise<string> {
  const access = await getAdminAccess();
  if (!access.allowed) throw new Error('Unauthorized');
  return access.adminId;
}

/**
 * For admin pages and layouts: sends signed-out visitors to the login page and
 * hides the admin area from signed-in non-admins.
 */
export async function requireAdminPage(returnTo = '/admin'): Promise<string> {
  const access = await getAdminAccess();
  if (access.allowed) return access.adminId;
  if (access.reason === 'unauthenticated') {
    redirect(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  }
  notFound();
}
