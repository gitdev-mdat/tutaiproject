import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { safeReturnPath } from '@/lib/auth/safe-return-path';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    let { username } = body;
    const { password } = body;
    const returnTo = safeReturnPath(body.returnTo);

    username = username?.trim().toLowerCase();

    const expectedUsername = process.env.DEMO_STUDENT_USERNAME;
    const expectedPassword = process.env.DEMO_STUDENT_PASSWORD;

    if (!expectedUsername || !expectedPassword) {
      return NextResponse.json(
        { success: false, message: 'Server configuration error.' },
        { status: 500 }
      );
    }

    if (username === expectedUsername && password === expectedPassword) {
      // Set HTTP-only session cookie
      const cookieStore = await cookies();
      cookieStore.set('tutai_demo_session', 'demo-student-session', {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 1 week
      });

      return NextResponse.json({
        success: true,
        redirectTo: returnTo,
      });
    }

    // Use a generic message to avoid revealing whether a username exists
    return NextResponse.json(
      { success: false, message: 'Tên đăng nhập hoặc mật khẩu không đúng.' },
      { status: 401 }
    );
  } catch {
    return NextResponse.json(
      { success: false, message: 'Đã xảy ra lỗi. Vui lòng thử lại.' },
      { status: 500 }
    );
  }
}
