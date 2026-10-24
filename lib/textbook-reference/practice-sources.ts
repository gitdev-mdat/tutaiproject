import { exerciseSetFor, problemTypeOf } from './extraction-response';
import { entrySpan, entryWithDescendants, mappingSpan, type PageSpan } from './lesson-coverage';
import type {
  TextbookArtifact,
  TextbookDocumentRecord,
  TextbookKnowledgeMapping,
  TextbookTocEntry,
} from './types';

/**
 * Where a lesson's practice comes from in a book, read from the table of
 * contents rather than from page numbers or keywords alone: the exercise sets
 * of the chapters the lesson is linked to, the "Hướng dẫn giải" sections that
 * hold their solutions, and which lesson each set belongs to.
 *
 * These sections are practice sources, not lesson references: they are never
 * shown in the theory view and never reach AI drafting through this module.
 */

/** Solutions are this many pages per extraction: dense pages, long answers. */
export const SOLUTION_PAGES_PER_REQUEST = 3;

const SOLUTION_HEADING = /hướng dẫn giải|lời giải|đáp án|giải chi tiết/iu;
const EXERCISE_HEADING = /bài tập|luyện tập|rèn luyện|tự luyện|câu hỏi trắc nghiệm/iu;

export function isSolutionSection(entry: Pick<TextbookTocEntry, 'originalHeading'>) {
  return SOLUTION_HEADING.test(entry.originalHeading);
}

/** The level-2 entry ("I.I. Tính đơn điệu của hàm số") that scopes an entry. */
export function chapterOf(entry: TextbookTocEntry, entries: TextbookTocEntry[]) {
  let chapter: TextbookTocEntry | undefined = entry;
  while (chapter && chapter.level > 2)
    chapter = entries.find((candidate) => candidate.id === chapter?.parentId);
  return chapter && chapter.level <= 2 ? chapter : null;
}

const isLeaf = (entry: TextbookTocEntry, entries: TextbookTocEntry[]) =>
  !entries.some((candidate) => candidate.parentId === entry.id);

export interface LessonSuggestion {
  lessonId: string;
  /** DIRECT: the set itself is linked. PROBLEM_TYPE: its "Dạng n" section is. PAGE_RANGE: a link's pages contain it. */
  via: 'DIRECT' | 'PROBLEM_TYPE' | 'PAGE_RANGE';
  reason: string;
}

export interface SolutionSource {
  entry: TextbookTocEntry;
  span: PageSpan;
  /** Bounded page groups to extract, in order; each is one request. */
  chunks: number[][];
  reason: string;
}

export interface PracticeSet {
  documentId: string;
  entry: TextbookTocEntry;
  chapter: TextbookTocEntry | null;
  problemType: string | null;
  span: PageSpan | null;
  exerciseIds: string[];
  /** Null: the outline and links do not say which lesson; the Admin chooses. */
  lesson: LessonSuggestion | null;
  /** Lessons the links make plausible but cannot decide between. */
  ambiguousLessonIds: string[];
  solutionSources: SolutionSource[];
}

function chunk(span: PageSpan, size: number): number[][] {
  const chunks: number[][] = [];
  for (let start = span.start; start <= span.end; start += size)
    chunks.push(Array.from({ length: Math.min(size, span.end - start + 1) }, (_, i) => start + i));
  return chunks;
}

/** The chapter's solution sections that come after the set's pages, nearest first. */
export function solutionSourcesFor(
  entry: TextbookTocEntry,
  entries: TextbookTocEntry[]
): SolutionSource[] {
  const chapter = chapterOf(entry, entries);
  if (!chapter) return [];
  const inChapter = entryWithDescendants(entries, chapter.id);
  const own = entrySpan(entry);
  return entries
    .filter(
      (candidate) =>
        candidate.id !== entry.id &&
        inChapter.has(candidate.id) &&
        isLeaf(candidate, entries) &&
        isSolutionSection(candidate) &&
        candidate.printedStartPage !== null &&
        (!own || candidate.printedStartPage >= own.start)
    )
    .sort((a, b) => a.printedStartPage! - b.printedStartPage!)
    .map((candidate) => {
      const span = entrySpan(candidate)!;
      return {
        entry: candidate,
        span,
        chunks: chunk(span, SOLUTION_PAGES_PER_REQUEST),
        reason: `Mục “${candidate.originalHeading}” cùng chương “${chapter.originalHeading}”, in sau phần đề`,
      };
    });
}

/** Leaf sections that hold questions: by heading, or because questions were extracted there. */
export function isExerciseSet(
  entry: TextbookTocEntry,
  entries: TextbookTocEntry[],
  artifacts: Pick<TextbookArtifact, 'entryId' | 'kind'>[]
) {
  if (!isLeaf(entry, entries) || isSolutionSection(entry)) return false;
  return (
    EXERCISE_HEADING.test(entry.originalHeading) ||
    artifacts.some((artifact) => artifact.entryId === entry.id && artifact.kind === 'EXERCISE')
  );
}

type Mapping = Pick<
  TextbookKnowledgeMapping,
  'documentId' | 'knowledgeNodeId' | 'entryId' | 'status' | 'printedStartPage' | 'printedEndPage'
>;

/**
 * Which lesson an exercise set belongs to, from confirmed links only:
 * 1. the set's own section is linked to exactly one lesson;
 * 2. else the "Dạng n" section of the same problem type, under the same parent;
 * 3. else exactly one lesson's link covers all of the set's pages.
 * A link the Admin removed from the theory view (REJECTED) says the section is
 * not lesson reference material; it says nothing against the set's practice.
 */
export function suggestLessonForSet(
  entry: TextbookTocEntry,
  entries: TextbookTocEntry[],
  mappings: Mapping[],
  documentId: string
): { lesson: LessonSuggestion | null; ambiguous: string[] } {
  const confirmed = mappings.filter(
    (mapping) => mapping.documentId === documentId && mapping.status === 'CONFIRMED'
  );
  const lessonsOn = (entryId: string) => [
    ...new Set(
      confirmed.filter((mapping) => mapping.entryId === entryId).map((m) => m.knowledgeNodeId)
    ),
  ];
  const direct = lessonsOn(entry.id);
  if (direct.length === 1)
    return {
      lesson: {
        lessonId: direct[0],
        via: 'DIRECT',
        reason: `Mục “${entry.originalHeading}” đã liên kết với bài này`,
      },
      ambiguous: [],
    };
  if (direct.length > 1) return { lesson: null, ambiguous: direct };

  const problemType = exerciseSetFor(entry, entries).problemType;
  if (problemType) {
    const siblings = entries.filter(
      (candidate) =>
        candidate.parentId === entry.parentId &&
        candidate.id !== entry.id &&
        problemTypeOf(candidate.originalHeading) === problemType
    );
    const lessons = [...new Set(siblings.flatMap((sibling) => lessonsOn(sibling.id)))];
    if (lessons.length === 1) {
      const sibling = siblings.find((item) => lessonsOn(item.id).includes(lessons[0]))!;
      return {
        lesson: {
          lessonId: lessons[0],
          via: 'PROBLEM_TYPE',
          reason: `Bài tập của ${problemType}: mục “${sibling.originalHeading}” đã liên kết với bài này`,
        },
        ambiguous: [],
      };
    }
    if (lessons.length > 1) return { lesson: null, ambiguous: lessons };
  }

  const own = entrySpan(entry);
  if (own) {
    const covering = [
      ...new Set(
        confirmed
          .filter((mapping) => {
            const linked = entries.find((item) => item.id === mapping.entryId);
            if (!linked || !entryWithDescendants(entries, linked.id).has(entry.id)) return false;
            const span = mappingSpan(mapping, linked);
            return !!span && span.start <= own.start && span.end >= own.end;
          })
          .map((mapping) => mapping.knowledgeNodeId)
      ),
    ];
    if (covering.length === 1)
      return {
        lesson: {
          lessonId: covering[0],
          via: 'PAGE_RANGE',
          reason: `Trang ${own.start}–${own.end} nằm trong phần sách đã liên kết với bài này`,
        },
        ambiguous: [],
      };
    if (covering.length > 1) return { lesson: null, ambiguous: covering };
  }
  return { lesson: null, ambiguous: [] };
}

/**
 * Exercise sets reachable from a lesson: every set in a chapter the lesson has
 * a confirmed link in, whichever lesson each set turns out to belong to.
 */
export function practiceSetsForLesson(input: {
  lessonId: string;
  documents: Pick<TextbookDocumentRecord, 'id' | 'tocEntries'>[];
  mappings: Mapping[];
  artifacts: TextbookArtifact[];
}): PracticeSet[] {
  const sets: PracticeSet[] = [];
  for (const document of input.documents) {
    const entries = document.tocEntries;
    const chapterIds = new Set(
      input.mappings
        .filter(
          (mapping) =>
            mapping.documentId === document.id &&
            mapping.knowledgeNodeId === input.lessonId &&
            mapping.status === 'CONFIRMED'
        )
        .flatMap((mapping) => {
          const entry = entries.find((item) => item.id === mapping.entryId);
          const chapter = entry ? chapterOf(entry, entries) : null;
          return chapter ? [chapter.id] : [];
        })
    );
    const artifacts = input.artifacts.filter((artifact) => artifact.documentId === document.id);
    for (const entry of entries) {
      const chapter = chapterOf(entry, entries);
      if (!chapter || !chapterIds.has(chapter.id) || !isExerciseSet(entry, entries, artifacts))
        continue;
      const { lesson, ambiguous } = suggestLessonForSet(
        entry,
        entries,
        input.mappings,
        document.id
      );
      sets.push({
        documentId: document.id,
        entry,
        chapter,
        problemType: exerciseSetFor(entry, entries).problemType,
        span: entrySpan(entry),
        exerciseIds: artifacts
          .filter((artifact) => artifact.kind === 'EXERCISE' && artifact.entryId === entry.id)
          .map((artifact) => artifact.id),
        lesson,
        ambiguousLessonIds: ambiguous,
        solutionSources: solutionSourcesFor(entry, entries),
      });
    }
  }
  return sets;
}

/** Whether a lesson may extract this entry as a practice source (exercise set or its solutions). */
export function isPracticeSourceForLesson(
  entry: TextbookTocEntry,
  document: Pick<TextbookDocumentRecord, 'id' | 'tocEntries'>,
  mappings: Mapping[],
  lessonId: string
) {
  const entries = document.tocEntries;
  const chapter = chapterOf(entry, entries);
  if (!chapter || !isLeaf(entry, entries)) return false;
  if (!isSolutionSection(entry) && !EXERCISE_HEADING.test(entry.originalHeading)) return false;
  return mappings.some((mapping) => {
    if (
      mapping.documentId !== document.id ||
      mapping.knowledgeNodeId !== lessonId ||
      mapping.status !== 'CONFIRMED'
    )
      return false;
    const linked = entries.find((item) => item.id === mapping.entryId);
    return !!linked && chapterOf(linked, entries)?.id === chapter.id;
  });
}
