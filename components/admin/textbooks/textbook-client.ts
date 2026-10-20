'use client';

import { tusUpload } from '@/lib/textbook-reference/tus-upload';
import type {
  PageLayout,
  TextbookAnchor,
  TextbookArtifact,
  TextbookDocumentRecord,
  TextbookExtractionJob,
  TextbookKnowledgeMapping,
  TextbookTocEntry,
  TextbookWorkerStatus,
} from '@/lib/textbook-reference/types';

export type DocumentSummary = Omit<TextbookDocumentRecord, 'tocEntries'> & {
  tocEntryCount: number;
};

export type ApiResult<T> =
  { ok: true; data: T } | { ok: false; status: number; error: string; missing?: string[] };

export interface LibraryView {
  worker: TextbookWorkerStatus;
  documents: DocumentSummary[];
}

export interface DocumentView {
  worker: TextbookWorkerStatus;
  document: TextbookDocumentRecord;
  jobs: TextbookExtractionJob[];
  artifacts: TextbookArtifact[];
  mappings: Array<TextbookKnowledgeMapping & { knowledgeNodeTitle: string | null }>;
}

export interface LessonSection {
  mapping: TextbookKnowledgeMapping;
  document: DocumentSummary;
  entry: TextbookTocEntry;
  subsections: TextbookTocEntry[];
  artifacts: TextbookArtifact[];
}

export interface LessonView {
  worker: TextbookWorkerStatus;
  node: { id: string; title: string };
  sections: LessonSection[];
  jobs: TextbookExtractionJob[];
  approvedCount: number;
  documents: Array<DocumentSummary & { tocEntries: TextbookTocEntry[] }>;
  suggestions: Array<{
    documentId: string;
    documentTitle: string;
    entry: TextbookTocEntry;
    score: number;
  }>;
}

const ENDPOINT = '/api/admin/textbooks';

async function call<T>(init?: RequestInit, query = ''): Promise<ApiResult<T>> {
  try {
    const response = await fetch(`${ENDPOINT}${query}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
      cache: 'no-store',
    });
    const body = (await response.json().catch(() => ({}))) as T & {
      error?: string;
      missing?: string[];
    };
    if (!response.ok)
      return {
        ok: false,
        status: response.status,
        error: body.error ?? 'Không kết nối được máy chủ.',
        missing: body.missing,
      };
    return { ok: true, data: body };
  } catch {
    return {
      ok: false,
      status: 0,
      error: 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.',
    };
  }
}

const post = <T>(body: Record<string, unknown>) =>
  call<T>({ method: 'POST', body: JSON.stringify(body) });

export const textbookApi = {
  library: () => call<LibraryView>(),
  document: (documentId: string) =>
    call<DocumentView>(undefined, `?documentId=${encodeURIComponent(documentId)}`),
  lesson: (nodeId: string) => call<LessonView>(undefined, `?nodeId=${encodeURIComponent(nodeId)}`),
  pageSetup: (input: {
    documentId: string;
    layout: PageLayout;
    anchors: TextbookAnchor[];
    tocPdfPages: number[];
  }) => post<{ document: TextbookDocumentRecord }>({ action: 'page-setup', ...input }),
  indexToc: (documentId: string) =>
    post<{ job: TextbookExtractionJob }>({ action: 'index-toc', documentId }),
  link: (documentId: string, entryId: string, knowledgeNodeId: string) =>
    post({ action: 'confirm-mapping', documentId, entryId, knowledgeNodeId }),
  unlink: (documentId: string, entryId: string, knowledgeNodeId: string) =>
    post({ action: 'remove-mapping', documentId, entryId, knowledgeNodeId }),
  extract: (input: {
    documentId: string;
    entryIds: string[];
    knowledgeNodeId: string;
    printedPages: number[];
  }) =>
    post<{
      job: TextbookExtractionJob;
      cacheHit: boolean;
      existing: boolean;
      worker: TextbookWorkerStatus;
    }>({
      action: 'extract',
      ...input,
    }),
  cancelJob: (jobId: string) => post({ action: 'cancel-job', jobId }),
  review: (artifactId: string, decision: 'approve' | 'reject' | 'reopen') =>
    post<{ artifact: TextbookArtifact }>({ action: 'review-artifact', artifactId, decision }),
  edit: (artifactId: string, title: string, content: string) =>
    post<{ artifact: TextbookArtifact }>({ action: 'edit-artifact', artifactId, title, content }),
};

async function sha256Hex(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

const resumeKey = (sha: string) => `tutai.textbook-upload.${sha}`;
const storage = {
  get: (key: string) => {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set: (key: string, value: string) => {
    try {
      window.localStorage.setItem(key, value);
    } catch {}
  },
  remove: (key: string) => {
    try {
      window.localStorage.removeItem(key);
    } catch {}
  },
};

export type UploadPhase =
  | { kind: 'hashing' }
  | { kind: 'uploading'; uploaded: number; total: number; resumed: boolean }
  | { kind: 'finishing' };

export type UploadOutcome =
  | { kind: 'uploaded'; document: TextbookDocumentRecord }
  | { kind: 'duplicate'; document: TextbookDocumentRecord };

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/**
 * Hashes the file, asks the server for a one-object upload token (or learns the
 * book is already in the library), uploads straight to private Storage in 6 MB
 * resumable chunks and registers the book. Reloading and choosing the same file
 * resumes where Storage stopped.
 */
export async function uploadTextbook(
  file: File,
  onPhase: (phase: UploadPhase) => void,
  signal: AbortSignal
): Promise<UploadOutcome> {
  if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf')
    throw new Error('Chỉ nhận tệp PDF.');
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('Tệp lớn hơn 50 MB.');
  onPhase({ kind: 'hashing' });
  const sha256 = await sha256Hex(file);
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
  type Init =
    | { kind: 'duplicate' | 'registered'; document: TextbookDocumentRecord }
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
  const init = await post<Init>({
    action: 'upload-init',
    sha256,
    byteSize: file.size,
    filename: file.name,
    title: file.name.replace(/\.pdf$/i, ''),
  });
  if (!init.ok) throw new Error(init.error);
  const started = init.data;
  if (started.kind !== 'upload')
    return {
      kind: started.kind === 'duplicate' ? 'duplicate' : 'uploaded',
      document: started.document,
    };
  const { uploadId, tus, publishableKey } = started;
  const resumeUrl = storage.get(resumeKey(sha256));
  try {
    await tusUpload({ ...tus, publishableKey }, file, {
      signal,
      resumeUrl,
      onUploadUrl: (url) => storage.set(resumeKey(sha256), url),
      onProgress: (uploaded, total) =>
        onPhase({
          kind: 'uploading',
          uploaded,
          total,
          resumed: Boolean(resumeUrl) && uploaded > 0,
        }),
    });
  } catch (error) {
    if (signal.aborted) {
      await post({ action: 'upload-cancel', uploadId });
      storage.remove(resumeKey(sha256));
    }
    throw error;
  }
  onPhase({ kind: 'finishing' });
  const done = await post<{ document: TextbookDocumentRecord; duplicate: boolean }>({
    action: 'upload-complete',
    uploadId,
  });
  if (!done.ok) throw new Error(done.error);
  storage.remove(resumeKey(sha256));
  return { kind: 'uploaded', document: done.data.document };
}
