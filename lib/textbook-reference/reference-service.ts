import 'server-only';

import { createHash } from 'node:crypto';
import {
  approvedArtifactsForNode,
  durableTextbookBackendConfigured,
  listTextbookDocuments,
} from './repository';
import type { ExtractedArtifactKind, TextbookArtifact } from './types';

/** Returns only human-approved artifacts explicitly mapped to the requested node. */
export function approvedReferencesForNode<
  T extends Pick<TextbookArtifact, 'documentId' | 'entryId' | 'reviewStatus'>,
>(
  artifacts: T[],
  mappings: Array<{
    documentId: string;
    entryId: string;
    knowledgeNodeId: string;
    status: string;
  }>,
  knowledgeNodeId: string
): T[] {
  const approvedPairs = new Set(
    mappings
      .filter(
        (mapping) => mapping.knowledgeNodeId === knowledgeNodeId && mapping.status === 'CONFIRMED'
      )
      .map((mapping) => `${mapping.documentId}\0${mapping.entryId}`)
  );
  return artifacts.filter(
    (artifact) =>
      artifact.reviewStatus === 'APPROVED' &&
      approvedPairs.has(`${artifact.documentId}\0${artifact.entryId}`)
  );
}

/** What a lesson draft may quote from: approved, bounded, with its source. */
export interface LessonReference {
  artifactId: string;
  documentId: string;
  entryId: string;
  /** SHA-256 of the full approved text, so a draft can be traced to this exact version. */
  contentSha256: string;
  kind: ExtractedArtifactKind;
  title: string;
  content: string;
  documentTitle: string;
  printedPages: number[];
  truncated: boolean;
}

export const REFERENCE_LIMITS = { items: 6, itemChars: 1500, totalChars: 6000 } as const;

const KIND_ORDER: ExtractedArtifactKind[] = [
  'THEORY',
  'METHOD',
  'WORKED_EXAMPLE',
  'EXERCISE',
  'SOLUTION',
];

/**
 * Picks the approved material a draft is grounded on: theory and method first,
 * then examples, then exercise/solution pairs, within fixed size limits so the
 * prompt never carries whole pages.
 */
export function selectLessonReferences(
  artifacts: TextbookArtifact[],
  documentTitles: Map<string, string>
): LessonReference[] {
  const byId = new Map(artifacts.map((artifact) => [artifact.id, artifact]));
  const ordered = [...artifacts]
    // An exercise without its approved solution teaches nothing reliable; skip it.
    .filter(
      (artifact) =>
        artifact.kind !== 'EXERCISE' ||
        !artifact.pairedArtifactId ||
        byId.has(artifact.pairedArtifactId)
    )
    .sort(
      (a, b) =>
        KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
        (a.printedPages[0] ?? 0) - (b.printedPages[0] ?? 0)
    );
  const selected: LessonReference[] = [];
  let total = 0;
  for (const artifact of ordered) {
    if (selected.length >= REFERENCE_LIMITS.items) break;
    const room = Math.min(REFERENCE_LIMITS.itemChars, REFERENCE_LIMITS.totalChars - total);
    if (room < 200) break;
    const content = artifact.content.trim();
    const truncated = content.length > room;
    const text = truncated ? `${content.slice(0, room).replace(/\s+\S*$/, '')} …` : content;
    total += text.length;
    selected.push({
      artifactId: artifact.id,
      documentId: artifact.documentId,
      entryId: artifact.entryId,
      contentSha256: createHash('sha256').update(artifact.content).digest('hex'),
      kind: artifact.kind,
      title: artifact.title,
      content: text,
      documentTitle: documentTitles.get(artifact.documentId) ?? 'Sách tham khảo',
      printedPages: artifact.printedPages,
      truncated,
    });
  }
  return selected;
}

/** Approved references for a Knowledge Tree node; empty when the backend is not configured. */
export async function lessonReferencesForNode(knowledgeNodeId: string): Promise<{
  configured: boolean;
  approvedCount: number;
  references: LessonReference[];
}> {
  if (!durableTextbookBackendConfigured())
    return { configured: false, approvedCount: 0, references: [] };
  const artifacts = await approvedArtifactsForNode(knowledgeNodeId);
  if (!artifacts.length) return { configured: true, approvedCount: 0, references: [] };
  const titles = new Map(
    (await listTextbookDocuments()).map((document) => [document.id, document.title])
  );
  return {
    configured: true,
    approvedCount: artifacts.length,
    references: selectLessonReferences(artifacts, titles),
  };
}
