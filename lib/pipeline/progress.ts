import type { PipelineDocument, PipelineExecutionStatus, PipelineProgress } from './types';

export function normalizeExecutionStatus(doc: PipelineDocument): PipelineExecutionStatus {
  if (doc.executionStatus) return doc.executionStatus;
  if (doc.state === 'UPLOADED') return 'NOT_STARTED';
  if (doc.state === 'READY_FOR_REVIEW' || doc.state === 'PUBLISHED') return 'COMPLETED';
  if (doc.state === 'FAILED') return 'FAILED';
  return 'INTERRUPTED';
}

export function computePipelineProgress(doc: PipelineDocument): PipelineProgress {
  const doneBatches = (doc.batches || []).filter((batch) => batch.state === 'DONE').length;
  const totalBatches = (doc.batches || []).length;
  const extraction = totalBatches === 0 ? 0 : Math.round((doneBatches / totalBatches) * 100);

  let upload = 100;
  let analysis = 0;
  let merge = 0;
  let validation = 0;

  switch (doc.state) {
    case 'UPLOADED':
      break;
    case 'DOCUMENT_ANALYSIS':
      analysis = 25;
      break;
    case 'TOC_DETECTION':
    case 'STRUCTURE_DETECTION':
      analysis = 50;
      break;
    case 'BATCH_SPLITTING':
      analysis = 75;
      break;
    case 'BATCH_EXTRACTION':
    case 'EXTRACTING':
      analysis = 100;
      break;
    case 'MERGING':
      analysis = 100;
      merge = 50;
      break;
    case 'STRUCTURE_VALIDATION':
      analysis = 100;
      merge = 100;
      validation = 50;
      break;
    case 'READY_FOR_REVIEW':
    case 'PUBLISHED':
      analysis = 100;
      merge = 100;
      validation = 100;
      break;
    case 'FAILED':
      upload = doc.failedStage === 'UPLOADED' ? 0 : 100;
      break;
  }

  const overall =
    doc.state === 'READY_FOR_REVIEW' || doc.state === 'PUBLISHED'
      ? 100
      : Math.round(
          upload * 0.1 + analysis * 0.2 + extraction * 0.5 + merge * 0.1 + validation * 0.1
        );

  return { upload, analysis, extraction, merge, validation, overall };
}
