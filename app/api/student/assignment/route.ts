import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/session';
import { lifecycleDestination, resolveAndEnsureStudentLifecycle } from '@/lib/student/lifecycle';

async function assign() {
  const session = await getAuthSession();
  if (!session)
    return NextResponse.json({ success: false, message: 'Vui lòng đăng nhập.' }, { status: 401 });
  const lifecycle = await resolveAndEnsureStudentLifecycle(session);
  const success = lifecycle.state === 'AUTHENTICATED_ACTIVE_STUDENT';
  return NextResponse.json(
    { success, lifecycle, redirectTo: lifecycleDestination(lifecycle.state) },
    { status: lifecycle.state === 'ASSIGNMENT_BLOCKED' ? 409 : success ? 200 : 422 }
  );
}

export const POST = assign;
export async function GET() {
  const response = await assign();
  const body = await response.json();
  return NextResponse.redirect(
    new URL(body.redirectTo ?? '/onboarding/profile', 'http://localhost'),
    303
  );
}
