import { withStudent } from '@/lib/practice/practice-http';
import { getLessonPracticeOverview, startPracticeAttempt } from '@/lib/practice/practice-service';

type Context = { params: Promise<{ lessonId: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { lessonId } = await params;
  return withStudent((studentId) => getLessonPracticeOverview(studentId, lessonId));
}

/** Starts a session: the whole lesson, or only the questions missed in `fromAttemptId`. */
export async function POST(request: Request, { params }: Context) {
  const { lessonId } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    mode?: string;
    fromAttemptId?: string;
  };
  const mode = body.mode === 'MISTAKES' ? 'MISTAKES' : 'LESSON';
  return withStudent((studentId) =>
    startPracticeAttempt(studentId, lessonId, mode, body.fromAttemptId)
  );
}
