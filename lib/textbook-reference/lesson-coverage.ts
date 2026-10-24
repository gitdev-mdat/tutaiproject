import type { TextbookArtifact, TextbookKnowledgeMapping, TextbookTocEntry } from './types';

/**
 * Which printed pages a confirmed lesson link covers. A link covers its TOC
 * section (and the subsections below it); the Admin may narrow it to part of
 * the section when two lessons split one section of the book.
 */

export interface PageSpan {
  start: number;
  end: number;
}

/** The section's own range from the outline; null when the outline has no page. */
export function entrySpan(entry: Pick<TextbookTocEntry, 'printedStartPage' | 'printedEndPage'>) {
  if (entry.printedStartPage === null) return null;
  return {
    start: entry.printedStartPage,
    end: Math.max(entry.printedStartPage, entry.printedEndPage ?? entry.printedStartPage),
  } satisfies PageSpan;
}

/** The pages a link really covers: the Admin's narrowed range, else the section's. */
export function mappingSpan(
  mapping: Pick<TextbookKnowledgeMapping, 'printedStartPage' | 'printedEndPage'>,
  entry: Pick<TextbookTocEntry, 'printedStartPage' | 'printedEndPage'> | undefined
): PageSpan | null {
  if (typeof mapping.printedStartPage === 'number') {
    const end =
      typeof mapping.printedEndPage === 'number'
        ? mapping.printedEndPage
        : mapping.printedStartPage;
    return { start: mapping.printedStartPage, end: Math.max(end, mapping.printedStartPage) };
  }
  return entry ? entrySpan(entry) : null;
}

/** Whether a narrowed range stays inside its section; a section without pages accepts any range. */
export function spanFitsEntry(
  span: PageSpan,
  entry: Pick<TextbookTocEntry, 'printedStartPage' | 'printedEndPage'>
): boolean {
  const own = entrySpan(entry);
  if (span.end < span.start) return false;
  return !own || (span.start >= own.start && span.end <= own.end);
}

export function spansOverlap(a: PageSpan, b: PageSpan) {
  return a.start <= b.end && b.start <= a.end;
}

export function formatSpan(span: PageSpan | null) {
  if (!span) return 'chưa rõ trang';
  return span.end !== span.start ? `tr. ${span.start}–${span.end}` : `tr. ${span.start}`;
}

/** The entry and every entry below it in the outline. */
export function entryWithDescendants(entries: TextbookTocEntry[], entryId: string): Set<string> {
  const covered = new Set([entryId]);
  // Outline entries are stored parent-first, but do not rely on it.
  let grew = true;
  while (grew) {
    grew = false;
    for (const candidate of entries)
      if (candidate.parentId && covered.has(candidate.parentId) && !covered.has(candidate.id)) {
        covered.add(candidate.id);
        grew = true;
      }
  }
  return covered;
}

/**
 * The artifacts a lesson may use: extracted under a section the lesson links
 * (directly or as a subsection), and from pages inside the link's range. A
 * narrowed P2 link therefore never picks up what P1 extracted from the same
 * section's other pages.
 */
export function artifactsCoveredByMappings<
  T extends Pick<TextbookArtifact, 'documentId' | 'entryId' | 'printedPages'>,
>(
  artifacts: T[],
  mappings: Array<
    Pick<
      TextbookKnowledgeMapping,
      'documentId' | 'entryId' | 'status' | 'printedStartPage' | 'printedEndPage'
    >
  >,
  tocByDocument: Map<string, TextbookTocEntry[]>
): T[] {
  const scopes = mappings
    .filter((mapping) => mapping.status === 'CONFIRMED')
    .flatMap((mapping) => {
      const entries = tocByDocument.get(mapping.documentId) ?? [];
      const entry = entries.find((item) => item.id === mapping.entryId);
      if (!entry) return [];
      return [
        {
          documentId: mapping.documentId,
          entryIds: entryWithDescendants(entries, entry.id),
          span: mappingSpan(mapping, entry),
        },
      ];
    });
  return artifacts.filter((artifact) =>
    scopes.some(
      (scope) =>
        scope.documentId === artifact.documentId &&
        scope.entryIds.has(artifact.entryId) &&
        // An artifact without page numbers cannot be placed; keep it only for an unbounded link.
        (!scope.span ||
          artifact.printedPages.some(
            (page) => page >= scope.span!.start && page <= scope.span!.end
          ))
    )
  );
}
