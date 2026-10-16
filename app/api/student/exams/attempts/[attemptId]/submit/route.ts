import { withStudent } from '@/lib/practice/practice-http';
import { submitExamAttempt } from '@/lib/exams/student-exam-service';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const { attemptId } = await params;
  return withStudent((studentId) => submitExamAttempt(studentId, attemptId));
}
