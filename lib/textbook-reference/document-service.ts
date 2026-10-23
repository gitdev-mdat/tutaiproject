import 'server-only';

import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { TextbookRequestError, verifyJob } from './extraction-service';
import {
  createSignedUploadToken,
  deletePrivateTextbook,
  documentStorageKey,
  privateObjectInfo,
} from './object-storage';
import { anchorsAgree, layoutOf, normalizedHeading } from './page-mapping';
import {
  closeTextbookUpload,
  enqueueTextbookJob,
  findTextbookBySha,
  getTextbookDocument,
  getTextbookUpload,
  insertTextbookDocument,
  listTextbookArtifacts,
  listTextbookMappings,
  openTextbookUpload,
  replaceTextbookAnchors,
  updateTextbookDocument,
  updateTextbookTocEntries,
} from './repository';
import { MAX_TOC_PAGES, recomputeTocRanges, tocJobKey } from './toc-service';
import type { PageLayout, TextbookAnchor, TextbookDocumentRecord } from './types';

/** Matches the Supabase free-plan per-file limit; the private bucket is created with it. */
export const MAX_TEXTBOOK_BYTES = 50 * 1024 * 1024;
/** Storage's resumable endpoint requires 6 MB chunks. */
export const UPLOAD_CHUNK_BYTES = 6 * 1024 * 1024;
const UPLOAD_SESSION_MS = 2 * 60 * 60 * 1000;

export interface UploadInit {
  sha256: string;
  byteSize: number;
  filename: string;
  title?: string;
}

function validateUpload(input: UploadInit) {
  if (!/^[0-9a-f]{64}$/.test(input.sha256))
    throw new TextbookRequestError('Mã kiểm tra tệp không hợp lệ.');
  if (!Number.isSafeInteger(input.byteSize) || input.byteSize <= 0)
    throw new TextbookRequestError('Kích thước tệp không hợp lệ.');
  if (input.byteSize > MAX_TEXTBOOK_BYTES)
    throw new TextbookRequestError(`Tệp lớn hơn ${MAX_TEXTBOOK_BYTES / 1024 / 1024} MB.`);
  const filename = path.basename(input.filename.replaceAll('\\', '/')).trim();
  if (!/\.pdf$/i.test(filename) || filename.length > 200)
    throw new TextbookRequestError('Chỉ nhận tệp PDF.');
  const title = (input.title?.trim() || filename.replace(/\.pdf$/i, '')).slice(0, 200);
  return { filename, title };
}

async function registerUploadedDocument(input: {
  sha256: string;
  byteSize: number;
  filename: string;
  title: string;
}): Promise<{ document: TextbookDocumentRecord; duplicate: boolean }> {
  const document: TextbookDocumentRecord = {
    id: `textbook-${input.sha256.slice(0, 16)}`,
    originalFilename: input.filename,
    title: input.title,
    sha256: input.sha256,
    byteSize: input.byteSize,
    pdfPageCount: null,
    storageKey: documentStorageKey(input.sha256),
    status: 'VERIFYING',
    importedAt: new Date().toISOString(),
    sourceVersion: input.sha256,
    tocIndexCompleteness: 'PARTIAL',
    processingErrors: [],
    anchors: [],
    tocEntries: [],
  };
  const result = await insertTextbookDocument(document);
  if (!result.duplicate) await enqueueTextbookJob(verifyJob(document.id, document.sha256));
  return result;
}

export type UploadInitResult =
  | { kind: 'duplicate'; document: TextbookDocumentRecord }
  | { kind: 'registered'; document: TextbookDocumentRecord }
  | {
      kind: 'upload';
      uploadId: string;
      tus: {
        endpoint: string;
        token: string;
        bucket: string;
        objectName: string;
        chunkSize: number;
      };
      publishableKey: string | null;
    };

/**
 * Starts (or resumes) a browser upload. Duplicates are detected by SHA-256
 * before any byte is sent. The browser gets a token for exactly one private
 * object and uploads it straight to Storage, never through this server.
 */
export async function initTextbookUpload(
  input: UploadInit,
  adminId: string
): Promise<UploadInitResult> {
  const { filename, title } = validateUpload(input);
  const existing = await findTextbookBySha(input.sha256);
  if (existing && existing.status !== 'FAILED') return { kind: 'duplicate', document: existing };
  const storageKey = documentStorageKey(input.sha256);
  if (existing) {
    // A previous copy failed verification: discard it so a clean upload can replace it.
    await discardFailedTextbook(existing);
  }
  const stored = await privateObjectInfo(storageKey);
  if (stored && stored.size === input.byteSize) {
    const { document } = await registerUploadedDocument({ ...input, filename, title });
    return { kind: 'registered', document };
  }
  if (stored) await deletePrivateTextbook(storageKey);
  const session = await openTextbookUpload({
    id: randomUUID(),
    sha256: input.sha256,
    byteSize: input.byteSize,
    originalFilename: filename,
    title,
    storageKey,
    expiresAt: new Date(Date.now() + UPLOAD_SESSION_MS).toISOString(),
    createdBy: adminId,
  });
  const token = await createSignedUploadToken(storageKey);
  return {
    kind: 'upload',
    uploadId: session.id,
    tus: { ...token, chunkSize: UPLOAD_CHUNK_BYTES },
    // A public key some gateways require on every request; it grants nothing by itself.
    publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? null,
  };
}

/** Called after the browser finished uploading: checks the stored object and registers the book. */
export async function completeTextbookUpload(uploadId: string) {
  const session = await getTextbookUpload(uploadId);
  if (!session) throw new TextbookRequestError('Không tìm thấy phiên tải lên.', 404);
  if (session.status === 'COMPLETED' && session.documentId) {
    const document = await getTextbookDocument(session.documentId);
    if (document) return { document, duplicate: true };
  }
  if (session.status !== 'PENDING') throw new TextbookRequestError('Phiên tải lên đã đóng.', 409);
  const stored = await privateObjectInfo(session.storageKey);
  if (!stored) throw new TextbookRequestError('Tệp chưa tải lên xong.', 409);
  if (stored.size !== session.byteSize) {
    await deletePrivateTextbook(session.storageKey);
    await closeTextbookUpload(session.id, 'CANCELLED');
    throw new TextbookRequestError('Tệp nhận được không khớp kích thước. Hãy tải lại.');
  }
  const result = await registerUploadedDocument({
    sha256: session.sha256,
    byteSize: session.byteSize,
    filename: session.originalFilename,
    title: session.title,
  });
  await closeTextbookUpload(session.id, 'COMPLETED', result.document.id);
  return result;
}

export async function cancelTextbookUpload(uploadId: string): Promise<void> {
  const session = await getTextbookUpload(uploadId);
  if (!session || session.status !== 'PENDING') return;
  await closeTextbookUpload(session.id, 'CANCELLED');
  // A finished but unregistered object would otherwise linger; unfinished
  // resumable parts expire inside Storage on their own.
  if (!(await findTextbookBySha(session.sha256))) await deletePrivateTextbook(session.storageKey);
}

async function discardFailedTextbook(document: TextbookDocumentRecord) {
  const { getSql } = await import('@/lib/db/postgres');
  await deletePrivateTextbook(document.storageKey);
  await getSql()`delete from tutai.textbook_documents where id = ${document.id} and status = 'FAILED'`;
}

/** Page anchors must agree with each other, or nothing can be mapped. */
export function validateAnchors(
  anchors: TextbookAnchor[],
  layout: PageLayout,
  pdfPageCount: number | null
): string | null {
  if (anchors.length < 2) return 'Cần ít nhất hai mốc trang.';
  const printed = new Set(anchors.map((anchor) => anchor.printedPage));
  if (printed.size !== anchors.length) return 'Mỗi số trang in chỉ nhập một lần.';
  for (const anchor of anchors) {
    if (pdfPageCount && anchor.pdfPage > pdfPageCount) return `PDF chỉ có ${pdfPageCount} trang.`;
    if (layout === 'SINGLE' && anchor.position !== 'FULL') return 'Sách một trang mỗi trang PDF.';
    if (layout === 'TWO_UP' && anchor.position !== 'LEFT' && anchor.position !== 'RIGHT')
      return 'Với bản quét hai trang, chọn nửa trái hoặc phải.';
  }
  if (!anchorsAgree(anchors, layout))
    return 'Các mốc trang không khớp nhau. Kiểm tra lại số trang PDF và nửa trái/phải.';
  return null;
}

export async function saveTextbookPageSetup(
  documentId: string,
  input: { layout: PageLayout; anchors: TextbookAnchor[]; tocPdfPages: number[] }
) {
  const document = await getTextbookDocument(documentId);
  if (!document) throw new TextbookRequestError('Không tìm thấy sách.', 404);
  if (document.status === 'VERIFYING')
    throw new TextbookRequestError('Sách đang được kiểm tra, chưa thể thiết lập trang.', 409);
  const anchors = input.anchors.map((anchor) => ({
    ...anchor,
    evidence: anchor.evidence?.trim() || 'Admin đối chiếu số trang in trên bản quét.',
  }));
  const problem = validateAnchors(anchors, input.layout, document.pdfPageCount);
  if (problem) throw new TextbookRequestError(problem);
  const tocPdfPages = [...new Set(input.tocPdfPages)].sort((a, b) => a - b);
  if (!tocPdfPages.length || tocPdfPages.length > MAX_TOC_PAGES)
    throw new TextbookRequestError(`Chọn từ 1 đến ${MAX_TOC_PAGES} trang PDF chứa mục lục.`);
  if (document.pdfPageCount && tocPdfPages.some((page) => page > document.pdfPageCount!))
    throw new TextbookRequestError(`PDF chỉ có ${document.pdfPageCount} trang.`);
  if (document.tocEntries.length) {
    const [mappings, artifacts] = await Promise.all([
      listTextbookMappings({ documentId }),
      listTextbookArtifacts({ documentId }),
    ]);
    if (mappings.length || artifacts.length)
      throw new TextbookRequestError(
        'Sách đã có mục được liên kết; mốc trang và mục lục được giữ nguyên.',
        409
      );
  }
  await replaceTextbookAnchors(documentId, anchors);
  await updateTextbookDocument(documentId, { pageLayout: input.layout, tocPdfPages });
  return { ...document, anchors, pageLayout: input.layout, tocPdfPages };
}

/**
 * Queues reading the printed table of contents. The book's status changes only
 * when a worker actually starts, so a waiting job is never shown as running.
 * An existing outline (possibly corrected by an Admin) is replaced only when
 * the caller says so explicitly.
 */
export async function requestTocIndex(documentId: string, options: { replace?: boolean } = {}) {
  const document = await getTextbookDocument(documentId);
  if (!document) throw new TextbookRequestError('Không tìm thấy sách.', 404);
  if (!['REGISTERED', 'INDEXED', 'FAILED'].includes(document.status) || !document.pdfPageCount)
    throw new TextbookRequestError('Sách chưa được kiểm tra xong.', 409);
  if (!document.tocPdfPages?.length || document.anchors.length < 2)
    throw new TextbookRequestError('Chọn trang mục lục và nhập mốc trang trước.');
  if (document.tocEntries.length && !options.replace)
    throw new TextbookRequestError(
      'Sách đã có mục lục. Xác nhận đọc lại để thay mục lục hiện có.',
      409
    );
  const now = new Date().toISOString();
  const { job, existing } = await enqueueTextbookJob({
    id: randomUUID(),
    kind: 'INDEX_TOC',
    documentId,
    knowledgeNodeId: '',
    entryIds: [],
    printedPages: [],
    tocPdfPages: document.tocPdfPages,
    extractionKey: tocJobKey(document, document.tocPdfPages),
    status: 'QUEUED',
    attempts: 0,
    provider: 'gemini',
    pagesProcessed: [],
    cacheHit: false,
    createdAt: now,
    updatedAt: now,
  });
  return { job, existing, layout: document.pageLayout ?? layoutOf(document.anchors) };
}

/** Server-side registration of a local file (CLI); same checks and states as a browser upload. */
export async function registerLocalTextbook(bytes: Buffer, filename: string, title?: string) {
  const { createHash } = await import('node:crypto');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const valid = validateUpload({ sha256, byteSize: bytes.length, filename, title });
  const existing = await findTextbookBySha(sha256);
  if (existing && existing.status !== 'FAILED') return { document: existing, duplicate: true };
  if (existing) await discardFailedTextbook(existing);
  const { uploadPrivateTextbook } = await import('./object-storage');
  await uploadPrivateTextbook(documentStorageKey(sha256), bytes);
  return registerUploadedDocument({ sha256, byteSize: bytes.length, ...valid });
}

/**
 * Admin corrections to the AI-read outline: heading text and start page of
 * entries. Ids and structure stay, so linked sections and extracts keep
 * pointing at the same entries; edited entries count as checked.
 */
export async function correctTextbookToc(
  documentId: string,
  changes: Array<{ entryId: string; heading: string; printedStartPage: number | null }>,
  confirmComplete: boolean
) {
  const document = await getTextbookDocument(documentId);
  if (!document) throw new TextbookRequestError('Không tìm thấy sách.', 404);
  if (!document.tocEntries.length) throw new TextbookRequestError('Sách chưa có mục lục.', 409);
  const byId = new Map(changes.map((change) => [change.entryId, change]));
  for (const change of changes) {
    if (!document.tocEntries.some((entry) => entry.id === change.entryId))
      throw new TextbookRequestError('Không tìm thấy mục trong mục lục.', 404);
    if (!change.heading.trim()) throw new TextbookRequestError('Tên mục không được để trống.');
    if (
      change.printedStartPage !== null &&
      (!Number.isInteger(change.printedStartPage) || change.printedStartPage < 1)
    )
      throw new TextbookRequestError('Số trang phải là số nguyên dương.');
  }
  const edited = document.tocEntries.map((entry) => {
    const change = byId.get(entry.id);
    if (!change) return entry;
    const heading = change.heading.replace(/\s+/g, ' ').trim();
    return {
      ...entry,
      originalHeading: heading,
      normalizedHeading: normalizedHeading(heading),
      printedStartPage: change.printedStartPage,
      status: 'VERIFIED' as const,
    };
  });
  const entries = recomputeTocRanges(edited, document);
  await updateTextbookTocEntries(documentId, entries, confirmComplete ? 'COMPLETE' : undefined);
  return {
    ...document,
    tocEntries: entries,
    tocIndexCompleteness: confirmComplete ? 'COMPLETE' : document.tocIndexCompleteness,
  };
}
