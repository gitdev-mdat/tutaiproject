import 'server-only';

import { getSql } from '@/lib/db/postgres';
import { listQuestions } from '@/lib/question-bank/qb-storage';
import type { Question } from '@/lib/question-bank/qb-types';
import { knowledgeBreadcrumb } from '@/lib/knowledge-tree/knowledge-tree';
import { readKnowledgeArticles } from '@/lib/knowledge-tree/knowledge-article-storage';
import { readKnowledgeTree } from '@/lib/knowledge-tree/knowledge-tree-storage';
import {
  getLessonPublicationState,
  type LessonPublicationState,
} from '@/lib/knowledge-tree/learning-visibility';
import {
  PRACTICE_READY_THRESHOLD,
  practiceQuestionState,
  type PracticeQuestionState,
} from './practice-rules';

/**
 * The admin's view of lesson practice: for every lesson, what students get
 * today and what still needs work.
 */

export type LessonReadiness = 'READY' | 'FEW_QUESTIONS' | 'NO_QUESTIONS' | 'LESSON_HIDDEN';

export type LessonCoverage = {
  lessonId: string;
  title: string;
  path: string[];
  publication: LessonPublicationState;
  counts: Record<PracticeQuestionState, number>;
  total: number;
  readiness: LessonReadiness;
  attention: string[];
  students: { attempts: number; students: number; averageScore: number | null };
};

export type CoverageQuestion = {
  question: Question;
  state: PracticeQuestionState;
  reason: string | null;
  stats: { answers: number; correct: number };
};

const EMPTY_COUNTS: Record<PracticeQuestionState, number> = {
  IN_PRACTICE: 0,
  DRAFT: 0,
  IN_REVIEW: 0,
  ARCHIVED: 0,
  PUBLISHED_ELSEWHERE: 0,
  NOT_USABLE: 0,
};

function readinessOf(publication: LessonPublicationState, inPractice: number): LessonReadiness {
  if (publication !== 'PUBLISHED') return 'LESSON_HIDDEN';
  if (inPractice === 0) return 'NO_QUESTIONS';
  return inPractice < PRACTICE_READY_THRESHOLD ? 'FEW_QUESTIONS' : 'READY';
}

async function lessonStats(): Promise<Map<string, LessonCoverage['students']>> {
  if (!process.env.DATABASE_URL) return new Map();
  const rows = await getSql()<
    { lesson_id: string; attempts: number; students: number; average: number | null }[]
  >`
    select lesson_id, count(*)::int as attempts, count(distinct student_id)::int as students,
      avg(correct_count::float / total_count) filter (where status = 'COMPLETED') as average
    from tutai.practice_attempts where mode in ('LESSON', 'MISTAKES') group by lesson_id`;
  return new Map(
    rows.map((row) => [
      row.lesson_id,
      { attempts: row.attempts, students: row.students, averageScore: row.average },
    ])
  );
}

async function questionStats(
  lessonId: string
): Promise<Map<string, { answers: number; correct: number }>> {
  if (!process.env.DATABASE_URL) return new Map();
  const rows = await getSql()<{ question_id: string; answers: number; correct: number }[]>`
    select x.question_id, count(*)::int as answers, count(*) filter (where x.is_correct)::int as correct
    from tutai.practice_answers x join tutai.practice_attempts a on a.id = x.attempt_id
    where a.lesson_id = ${lessonId} and a.mode in ('LESSON', 'MISTAKES') group by x.question_id`;
  return new Map(
    rows.map((row) => [row.question_id, { answers: row.answers, correct: row.correct }])
  );
}

export async function getPracticeCoverage(): Promise<LessonCoverage[]> {
  const [tree, articles, { questions }, stats] = await Promise.all([
    readKnowledgeTree(),
    readKnowledgeArticles(),
    listQuestions({ pageSize: 100_000 }),
    lessonStats(),
  ]);
  const byLesson = new Map<string, Question[]>();
  for (const question of questions) {
    if (!question.primaryKnowledgeNodeId) continue;
    const list = byLesson.get(question.primaryKnowledgeNodeId) ?? [];
    list.push(question);
    byLesson.set(question.primaryKnowledgeNodeId, list);
  }
  const lessons = tree.nodes.filter((node) => node.kind === 'KNOWLEDGE');
  return lessons
    .map((node) => {
      const publication = getLessonPublicationState(
        tree.nodes,
        node.id,
        articles.articles[node.id]
      );
      const counts = { ...EMPTY_COUNTS };
      for (const question of byLesson.get(node.id) ?? []) {
        counts[practiceQuestionState(question).state] += 1;
      }
      const attention: string[] = [];
      if (publication !== 'PUBLISHED' && counts.IN_PRACTICE > 0) {
        attention.push('Có câu luyện tập nhưng bài học chưa hiển thị cho học sinh.');
      }
      if (counts.IN_REVIEW > 0) attention.push(`${counts.IN_REVIEW} câu đang chờ duyệt.`);
      if (counts.NOT_USABLE + counts.PUBLISHED_ELSEWHERE > 0) {
        attention.push(
          `${counts.NOT_USABLE + counts.PUBLISHED_ELSEWHERE} câu đã xuất bản nhưng học sinh chưa nhận được.`
        );
      }
      return {
        lessonId: node.id,
        title: node.title,
        path: knowledgeBreadcrumb(tree.nodes, node.id)
          .slice(0, -1)
          .map((item) => item.title),
        publication,
        counts,
        total: (byLesson.get(node.id) ?? []).length,
        readiness: readinessOf(publication, counts.IN_PRACTICE),
        attention,
        students: stats.get(node.id) ?? { attempts: 0, students: 0, averageScore: null },
      };
    })
    .filter((lesson) => lesson.publication !== 'ARCHIVED' || lesson.total > 0);
}

export async function getLessonPracticeDetail(lessonId: string) {
  const coverage = (await getPracticeCoverage()).find((lesson) => lesson.lessonId === lessonId);
  if (!coverage) return null;
  const [{ questions }, stats] = await Promise.all([
    listQuestions({ curriculumItemId: lessonId, pageSize: 10_000 }),
    questionStats(lessonId),
  ]);
  const items: CoverageQuestion[] = questions
    .map((question) => ({
      question,
      ...practiceQuestionState(question),
      stats: stats.get(question.id) ?? { answers: 0, correct: 0 },
    }))
    .sort((a, b) => a.question.createdAt.localeCompare(b.question.createdAt));
  return { coverage, questions: items };
}
