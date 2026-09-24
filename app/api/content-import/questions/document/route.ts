import { NextResponse } from 'next/server';
import {
  attachDetectedQuestionVisuals,
  enrichPdfCandidatesWithMedia,
  extractDocxDeterministically,
  extractPdfDeterministically,
  planDocumentRecovery,
  reconcileDocumentCandidates,
} from '@/lib/content-import/document-extraction';
import {
  extractQuestionsFromDocument,
  extractQuestionsFromDocumentPages,
} from '@/lib/content-import/extraction';
import { createDocumentImportSession, ImportStorageError } from '@/lib/content-import/storage';
import { detectMissingQuestionVisuals } from '@/lib/content-import/visual-region-detection';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'A PDF or DOCX file is required.' }, { status: 400 });
    }

    const lowerName = file.name.toLowerCase();
    const format = lowerName.endsWith('.pdf') ? 'PDF' : lowerName.endsWith('.docx') ? 'DOCX' : null;

    if (!format) {
      return NextResponse.json(
        { error: 'Only PDF and DOCX documents are supported.' },
        { status: 415 }
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const extraction =
      format === 'PDF'
        ? await extractPdfDeterministically(bytes)
        : await extractDocxDeterministically(bytes);

    let candidates = extraction.candidates;
    const recoveryPlan = planDocumentRecovery(extraction.pages, candidates);

    if (candidates.length === 0) {
      const recoveryStartedAt = Date.now();

      try {
        const recovered = await extractQuestionsFromDocument(
          bytes,
          format,
          extraction.pages.length
        );

        candidates = reconcileDocumentCandidates(candidates, recovered);

        console.info(
          `[content-import] Visual recovery diagnostics: scope=all, pages=${extraction.pages.length}, bytes=${bytes.length}, durationMs=${Date.now() - recoveryStartedAt}.`
        );

        if (candidates.length === 0) {
          extraction.warnings.push(
            'Không tìm thấy câu hỏi qua phân tích văn bản hoặc nhận diện hình ảnh.'
          );
        } else {
          extraction.warnings.push(
            'Các câu hỏi đã được khôi phục qua nhận diện thị giác do tài liệu không có phân đoạn văn bản rõ ràng; vui lòng kiểm tra kỹ trước khi lưu.'
          );
        }
      } catch (error: unknown) {
        console.error(
          `[content-import] Visual question recovery failed after ${Date.now() - recoveryStartedAt}ms (scope=all, pages=${extraction.pages.length}, bytes=${bytes.length}):`,
          error
        );
        extraction.warnings.push(
          'Không thể hoàn tất khôi phục nhận diện thị giác do dịch vụ phản hồi chậm hoặc gián đoạn; các câu hỏi đã nhận diện được giữ nguyên.'
        );
      }
    } else if (recoveryPlan.pageNumbers.length > 0) {
      const recoveryStartedAt = Date.now();

      try {
        const recovered = await extractQuestionsFromDocumentPages(
          bytes,
          format,
          extraction.pages.length,
          recoveryPlan.pageNumbers
        );

        candidates = reconcileDocumentCandidates(candidates, recovered);

        console.info(
          `[content-import] Visual recovery diagnostics: scope=pages:${recoveryPlan.pageNumbers.join(',')}, unresolvedPages=${recoveryPlan.pageNumbers.length}, totalPages=${extraction.pages.length}, bytes=${bytes.length}, durationMs=${Date.now() - recoveryStartedAt}.`
        );

        if (recovered.length > 0) {
          extraction.warnings.push(
            `Đã khôi phục bổ sung câu hỏi cho trang ${recoveryPlan.pageNumbers.join(', ')}; vui lòng kiểm tra lại trước khi lưu.`
          );
        }
      } catch (error: unknown) {
        console.error(
          `[content-import] Selective page recovery for page(s) ${recoveryPlan.pageNumbers.join(', ')} failed after ${Date.now() - recoveryStartedAt}ms:`,
          error
        );
        extraction.warnings.push(
          `Khôi phục bổ sung cho trang ${recoveryPlan.pageNumbers.join(', ')} bị gián đoạn; các câu hỏi đã tách được giữ nguyên.`
        );
      }
    }

    // Important: enrich only after deterministic extraction and visual recovery have been
    // reconciled. Recovery candidates do not exist during extractPdfDeterministically().
    if (format === 'PDF' && candidates.length > 0) {
      candidates = await enrichPdfCandidatesWithMedia(extraction.pages, candidates);

      const localization = await detectMissingQuestionVisuals(extraction.pages, candidates);
      candidates = await attachDetectedQuestionVisuals(
        extraction.pages,
        candidates,
        localization.detections
      );
      if (localization.failedWindows.length > 0) {
        extraction.warnings.push(
          'Không thể tự động định vị một số hình minh họa; các câu hỏi liên quan vẫn được giữ để chọn vùng nguồn thủ công.'
        );
      }
    }

    const session = await createDocumentImportSession({
      file,
      format,
      candidates,
      pageCount: extraction.pages.length,
      warnings: extraction.warnings,
      renderedPages: extraction.pages.flatMap((page) =>
        (page.visualCrops ?? []).map((crop) => ({
          pageNumber: page.pageNumber,
          id: crop.id,
          width: crop.width,
          height: crop.height,
          bytes: crop.bytes,
          sourceRegion: crop.sourceRegion,
        }))
      ),
    });

    return NextResponse.json(session, { status: 201 });
  } catch (error: unknown) {
    console.error('[content-import] document import failed:', error);

    const status = error instanceof ImportStorageError ? error.status : 400;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Document extraction failed.' },
      { status }
    );
  }
}
