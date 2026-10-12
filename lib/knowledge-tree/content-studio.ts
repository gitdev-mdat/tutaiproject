/**
 * Content Studio read model — curriculum metrics and the admin work queue.
 *
 * Everything here is derived from the tree and article summaries that already
 * exist; no task records are stored. Archived branches are excluded because
 * students never see them and there is nothing to do for them.
 */

import { childrenOf } from './knowledge-tree';
import {
  getLessonPublicationState,
  type ArticleSummary,
  type LessonPublicationState,
} from './learning-visibility';
import type { KnowledgeTreeNode } from './knowledge-tree-types';

export interface StudioChapter {
  node: KnowledgeTreeNode;
  archived: boolean;
  /** Non-archived KNOWLEDGE items anywhere under the chapter. */
  lessons: KnowledgeTreeNode[];
  counts: Record<Exclude<LessonPublicationState, 'ARCHIVED'>, number>;
  /** Every lesson is visible to students, and there is at least one. */
  complete: boolean;
}

export interface StudioOverview {
  chapters: StudioChapter[];
  totals: Record<Exclude<LessonPublicationState, 'ARCHIVED'>, number> & { lessons: number };
  activeChapters: number;
  completeChapters: number;
  archivedLessons: number;
}

export type WorkItemKind = 'READY' | 'DRAFT' | 'NO_ARTICLE' | 'EMPTY_CHAPTER';

export interface WorkItem {
  kind: WorkItemKind;
  nodeId: string;
  title: string;
  chapterId: string;
  chapterTitle: string;
}

/** Order in which the queue presents work: quickest wins first. */
export const WORK_ITEM_ORDER: WorkItemKind[] = ['READY', 'DRAFT', 'NO_ARTICLE', 'EMPTY_CHAPTER'];

function descendants(nodes: KnowledgeTreeNode[], id: string): KnowledgeTreeNode[] {
  return childrenOf(nodes, id).flatMap((child) => [child, ...descendants(nodes, child.id)]);
}

const emptyCounts = () => ({ NO_ARTICLE: 0, DRAFT: 0, READY: 0, PUBLISHED: 0 });

export function buildStudioOverview(
  nodes: KnowledgeTreeNode[],
  summaries: Record<string, ArticleSummary>,
  gradeId: string
): StudioOverview {
  const totals = { ...emptyCounts(), lessons: 0 };
  let archivedLessons = 0;
  const chapters = (gradeId ? childrenOf(nodes, gradeId) : []).map((chapter): StudioChapter => {
    const branch = [chapter, ...descendants(nodes, chapter.id)].filter(
      (node) => node.kind === 'KNOWLEDGE'
    );
    const counts = emptyCounts();
    const lessons: KnowledgeTreeNode[] = [];
    for (const node of branch) {
      const state = getLessonPublicationState(nodes, node.id, summaries[node.id]);
      if (state === 'ARCHIVED') {
        archivedLessons += 1;
        continue;
      }
      lessons.push(node);
      counts[state] += 1;
    }
    const archived = chapter.status === 'ARCHIVED';
    if (!archived) {
      for (const key of Object.keys(counts) as Array<keyof typeof counts>) {
        totals[key] += counts[key];
      }
      totals.lessons += lessons.length;
    }
    return {
      node: chapter,
      archived,
      lessons,
      counts,
      complete: !archived && lessons.length > 0 && counts.PUBLISHED === lessons.length,
    };
  });
  const active = chapters.filter((chapter) => !chapter.archived);
  return {
    chapters,
    totals,
    activeChapters: active.length,
    completeChapters: active.filter((chapter) => chapter.complete).length,
    archivedLessons,
  };
}

export function buildWorkQueue(
  overview: StudioOverview,
  nodes: KnowledgeTreeNode[],
  summaries: Record<string, ArticleSummary>
): WorkItem[] {
  const items: WorkItem[] = [];
  for (const chapter of overview.chapters) {
    if (chapter.archived) continue;
    const base = { chapterId: chapter.node.id, chapterTitle: chapter.node.title };
    if (chapter.lessons.length === 0) {
      items.push({
        kind: 'EMPTY_CHAPTER',
        nodeId: chapter.node.id,
        title: chapter.node.title,
        ...base,
      });
      continue;
    }
    for (const lesson of chapter.lessons) {
      const state = getLessonPublicationState(nodes, lesson.id, summaries[lesson.id]);
      if (state === 'PUBLISHED' || state === 'ARCHIVED') continue;
      items.push({ kind: state, nodeId: lesson.id, title: lesson.title, ...base });
    }
  }
  return items.sort((a, b) => WORK_ITEM_ORDER.indexOf(a.kind) - WORK_ITEM_ORDER.indexOf(b.kind));
}
