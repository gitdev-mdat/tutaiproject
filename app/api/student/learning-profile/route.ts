import { NextResponse } from 'next/server';
import { AuthError, saveLearningGoals } from '@/lib/auth/auth-service';
import { getAuthSession } from '@/lib/auth/session';

/** The student's learning goals (grade, subject, current and target score), as the Roadmap uses them. */
export async function PATCH(request: Request) {
  const session = await getAuthSession();
  if (!session)
    return NextResponse.json({ success: false, message: 'Vui lòng đăng nhập.' }, { status: 401 });
  try {
    const body = (await request.json()) as Record<string, unknown>;
    await saveLearningGoals(session.user.id, {
      grade: body.grade,
      primarySubject: body.primarySubject,
      currentScore: body.currentScore,
      targetScore: body.targetScore,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError)
      return NextResponse.json(
        { success: false, code: error.code, message: error.message },
        { status: error.status }
      );
    console.error('Learning goals save failed', error);
    return NextResponse.json(
      { success: false, message: 'Không thể lưu mục tiêu lúc này.' },
      { status: 500 }
    );
  }
}
