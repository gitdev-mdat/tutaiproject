import { describe, expect, it } from 'vitest';
import { validateExamUpload } from './upload-validation';
import type { ImportSession, SourcePage } from './types';

function page(overrides: Partial<SourcePage> = {}): SourcePage {
  return {
    id: 'page-1',
    order: 1,
    originalFileName: 'page.jpg',
    storedFileName: 'page.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 1000,
    width: 1400,
    height: 2000,
    checksum: 'checksum',
    pageType: 'EXAM_PAGE',
    rotation: 0,
    assetRole: 'SOURCE_IMAGE',
    warnings: [],
    createdAt: '2026-08-05T00:00:00.000Z',
    ...overrides,
  };
}

function session(pages: SourcePage[]): ImportSession {
  return {
    id: 'session-1',
    domain: 'EXAM',
    sourceFormat: 'IMAGES',
    status: 'DRAFT',
    currentStep: 1,
    pages,
    pipelineStages: [],
    candidates: [],
    summary: {
      pageCount: pages.length,
      detectedQuestions: 0,
      approvedQuestions: 0,
      reviewQuestions: 0,
      skippedQuestions: 0,
      questionsWithAnswers: 0,
      questionsWithoutAnswers: 0,
      duplicateCandidates: 0,
      failedItems: 0,
      lowQualityImages: 0,
    },
    extractionProvider: 'GEMINI',
    createdAt: '2026-08-05T00:00:00.000Z',
    updatedAt: '2026-08-05T00:00:00.000Z',
  };
}

describe('validateExamUpload', () => {
  it('blocks continuation when no exam page is classified', () => {
    const issues = validateExamUpload(session([page({ pageType: 'UNKNOWN' })]));
    expect(issues).toContainEqual(
      expect.objectContaining({ id: 'missing-exam-page', level: 'BLOCKING' })
    );
  });

  it('keeps missing answers informational', () => {
    const issues = validateExamUpload(session([page()]));
    expect(issues).toContainEqual(
      expect.objectContaining({ id: 'missing-answer-page', level: 'INFO' })
    );
  });

  it('returns page-specific duplicate and quality actions', () => {
    const issues = validateExamUpload(
      session([page({ warnings: ['DUPLICATE_IMAGE', 'LOW_RESOLUTION'] })])
    );
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'DELETE_DUPLICATE', pageId: 'page-1' }),
        expect.objectContaining({ action: 'VIEW_PAGE', pageId: 'page-1' }),
      ])
    );
  });
});
