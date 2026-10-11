import { withStudent } from '@/lib/practice/practice-http';
import { getPracticeAttempt } from '@/lib/practice/practice-service';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const { attemptId } = await params;
  return withStudent((studentId) => getPracticeAttempt(studentId, attemptId));
}
