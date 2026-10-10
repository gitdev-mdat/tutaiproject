import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { safeReturnPath } from '@/lib/auth/safe-return-path';

const OAUTH_COOKIE = 'tutai_google_oauth';

export async function GET(request: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId)
    return NextResponse.redirect(new URL('/auth/login?oauthError=not_configured', request.url));
  const url = new URL(request.url);
  const state = randomBytes(24).toString('base64url');
  const returnTo = safeReturnPath(url.searchParams.get('returnTo'), '/student/dashboard');
  const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? `${url.origin}/api/auth/google/callback`;
  const cookieStore = await cookies();
  cookieStore.set(OAUTH_COOKIE, JSON.stringify({ state, returnTo }), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 600,
  });
  const authorization = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authorization.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  }).toString();
  return NextResponse.redirect(authorization);
}
