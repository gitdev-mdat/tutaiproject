import { withStudent } from '@/lib/practice/practice-http';
import { getExamAttempt } from '@/lib/exams/student-exam-service';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const { attemptId } = await params;
  return withStudent((studentId) => getExamAttempt(studentId, attemptId));
}
