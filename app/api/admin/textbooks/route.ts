import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminApiGuard } from '@/lib/auth/admin';
import { queueTextbookExtraction } from '@/lib/textbook-reference/extraction-service';
import { readTextbookStore, writeTextbookStore } from '@/lib/textbook-reference/repository';
import { normalizedHeading } from '@/lib/textbook-reference/page-mapping';

const mutation = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('confirm-mapping'),
    documentId: z.string(),
    entryId: z.string(),
    knowledgeNodeId: z.string(),
  }),
  z.object({
    action: z.literal('review-artifact'),
    artifactId: z.string(),
    decision: z.enum(['approve', 'reject']),
  }),
  z.object({
    action: z.literal('extract'),
    documentId: z.string(),
    entryIds: z.array(z.string()).min(1),
    knowledgeNodeId: z.string(),
    printedPages: z.array(z.number().int().positive()).min(1).max(6),
  }),
]);

export async function GET(request: Request) {
  const denied = await adminApiGuard();
  if (denied) return denied;
  const store = await readTextbookStore();
  const url = new URL(request.url);
  const query = url.searchParams.get('q');
  const tree = JSON.parse(
    await (await import('node:fs/promises')).readFile('data/knowledge-tree/tree.json', 'utf8')
  ) as { nodes: Array<{ id: string; title: string; parentId: string | null }> };
  const documents = store.documents.map((document) => ({
    ...document,
    tocEntries: document.tocEntries.filter(
      (entry) =>
        !query || normalizedHeading(entry.originalHeading).includes(normalizedHeading(query))
    ),
  }));
  const candidates = store.documents.flatMap((document) =>
    document.tocEntries
      .filter(
        (entry) =>
          !query || normalizedHeading(entry.originalHeading).includes(normalizedHeading(query))
      )
      .map((entry) => {
        const relatedTitles = new Set([
          entry.normalizedHeading,
          ...document.tocEntries
            .filter((parent) => entry.parentId === parent.id)
            .map((parent) => parent.normalizedHeading),
        ]);
        const terms = new Set(
          [...relatedTitles]
            .join(' ')
            .split(/[^\p{L}\p{N}]+/u)
            .filter((term) => term.length > 2)
        );
        return {
          documentId: document.id,
          entryId: entry.id,
          entryHeading: entry.originalHeading,
          candidates: tree.nodes
            .map((node) => {
              const nodeTerms = new Set(
                normalizedHeading(node.title)
                  .split(/[^\p{L}\p{N}]+/u)
                  .filter((term) => term.length > 2)
              );
              const overlap = [...terms].filter((term) => nodeTerms.has(term)).length;
              const exact = normalizedHeading(node.title) === entry.normalizedHeading;
              const confidence = exact ? 1 : terms.size ? overlap / terms.size : 0;
              return {
                knowledgeNodeId: node.id,
                title: node.title,
                confidence,
                status: exact ? 'EXACT_CANDIDATE' : 'CANDIDATE',
                confirmationRequired: true,
              };
            })
            .filter((candidate) => candidate.confidence > 0)
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, 5),
        };
      })
  );
  const mappings = store.mappings.map((mapping) => ({
    ...mapping,
    knowledgeNodeTitle:
      tree.nodes.find((node) => node.id === mapping.knowledgeNodeId)?.title ?? null,
  }));
  const nodeId = url.searchParams.get('nodeId');
  const approvedOnly = url.searchParams.get('approvedOnly') === 'true';
  const artifacts = store.artifacts.filter(
    (artifact) =>
      (!nodeId ||
        store.mappings.some(
          (mapping) =>
            mapping.documentId === artifact.documentId &&
            mapping.entryId === artifact.entryId &&
            mapping.knowledgeNodeId === nodeId &&
            mapping.status === 'CONFIRMED'
        )) &&
      (!approvedOnly || artifact.reviewStatus === 'APPROVED')
  );
  return NextResponse.json({ documents, jobs: store.jobs, artifacts, mappings, candidates });
}

export async function POST(request: Request) {
  const denied = await adminApiGuard();
  if (denied) return denied;
  if (
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL === '1' ||
    process.env.VERCEL_ENV === 'production'
  ) {
    return NextResponse.json(
      {
        error:
          'Textbook filesystem storage is local-only and is disabled on Production deployments.',
      },
      { status: 503 }
    );
  }
  const parsed = mutation.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: 'Invalid request.', details: parsed.error.flatten() },
      { status: 400 }
    );
  const input = parsed.data;
  try {
    const store = await readTextbookStore();
    if (input.action === 'confirm-mapping') {
      const document = store.documents.find((item) => item.id === input.documentId);
      if (!document || !document.tocEntries.some((entry) => entry.id === input.entryId))
        return NextResponse.json(
          { error: 'Document or outline entry not found.' },
          { status: 404 }
        );
      const tree = JSON.parse(
        await (await import('node:fs/promises')).readFile('data/knowledge-tree/tree.json', 'utf8')
      ) as { nodes: Array<{ id: string; title: string }> };
      if (!tree.nodes.some((node) => node.id === input.knowledgeNodeId))
        return NextResponse.json({ error: 'Knowledge Tree node not found.' }, { status: 404 });
      const now = new Date().toISOString();
      const mapping = {
        id: `map-${input.documentId}-${input.entryId}-${input.knowledgeNodeId}`,
        documentId: input.documentId,
        entryId: input.entryId,
        knowledgeNodeId: input.knowledgeNodeId,
        confidence: 1,
        status: 'CONFIRMED' as const,
        confirmationRequired: false,
        updatedAt: now,
      };
      store.mappings = store.mappings.filter((item) => item.id !== mapping.id).concat(mapping);
      await writeTextbookStore(store);
      return NextResponse.json({
        mapping,
        knowledgeNodeTitle: tree.nodes.find((node) => node.id === input.knowledgeNodeId)?.title,
      });
    }
    if (input.action === 'review-artifact') {
      const artifact = store.artifacts.find((item) => item.id === input.artifactId);
      if (!artifact) return NextResponse.json({ error: 'Artifact not found.' }, { status: 404 });
      artifact.reviewStatus = input.decision === 'approve' ? 'APPROVED' : 'REJECTED';
      await writeTextbookStore(store);
      return NextResponse.json({ artifact });
    }
    const result = await queueTextbookExtraction(input);
    return NextResponse.json(result, { status: result.cacheHit ? 200 : 202 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Textbook operation failed.' },
      { status: 422 }
    );
  }
}
