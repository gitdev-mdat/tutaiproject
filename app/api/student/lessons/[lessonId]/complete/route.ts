import { NextResponse } from 'next/server';
import { getDemoStudentSession } from '@/lib/auth/demo-session';
import { getVisibleLessonArticle } from '@/lib/knowledge-tree/knowledge-tree-service';
import { learningStreakEnabled, type CompletionResponse } from '@/lib/learning/learning-streak';
import { recordLessonCompletion } from '@/lib/learning/learning-streak-service';

type Context = { params: Promise<{ lessonId: string }> };

export const dynamic = 'force-dynamic';

function reply(body: CompletionResponse | { error: string }, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

/**
 * The signed-in student finished a published lesson: counts it towards their
 * daily learning streak and returns the streak as stored. Repeating the call
 * changes nothing (see recordLessonCompletion). Off unless
 * TUTAI_LEARNING_STREAK=on, so a Preview that shares the Production database
 * never writes to it.
 */
export async function POST(request: Request, { params }: Context) {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (origin && host && new URL(origin).host !== host) return reply({ error: 'Forbidden' }, 403);
  if (!learningStreakEnabled()) return reply({ status: 'disabled' });

  const student = await getDemoStudentSession();
  if (!student) return reply({ error: 'Bạn cần đăng nhập.' }, 401);
  const lessonId = decodeURIComponent((await params).lessonId);
  try {
    if (!(await getVisibleLessonArticle(lessonId))) {
      return reply({ error: 'Không tìm thấy bài học.' }, 404);
    }
    return reply(await recordLessonCompletion(student.id, lessonId));
  } catch (error) {
    console.error('[learning-streak]', (error as Error)?.message);
    return reply({ status: 'error', error: 'Chưa lưu được chuỗi ngày học.' }, 500);
  }
}
