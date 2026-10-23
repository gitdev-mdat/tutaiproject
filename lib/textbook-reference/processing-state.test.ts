import { describe, expect, it } from 'vitest';
import { bookState } from './processing-state';
import type { TextbookExtractionJob } from './types';

const NOW = Date.parse('2026-10-23T14:20:00Z');
const configured = {
  status: 'REGISTERED' as const,
  anchors: [
    { printedPage: 13, pdfPage: 7, position: 'RIGHT' as const, evidence: '' },
    { printedPage: 39, pdfPage: 20, position: 'RIGHT' as const, evidence: '' },
  ],
  tocPdfPages: [5, 6, 7],
  processingErrors: [] as string[],
  tocIndexCompleteness: 'PARTIAL' as const,
  tocEntryCount: 0,
};

function job(overrides: Partial<TextbookExtractionJob>): TextbookExtractionJob {
  return {
    id: 'job-1',
    kind: 'INDEX_TOC',
    documentId: 'doc',
    knowledgeNodeId: '',
    entryIds: [],
    printedPages: [],
    tocPdfPages: [5, 6, 7],
    extractionKey: 'k',
    status: 'QUEUED',
    attempts: 0,
    provider: 'gemini',
    pagesProcessed: [],
    cacheHit: false,
    createdAt: '2026-10-23T14:19:00Z',
    updatedAt: '2026-10-23T14:19:00Z',
    ...overrides,
  };
}

describe('bookState', () => {
  it('shows a queued read as waiting, never as running', () => {
    const state = bookState({ ...configured, status: 'INDEXING' }, job({}), NOW);
    expect(state).toMatchObject({ key: 'TOC_WAITING', tone: 'waiting', active: true });
    expect(state.title).not.toMatch(/đang đọc/i);
  });

  it('shows running only while a worker holds a live lease', () => {
    const running = job({
      status: 'RUNNING',
      attempts: 1,
      startedAt: '2026-10-23T14:19:30Z',
      leaseUntil: '2026-10-23T14:25:30Z',
    });
    expect(bookState(configured, running, NOW).key).toBe('TOC_RUNNING');
    const expired = { ...running, leaseUntil: '2026-10-23T14:19:59Z' };
    expect(bookState(configured, expired, NOW)).toMatchObject({ key: 'INTERRUPTED', active: true });
  });

  it('a failed read is a failure with its real reason, even if the book row still says INDEXING', () => {
    const failed = job({
      status: 'FAILED',
      attempts: 1,
      error: 'Tài khoản Gemini đã hết tín dụng.',
      errorCode: 'BILLING',
      retryable: false,
    });
    const state = bookState(
      { ...configured, status: 'INDEXING', processingErrors: ['old error'] },
      failed,
      NOW
    );
    expect(state).toMatchObject({ key: 'TOC_FAILED', tone: 'error', active: false });
    expect(state.description).toBe('Tài khoản Gemini đã hết tín dụng.');
  });

  it('a failed re-read keeps the existing outline and says so', () => {
    const state = bookState(
      { ...configured, status: 'INDEXED', tocEntryCount: 42 },
      job({ status: 'FAILED', error: 'Lỗi.' }),
      NOW
    );
    expect(state).toMatchObject({ key: 'TOC_FAILED', previousTocKept: true, tone: 'attention' });
    expect(state.description).toMatch(/giữ nguyên/);
  });

  it('is ready only once the outline is saved', () => {
    const state = bookState(
      { ...configured, status: 'INDEXED', tocEntryCount: 42 },
      job({ status: 'COMPLETED', attempts: 1 }),
      NOW
    );
    expect(state).toMatchObject({ key: 'TOC_READY', tone: 'success', active: false });
  });

  it('asks for page setup until layout, anchors and outline pages exist', () => {
    expect(bookState({ ...configured, tocPdfPages: [], anchors: [] }, null, NOW).key).toBe(
      'NEEDS_SETUP'
    );
    expect(bookState(configured, null, NOW).key).toBe('READY_TO_READ');
  });

  it('covers the file check and a broken file', () => {
    expect(
      bookState({ ...configured, status: 'VERIFYING' }, job({ kind: 'VERIFY' }), NOW).key
    ).toBe('CHECK_WAITING');
    expect(
      bookState(
        { ...configured, status: 'FAILED', processingErrors: ['Tệp không khớp mã kiểm tra.'] },
        job({ kind: 'VERIFY', status: 'FAILED' }),
        NOW
      )
    ).toMatchObject({ key: 'FILE_FAILED', description: 'Tệp không khớp mã kiểm tra.' });
  });
});
