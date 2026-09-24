/**
 * Unit tests for lib/pipeline/pipeline-orchestrator.ts — Files API
 * (waitForFileReady, uploadPdfToGemini)
 *
 * Covers:
 *  - missing uploaded file name
 *  - files.get called with { name }
 *  - ACTIVE state
 *  - FAILED state
 *  - timeout
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock gemini-client ───────────────────────────────────────────────────────────
// vi.hoisted() runs before vi.mock() hoisting, so the factory closure captures
// these references correctly.

const { mockUpload, mockGet, mockDelete, mockGenerateContent } = vi.hoisted(() => ({
  mockUpload: vi.fn<
    () => Promise<{
      name?: string;
      uri?: string;
      mimeType?: string;
      state?: string;
    }>
  >(),
  mockGet: vi.fn<() => Promise<{ name?: string; state?: string } | null>>(),
  mockDelete: vi.fn<() => Promise<unknown>>(),
  mockGenerateContent: vi.fn<(req: unknown) => Promise<unknown>>(),
}));

vi.mock('@/lib/ai/gemini-client', () => ({
  gemini: {
    files: { upload: mockUpload, get: mockGet, delete: mockDelete },
    models: { generateContent: mockGenerateContent },
  },
}));

vi.mock('@/lib/config/models', () => ({
  GEMINI_MODELS: {
    documentAnalysis: 'gemini-3.5-flash',
    tocDetection: 'gemini-3.5-flash',
    batchExtraction: 'gemini-3.5-flash',
  },
}));

// ─── Module under test ─────────────────────────────────────────────────────────

import {
  waitForFileReady,
  uploadPdfToGemini,
  safeGeminiCall,
  createKnowledgeItemId,
} from '@/lib/pipeline/pipeline-orchestrator';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function createTestPdf(docId: string): Promise<void> {
  const { mkdir, writeFile } = await import('fs/promises');
  const dir = `tmp/uploads/${docId}`;
  await mkdir(dir, { recursive: true });
  await writeFile(`${dir}/original.pdf`, Buffer.from('PDF-placeholder'));
}

async function cleanupTestPdf(docId: string): Promise<void> {
  try {
    const { rm } = await import('fs/promises');
    await rm(`tmp/uploads/${docId}`, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUpload.mockResolvedValue({
    name: 'files/test-file',
    uri: 'https://generativelanguage.googleapis.com/v1beta/files/test-file',
  });
  mockGet.mockResolvedValue({ state: 'ACTIVE' });
  mockDelete.mockResolvedValue(undefined);
});

afterEach(async () => {
  await cleanupTestPdf('test-doc-1');
  await cleanupTestPdf('test-doc-2');
});

// ── waitForFileReady ──────────────────────────────────────────────────────────

describe('waitForFileReady', () => {
  it('throws INVALID_FILE_NAME when name is undefined', async () => {
    await expect(waitForFileReady(undefined as unknown as string, 1000, 'doc-1')).rejects.toThrow(
      /invalid name/
    );
  });

  it('throws INVALID_FILE_NAME when name is null', async () => {
    await expect(waitForFileReady(null as unknown as string, 1000, 'doc-1')).rejects.toThrow(
      /invalid name/
    );
  });

  // files.get called with { name } — verify the SDK call signature
  it('calls gemini.files.get with an object { name }', async () => {
    mockGet.mockResolvedValue({ name: 'files/test-file', state: 'ACTIVE' });
    await waitForFileReady('files/test-file', 1000, 'doc-1');
    expect(mockGet).toHaveBeenCalledOnce();
    expect(mockGet).toHaveBeenCalledWith({ name: 'files/test-file' });
  });

  it('returns when state is ACTIVE', async () => {
    mockGet.mockResolvedValue({ name: 'files/test-file', state: 'ACTIVE' });
    await expect(waitForFileReady('files/test-file', 1000, 'doc-1')).resolves.toBeUndefined();
  });

  it('throws FILE_PROCESSING_FAILED when state is FAILED', async () => {
    mockGet.mockResolvedValue({ name: 'files/test-file', state: 'FAILED' });
    await expect(waitForFileReady('files/test-file', 1000, 'doc-1')).rejects.toThrow(
      /processing failed/
    );
    await expect(waitForFileReady('files/test-file', 1000, 'doc-1')).rejects.toMatchObject({
      code: 'FILE_PROCESSING_FAILED',
      stage: 'WAIT_FOR_FILE',
      retryable: false,
    });
  });

  it('polls PROCESSING until ACTIVE then returns', async () => {
    const states = ['PROCESSING', 'PROCESSING', 'ACTIVE'];
    let call = 0;
    mockGet.mockImplementation(() =>
      Promise.resolve({ name: 'files/test', state: states[call++] ?? 'ACTIVE' })
    );
    await expect(waitForFileReady('files/test', 10000, 'doc-1')).resolves.toBeUndefined();
    expect(mockGet).toHaveBeenCalledTimes(3);
    expect(mockGet).toHaveBeenNthCalledWith(1, { name: 'files/test' });
    expect(mockGet).toHaveBeenNthCalledWith(2, { name: 'files/test' });
    expect(mockGet).toHaveBeenNthCalledWith(3, { name: 'files/test' });
  });

  it('throws FILE_TIMEOUT when polling never reaches ACTIVE', async () => {
    mockGet.mockResolvedValue({ name: 'files/test', state: 'PROCESSING' });
    await expect(waitForFileReady('files/test', 5000, 'doc-1')).rejects.toThrow(/Timed out/);
    await expect(waitForFileReady('files/test', 5000, 'doc-1')).rejects.toMatchObject({
      code: 'FILE_TIMEOUT',
      stage: 'WAIT_FOR_FILE',
      retryable: true,
    });
  });

  it('keeps polling when gemini.files.get returns null', async () => {
    mockGet.mockResolvedValue(null);
    mockGet.mockResolvedValueOnce(null);
    await expect(waitForFileReady('files/test', 5000, 'doc-1')).rejects.toThrow(/Timed out/);
  });

  it('keeps polling when state is not a string', async () => {
    mockGet.mockResolvedValue({ name: 'files/test', state: 123 as unknown as string });
    mockGet.mockResolvedValueOnce({ name: 'files/test', state: 123 as unknown as string });
    await expect(waitForFileReady('files/test', 5000, 'doc-1')).rejects.toThrow(/Timed out/);
  });
});

// ── uploadPdfToGemini ─────────────────────────────────────────────────────────

describe('uploadPdfToGemini', () => {
  it('throws UPLOAD_NO_NAME when uploaded file has no name', async () => {
    await createTestPdf('test-doc-2');
    mockUpload.mockResolvedValue(
      {} as unknown as { name: string; mimeType?: string; state?: string }
    );
    await expect(uploadPdfToGemini(Buffer.from('pdf'), 'test.pdf', 'test-doc-2')).rejects.toThrow(
      /no name field/
    );
    await expect(
      uploadPdfToGemini(Buffer.from('pdf'), 'test.pdf', 'test-doc-2')
    ).rejects.toMatchObject({ code: 'UPLOAD_NO_NAME', retryable: false });
  });

  it('throws UPLOAD_NO_NAME when uploaded name is empty string', async () => {
    await createTestPdf('test-doc-2');
    mockUpload.mockResolvedValue({ name: '' });
    await expect(uploadPdfToGemini(Buffer.from('pdf'), 'test.pdf', 'test-doc-2')).rejects.toThrow(
      /no name field/
    );
  });

  it('throws UPLOAD_INVALID_NAME when name does not match "files/..." format', async () => {
    await createTestPdf('test-doc-2');
    mockUpload.mockResolvedValue({ name: 'invalid-name-no-prefix' });
    await expect(uploadPdfToGemini(Buffer.from('pdf'), 'test.pdf', 'test-doc-2')).rejects.toThrow(
      /invalid name format/
    );
    await expect(
      uploadPdfToGemini(Buffer.from('pdf'), 'test.pdf', 'test-doc-2')
    ).rejects.toMatchObject({ code: 'UPLOAD_INVALID_NAME', retryable: false });
  });

  it('returns the name and uri from uploaded when valid', async () => {
    await createTestPdf('test-doc-1');
    mockUpload.mockResolvedValue({
      name: 'files/abc-123',
      uri: 'https://generativelanguage.googleapis.com/v1beta/files/abc-123',
    });
    const result = await uploadPdfToGemini(Buffer.from('pdf'), 'test.pdf', 'test-doc-1');
    expect(result).toEqual({
      name: 'files/abc-123',
      uri: 'https://generativelanguage.googleapis.com/v1beta/files/abc-123',
    });
  });

  it('logs safe metadata on success (name, uri, mimeType, state)', async () => {
    const logSpy = vi.spyOn(console, 'log');
    await createTestPdf('test-doc-1');
    mockUpload.mockResolvedValue({
      name: 'files/success-upload',
      uri: 'https://generativelanguage.googleapis.com/...',
      mimeType: 'application/pdf',
      state: 'ACTIVE',
    });
    await uploadPdfToGemini(Buffer.from('pdf'), 'test.pdf', 'test-doc-1');
    const logCalls = logSpy.mock.calls.map((c) => JSON.parse(c[0] as string));
    const uploadCall = logCalls.find((l) => l.stage === 'FILE_UPLOAD' && l.success);
    expect(uploadCall).toMatchObject({
      success: true,
      fileName: 'files/success-upload',
      uri: 'https://generativelanguage.googleapis.com/...',
      mimeType: 'application/pdf',
      state: 'ACTIVE',
    });
    // No secrets logged (no API key, no base64, no binary)
    const fullLog = logSpy.mock.calls.map((c) => c[0]).join();
    expect(fullLog).not.toContain('AIza');
    expect(fullLog).not.toContain('application/pdf'.repeat(10));
    logSpy.mockRestore();
  });

  it('does not call files.delete when upload fails', async () => {
    await createTestPdf('test-doc-2');
    mockUpload.mockResolvedValue({} as unknown as { name: string });
    await expect(uploadPdfToGemini(Buffer.from('pdf'), 'test.pdf', 'test-doc-2')).rejects.toThrow();
    expect(mockDelete).not.toHaveBeenCalled();
  });
});

// ── safeGeminiCall ─────────────────────────────────────────────────────────────

/** Returns a mock generateContent response that satisfies schema validation.
 *  safeGeminiCall reads raw.text first; the mock must include it. */
function makeValidResponse(text: string): unknown {
  return {
    text, // required by safeGeminiCall: responseText = raw.text ?? ''
    sdkHttpResponse: { statusCode: 200 },
    candidates: [
      {
        content: { role: 'model', parts: [{ text }] },
      },
    ],
    modelVersion: 'gemini-2.0-flash',
    responseId: 'test-id',
    usageMetadata: {},
  };
}

describe('safeGeminiCall — request shape', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateContent.mockResolvedValue(makeValidResponse('{"ok":true}'));
  });

  // Test 1: with fileUri → request contains fileData Part, NOT text "Use this file: ..."
  it('includes fileData Part when fileUri is provided', async () => {
    await safeGeminiCall<{ ok: boolean }>(
      'TEST_STAGE',
      'doc-1',
      'gemini-3.5-flash',
      'Test prompt',
      'Be helpful.',
      undefined,
      undefined,
      'files/test-uri-abc123'
    );

    expect(mockGenerateContent).toHaveBeenCalledOnce();
    const callArg = mockGenerateContent.mock.calls[0]![0] as {
      contents: Array<{ parts: object[] }>;
    };
    const parts = callArg.contents[0]?.parts ?? [];

    const hasFileData = parts.some((p) => typeof p === 'object' && 'fileData' in p);
    const hasTextUseThisFile = parts.some(
      (p) =>
        typeof p === 'object' &&
        'text' in p &&
        String((p as { text: string }).text).includes('Use this file')
    );

    expect(hasFileData).toBe(true);
    expect(hasTextUseThisFile).toBe(false);
  });

  // Test 2: without fileUri → request contains only text Part, no fileData
  it('does NOT include fileData Part when fileUri is absent', async () => {
    await safeGeminiCall<{ ok: boolean }>(
      'TEST_STAGE',
      'doc-1',
      'gemini-3.5-flash',
      'Test prompt',
      'Be helpful.'
    );

    expect(mockGenerateContent).toHaveBeenCalledOnce();
    const callArg = mockGenerateContent.mock.calls[0]![0] as {
      contents: Array<{ parts: object[] }>;
    };
    const parts = callArg.contents[0]?.parts ?? [];
    const hasFileData = parts.some((p) => typeof p === 'object' && 'fileData' in p);
    expect(hasFileData).toBe(false);
    expect(parts).toEqual([{ text: 'Test prompt' }]);
  });

  // Test 3: fileData Part has correct structure
  it('fileData Part contains fileUri and mimeType', async () => {
    await safeGeminiCall<{ ok: boolean }>(
      'TEST_STAGE',
      'doc-1',
      'gemini-3.5-flash',
      'Test prompt',
      'Be helpful.',
      undefined,
      undefined,
      'files/my-pdf-xyz789'
    );

    const callArg = mockGenerateContent.mock.calls[0]![0] as {
      contents: Array<{
        parts: Array<{ fileData?: { fileUri: string; mimeType: string }; text?: string }>;
      }>;
    };
    const fileDataPart = callArg.contents[0]?.parts?.find((p) => 'fileData' in p);

    expect(fileDataPart?.fileData).toMatchObject({
      fileUri: 'files/my-pdf-xyz789',
      mimeType: 'application/pdf',
    });
  });
});

// ── createKnowledgeItemId ────────────────────────────────────────────────────

describe('createKnowledgeItemId', () => {
  // Test 3: deterministic — same input always produces the same ID
  it('is deterministic: identical inputs produce identical IDs', () => {
    const input = {
      documentId: 'doc-abc',
      batchIndex: 2,
      pageStart: 45,
      pageEnd: 72,
      title: 'Quadratic Functions',
      itemIndex: 3,
    };
    expect(createKnowledgeItemId(input)).toBe(createKnowledgeItemId(input));
    expect(createKnowledgeItemId(input)).toBe(createKnowledgeItemId(input));
  });

  // Test 4: same title but different batchIndex → different IDs
  it('produces different IDs when batchIndex differs', () => {
    const base = {
      documentId: 'doc-abc',
      batchIndex: 0,
      pageStart: 10,
      pageEnd: 20,
      title: 'Logarithms',
      itemIndex: 0,
    };
    const id0 = createKnowledgeItemId({ ...base, batchIndex: 0 });
    const id1 = createKnowledgeItemId({ ...base, batchIndex: 1 });
    expect(id0).not.toBe(id1);
  });

  // Test 5: same title same batch, same document → no duplicate
  // Two different items (different itemIndex) within same batch get different IDs
  it('produces different IDs for different itemIndex values', () => {
    const base = {
      documentId: 'doc-abc',
      batchIndex: 0,
      pageStart: 10,
      pageEnd: 20,
      title: 'Probability',
      itemIndex: 0,
    };
    const id0 = createKnowledgeItemId({ ...base, itemIndex: 0 });
    const id1 = createKnowledgeItemId({ ...base, itemIndex: 1 });
    expect(id0).not.toBe(id1);
  });

  // Test 5-variant: two batches both return AI ID "t1" → must get distinct backend IDs
  it('maps two batches with identical AI-generated "t1" to distinct backend IDs', () => {
    // Simulate: Batch 0, itemIndex=0 gets AI id="t1"
    const batch0Item = {
      documentId: 'doc-abc',
      batchIndex: 0,
      pageStart: 10,
      pageEnd: 20,
      title: 'Linear Correlation',
      itemIndex: 0,
    };
    // Simulate: Batch 1, itemIndex=0 also gets AI id="t1"
    const batch1Item = {
      documentId: 'doc-abc',
      batchIndex: 1,
      pageStart: 30,
      pageEnd: 40,
      title: 'Linear Correlation',
      itemIndex: 0,
    };

    const id0 = createKnowledgeItemId(batch0Item);
    const id1 = createKnowledgeItemId(batch1Item);

    expect(id0).not.toBe(id1);
    // Both are 24-char hex strings
    expect(id0).toMatch(/^[0-9a-f]{24}$/);
    expect(id1).toMatch(/^[0-9a-f]{24}$/);
  });

  it('is stable across whitespace/case variations in title', () => {
    const base = {
      documentId: 'doc-abc',
      batchIndex: 0,
      pageStart: 10,
      pageEnd: 20,
      title: 'Quadratic Functions',
      itemIndex: 0,
    };
    const id1 = createKnowledgeItemId(base);
    const id2 = createKnowledgeItemId({ ...base, title: '  QUADRATIC   functions  ' });
    expect(id1).toBe(id2);
  });

  it('produces a 24-character hex string', () => {
    const id = createKnowledgeItemId({
      documentId: 'doc-abc',
      batchIndex: 0,
      pageStart: 10,
      pageEnd: 20,
      title: 'Test Title',
      itemIndex: 0,
    });
    expect(id).toMatch(/^[0-9a-f]{24}$/);
  });

  it('does not use timestamp or Math.random()', () => {
    const base = {
      documentId: 'doc-abc',
      batchIndex: 0,
      pageStart: 10,
      pageEnd: 20,
      title: 'Test',
      itemIndex: 0,
    };
    const ids = Array.from({ length: 5 }, () => createKnowledgeItemId(base));
    // All identical if truly deterministic (no timestamp/no random)
    expect(new Set(ids).size).toBe(1);
  });
});
