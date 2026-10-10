import 'server-only';

import { cookies } from 'next/headers';
import { createSession, resolveSession, revokeSession } from './auth-service';

export const SESSION_COOKIE_NAME = 'tutai_session';

export async function setSessionCookie(
  userId: string,
  remember = true,
  replaceExisting = false
): Promise<void> {
  const { token, expiresAt } = await createSession(userId, remember, replaceExisting);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    ...(remember ? { expires: expiresAt } : {}),
  });
}

export async function getAuthSession() {
  const cookieStore = await cookies();
  return resolveSession(cookieStore.get(SESSION_COOKIE_NAME)?.value);
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  await revokeSession(token);
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export function destinationFor(profile: { onboardingCompletedAt: string | null }): string {
  return profile.onboardingCompletedAt ? '/student/dashboard' : '/onboarding/profile';
}
