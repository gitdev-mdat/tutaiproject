import { withStudent } from '@/lib/practice/practice-http';
import { gradeLessonCheck } from '@/lib/practice/practice-service';

type Context = { params: Promise<{ lessonId: string }> };

/** Grades a quick question inside the lesson. The answer is not stored. */
export async function POST(request: Request, { params }: Context) {
  const { lessonId } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    questionId?: string;
    response?: unknown;
  };
  return withStudent(() =>
    gradeLessonCheck(lessonId, String(body.questionId ?? ''), body.response)
  );
}
