import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { safeReturnPath } from '@/lib/auth/safe-return-path';
import { getAuthSession } from '@/lib/auth/session';

const OAUTH_COOKIE = 'tutai_google_oauth';

export async function GET(request: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId)
    return NextResponse.redirect(new URL('/auth/login?oauthError=not_configured', request.url));
  const url = new URL(request.url);
  const state = randomBytes(24).toString('base64url');
  // intent=link attaches Google to the account that is signed in now. The
  // callback only links if that same account is still signed in.
  const linking = url.searchParams.get('intent') === 'link';
  let linkUserId: string | undefined;
  if (linking) {
    const session = await getAuthSession();
    if (!session)
      return NextResponse.redirect(new URL('/auth/login?oauthError=session_expired', request.url));
    linkUserId = session.user.id;
  }
  const returnTo = safeReturnPath(
    url.searchParams.get('returnTo'),
    linking ? '/student/profile' : '/student/dashboard'
  );
  const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? `${url.origin}/api/auth/google/callback`;
  const cookieStore = await cookies();
  cookieStore.set(OAUTH_COOKIE, JSON.stringify({ state, returnTo, linkUserId }), {
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
