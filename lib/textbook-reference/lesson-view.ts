import 'server-only';

import { readKnowledgeTree } from '@/lib/knowledge-tree/knowledge-tree-storage';
import { artifactsCoveredByMappings, entryWithDescendants, mappingSpan } from './lesson-coverage';
import { curriculumOrder, recommendSections } from './recommendations';
import {
  listTextbookArtifacts,
  listTextbookDocuments,
  listTextbookJobs,
  listTextbookMappings,
} from './repository';
import { sectionState, type SectionState } from './section-state';
import type {
  TextbookArtifact,
  TextbookDocumentRecord,
  TextbookExtractionJob,
  TextbookKnowledgeMapping,
  TextbookTocEntry,
} from './types';

/** One lesson's textbook side: linked sections with their real state, and suggestions. */
export interface LessonTextbookSection {
  mapping: TextbookKnowledgeMapping;
  document: Omit<TextbookDocumentRecord, 'tocEntries'> & { tocEntryCount: number };
  entry: TextbookTocEntry;
  subsections: TextbookTocEntry[];
  /** Artifacts extracted under this section, inside the link's pages. */
  artifacts: TextbookArtifact[];
  /** Extraction jobs of this lesson for this section, newest first. */
  jobs: TextbookExtractionJob[];
  state: SectionState;
}

/** Counts behind the "ready for AI" summary in the editor and the AI panel. */
export interface LessonTextbookReadiness {
  linkedSections: number;
  approved: number;
  needsReview: number;
  activeJobs: number;
  failedSections: number;
  /** Linked sections with no extracted page yet. */
  notExtracted: number;
}

export function readinessOf(sections: Pick<LessonTextbookSection, 'state'>[]) {
  return {
    linkedSections: sections.length,
    approved: sections.reduce((sum, section) => sum + section.state.approved, 0),
    needsReview: sections.reduce((sum, section) => sum + section.state.needsReview, 0),
    activeJobs: sections.filter((section) => section.state.activeJob).length,
    failedSections: sections.filter((section) => section.state.key === 'FAILED').length,
    notExtracted: sections.filter((section) => section.state.key === 'LINKED').length,
  } satisfies LessonTextbookReadiness;
}

const summary = ({ tocEntries, ...document }: TextbookDocumentRecord) => ({
  ...document,
  tocEntryCount: tocEntries.length,
});

export async function loadLessonTextbook(nodeId: string) {
  const tree = await readKnowledgeTree();
  const node = tree.nodes.find((item) => item.id === nodeId);
  if (!node) return null;
  const documents = await listTextbookDocuments({ withToc: true });
  const indexed = documents.filter((document) => document.status === 'INDEXED');
  const allMappings = (
    await Promise.all(indexed.map((document) => listTextbookMappings({ documentId: document.id })))
  ).flat();
  const mine = allMappings.filter((mapping) => mapping.knowledgeNodeId === nodeId);
  const confirmed = mine.filter((mapping) => mapping.status === 'CONFIRMED');
  const linkedDocumentIds = [...new Set(confirmed.map((mapping) => mapping.documentId))];
  const [artifacts, jobs] = await Promise.all([
    Promise.all(linkedDocumentIds.map((id) => listTextbookArtifacts({ documentId: id }))).then(
      (lists) => lists.flat()
    ),
    Promise.all(
      linkedDocumentIds.map((id) => listTextbookJobs({ documentId: id, limit: 50 }))
    ).then((lists) =>
      lists
        .flat()
        .filter((job) => job.knowledgeNodeId === nodeId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    ),
  ]);
  const byDocument = new Map(documents.map((document) => [document.id, document]));
  const tocByDocument = new Map(documents.map((document) => [document.id, document.tocEntries]));
  const sections: LessonTextbookSection[] = confirmed.flatMap((mapping) => {
    const document = byDocument.get(mapping.documentId);
    const entry = document?.tocEntries.find((item) => item.id === mapping.entryId);
    if (!document || !entry) return [];
    const covered = entryWithDescendants(document.tocEntries, entry.id);
    const sectionArtifacts = artifactsCoveredByMappings(
      artifacts.filter((artifact) => artifact.documentId === document.id),
      [mapping],
      tocByDocument
    );
    const sectionJobs = jobs.filter(
      (job) =>
        job.documentId === document.id &&
        job.kind === 'EXTRACT' &&
        job.entryIds.some((id) => covered.has(id))
    );
    return [
      {
        mapping,
        document: summary(document),
        entry,
        subsections: document.tocEntries.filter(
          (item) => item.id !== entry.id && covered.has(item.id)
        ),
        artifacts: sectionArtifacts,
        jobs: sectionJobs,
        state: sectionState({
          documentId: document.id,
          mapping,
          entry,
          tocEntries: document.tocEntries,
          artifacts: sectionArtifacts,
          jobs: sectionJobs,
        }),
      },
    ];
  });
  // Sections in book order, so the lesson reads like the book.
  sections.sort(
    (a, b) =>
      a.document.title.localeCompare(b.document.title) ||
      (mappingSpan(a.mapping, a.entry)?.start ?? 0) - (mappingSpan(b.mapping, b.entry)?.start ?? 0)
  );
  const { recommendations, coverage } = recommendSections({
    lesson: { id: node.id, title: node.title },
    curriculum: curriculumOrder(tree.nodes, node.id),
    documents: indexed.map((document) => ({
      id: document.id,
      title: document.title,
      tocEntries: document.tocEntries,
    })),
    mappings: allMappings,
  });
  const titles = new Map(tree.nodes.map((item) => [item.id, item.title]));
  return {
    node: { id: node.id, title: node.title },
    sections,
    jobs,
    readiness: readinessOf(sections),
    recommendations,
    coverage,
    /** Which other lessons use each section of the linked books (for "also used by"). */
    otherLinks: allMappings
      .filter((mapping) => mapping.status === 'CONFIRMED' && mapping.knowledgeNodeId !== nodeId)
      .map((mapping) => ({
        documentId: mapping.documentId,
        entryId: mapping.entryId,
        knowledgeNodeId: mapping.knowledgeNodeId,
        title: titles.get(mapping.knowledgeNodeId) ?? null,
        span: mappingSpan(
          mapping,
          byDocument.get(mapping.documentId)?.tocEntries.find((e) => e.id === mapping.entryId)
        ),
      })),
    documents: indexed.map((document) => ({
      ...summary(document),
      tocEntries: document.tocEntries,
    })),
  };
}

export type LessonTextbookView = NonNullable<Awaited<ReturnType<typeof loadLessonTextbook>>>;
