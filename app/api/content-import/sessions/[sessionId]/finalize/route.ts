import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { requireImportSession, saveImportSession } from '@/lib/content-import/storage';
import { saveExam } from '@/lib/exams/exam-storage';
import type { ExamRecord } from '@/lib/exams/exam-types';

export async function POST(_request: Request, context: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await context.params;
    const session = await requireImportSession(sessionId);
    if (session.domain !== 'EXAM' || !session.examMetadata) {
      return NextResponse.json({ error: 'Phiên nhập không thuộc đề thi.' }, { status: 400 });
    }
    const approved = session.candidates.filter(
      (candidate) => candidate.status === 'APPROVED' && candidate.questionId
    );
    const now = new Date().toISOString();
    const exam: ExamRecord = {
      id: randomUUID(),
      name: session.examMetadata.name || `Đề nhập từ ảnh ${now.slice(0, 10)}`,
      subjectId: session.examMetadata.subjectId,
      grade: session.examMetadata.grade,
      examType: session.examMetadata.examType,
      questionIds: approved.map((candidate) => candidate.questionId as string),
      durationMinutes: session.examMetadata.durationMinutes,
      sourceName: session.examMetadata.sourceName,
      sourceUrl: session.examMetadata.sourceUrl,
      rightsStatus: session.examMetadata.rightsStatus,
      importMethod: 'IMAGES',
      importStatus: session.candidates.every((candidate) =>
        ['APPROVED', 'SKIPPED'].includes(candidate.status)
      )
        ? 'COMPLETED'
        : 'REVIEW_REQUIRED',
      publishStatus: 'DRAFT',
      importSessionId: session.id,
      rawExamCode: session.examMetadata.rawExamCode,
      normalizedExamCode: session.examMetadata.normalizedExamCode,
      createdAt: now,
      updatedAt: now,
    };
    await saveExam(exam);
    session.currentStep = 5;
    session.status = 'COMPLETED';
    await saveImportSession(session);
    return NextResponse.json({ exam, session: await requireImportSession(session.id) });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Không thể hoàn tất phiên nhập.' },
      { status: 500 }
    );
  }
}
