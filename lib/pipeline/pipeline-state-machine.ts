import { PipelineDocument, TextbookPipelineStage } from './types';
import fs from 'fs';
import path from 'path';
import { appendPipelineEvent } from './events';

const UPLOADS_DIR = 'tmp/uploads';

function getDocPath(docId: string): string {
  return path.join(UPLOADS_DIR, docId, 'document.json');
}

export async function loadDoc(docId: string): Promise<PipelineDocument | null> {
  const filePath = getDocPath(docId);
  if (!fs.existsSync(filePath)) return null;
  const raw = await fs.promises.readFile(filePath, 'utf-8');
  return JSON.parse(raw) as PipelineDocument;
}

export async function saveDoc(
  doc: PipelineDocument,
  options: { touchUpdatedAt?: boolean } = {}
): Promise<void> {
  const filePath = getDocPath(doc.id);
  if (options.touchUpdatedAt !== false) {
    doc.updatedAt = new Date().toISOString();
  }
  // Create dir if not exists
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(filePath, JSON.stringify(doc, null, 2), 'utf-8');
}

export const ALLOWED_TRANSITIONS = new Map<TextbookPipelineStage, Set<TextbookPipelineStage>>([
  ['UPLOADED', new Set(['DOCUMENT_ANALYSIS', 'FAILED'])],
  ['DOCUMENT_ANALYSIS', new Set(['TOC_DETECTION', 'FAILED'])],
  ['TOC_DETECTION', new Set(['BATCH_SPLITTING', 'FAILED'])],
  ['BATCH_SPLITTING', new Set(['EXTRACTING', 'FAILED'])],
  ['EXTRACTING', new Set(['MERGING', 'FAILED'])],
  ['MERGING', new Set(['STRUCTURE_VALIDATION', 'FAILED'])],
  ['STRUCTURE_VALIDATION', new Set(['READY_FOR_REVIEW', 'FAILED'])],
  ['READY_FOR_REVIEW', new Set(['PUBLISHED', 'FAILED'])],
  ['PUBLISHED', new Set()],
  [
    'FAILED',
    new Set([
      'UPLOADED',
      'DOCUMENT_ANALYSIS',
      'TOC_DETECTION',
      'BATCH_SPLITTING',
      'EXTRACTING',
      'MERGING',
      'STRUCTURE_VALIDATION',
    ]),
  ],
]);

export async function transitionPipelineStage(params: {
  documentId: string;
  to: TextbookPipelineStage;
  message?: string;
  error?: { stage?: string; code: string; message: string; retryable?: boolean };
}): Promise<PipelineDocument> {
  const doc = await loadDoc(params.documentId);
  if (!doc) throw new Error(`Document ${params.documentId} not found`);

  const allowedTo = ALLOWED_TRANSITIONS.get(doc.state);

  if (!allowedTo?.has(params.to) && doc.state !== params.to) {
    console.warn(
      `[Pipeline] Invalid transition from ${doc.state} to ${params.to} for doc ${params.documentId}. Forcing transition anyway for recovery.`
    );
  }

  const now = new Date().toISOString();
  const previousStage = doc.state;

  if (doc.state !== params.to) {
    doc.state = params.to;
    doc.stageStartedAt = now;
  }

  if (params.error) {
    doc.errorCode = params.error.code;
    doc.errorMessage = params.error.message;
    doc.failedStage = (
      params.error.stage && params.error.stage !== 'BATCH_EXTRACTION'
        ? params.error.stage
        : previousStage
    ) as TextbookPipelineStage;
    doc.failureAt = now;
  } else {
    doc.errorCode = undefined;
    doc.errorMessage = undefined;
    doc.failedStage = undefined;
    doc.failureAt = undefined;
  }

  doc.heartbeatAt = now;
  await saveDoc(doc);

  if (previousStage !== params.to) {
    if (params.to === 'FAILED') {
      await appendPipelineEvent(
        doc.id,
        'STAGE_FAILED',
        doc.failedStage ?? previousStage,
        'FAILED',
        params.message ?? `Stage ${doc.failedStage ?? previousStage} failed`,
        {
          metadata: {
            code: params.error?.code,
            attempt: doc.attempt,
            retryable: params.error?.retryable,
          },
        }
      );
    } else {
      await appendPipelineEvent(
        doc.id,
        'STAGE_COMPLETED',
        previousStage,
        'COMPLETED',
        `Stage ${previousStage} completed`
      );
      await appendPipelineEvent(
        doc.id,
        'STAGE_STARTED',
        params.to,
        'STARTED',
        params.message ?? `Stage ${params.to} started`
      );
    }
  }
  return doc;
}

export async function updateHeartbeat(docId: string): Promise<void> {
  const doc = await loadDoc(docId);
  if (doc && doc.executionStatus === 'RUNNING') {
    doc.heartbeatAt = new Date().toISOString();
    await saveDoc(doc, { touchUpdatedAt: false });
  }
}

export async function markInterruptedIfStale(
  doc: PipelineDocument,
  options: { now?: number; staleAfterMs?: number; hasExecutionLock?: boolean } = {}
): Promise<PipelineDocument> {
  const now = options.now ?? Date.now();
  const staleAfterMs = options.staleAfterMs ?? 120_000;
  const heartbeat = doc.heartbeatAt ? new Date(doc.heartbeatAt).getTime() : 0;
  const stale =
    doc.executionStatus === 'RUNNING' &&
    !options.hasExecutionLock &&
    now - heartbeat > staleAfterMs;

  if (!stale) return doc;

  doc.executionStatus = 'INTERRUPTED';
  await saveDoc(doc);
  await appendPipelineEvent(
    doc.id,
    'PIPELINE_INTERRUPTED',
    doc.state,
    'WARNING',
    `Pipeline interrupted during ${doc.state}`
  );
  return doc;
}
