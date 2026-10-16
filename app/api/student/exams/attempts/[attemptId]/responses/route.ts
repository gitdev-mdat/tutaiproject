import { withStudent } from '@/lib/practice/practice-http';
import { saveExamResponse } from '@/lib/exams/student-exam-service';

/** Saves one response (`null` clears it). Nothing is graded before the exam is submitted. */
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
    saveExamResponse(studentId, attemptId, String(body.questionId ?? ''), body.response ?? null)
  );
}
