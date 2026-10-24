import {
  entrySpan,
  entryWithDescendants,
  formatSpan,
  mappingSpan,
  spansOverlap,
  type PageSpan,
} from './lesson-coverage';
import { normalizedHeading } from './page-mapping';
import type { TextbookKnowledgeMapping, TextbookTocEntry } from './types';

/**
 * Curriculum-aware suggestions of book sections for a lesson. Deterministic:
 * built only from the outline and the links Admins already confirmed, in this
 * order of evidence:
 *
 * 1. sections already linked to this lesson (never suggested again);
 * 2. the lesson's place in the curriculum;
 * 3. where the closest earlier lesson's confirmed pages end in each book;
 * 4. the outline: the section that starts there, and whether it is still in
 *    the same topic of the book;
 * 5. lesson title vs section heading;
 * 6. pages already linked to other lessons;
 * 7. sections later lessons already use (never suggested for this one).
 *
 * A suggestion is only a suggestion: linking stays an explicit Admin action,
 * and a section the Admin unlinked from this lesson is not suggested again.
 */

export interface CurriculumLesson {
  id: string;
  title: string;
}

export interface RecommendationDocument {
  id: string;
  title: string;
  tocEntries: TextbookTocEntry[];
}

export type RecommendationBasis = 'CONTINUATION' | 'SOLUTIONS' | 'TITLE';
/** How well the evidence agrees; never "certain", since pages come from the outline. */
export type RecommendationStrength = 'STRONG' | 'POSSIBLE' | 'WEAK';

export interface SectionRecommendation {
  documentId: string;
  documentTitle: string;
  entry: TextbookTocEntry;
  /** Pages to link: the whole section, or its remaining part after an earlier lesson. */
  span: PageSpan | null;
  /** True when `span` is narrower than the section. */
  partial: boolean;
  basis: RecommendationBasis;
  strength: RecommendationStrength;
  reasons: string[];
  warnings: string[];
  /** False while the section's page numbers come only from the outline. */
  pagesVerified: boolean;
  linkedElsewhere: Array<{ nodeId: string; title: string; span: PageSpan | null }>;
}

/** Where earlier and later lessons sit in a book, so the Admin sees the boundary. */
export interface BookCoverage {
  documentId: string;
  documentTitle: string;
  previous: { nodeId: string; title: string; span: PageSpan; lastHeading: string } | null;
  next: { nodeId: string; title: string; span: PageSpan } | null;
  /** Earlier lessons between `previous` and this one that link nothing in this book. */
  skipped: string[];
}

export interface RecommendationResult {
  recommendations: SectionRecommendation[];
  coverage: BookCoverage[];
}

const SOLUTION_HEADING = /hướng dẫn giải|lời giải|đáp án|giải chi tiết/;
const MAX_RECOMMENDATIONS = 5;

// Words every maths heading shares; matching on them says nothing about the topic.
const STOPWORDS = new Set(
  'của và các cho với trong một những là có bài phần hàm số toán dạng tập khi'.split(' ')
);

function words(value: string) {
  return new Set(
    normalizedHeading(value.replace(/\(P\d+\)/gi, ''))
      .split(/[^\p{L}\p{N}]+/u)
      .filter((word) => word.length >= 2 && !STOPWORDS.has(word) && !/^\d+$/.test(word))
  );
}

/** Share of the lesson title's words found in the heading (0–1). */
export function titleRelevance(lessonTitle: string, heading: string) {
  const wanted = words(lessonTitle);
  if (!wanted.size) return 0;
  const have = words(heading);
  return [...wanted].filter((word) => have.has(word)).length / wanted.size;
}

function ancestors(entries: TextbookTocEntry[], entry: TextbookTocEntry) {
  const byId = new Map(entries.map((item) => [item.id, item]));
  const chain: TextbookTocEntry[] = [];
  let current = entry.parentId ? byId.get(entry.parentId) : undefined;
  while (current && chain.length < 20) {
    chain.push(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return chain;
}

/**
 * The book's topic an entry belongs to: the outermost section below the book's
 * top level (e.g. "I.I. Tính đơn điệu của hàm số" under "Chủ đề 1"). A
 * top-level entry is its own topic.
 */
export function topicOf(entries: TextbookTocEntry[], entry: TextbookTocEntry) {
  const chain = [entry, ...ancestors(entries, entry)];
  return chain.length >= 2 ? chain[chain.length - 2] : chain[0];
}

function pagesVerified(entry: TextbookTocEntry) {
  return (
    entry.status === 'VERIFIED' ||
    (entry.locations.length > 0 &&
      entry.locations.every((location) => location.verification === 'VERIFIED'))
  );
}

const isSolutionHeading = (entry: TextbookTocEntry) =>
  SOLUTION_HEADING.test(entry.normalizedHeading || normalizedHeading(entry.originalHeading));

interface LinkedSpan {
  nodeId: string;
  entry: TextbookTocEntry;
  span: PageSpan | null;
}

export function recommendSections(input: {
  lesson: CurriculumLesson;
  /** Lessons in curriculum order (this one included), e.g. a grade's lessons depth-first. */
  curriculum: CurriculumLesson[];
  documents: RecommendationDocument[];
  /** Every mapping of these documents, for every lesson. */
  mappings: TextbookKnowledgeMapping[];
}): RecommendationResult {
  const { lesson, curriculum, documents, mappings } = input;
  const position = curriculum.findIndex((item) => item.id === lesson.id);
  const titles = new Map(curriculum.map((item) => [item.id, item.title]));
  const recommendations: SectionRecommendation[] = [];
  const coverage: BookCoverage[] = [];

  for (const document of documents) {
    const entries = document.tocEntries;
    const byId = new Map(entries.map((entry) => [entry.id, entry]));
    const forDocument = mappings.filter((mapping) => mapping.documentId === document.id);
    const linked = (status: TextbookKnowledgeMapping['status']) =>
      forDocument
        .filter((mapping) => mapping.status === status && byId.has(mapping.entryId))
        .map((mapping) => {
          const entry = byId.get(mapping.entryId)!;
          return { nodeId: mapping.knowledgeNodeId, entry, span: mappingSpan(mapping, entry) };
        });
    const confirmed: LinkedSpan[] = linked('CONFIRMED');
    const own = new Set(
      confirmed.filter((item) => item.nodeId === lesson.id).map((item) => item.entry.id)
    );
    const ownCovered = new Set([...own].flatMap((id) => [...entryWithDescendants(entries, id)]));
    const ownAncestors = new Set(
      [...own].flatMap((id) => ancestors(entries, byId.get(id)!).map((entry) => entry.id))
    );
    const declined = new Set(
      linked('REJECTED')
        .filter((item) => item.nodeId === lesson.id)
        .map((item) => item.entry.id)
    );
    // Sections later lessons already use belong to them, not to this lesson.
    const laterIds = new Set(position >= 0 ? curriculum.slice(position + 1).map((l) => l.id) : []);
    const takenByLater = new Set(
      confirmed.filter((item) => laterIds.has(item.nodeId)).map((item) => item.entry.id)
    );
    const spanOf = (nodeId: string) => {
      const all = confirmed
        .filter((item) => item.nodeId === nodeId && item.span)
        .map((item) => ({ ...item, span: item.span! }));
      // A linked solutions section sits far away and says nothing about where the lesson ends.
      const content = all.filter((item) => !isSolutionHeading(item.entry));
      const spans = content.length ? content : all;
      if (!spans.length) return null;
      const last = spans.reduce((best, item) =>
        item.span.end > best.span.end ||
        (item.span.end === best.span.end && item.entry.level > best.entry.level)
          ? item
          : best
      );
      return {
        span: {
          start: Math.min(...spans.map((item) => item.span.start)),
          end: last.span.end,
        },
        last,
      };
    };

    // Closest earlier lesson (in curriculum order, not edit order) with links in this book.
    let previous: BookCoverage['previous'] = null;
    let previousLast: LinkedSpan | null = null;
    const skipped: string[] = [];
    for (let index = position - 1; index >= 0 && !previous; index -= 1) {
      const found = spanOf(curriculum[index].id);
      if (found) {
        previous = {
          nodeId: curriculum[index].id,
          title: curriculum[index].title,
          span: found.span,
          lastHeading: found.last.entry.originalHeading,
        };
        previousLast = found.last;
      } else skipped.unshift(curriculum[index].title);
    }
    let next: BookCoverage['next'] = null;
    for (let index = position + 1; index < curriculum.length && !next; index += 1) {
      const found = spanOf(curriculum[index].id);
      if (found)
        next = { nodeId: curriculum[index].id, title: curriculum[index].title, span: found.span };
    }
    if (previous || next || own.size)
      coverage.push({
        documentId: document.id,
        documentTitle: document.title,
        previous,
        next,
        skipped: previous ? skipped : [],
      });

    const already = new Set<string>();
    const offer = (
      entry: TextbookTocEntry,
      fields: Pick<SectionRecommendation, 'basis' | 'strength' | 'reasons'> & {
        span?: PageSpan | null;
        warnings?: string[];
      }
    ) => {
      if (own.has(entry.id) || declined.has(entry.id) || already.has(entry.id)) return;
      // Already covered by a linked section, or a broader section around one: nothing new.
      if (ownCovered.has(entry.id) || ownAncestors.has(entry.id)) return;
      if (takenByLater.has(entry.id)) return;
      already.add(entry.id);
      const span = fields.span === undefined ? entrySpan(entry) : fields.span;
      const whole = entrySpan(entry);
      const verified = pagesVerified(entry);
      const warnings = [...(fields.warnings ?? [])];
      if (!verified) warnings.push('Số trang lấy từ mục lục, chưa đối chiếu với trang sách.');
      recommendations.push({
        documentId: document.id,
        documentTitle: document.title,
        entry,
        span,
        partial: !!span && !!whole && (span.start !== whole.start || span.end !== whole.end),
        basis: fields.basis,
        strength: fields.strength,
        reasons: fields.reasons,
        warnings,
        pagesVerified: verified,
        linkedElsewhere: confirmed
          .filter(
            (item) =>
              item.nodeId !== lesson.id &&
              (item.entry.id === entry.id ||
                (!!span && !!item.span && spansOverlap(span, item.span)))
          )
          .map((item) => ({
            nodeId: item.nodeId,
            title: titles.get(item.nodeId) ?? 'Bài khác',
            span: item.span,
          }))
          .filter(
            (item, index, list) => list.findIndex((other) => other.nodeId === item.nodeId) === index
          ),
      });
    };

    if (previous && previousLast) {
      const end = previous.span.end;
      const topic = topicOf(entries, previousLast.entry);
      const topicIds = entryWithDescendants(entries, topic.id);
      const topicSpan = entrySpan(topic);
      const before = `“${previous.title}” dừng ở tr. ${end}`;
      const relevantTo = (entry: TextbookTocEntry) =>
        Math.max(
          titleRelevance(lesson.title, entry.originalHeading),
          titleRelevance(lesson.title, topicOf(entries, entry).originalHeading)
        );

      // Same topic as the earlier lesson is evidence only if this lesson is about that topic too.
      const continuesTopic = relevantTo(previousLast.entry) >= 0.5;

      // The earlier lesson used only the first part of a section: the rest comes next.
      const lastWhole = entrySpan(previousLast.entry);
      const remainder =
        lastWhole && previousLast.span && previousLast.span.end < lastWhole.end
          ? { start: previousLast.span.end + 1, end: lastWhole.end }
          : null;
      if (remainder)
        offer(previousLast.entry, {
          basis: 'CONTINUATION',
          strength: continuesTopic ? 'STRONG' : 'WEAK',
          span: remainder,
          reasons: [`Phần còn lại của mục này: ${before}, mục kéo dài đến tr. ${remainder.end}.`],
          warnings: continuesTopic
            ? []
            : [
                `Thuộc chủ đề “${topic.originalHeading}” của bài trước; tên bài này không khớp chủ đề đó.`,
              ],
        });

      const upper = next ? next.span.start - 1 : Number.POSITIVE_INFINITY;
      const following = entries
        .filter((entry) => {
          const span = entrySpan(entry);
          return (
            span &&
            span.start > end &&
            span.start <= upper &&
            entry.parentId !== null &&
            !isSolutionHeading(entry)
          );
        })
        // The section that starts first; the most specific one when several start together.
        .sort((a, b) => a.printedStartPage! - b.printedStartPage! || b.level - a.level);

      const offerContinuation = (entry: TextbookTocEntry, nearest: boolean) => {
        const span = entrySpan(entry)!;
        const inTopic = topicIds.has(entry.id);
        const contiguous = nearest && !remainder && span.start === end + 1;
        const relevant = relevantTo(entry) >= 0.5;
        const reasons = [
          contiguous
            ? `Bắt đầu ngay sau phần của bài trước: ${before}.`
            : nearest && remainder
              ? `Mục tiếp theo sau phần còn lại (${formatSpan(remainder)}) của “${previousLast.entry.originalHeading}”.`
              : nearest
                ? `Mục gần nhất sau phần của bài trước (${before}); tr. ${end + 1}–${span.start - 1} không thuộc mục nào trong mục lục.`
                : `Chủ đề tiếp theo của sách khớp tên bài (${before}).`,
        ];
        const warnings: string[] = [];
        if (inTopic && relevant)
          reasons.push(
            `Vẫn trong chủ đề “${topic.originalHeading}” (${formatSpan(topicSpan)}) như bài trước.`
          );
        else if (relevant)
          reasons.push(
            `Chủ đề “${topicOf(entries, entry).originalHeading}” của sách khớp tên bài.`
          );
        else if (inTopic)
          warnings.push(
            `Vẫn thuộc chủ đề “${topic.originalHeading}” của bài trước, nhưng tên bài này không khớp chủ đề đó.`
          );
        else
          warnings.push(
            `Đã sang chủ đề khác của sách (“${topicOf(entries, entry).originalHeading}”). Chỉ liên kết nếu bài này học phần đó.`
          );
        offer(entry, {
          basis: 'CONTINUATION',
          strength: relevant && contiguous ? 'STRONG' : relevant ? 'POSSIBLE' : 'WEAK',
          reasons,
          warnings,
        });
        return relevant;
      };

      const first = following[0];
      let anchor: TextbookTocEntry | undefined;
      if (first) {
        if (offerContinuation(first, true)) anchor = first;
        else {
          // The nearest section is about something else: look for where this lesson's topic starts.
          anchor = following.find((entry) => relevantTo(entry) >= 0.5);
          if (anchor) offerContinuation(anchor, false);
        }
      }
      if (anchor) {
        const span = entrySpan(anchor)!;
        // The exercises that follow it in the same part of the book, when they come right after.
        const after = following.find(
          (entry) =>
            entry.parentId === anchor.parentId &&
            entry.id !== anchor.id &&
            entry.printedStartPage! === span.end + 1
        );
        if (after)
          offer(after, {
            basis: 'CONTINUATION',
            strength: 'POSSIBLE',
            reasons: [
              `Nối tiếp ngay sau “${anchor.originalHeading}” (${formatSpan(span)}) trong cùng phần của sách.`,
            ],
          });
      }

      // Worked solutions often sit far from the exercises, at the end of the topic this lesson is in.
      const lessonTopic = anchor ? topicOf(entries, anchor) : continuesTopic ? topic : null;
      const lessonTopicIds = lessonTopic ? entryWithDescendants(entries, lessonTopic.id) : null;
      // The first solutions section after where this lesson starts in the book: the one that
      // answers its exercises, not every solutions section of a long topic.
      const startsAt = anchor?.printedStartPage ?? end;
      const solutions = entries
        .filter(
          (item) =>
            lessonTopicIds?.has(item.id) &&
            isSolutionHeading(item) &&
            (item.printedStartPage ?? 0) > startsAt
        )
        .sort((a, b) => a.printedStartPage! - b.printedStartPage!)
        .slice(0, 1);
      for (const entry of solutions) {
        const span = entrySpan(entry);
        const sharedWith = confirmed.find(
          (item) => item.entry.id === entry.id && item.nodeId !== lesson.id
        );
        offer(entry, {
          basis: 'SOLUTIONS',
          strength: 'POSSIBLE',
          reasons: [
            `Lời giải cho bài tập của chủ đề “${lessonTopic!.originalHeading}”, nằm riêng ở ${formatSpan(span)}.`,
            sharedWith
              ? `Đã dùng cho “${titles.get(sharedWith.nodeId) ?? 'bài khác'}”; một mục lời giải có thể dùng chung cho nhiều bài.`
              : 'Chỉ cần nếu bài có bài tập lấy từ chủ đề này.',
          ],
        });
      }
    }

    // Title match: useful for the first lesson of a book, never above the curriculum evidence.
    for (const entry of entries) {
      const relevance = titleRelevance(lesson.title, entry.originalHeading);
      if (relevance < 0.75) continue;
      const span = entrySpan(entry);
      const covered = entryWithDescendants(entries, entry.id);
      const others = confirmed.filter(
        (item) =>
          item.nodeId !== lesson.id && covered.has(item.entry.id) && item.entry.id !== entry.id
      );
      offer(entry, {
        basis: 'TITLE',
        strength: others.length ? 'WEAK' : previous ? 'POSSIBLE' : 'POSSIBLE',
        reasons: ['Tên mục trùng với tên bài.'],
        warnings: others.length
          ? [
              `Mục lớn, gồm cả phần đã liên kết với “${titles.get(others[0].nodeId) ?? 'bài khác'}” (${formatSpan(others[0].span)}). Nên chọn mục con đúng với bài này.`,
            ]
          : [],
        span,
      });
    }
  }

  const strengthOrder: RecommendationStrength[] = ['STRONG', 'POSSIBLE', 'WEAK'];
  const basisOrder: RecommendationBasis[] = ['CONTINUATION', 'SOLUTIONS', 'TITLE'];
  recommendations.sort(
    (a, b) =>
      strengthOrder.indexOf(a.strength) - strengthOrder.indexOf(b.strength) ||
      basisOrder.indexOf(a.basis) - basisOrder.indexOf(b.basis) ||
      (a.span?.start ?? 0) - (b.span?.start ?? 0)
  );
  return { recommendations: recommendations.slice(0, MAX_RECOMMENDATIONS), coverage };
}

/** Lessons of the same grade in curriculum order: the tree walked depth-first by `order`. */
export function curriculumOrder(
  nodes: Array<{ id: string; title: string; parentId: string | null; order: number; kind: string }>,
  lessonId: string
): CurriculumLesson[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const path: string[] = [];
  for (
    let current = byId.get(lessonId);
    current;
    current = current.parentId ? byId.get(current.parentId) : undefined
  )
    path.unshift(current.id);
  // Subject › grade › …: walk from the grade so books of one grade line up.
  const rootId = path[Math.min(1, path.length - 1)];
  const children = new Map<string | null, typeof nodes>();
  for (const node of nodes)
    children.set(node.parentId, [...(children.get(node.parentId) ?? []), node]);
  const ordered: CurriculumLesson[] = [];
  const walk = (id: string) => {
    const node = byId.get(id);
    if (!node) return;
    if (node.kind === 'KNOWLEDGE') ordered.push({ id: node.id, title: node.title });
    for (const child of [...(children.get(id) ?? [])].sort((a, b) => a.order - b.order))
      walk(child.id);
  };
  if (rootId) walk(rootId);
  return ordered;
}
