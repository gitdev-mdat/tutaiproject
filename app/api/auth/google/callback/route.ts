import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { findOrCreateGoogleUser } from '@/lib/auth/auth-service';
import { destinationFor, getAuthSession, setSessionCookie } from '@/lib/auth/session';

const OAUTH_COOKIE = 'tutai_google_oauth';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const cookieStore = await cookies();
  const rawState = cookieStore.get(OAUTH_COOKIE)?.value;
  cookieStore.delete(OAUTH_COOKIE);
  try {
    if (requestUrl.searchParams.get('error')) throw new Error('provider_denied');
    const saved = rawState ? (JSON.parse(rawState) as { state?: string; returnTo?: string }) : null;
    if (!saved?.state || saved.state !== requestUrl.searchParams.get('state'))
      throw new Error('invalid_state');
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
    console.error('Google OAuth callback failed', error);
    return NextResponse.redirect(
      new URL('/auth/login?oauthError=callback_failed', requestUrl.origin)
    );
  }
}
