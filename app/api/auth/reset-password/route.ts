import { NextResponse } from 'next/server';
import { AuthError, resetPassword } from '@/lib/auth/auth-service';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { token?: string; password?: string };
    await resetPassword(body.token ?? '', body.password ?? '');
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError)
      return NextResponse.json(
        { success: false, code: error.code, message: error.message },
        { status: error.status }
      );
    return NextResponse.json(
      { success: false, message: 'Không thể đặt lại mật khẩu.' },
      { status: 500 }
    );
  }
}
