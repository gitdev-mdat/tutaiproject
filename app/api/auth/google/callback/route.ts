import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { AuthError, findOrCreateGoogleUser, linkGoogleToUser } from '@/lib/auth/auth-service';
import { ACCOUNT_LINK_REQUIRES_VERIFICATION, GOOGLE_LINK_ERRORS } from '@/lib/auth/errors';
import { destinationFor, getAuthSession, setSessionCookie } from '@/lib/auth/session';

const OAUTH_COOKIE = 'tutai_google_oauth';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const cookieStore = await cookies();
  const rawState = cookieStore.get(OAUTH_COOKIE)?.value;
  cookieStore.delete(OAUTH_COOKIE);
  let saved: { state?: string; returnTo?: string; linkUserId?: string } | null = null;
  try {
    saved = rawState ? JSON.parse(rawState) : null;
  } catch {
    saved = null;
  }
  const linkUserId = saved?.linkUserId;
  const linkReturn = saved?.returnTo ?? '/student/profile';
  try {
    if (requestUrl.searchParams.get('error')) throw new Error('provider_denied');
    if (!saved?.state || saved.state !== requestUrl.searchParams.get('state')) {
      // The cookie is gone when the sign-in started on another address, took
      // longer than ten minutes, or this callback was opened a second time.
      throw new OAuthStateError(saved?.state ? 'state mismatch' : 'no state cookie');
    }
    const code = requestUrl.searchParams.get('code');
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!code || !clientId || !clientSecret) throw new Error('missing_configuration');
    const redirectUri =
      process.env.GOOGLE_REDIRECT_URI ?? `${requestUrl.origin}/api/auth/google/callback`;
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenResponse.ok) throw new Error('token_exchange_failed');
    const tokens = (await tokenResponse.json()) as { access_token?: string };
    if (!tokens.access_token) throw new Error('missing_access_token');
    const userResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
      cache: 'no-store',
    });
    if (!userResponse.ok) throw new Error('userinfo_failed');
    const google = (await userResponse.json()) as {
      sub: string;
      email: string;
      email_verified: boolean;
      name?: string;
      picture?: string;
    };
    if (linkUserId) {
      // Link only into the account that started the flow, and only while it is
      // still the one signed in here.
      const current = await getAuthSession();
      if (current?.user.id !== linkUserId) throw new SessionChangedError();
      await linkGoogleToUser(linkUserId, {
        subject: google.sub,
        email: google.email,
        emailVerified: google.email_verified,
        displayName: google.name,
        avatarUrl: google.picture,
      });
      return NextResponse.redirect(withParam(linkReturn, 'google', 'linked', requestUrl.origin));
    }
    const { user } = await findOrCreateGoogleUser({
      subject: google.sub,
      email: google.email,
      emailVerified: google.email_verified,
      displayName: google.name,
      avatarUrl: google.picture,
    });
    await setSessionCookie(user.id, true);
    const session = await getAuthSession();
    const requiredDestination = session ? destinationFor(session.profile) : '/onboarding/profile';
    const destination =
      requiredDestination === '/onboarding/profile'
        ? requiredDestination
        : (saved.returnTo ?? requiredDestination);
    return NextResponse.redirect(new URL(destination, requestUrl.origin));
  } catch (error) {
    if (linkUserId && error instanceof AuthError && error.code in GOOGLE_LINK_ERRORS) {
      return NextResponse.redirect(
        withParam(linkReturn, 'googleError', error.code, requestUrl.origin)
      );
    }
    const code = oauthErrorCode(error);
    if (code === 'state_expired') console.warn('Google OAuth callback:', (error as Error).message);
    else if (code === 'callback_failed') console.error('Google OAuth callback failed', error);
    // The login page sends signed-in visitors straight on and would hide the
    // message, so a signed-in person hears about it on their profile instead.
    if (code !== 'session_expired' && (linkUserId || (await getAuthSession().catch(() => null))))
      return NextResponse.redirect(withParam(linkReturn, 'googleError', code, requestUrl.origin));
    return NextResponse.redirect(new URL(`/auth/login?oauthError=${code}`, requestUrl.origin));
  }
}

class OAuthStateError extends Error {}
class SessionChangedError extends Error {}

function oauthErrorCode(error: unknown): string {
  if (error instanceof OAuthStateError) return 'state_expired';
  if (error instanceof SessionChangedError) return 'session_expired';
  if (error instanceof AuthError) {
    if (error.code === ACCOUNT_LINK_REQUIRES_VERIFICATION) return 'account_exists';
    if (error.code === 'UNVERIFIED_GOOGLE_EMAIL') return 'unverified_google';
  }
  if (error instanceof Error && error.message === 'provider_denied') return 'cancelled';
  return 'callback_failed';
}

function withParam(path: string, key: string, value: string, origin: string): URL {
  const url = new URL(path, origin);
  url.searchParams.set(key, value);
  return url;
}
