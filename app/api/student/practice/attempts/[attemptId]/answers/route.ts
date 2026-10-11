import { withStudent } from '@/lib/practice/practice-http';
import { answerPracticeQuestion } from '@/lib/practice/practice-service';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const { attemptId } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    questionId?: string;
    response?: unknown;
  };
  return withStudent((studentId) =>
    answerPracticeQuestion(studentId, attemptId, String(body.questionId ?? ''), body.response)
  );
}
