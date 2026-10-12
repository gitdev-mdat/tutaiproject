import 'server-only';

import { NextResponse } from 'next/server';
import { getDemoStudentSession } from '@/lib/auth/demo-session';
import { PracticeResponseError } from './grading';
import { PracticeError } from './practice-service';

/** Runs a student practice handler with the signed-in student's profile id. */
export async function withStudent(
  handler: (studentId: string) => Promise<unknown>
): Promise<NextResponse> {
  try {
    const student = await getDemoStudentSession();
    if (!student) return NextResponse.json({ error: 'Bạn cần đăng nhập.' }, { status: 401 });
    return NextResponse.json(await handler(student.id));
  } catch (error) {
    if (error instanceof PracticeError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof PracticeResponseError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('[practice]', error);
    return NextResponse.json({ error: 'Không thể xử lý bài luyện tập lúc này.' }, { status: 500 });
  }
}
