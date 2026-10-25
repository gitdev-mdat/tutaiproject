import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminApiGuard, getAdminAccess } from '@/lib/auth/admin';
import { RIGHTS_STATUS_VALUES } from '@/lib/question-bank/qb-types';
import {
  assignLesson,
  clearVerification,
  confirmSolution,
  importExercises,
  loadLessonPractice,
  PracticeRequestError,
  publishExercises,
  rejectSolution,
  saveExerciseDraft,
  verifyByAdmin,
} from '@/lib/textbook-reference/practice-service';
import {
  missingTextbookSettings,
  TextbookBackendUnavailableError,
} from '@/lib/textbook-reference/repository';

export const dynamic = 'force-dynamic';

const choice = z.object({ label: z.enum(['A', 'B', 'C', 'D']), text: z.string().max(2000) });
const mutation = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('confirm-solution'),
    exerciseId: z.string(),
    solutionId: z.string(),
    acknowledgedConflicts: z.array(z.string().max(500)).max(20).optional(),
  }),
  z.object({
    action: z.literal('reject-solution'),
    exerciseId: z.string(),
    solutionId: z.string(),
  }),
  z.object({ action: z.literal('clear-verification'), exerciseId: z.string() }),
  z.object({
    action: z.literal('admin-verify'),
    exerciseId: z.string(),
    answer: z.enum(['A', 'B', 'C', 'D']),
    explanation: z.string().trim().min(1).max(8000),
  }),
  z.object({
    action: z.literal('save-draft'),
    exerciseId: z.string(),
    stem: z.string().max(8000),
    choices: z.array(choice).min(2).max(4),
    explanation: z.string().max(8000),
  }),
  z.object({
    action: z.literal('assign-lesson'),
    exerciseIds: z.array(z.string()).min(1).max(100),
    lessonId: z.string(),
  }),
  z.object({
    action: z.literal('import'),
    lessonId: z.string(),
    exerciseIds: z.array(z.string()).min(1).max(100),
    rightsStatus: z.enum(RIGHTS_STATUS_VALUES),
  }),
  z.object({
    action: z.literal('publish'),
    lessonId: z.string(),
    exerciseIds: z.array(z.string()).min(1).max(100),
    rightsStatus: z.enum(RIGHTS_STATUS_VALUES),
    attested: z.boolean(),
    dryRun: z.boolean().optional(),
  }),
]);

function failure(error: unknown) {
  if (error instanceof PracticeRequestError)
    return NextResponse.json(
      { error: error.message, ...(error.conflicts ? { conflicts: error.conflicts } : {}) },
      { status: error.status }
    );
  if (error instanceof TextbookBackendUnavailableError)
    return NextResponse.json({ error: 'Kho sách chưa được cấu hình.' }, { status: 503 });
  console.error('[textbooks] practice operation failed', (error as Error)?.message);
  return NextResponse.json(
    { error: 'Thao tác chưa thực hiện được. Thử lại sau.' },
    { status: 500 }
  );
}

/** GET ?lessonId=… the lesson's textbook exercises, their solutions and Question Bank state. */
export async function GET(request: Request) {
  const denied = await adminApiGuard();
  if (denied) return denied;
  if (missingTextbookSettings().length)
    return NextResponse.json({ error: 'Kho sách chưa được cấu hình.' }, { status: 503 });
  try {
    const lessonId = new URL(request.url).searchParams.get('lessonId') ?? '';
    const workspace = await loadLessonPractice(lessonId);
    if (!workspace) return NextResponse.json({ error: 'Không tìm thấy bài học.' }, { status: 404 });
    return NextResponse.json(workspace);
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  const denied = await adminApiGuard();
  if (denied) return denied;
  const access = await getAdminAccess();
  const actor = access.allowed ? access.adminId : 'unknown';
  const parsed = mutation.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: 'Yêu cầu không hợp lệ.' }, { status: 400 });
  const input = parsed.data;
  try {
    switch (input.action) {
      case 'confirm-solution':
        return NextResponse.json({
          artifact: await confirmSolution(
            input.exerciseId,
            input.solutionId,
            actor,
            input.acknowledgedConflicts
          ),
        });
      case 'reject-solution':
        return NextResponse.json({
          artifact: await rejectSolution(input.exerciseId, input.solutionId),
        });
      case 'clear-verification':
        return NextResponse.json({ artifact: await clearVerification(input.exerciseId) });
      case 'admin-verify':
        return NextResponse.json({ artifact: await verifyByAdmin(input.exerciseId, input, actor) });
      case 'save-draft':
        return NextResponse.json({
          artifact: await saveExerciseDraft(input.exerciseId, input, actor),
        });
      case 'assign-lesson':
        await assignLesson(input.exerciseIds, input.lessonId, actor);
        return NextResponse.json({ ok: true });
      case 'import':
        return NextResponse.json({
          outcomes: await importExercises(
            input.lessonId,
            input.exerciseIds,
            input.rightsStatus,
            actor
          ),
        });
      case 'publish':
        return NextResponse.json({
          outcomes: await publishExercises(
            input.lessonId,
            input.exerciseIds,
            { rights: input.rightsStatus, attested: input.attested, dryRun: input.dryRun },
            actor
          ),
        });
    }
  } catch (error) {
    return failure(error);
  }
}
