import { NextResponse } from 'next/server';
import { listImportJobs } from '@/lib/question-bank/qb-storage';
import { listImportSessions } from '@/lib/content-import/storage';
import type { ImportJob } from '@/lib/question-bank/qb-types';

export async function GET() {
  try {
    const [jobs, sessions] = await Promise.all([listImportJobs(), listImportSessions()]);
    const jobIds = new Set(jobs.map((job) => job.id));
    const sessionJobs: ImportJob[] = sessions
      .filter((session) => session.domain === 'QUESTION_BANK' && !jobIds.has(session.id))
      .map((session) => ({
        id: session.id,
        idempotencyKey: session.id,
        fileName:
          session.structuredData?.fileName ||
          session.sourceDocument?.originalFileName ||
          session.pages.map((page) => page.originalFileName).join(', ') ||
          'Document import',
        format:
          session.sourceFormat === 'IMAGES' || session.sourceFormat === 'IMAGE'
            ? 'IMAGE'
            : session.sourceFormat,
        createdAt: session.createdAt,
        completedAt: session.status === 'COMPLETED' ? session.updatedAt : undefined,
        status:
          session.status === 'DRAFT'
            ? 'PENDING'
            : session.status === 'READY'
              ? 'READY'
              : session.status === 'PROCESSING'
                ? 'IMPORTING'
                : session.status === 'REVIEW_REQUIRED'
                  ? 'PARTIAL'
                  : session.status,
        totalRows: session.candidates.length,
        successRows: session.summary.approvedQuestions,
        warningRows: session.summary.reviewQuestions,
        failedRows: session.summary.failedItems,
        duplicateRows: session.summary.duplicateCandidates,
        domain: 'QUESTION_BANK' as const,
        resumeSessionId: session.status === 'COMPLETED' ? undefined : session.id,
      }));
    return NextResponse.json(
      [...jobs.map((job) => ({ ...job, domain: 'QUESTION_BANK' as const })), ...sessionJobs].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
