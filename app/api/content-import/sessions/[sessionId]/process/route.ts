import { NextResponse } from 'next/server';
import { extractQuestionsFromSession } from '@/lib/content-import/extraction';
import {
  ImportStorageError,
  requireImportSession,
  saveImportSession,
} from '@/lib/content-import/storage';
import type { PipelineStageId } from '@/lib/content-import/types';

function setStages(
  session: Awaited<ReturnType<typeof requireImportSession>>,
  updates: Partial<
    Record<
      PipelineStageId,
      { status: 'WAITING' | 'PROCESSING' | 'COMPLETED' | 'WARNING' | 'FAILED'; message?: string }
    >
  >
) {
  session.pipelineStages = session.pipelineStages.map((stage) => ({
    ...stage,
    ...(updates[stage.id] ?? {}),
  }));
}

export async function POST(_request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await context.params;
  try {
    const session = await requireImportSession(sessionId);
    if (session.extractionProvider === 'UNAVAILABLE') {
      throw new ImportStorageError(
        'Chưa cấu hình dịch vụ nhận diện ảnh. Phiên nhập vẫn được giữ nguyên để thử lại sau.',
        503
      );
    }
    session.status = 'PROCESSING';
    session.currentStep = 3;
    session.processingError = undefined;
    setStages(session, {
      CHECK_IMAGES: { status: 'COMPLETED', message: `Đã kiểm tra ${session.pages.length} ảnh gốc` },
      RECOGNIZE_LAYOUT: { status: 'PROCESSING', message: 'Đang gửi ảnh đến dịch vụ nhận diện' },
      EXTRACT_QUESTIONS: { status: 'PROCESSING', message: 'Đang trích xuất nội dung có cấu trúc' },
    });
    await saveImportSession(session);

    const candidates = await extractQuestionsFromSession(session);
    session.candidates = candidates;
    session.status = 'REVIEW_REQUIRED';
    session.currentStep = 4;
    const hasLowQuality = session.pages.some((page) => page.warnings.includes('LOW_RESOLUTION'));
    const missingAnswers = candidates.filter((candidate) => !candidate.correctAnswer).length;
    setStages(session, {
      RECOGNIZE_LAYOUT: { status: 'COMPLETED' },
      EXTRACT_QUESTIONS: { status: 'COMPLETED', message: `Phát hiện ${candidates.length} câu hỏi` },
      READ_MATH_AND_ASSETS: { status: 'COMPLETED' },
      MERGE_ACROSS_PAGES: { status: 'COMPLETED' },
      READ_ANSWER_KEY: missingAnswers
        ? { status: 'WARNING', message: `${missingAnswers} câu chưa có đáp án` }
        : { status: 'COMPLETED' },
      VALIDATE_DATA: hasLowQuality
        ? { status: 'WARNING', message: 'Có ảnh độ phân giải thấp cần kiểm tra' }
        : { status: 'COMPLETED' },
    });
    await saveImportSession(session);
    return NextResponse.json(await requireImportSession(sessionId));
  } catch (error: unknown) {
    try {
      const session = await requireImportSession(sessionId);
      const failedStage: PipelineStageId = 'EXTRACT_QUESTIONS';
      session.status = 'FAILED';
      session.processingError = {
        stage: failedStage,
        reason: error instanceof Error ? error.message : 'Không thể trích xuất câu hỏi từ ảnh.',
        retryable: true,
      };
      setStages(session, {
        [failedStage]: { status: 'FAILED', message: session.processingError.reason },
      });
      await saveImportSession(session);
    } catch {
      // The primary error is more useful when the session itself cannot be reloaded.
    }
    const status = error instanceof ImportStorageError ? error.status : 502;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Không thể xử lý ảnh.' },
      { status }
    );
  }
}
