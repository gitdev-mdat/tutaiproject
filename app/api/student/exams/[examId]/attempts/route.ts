import { withStudent } from '@/lib/practice/practice-http';
import { startExamAttempt } from '@/lib/exams/student-exam-service';

/** Starts the exam, or resumes the attempt already running. */
export async function POST(_request: Request, { params }: { params: Promise<{ examId: string }> }) {
  const { examId } = await params;
  return withStudent((studentId) => startExamAttempt(studentId, decodeURIComponent(examId)));
}
