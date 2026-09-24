import fs from 'fs/promises';
import path from 'path';
import {
  PipelineEvent,
  PipelineEventStatus,
  PipelineEventType,
  TextbookPipelineStage,
} from './types';
import { v4 as uuidv4 } from 'uuid';

const UPLOADS_DIR = 'tmp/uploads';

function getEventsPath(docId: string): string {
  return path.join(UPLOADS_DIR, docId, 'events.json');
}

function hasErrorCode(error: unknown): error is { code: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code?: unknown }).code === 'string'
  );
}

export async function appendPipelineEvent(
  pipelineDocumentId: string,
  type: PipelineEventType,
  stage: TextbookPipelineStage,
  status: PipelineEventStatus,
  message: string,
  extra?: {
    progress?: number;
    batchIndex?: number;
    batchCount?: number;
    metadata?: Record<string, unknown>;
  }
): Promise<PipelineEvent> {
  const filePath = getEventsPath(pipelineDocumentId);
  const event: PipelineEvent = {
    id: uuidv4(),
    pipelineDocumentId,
    type,
    stage,
    status,
    message,
    ...extra,
    createdAt: new Date().toISOString(),
  };

  try {
    let events: PipelineEvent[] = [];
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      events = JSON.parse(raw);
    } catch (err: unknown) {
      if (!hasErrorCode(err) || err.code !== 'ENOENT') {
        console.error(`Failed to read events file for doc ${pipelineDocumentId}`, err);
      }
    }

    events.push(event);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(events, null, 2), 'utf-8');
  } catch (err) {
    console.error(`Failed to append pipeline event for doc ${pipelineDocumentId}`, err);
  }

  return event;
}

export async function getPipelineEvents(
  pipelineDocumentId: string,
  afterEventId?: string
): Promise<PipelineEvent[]> {
  const filePath = getEventsPath(pipelineDocumentId);
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const events: PipelineEvent[] = JSON.parse(raw);
    if (!afterEventId) return events;

    const cursorIndex = events.findIndex((event) => event.id === afterEventId);
    if (cursorIndex >= 0) return events.slice(cursorIndex + 1);

    // Compatibility with pre-4.1.3 timestamp cursors.
    return events.filter((event) => event.createdAt > afterEventId);
  } catch (err: unknown) {
    if (!hasErrorCode(err) || err.code !== 'ENOENT') {
      console.error(`Failed to read events file for doc ${pipelineDocumentId}`, err);
    }
    return [];
  }
}
