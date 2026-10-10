import { NextResponse } from 'next/server';
import { AuthError, saveOnboarding } from '@/lib/auth/auth-service';
import { getAuthSession } from '@/lib/auth/session';
import { lifecycleDestination, resolveAndEnsureStudentLifecycle } from '@/lib/student/lifecycle';

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session)
    return NextResponse.json({ success: false, message: 'Vui lòng đăng nhập.' }, { status: 401 });
  try {
    const body = await request.json();
    await saveOnboarding(session.user.id, body);
    const refreshed = await getAuthSession();
    const lifecycle = await resolveAndEnsureStudentLifecycle(refreshed);
    return NextResponse.json({
      success: lifecycle.state === 'AUTHENTICATED_ACTIVE_STUDENT',
      lifecycle,
      redirectTo: lifecycleDestination(lifecycle.state),
    });
  } catch (error) {
    if (error instanceof AuthError)
      return NextResponse.json(
        { success: false, code: error.code, message: error.message },
        { status: error.status }
      );
    console.error('Onboarding save failed', error);
    return NextResponse.json(
      { success: false, message: 'Không thể lưu hồ sơ lúc này.' },
      { status: 500 }
    );
  }
}
