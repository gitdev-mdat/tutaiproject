import type { Metadata } from 'next';
import { ExamsPage, type ExamCoverageLabel } from '@/components/admin/exams/exams-page';
import { requireAdminPage } from '@/lib/auth/admin';
import { coverageSummary, examCoverage } from '@/lib/exams/exam-coverage';
import { listExams } from '@/lib/exams/exam-storage';
import { readKnowledgeTree } from '@/lib/knowledge-tree/knowledge-tree-storage';
import { listQuestions } from '@/lib/question-bank/qb-storage';

export const metadata: Metadata = { title: 'Quản lý đề thi | Tú Tài Admin' };
export const dynamic = 'force-dynamic';

/**
 * Each exam's curriculum coverage, from its questions' Knowledge Tree nodes:
 * the published copy for a published exam, the current questions otherwise.
 */
async function coverageByExam(): Promise<Record<string, ExamCoverageLabel>> {
  const [exams, tree, { questions }] = await Promise.all([
    listExams(),
    readKnowledgeTree(),
    listQuestions({ pageSize: 100_000 }),
  ]);
  const byId = new Map(questions.map((question) => [question.id, question]));
  return Object.fromEntries(
    exams.map((exam) => {
      const examQuestions =
        exam.publishedSnapshot?.questions ??
        exam.questionIds.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
      const coverage = examCoverage(examQuestions, tree.nodes);
      return [
        exam.id,
        {
          summary: coverageSummary(coverage),
          chapters: coverage.chapters.map((chapter) => chapter.title),
        },
      ];
    })
  );
}

export default async function AdminExamsPage() {
  await requireAdminPage('/admin/exams');
  return <ExamsPage coverage={await coverageByExam()} />;
}
