import { NextResponse } from 'next/server';
import { commitCandidateToQuestion } from '@/lib/content-import/commit';
import type { QuestionCandidate } from '@/lib/content-import/types';
import { adminApiGuard } from '@/lib/auth/admin';

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string; candidateId: string }> }
) {
  const denied = await adminApiGuard();
  if (denied) return denied;
  try {
    const { sessionId, candidateId } = await context.params;
    const body = (await request.json()) as { candidate?: Partial<QuestionCandidate> };
    return NextResponse.json(
      await commitCandidateToQuestion(sessionId, candidateId, body.candidate)
    );
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Không thể duyệt câu hỏi.' },
      { status: 422 }
    );
  }
}
