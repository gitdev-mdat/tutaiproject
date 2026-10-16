import { knowledgeBreadcrumb } from '@/lib/knowledge-tree/knowledge-tree';
import type { KnowledgeTreeNode } from '@/lib/knowledge-tree/knowledge-tree-types';
import type { Question } from '@/lib/question-bank/qb-types';

/**
 * What part of the curriculum an exam assesses, read from its questions.
 *
 * An exam does not keep its own list of chapters: each question is attached to
 * one Knowledge Tree node (`primaryKnowledgeNodeId`), so the exam's coverage is
 * the set of those nodes, grouped by chapter on the live tree. A chapter test
 * covers one chapter; a semester or national exam covers many. Nothing is
 * forced into a single lesson, and nothing is copied that could drift from
 * the tree when a lesson is renamed or moved.
 */
export interface ExamCoverage {
  chapters: { id: string; title: string; lessonCount: number; questionCount: number }[];
  lessonCount: number;
  /** Questions whose node is no longer in the tree (deleted), or that have none. */
  unmappedCount: number;
}

/** The chapter of a node: the third level of subject › grade › chapter › … */
function chapterOf(path: KnowledgeTreeNode[]) {
  return path[2] ?? path[path.length - 1] ?? null;
}

export function examCoverage(questions: Question[], nodes: KnowledgeTreeNode[]): ExamCoverage {
  const known = new Set(nodes.map((node) => node.id));
  const chapters = new Map<
    string,
    { id: string; title: string; lessons: Set<string>; questionCount: number }
  >();
  const lessons = new Set<string>();
  let unmappedCount = 0;
  for (const question of questions) {
    const nodeId = question.primaryKnowledgeNodeId;
    if (!nodeId || !known.has(nodeId)) {
      unmappedCount += 1;
      continue;
    }
    const chapter = chapterOf(knowledgeBreadcrumb(nodes, nodeId));
    if (!chapter) {
      unmappedCount += 1;
      continue;
    }
    const entry = chapters.get(chapter.id) ?? {
      id: chapter.id,
      title: chapter.title,
      lessons: new Set<string>(),
      questionCount: 0,
    };
    entry.lessons.add(nodeId);
    entry.questionCount += 1;
    chapters.set(chapter.id, entry);
    lessons.add(nodeId);
  }
  const order = new Map(nodes.map((node, index) => [node.id, index]));
  return {
    chapters: [...chapters.values()]
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
      .map(({ lessons: chapterLessons, ...rest }) => ({
        ...rest,
        lessonCount: chapterLessons.size,
      })),
    lessonCount: lessons.size,
    unmappedCount,
  };
}

/** "2 chương · 5 bài", or why there is nothing to show. */
export function coverageSummary(coverage: ExamCoverage): string {
  if (!coverage.chapters.length)
    return coverage.unmappedCount ? 'Câu chưa gắn bài học' : 'Chưa có câu';
  const text = `${coverage.chapters.length} chương · ${coverage.lessonCount} bài`;
  return coverage.unmappedCount ? `${text} · ${coverage.unmappedCount} câu chưa gắn bài` : text;
}
