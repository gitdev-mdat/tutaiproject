import { NextResponse } from 'next/server';
import { AuthError, authenticateCredential } from '@/lib/auth/auth-service';
import { destinationFor, getAuthSession, setSessionCookie } from '@/lib/auth/session';
import { safeReturnPath } from '@/lib/auth/safe-return-path';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      identifier?: string;
      password?: string;
      remember?: boolean;
      returnTo?: string;
    };
    const user = await authenticateCredential(body.identifier ?? '', body.password ?? '');
    await setSessionCookie(user.id, Boolean(body.remember));
    const session = await getAuthSession();
    const defaultDestination = session ? destinationFor(session.profile) : '/onboarding/profile';
    const requested = safeReturnPath(body.returnTo, defaultDestination);
    const redirectTo =
      defaultDestination === '/onboarding/profile' ? defaultDestination : requested;
    return NextResponse.json({ success: true, redirectTo });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, code: error.code, message: error.message },
        { status: error.status }
      );
    }
    console.error('Login failed', error);
    return NextResponse.json(
      {
        success: false,
        code: 'SERVER_ERROR',
        message: 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.',
      },
      { status: 500 }
    );
  }
}
