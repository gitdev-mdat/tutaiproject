import 'server-only';

import { requireAdmin } from '@/lib/auth/admin';
import { readTextbookStore } from './repository';
import type { TextbookArtifact } from './types';

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

export async function retrieveApprovedTextbookReferences(
  knowledgeNodeId: string
): Promise<TextbookArtifact[]> {
  await requireAdmin();
  const store = await readTextbookStore();
  return approvedReferencesForNode(store.artifacts, store.mappings, knowledgeNodeId);
}
