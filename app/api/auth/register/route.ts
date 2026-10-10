import { NextResponse } from 'next/server';
import { AuthError, registerCredential } from '@/lib/auth/auth-service';
import { destinationFor, setSessionCookie } from '@/lib/auth/session';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      username?: string;
      email?: string;
      password?: string;
      fullName?: string;
      phone?: string;
    };
    const user = await registerCredential({
      username: body.username ?? '',
      email: body.email ?? '',
      password: body.password ?? '',
      fullName: body.fullName ?? '',
      phone: body.phone ?? '',
    });
    await setSessionCookie(user.id, true);
    return NextResponse.json(
      { success: true, redirectTo: destinationFor({ onboardingCompletedAt: null }) },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, code: error.code, message: error.message },
        { status: error.status }
      );
    }
    console.error('Registration failed', error);
    return NextResponse.json(
      {
        success: false,
        code: 'SERVER_ERROR',
        message: 'Không thể tạo tài khoản lúc này. Vui lòng thử lại.',
      },
      { status: 500 }
    );
  }
}
