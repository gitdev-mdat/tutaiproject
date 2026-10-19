import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminApiGuard } from '@/lib/auth/admin';
import { queueTextbookExtraction } from '@/lib/textbook-reference/extraction-service';
import {
  durableTextbookBackendConfigured,
  readTextbookStore,
  writeTextbookStore,
} from '@/lib/textbook-reference/repository';
import { readKnowledgeTree } from '@/lib/knowledge-tree/knowledge-tree-storage';
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
  if (isProduction() && !durableTextbookBackendConfigured()) return unavailable();
  try {
    const store = await readTextbookStore();
    const url = new URL(request.url);
    const query = url.searchParams.get('q');
    const tree = await readKnowledgeTree();
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
  } catch {
    return NextResponse.json({ error: 'Textbook backend operation failed.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const denied = await adminApiGuard();
  if (denied) return denied;
  if (isProduction() && !durableTextbookBackendConfigured()) return unavailable();
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
      const tree = await readKnowledgeTree();
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
    const message = error instanceof Error ? error.message : '';
    const missing =
      /not found|unknown table-of-contents entry|unknown node|artifact not found/i.test(message);
    const invalid =
      /Choose between|outside the selected|uncertain PDF|confirmed Knowledge Tree mapping/i.test(
        message
      );
    return NextResponse.json(
      {
        error: missing || invalid ? message : 'Textbook backend operation failed.',
      },
      { status: missing ? 404 : invalid ? 422 : 500 }
    );
  }
}

function isProduction() {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL === '1' ||
    process.env.VERCEL_ENV === 'production'
  );
}

function unavailable() {
  return NextResponse.json(
    {
      error:
        'Durable textbook storage is not configured (PostgreSQL and private Supabase Storage).',
    },
    { status: 503 }
  );
}
