import 'server-only';

import { getSql } from '@/lib/db/postgres';
import type { AiDraftBlockType, LessonDraftMode } from './ai-lesson-draft';

/**
 * What was really sent to the model for one draft, kept so the Admin can later
 * see which approved textbook extracts a lesson draft was written from. Ids,
 * pages and hashes only: no textbook text and no draft text is stored.
 */
export interface DraftReferenceProvenance {
  artifactId: string;
  documentId: string;
  entryId: string;
  kind: string;
  title: string;
  documentTitle: string;
  printedPages: number[];
  /** SHA-256 of the approved extract's full text at generation time. */
  contentSha256: string;
  /** Characters of the extract placed in the prompt (after the size limit). */
  sentChars: number;
  truncated: boolean;
  /** Checked against the exact prompt string handed to the provider. */
  includedInPrompt: boolean;
}

export type DraftGenerationStatus = 'PROPOSED' | 'APPLIED' | 'SAVED';

export interface DraftGeneration {
  id: string;
  knowledgeNodeId: string;
  mode: LessonDraftMode;
  status: DraftGenerationStatus;
  createdAt: string;
  model: string;
  promptVersion: string;
  promptSha256: string;
  promptChars: number;
  references: DraftReferenceProvenance[];
  appliedBlocks?: AiDraftBlockType[];
  appliedAt?: string;
  savedAt?: string;
}

type Env = Record<string, string | undefined>;

/** Provenance needs PostgreSQL; local JSON-only setups draft without a history. */
export function draftProvenanceAvailable(env: Env = process.env) {
  return Boolean(env.DATABASE_URL);
}

type Payload = Omit<DraftGeneration, 'id' | 'knowledgeNodeId' | 'mode' | 'status' | 'createdAt'>;

function toGeneration(row: Record<string, unknown>): DraftGeneration {
  return {
    ...(row.payload as Payload),
    id: row.id as string,
    knowledgeNodeId: row.knowledge_node_id as string,
    mode: row.mode as LessonDraftMode,
    status: row.status as DraftGenerationStatus,
    createdAt: new Date(row.created_at as string).toISOString(),
  };
}

export async function recordDraftGeneration(
  generation: DraftGeneration,
  createdBy: string
): Promise<void> {
  const { id, knowledgeNodeId, mode, status, createdAt, ...payload } = generation;
  await getSql()`
    insert into tutai.lesson_draft_generations
      (id, knowledge_node_id, mode, status, created_by, created_at, payload)
    values (${id}, ${knowledgeNodeId}, ${mode}, ${status}, ${createdBy}, ${createdAt},
      ${getSql().json(payload as never)})`;
}

export async function listDraftGenerations(
  knowledgeNodeId: string,
  limit = 5
): Promise<DraftGeneration[]> {
  const rows = await getSql()`
    select * from tutai.lesson_draft_generations
    where knowledge_node_id = ${knowledgeNodeId}
    order by created_at desc
    limit ${limit}`;
  return rows.map(toGeneration);
}

const ORDER: DraftGenerationStatus[] = ['PROPOSED', 'APPLIED', 'SAVED'];

/**
 * Moves a draft forward (applied to the editor, then saved with the lesson).
 * Never backwards, and only for the lesson it was generated for.
 */
export async function advanceDraftGeneration(
  knowledgeNodeId: string,
  id: string,
  status: Exclude<DraftGenerationStatus, 'PROPOSED'>,
  blocks?: AiDraftBlockType[]
): Promise<DraftGeneration | null> {
  const allowed = ORDER.slice(0, ORDER.indexOf(status));
  const now = new Date().toISOString();
  const patch =
    status === 'APPLIED' ? { appliedAt: now, appliedBlocks: blocks ?? [] } : { savedAt: now };
  const [row] = await getSql()`
    update tutai.lesson_draft_generations set
      status = ${status},
      payload = payload || ${getSql().json(patch as never)},
      updated_at = now()
    where id = ${id} and knowledge_node_id = ${knowledgeNodeId} and status in ${getSql()(allowed)}
    returning *`;
  return row ? toGeneration(row) : null;
}
