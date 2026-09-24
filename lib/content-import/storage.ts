import 'server-only';

import { createHash, randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import {
  DEFAULT_PIPELINE_STAGES,
  EMPTY_IMPORT_SUMMARY,
  type ExamMetadata,
  type ImportDomain,
  type ImportSession,
  type QuestionCandidate,
  type PageType,
  type SourcePage,
} from './types';
import { normalizeExamCode, summarizeSession } from './session-utils';
import type { QuestionAsset } from '@/lib/question-bank/qb-types';

const IMPORT_ROOT = path.join(process.cwd(), 'tmp', 'content-imports');
const QUESTION_ASSET_ROOT = path.join(process.cwd(), 'data', 'question-bank', 'assets');
const SESSION_ID_PATTERN = /^[a-zA-Z0-9-]+$/;
const MAX_FILES = 24;
const MAX_FILE_SIZE = 12 * 1024 * 1024;
const ACCEPTED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export interface UploadImageManifestItem {
  name: string;
  width: number;
  height: number;
  pageType?: PageType;
}

export class ImportStorageError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = 'ImportStorageError';
  }
}

function assertSessionId(sessionId: string): void {
  if (!SESSION_ID_PATTERN.test(sessionId)) {
    throw new ImportStorageError('Mã phiên nhập không hợp lệ.', 400);
  }
}

function sessionDirectory(sessionId: string): string {
  assertSessionId(sessionId);
  return path.join(IMPORT_ROOT, sessionId);
}

function sessionFile(sessionId: string): string {
  return path.join(sessionDirectory(sessionId), 'session.json');
}

export function sourcePageFile(sessionId: string, storedFileName: string): string {
  assertSessionId(sessionId);
  const safeName = path.basename(storedFileName);
  return path.join(sessionDirectory(sessionId), 'source', safeName);
}

export function sourceDocumentFile(sessionId: string, storedFileName: string): string {
  return sourcePageFile(sessionId, storedFileName);
}

export function questionAssetFile(questionId: string, storedFileName: string): string {
  assertSessionId(questionId);
  return path.join(QUESTION_ASSET_ROOT, questionId, path.basename(storedFileName));
}

export async function materializeQuestionAssets(
  session: ImportSession,
  candidate: QuestionCandidate,
  questionId: string
): Promise<QuestionAsset[]> {
  const selectedPages = session.pages.filter((page) => candidate.sourcePageIds.includes(page.id));
  // PDF/DOCX source documents stay once at the import-session level and are
  // referenced through importJobId, source name/page and source bounds.
  if (selectedPages.length === 0) return [];
  const directory = path.join(QUESTION_ASSET_ROOT, questionId);
  await fs.mkdir(directory, { recursive: true });
  const createdAt = new Date().toISOString();
  const assets: QuestionAsset[] = [];
  try {
    for (const page of selectedPages) {
      // Preserve the crop identifier so ordered IMAGE blocks continue to resolve
      // after the session asset is copied into durable question storage.
      const id = page.id;
      const extension = path.extname(page.storedFileName).toLowerCase();
      const storedFileName = `${id}${extension}`;
      await fs.copyFile(
        sourcePageFile(session.id, page.storedFileName),
        questionAssetFile(questionId, storedFileName)
      );
      assets.push({
        id,
        role:
          candidate.questionAssetDescription || candidate.sourceBounds
            ? 'QUESTION_IMAGE'
            : 'SOURCE_EVIDENCE',
        storageKey: `question-assets/${questionId}/${storedFileName}`,
        mimeType: page.mimeType,
        originalFileName: page.originalFileName,
        checksum: page.checksum,
        sourceSessionId: session.id,
        sourcePageId: page.id,
        sourceBounds: candidate.sourceBounds,
        crop: page.crop,
        createdAt,
      });
    }
    return assets;
  } catch (error: unknown) {
    await Promise.allSettled(
      assets.map((asset) =>
        fs.unlink(questionAssetFile(questionId, path.basename(asset.storageKey)))
      )
    );
    throw error;
  }
}

async function atomicWriteJson(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${randomUUID()}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(value, null, 2), 'utf8');
  let attempts = 0;
  while (attempts < 8) {
    try {
      await fs.rename(temporary, filePath);
      return;
    } catch (error: unknown) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'EPERM' && code !== 'EBUSY' && code !== 'EACCES') throw error;
      attempts += 1;
      await new Promise((resolve) => setTimeout(resolve, 40 * attempts));
    }
  }
  await fs.rename(temporary, filePath);
}

function extensionForMimeType(mimeType: string): string {
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/webp') return '.webp';
  return '.jpg';
}

function imageWarnings(width: number, height: number): string[] {
  const warnings: string[] = [];
  if (Math.min(width, height) < 900) warnings.push('LOW_RESOLUTION');
  if (width > height * 1.25) warnings.push('LANDSCAPE');
  return warnings;
}

export function defaultExamMetadata(): ExamMetadata {
  return {
    name: '',
    rawExamCode: '',
    normalizedExamCode: '',
    curriculumProgram: 'Chương trình GDPT 2018',
    sourceName: '',
    sourceUrl: '',
    publisher: '',
    sourceNote: '',
    rightsStatus: 'UNVERIFIED',
    answerMatchingMode: 'INCLUDED',
    rawAnswerCode: '',
    normalizedAnswerCode: '',
    answerCodeConfirmed: false,
  };
}

export async function createImageImportSession(input: {
  domain: ImportDomain;
  files: File[];
  manifest: UploadImageManifestItem[];
}): Promise<ImportSession> {
  if (input.files.length === 0) throw new ImportStorageError('Vui lòng chọn ít nhất một ảnh.', 400);
  if (input.domain === 'QUESTION_BANK' && input.files.length !== 1) {
    throw new ImportStorageError('Nhập một câu hỏi chỉ chấp nhận một ảnh.', 400);
  }
  if (input.files.length > MAX_FILES) {
    throw new ImportStorageError(`Mỗi phiên hỗ trợ tối đa ${MAX_FILES} ảnh.`, 400);
  }
  if (input.manifest.length !== input.files.length) {
    throw new ImportStorageError('Thông tin ảnh không khớp với số tệp.', 400);
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  const directory = sessionDirectory(id);
  await fs.mkdir(path.join(directory, 'source'), { recursive: true });

  const pages: SourcePage[] = [];
  const checksums = new Set<string>();
  for (let index = 0; index < input.files.length; index += 1) {
    const file = input.files[index];
    const manifest = input.manifest[index];
    if (!ACCEPTED_MIME_TYPES.has(file.type)) {
      throw new ImportStorageError(
        `Tệp ${file.name} không thuộc định dạng JPG, PNG hoặc WEBP.`,
        415
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new ImportStorageError(`Tệp ${file.name} vượt quá giới hạn 12 MB.`, 413);
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const checksum = createHash('sha256').update(bytes).digest('hex');
    const duplicate = checksums.has(checksum);
    checksums.add(checksum);
    const pageId = randomUUID();
    const storedFileName = `${pageId}${extensionForMimeType(file.type)}`;
    await fs.writeFile(sourcePageFile(id, storedFileName), bytes);
    pages.push({
      id: pageId,
      order: index + 1,
      originalFileName: file.name,
      storedFileName,
      mimeType: file.type,
      sizeBytes: file.size,
      width: Math.max(0, Math.round(manifest.width)),
      height: Math.max(0, Math.round(manifest.height)),
      checksum,
      pageType: manifest.pageType ?? (input.domain === 'EXAM' ? 'UNKNOWN' : 'EXAM_PAGE'),
      rotation: 0,
      assetRole: 'SOURCE_IMAGE',
      warnings: [
        ...imageWarnings(manifest.width, manifest.height),
        ...(duplicate ? ['DUPLICATE_IMAGE'] : []),
      ],
      createdAt: now,
    });
  }

  const session: ImportSession = {
    id,
    domain: input.domain,
    sourceFormat: input.domain === 'EXAM' ? 'IMAGES' : 'IMAGE',
    status: 'DRAFT',
    currentStep: 1,
    pages,
    examMetadata: input.domain === 'EXAM' ? defaultExamMetadata() : undefined,
    singleQuestionSource:
      input.domain === 'QUESTION_BANK'
        ? { sourceName: '', sourceUrl: '', rightsStatus: 'UNVERIFIED' }
        : undefined,
    pipelineStages: DEFAULT_PIPELINE_STAGES,
    candidates: [],
    summary: { ...EMPTY_IMPORT_SUMMARY, pageCount: pages.length },
    extractionProvider: process.env.GEMINI_API_KEY ? 'GEMINI' : 'UNAVAILABLE',
    createdAt: now,
    updatedAt: now,
  };
  await saveImportSession(session);
  return session;
}

export async function createStructuredImportSession(input: {
  fileName: string;
  format: 'XLSX' | 'CSV' | 'JSON' | 'PDF' | 'DOCX';
  rawRows: Array<Record<string, unknown>>;
  mappings: NonNullable<ImportSession['structuredData']>['mappings'];
  defaults: NonNullable<ImportSession['structuredData']>['defaults'];
  candidates: QuestionCandidate[];
}): Promise<ImportSession> {
  const id = randomUUID();
  const now = new Date().toISOString();
  const session: ImportSession = {
    id,
    domain: 'QUESTION_BANK',
    sourceFormat: input.format,
    status: input.candidates.some((candidate) => candidate.reviewLevel === 'BLOCKING')
      ? 'REVIEW_REQUIRED'
      : 'READY',
    currentStep: 3,
    pages: [],
    singleQuestionSource: { sourceName: input.fileName, sourceUrl: '', rightsStatus: 'UNVERIFIED' },
    pipelineStages: DEFAULT_PIPELINE_STAGES.map((stage) => ({ ...stage, status: 'COMPLETED' })),
    candidates: input.candidates,
    structuredData: {
      fileName: input.fileName,
      format: input.format,
      rawRows: input.rawRows,
      mappings: input.mappings,
      defaults: input.defaults,
    },
    summary: EMPTY_IMPORT_SUMMARY,
    extractionProvider: 'UNAVAILABLE',
    createdAt: now,
    updatedAt: now,
  };
  await saveImportSession(session);
  return await requireImportSession(id);
}

export async function createDocumentImportSession(input: {
  file: File;
  format: 'PDF' | 'DOCX';
  candidates: QuestionCandidate[];
  pageCount?: number;
  warnings: string[];
  renderedPages?: Array<{
    pageNumber: number;
    id?: string;
    width: number;
    height: number;
    bytes: Buffer;
    sourceRegion?: { x: number; y: number; width: number; height: number };
  }>;
}): Promise<ImportSession> {
  const maxDocumentSize = 30 * 1024 * 1024;
  if (input.file.size <= 0 || input.file.size > maxDocumentSize) {
    throw new ImportStorageError('Document must be between 1 byte and 30 MB.', 413);
  }
  const expectedMime =
    input.format === 'PDF'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (input.file.type && input.file.type !== expectedMime) {
    throw new ImportStorageError('Document MIME type does not match its format.', 415);
  }
  const id = randomUUID();
  const now = new Date().toISOString();
  const bytes = Buffer.from(await input.file.arrayBuffer());
  const checksum = createHash('sha256').update(bytes).digest('hex');
  const extension = input.format === 'PDF' ? '.pdf' : '.docx';
  const storedFileName = `document${extension}`;
  await fs.mkdir(path.join(sessionDirectory(id), 'source'), { recursive: true });
  await fs.writeFile(sourceDocumentFile(id, storedFileName), bytes);
  const pages: SourcePage[] = [];
  for (const rendered of input.renderedPages ?? []) {
    const pageId = rendered.id ?? randomUUID();
    const pageFileName = `${pageId}.png`;
    await fs.writeFile(sourcePageFile(id, pageFileName), rendered.bytes);
    pages.push({
      id: pageId,
      order: rendered.pageNumber,
      originalFileName: `${input.file.name} — trang ${rendered.pageNumber}`,
      storedFileName: pageFileName,
      mimeType: 'image/png',
      sizeBytes: rendered.bytes.length,
      width: rendered.width,
      height: rendered.height,
      checksum: createHash('sha256').update(rendered.bytes).digest('hex'),
      pageType: 'EXAM_PAGE',
      rotation: 0,
      assetRole: 'SOURCE_IMAGE',
      warnings: [],
      createdAt: now,
    });
  }
  const session: ImportSession = {
    id,
    domain: 'QUESTION_BANK',
    sourceFormat: input.format,
    status: 'REVIEW_REQUIRED',
    currentStep: 4,
    pages,
    sourceDocument: {
      originalFileName: input.file.name,
      storedFileName,
      mimeType: expectedMime,
      sizeBytes: bytes.length,
      checksum,
      pageCount: input.pageCount,
    },
    singleQuestionSource: {
      sourceName: input.file.name,
      sourceUrl: '',
      rightsStatus: 'UNVERIFIED',
    },
    pipelineStages: DEFAULT_PIPELINE_STAGES.map((stage) => ({ ...stage, status: 'COMPLETED' })),
    candidates: input.candidates,
    summary: EMPTY_IMPORT_SUMMARY,
    warnings: input.warnings,
    extractionProvider: 'UNAVAILABLE',
    createdAt: now,
    updatedAt: now,
  };
  await saveImportSession(session);
  return await requireImportSession(id);
}

export async function listImportSessions(): Promise<ImportSession[]> {
  let entries: Array<{ name: string; isDirectory(): boolean }> = [];
  try {
    entries = await fs.readdir(IMPORT_ROOT, { withFileTypes: true });
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  const sessions = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() && SESSION_ID_PATTERN.test(entry.name))
      .map((entry) => getImportSession(entry.name))
  );
  return sessions
    .filter((session): session is ImportSession => session !== null)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function appendImagesToSession(input: {
  sessionId: string;
  files: File[];
  manifest: UploadImageManifestItem[];
}): Promise<ImportSession> {
  const session = await requireImportSession(input.sessionId);
  if (session.domain !== 'EXAM') {
    throw new ImportStorageError('Chỉ phiên nhập đề thi mới có thể thêm trang ảnh.', 400);
  }
  if (input.files.length === 0) {
    throw new ImportStorageError('Vui lòng chọn ít nhất một ảnh.', 400);
  }
  if (input.manifest.length !== input.files.length) {
    throw new ImportStorageError('Thông tin ảnh không khớp với số tệp.', 400);
  }
  if (session.pages.length + input.files.length > MAX_FILES) {
    throw new ImportStorageError(`Mỗi phiên hỗ trợ tối đa ${MAX_FILES} ảnh.`, 400);
  }

  const knownChecksums = new Set(session.pages.map((page) => page.checksum));
  const now = new Date().toISOString();
  const prepared: Array<{ page: SourcePage; bytes: Buffer }> = [];
  for (let index = 0; index < input.files.length; index += 1) {
    const file = input.files[index];
    const manifest = input.manifest[index];
    if (!ACCEPTED_MIME_TYPES.has(file.type)) {
      throw new ImportStorageError(
        `Tệp ${file.name} không thuộc định dạng JPG, PNG hoặc WEBP.`,
        415
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new ImportStorageError(`Tệp ${file.name} vượt quá giới hạn 12 MB.`, 413);
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const checksum = createHash('sha256').update(bytes).digest('hex');
    const duplicate = knownChecksums.has(checksum);
    knownChecksums.add(checksum);
    const pageId = randomUUID();
    prepared.push({
      bytes,
      page: {
        id: pageId,
        order: session.pages.length + index + 1,
        originalFileName: file.name,
        storedFileName: `${pageId}${extensionForMimeType(file.type)}`,
        mimeType: file.type,
        sizeBytes: file.size,
        width: Math.max(0, Math.round(manifest.width)),
        height: Math.max(0, Math.round(manifest.height)),
        checksum,
        pageType: manifest.pageType ?? 'UNKNOWN',
        rotation: 0,
        assetRole: 'SOURCE_IMAGE',
        warnings: [
          ...imageWarnings(manifest.width, manifest.height),
          ...(duplicate ? ['DUPLICATE_IMAGE'] : []),
        ],
        createdAt: now,
      },
    });
  }

  try {
    await Promise.all(
      prepared.map(({ page, bytes }) =>
        fs.writeFile(sourcePageFile(session.id, page.storedFileName), bytes)
      )
    );
    session.pages.push(...prepared.map(({ page }) => page));
    session.status = 'DRAFT';
    session.currentStep = 1;
    await saveImportSession(session);
    return await requireImportSession(session.id);
  } catch (error: unknown) {
    await Promise.allSettled(
      prepared.map(({ page }) => fs.unlink(sourcePageFile(session.id, page.storedFileName)))
    );
    throw error;
  }
}

export async function getImportSession(sessionId: string): Promise<ImportSession | null> {
  try {
    const raw = await fs.readFile(sessionFile(sessionId), 'utf8');
    return JSON.parse(raw) as ImportSession;
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

export async function requireImportSession(sessionId: string): Promise<ImportSession> {
  const session = await getImportSession(sessionId);
  if (!session) throw new ImportStorageError('Không tìm thấy phiên nhập.', 404);
  return session;
}

export async function deleteImportSession(sessionId: string): Promise<void> {
  await requireImportSession(sessionId);
  await fs.rm(sessionDirectory(sessionId), { recursive: true, force: true });
}

export async function saveImportSession(session: ImportSession): Promise<void> {
  const next = {
    ...session,
    pages: [...session.pages].sort((a, b) => a.order - b.order),
    summary: summarizeSession(session),
    updatedAt: new Date().toISOString(),
  };
  await atomicWriteJson(sessionFile(session.id), next);
}

export async function updateExamMetadata(
  sessionId: string,
  metadata: ExamMetadata,
  advance = true
): Promise<ImportSession> {
  const session = await requireImportSession(sessionId);
  if (session.domain !== 'EXAM')
    throw new ImportStorageError('Phiên nhập không thuộc đề thi.', 400);
  const next: ImportSession = {
    ...session,
    examMetadata: {
      ...metadata,
      normalizedExamCode: normalizeExamCode(metadata.rawExamCode),
      normalizedAnswerCode: normalizeExamCode(metadata.rawAnswerCode),
    },
    currentStep: advance ? 3 : session.currentStep,
    status: advance ? 'READY' : session.status,
  };
  await saveImportSession(next);
  return next;
}

export async function deleteSourcePage(sessionId: string, pageId: string): Promise<ImportSession> {
  const session = await requireImportSession(sessionId);
  const page = session.pages.find((item) => item.id === pageId);
  if (!page) throw new ImportStorageError('Không tìm thấy trang ảnh.', 404);
  if (session.pages.length === 1) {
    throw new ImportStorageError('Phiên nhập phải giữ lại ít nhất một ảnh.', 400);
  }
  await fs.unlink(sourcePageFile(sessionId, page.storedFileName));
  const pages = session.pages
    .filter((item) => item.id !== pageId)
    .map((item, index) => ({ ...item, order: index + 1 }));
  const next = { ...session, pages };
  await saveImportSession(next);
  return next;
}

export async function replaceSourcePage(input: {
  sessionId: string;
  pageId: string;
  file: File;
  width: number;
  height: number;
}): Promise<ImportSession> {
  const session = await requireImportSession(input.sessionId);
  const index = session.pages.findIndex((item) => item.id === input.pageId);
  if (index < 0) throw new ImportStorageError('Không tìm thấy trang ảnh.', 404);
  if (!ACCEPTED_MIME_TYPES.has(input.file.type)) {
    throw new ImportStorageError('Ảnh thay thế phải là JPG, PNG hoặc WEBP.', 415);
  }
  if (input.file.size > MAX_FILE_SIZE) throw new ImportStorageError('Ảnh vượt quá 12 MB.', 413);
  const previous = session.pages[index];
  const bytes = Buffer.from(await input.file.arrayBuffer());
  const checksum = createHash('sha256').update(bytes).digest('hex');
  const storedFileName = `${previous.id}${extensionForMimeType(input.file.type)}`;
  if (storedFileName !== previous.storedFileName) {
    await fs.unlink(sourcePageFile(input.sessionId, previous.storedFileName));
  }
  await fs.writeFile(sourcePageFile(input.sessionId, storedFileName), bytes);
  const page: SourcePage = {
    ...previous,
    originalFileName: input.file.name,
    storedFileName,
    mimeType: input.file.type,
    sizeBytes: input.file.size,
    width: input.width,
    height: input.height,
    checksum,
    rotation: 0,
    crop: undefined,
    warnings: imageWarnings(input.width, input.height),
  };
  const pages = [...session.pages];
  pages[index] = page;
  const next = { ...session, pages };
  await saveImportSession(next);
  return next;
}
