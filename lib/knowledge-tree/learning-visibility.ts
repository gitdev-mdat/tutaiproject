/**
 * Learning visibility — the single rule that decides what students can see.
 *
 * Derived only from fields that already exist in the domain:
 * - an article is shown to students when `status === 'PUBLISHED'` and
 *   `publishToLearning === true`;
 * - nothing on the node's path (itself or any ancestor) may be ARCHIVED.
 *
 * Admin badges and the student catalog both consume this module so the two
 * sides can never disagree about whether a lesson is visible.
 */

import { childrenOf, knowledgeBreadcrumb } from './knowledge-tree';
import type {
  KnowledgeArticle,
  KnowledgeTreeDocument,
  KnowledgeTreeNode,
} from './knowledge-tree-types';

export type LessonPublicationState = 'ARCHIVED' | 'NO_ARTICLE' | 'DRAFT' | 'READY' | 'PUBLISHED';

export interface ArticleSummary {
  status: KnowledgeArticle['status'];
  publishToLearning: boolean;
  updatedAt: string;
}

export function summarizeArticle(article: KnowledgeArticle): ArticleSummary {
  return {
    status: article.status,
    publishToLearning: article.publishToLearning,
    updatedAt: article.updatedAt,
  };
}

export function isArticleVisibleToStudents(
  article: Pick<KnowledgeArticle, 'status' | 'publishToLearning'> | null | undefined
): boolean {
  return !!article && article.status === 'PUBLISHED' && article.publishToLearning;
}

export function isOnArchivedPath(nodes: KnowledgeTreeNode[], nodeId: string): boolean {
  return knowledgeBreadcrumb(nodes, nodeId).some((node) => node.status === 'ARCHIVED');
}

export function getLessonPublicationState(
  nodes: KnowledgeTreeNode[],
  nodeId: string,
  article: Pick<KnowledgeArticle, 'status' | 'publishToLearning'> | null | undefined
): LessonPublicationState {
  if (isOnArchivedPath(nodes, nodeId)) return 'ARCHIVED';
  if (!article) return 'NO_ARTICLE';
  if (isArticleVisibleToStudents(article)) return 'PUBLISHED';
  return article.status === 'READY' ? 'READY' : 'DRAFT';
}

export const LESSON_PUBLICATION_LABELS: Record<LessonPublicationState, string> = {
  ARCHIVED: 'Lưu trữ',
  NO_ARTICLE: 'Chưa có bài',
  DRAFT: 'Bản nháp',
  READY: 'Sẵn sàng',
  PUBLISHED: 'Đang hiển thị',
};

// ─── Student catalog ─────────────────────────────────────────────────────────

export interface LearningLesson {
  id: string;
  title: string;
  description: string;
  chapterId: string;
  chapterTitle: string;
}

export interface LearningChapter {
  id: string;
  title: string;
  lessons: LearningLesson[];
}

export interface LearningGrade {
  id: string;
  title: string;
  chapters: LearningChapter[];
}

export interface LearningSubject {
  id: string;
  title: string;
  grades: LearningGrade[];
  lessonCount: number;
}

/** Visible KNOWLEDGE descendants of a node, flattened in curriculum order. */
function visibleLessonsUnder(
  nodes: KnowledgeTreeNode[],
  parentId: string,
  articles: Record<string, Pick<KnowledgeArticle, 'status' | 'publishToLearning'>>
): KnowledgeTreeNode[] {
  const result: KnowledgeTreeNode[] = [];
  for (const child of childrenOf(nodes, parentId)) {
    if (child.status === 'ARCHIVED') continue;
    if (child.kind === 'KNOWLEDGE' && isArticleVisibleToStudents(articles[child.id])) {
      result.push(child);
    }
    result.push(...visibleLessonsUnder(nodes, child.id, articles));
  }
  return result;
}

/**
 * Builds the student-facing catalog: subject → grade → chapter → lesson.
 * Empty branches are dropped so students never land on a chapter with nothing to read.
 */
export function buildLearningCatalog(
  tree: KnowledgeTreeDocument,
  articles: Record<string, Pick<KnowledgeArticle, 'status' | 'publishToLearning'>>
): LearningSubject[] {
  const nodes = tree.nodes;
  const subjects: LearningSubject[] = [];
  for (const subject of childrenOf(nodes, null)) {
    if (subject.status === 'ARCHIVED') continue;
    const grades: LearningGrade[] = [];
    for (const grade of childrenOf(nodes, subject.id)) {
      if (grade.status === 'ARCHIVED') continue;
      const chapters: LearningChapter[] = [];
      for (const chapter of childrenOf(nodes, grade.id)) {
        if (chapter.status === 'ARCHIVED') continue;
        const lessonNodes =
          chapter.kind === 'KNOWLEDGE'
            ? isArticleVisibleToStudents(articles[chapter.id])
              ? [chapter]
              : []
            : visibleLessonsUnder(nodes, chapter.id, articles);
        if (lessonNodes.length === 0) continue;
        chapters.push({
          id: chapter.id,
          title: chapter.title,
          lessons: lessonNodes.map((lesson) => ({
            id: lesson.id,
            title: lesson.title,
            description: lesson.description,
            chapterId: chapter.id,
            chapterTitle: chapter.title,
          })),
        });
      }
      if (chapters.length) grades.push({ id: grade.id, title: grade.title, chapters });
    }
    const lessonCount = grades.reduce(
      (sum, grade) => sum + grade.chapters.reduce((s, chapter) => s + chapter.lessons.length, 0),
      0
    );
    if (lessonCount) subjects.push({ id: subject.id, title: subject.title, grades, lessonCount });
  }
  return subjects;
}

export function flattenSubjectLessons(subject: LearningSubject): LearningLesson[] {
  return subject.grades.flatMap((grade) => grade.chapters.flatMap((chapter) => chapter.lessons));
}

export function findLessonInCatalog(
  catalog: LearningSubject[],
  lessonId: string
): {
  subject: LearningSubject;
  lesson: LearningLesson;
  index: number;
  lessons: LearningLesson[];
} | null {
  for (const subject of catalog) {
    const lessons = flattenSubjectLessons(subject);
    const index = lessons.findIndex((lesson) => lesson.id === lessonId);
    if (index >= 0) return { subject, lesson: lessons[index], index, lessons };
  }
  return null;
}
