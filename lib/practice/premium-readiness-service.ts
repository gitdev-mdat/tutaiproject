import 'server-only';

import { learningPrograms } from '@/features/lessons/lib/study-plan';
import { listExams } from '@/lib/exams/exam-storage';
import { getLearningCatalog } from '@/lib/knowledge-tree/knowledge-tree-service';
import { listQuestions } from '@/lib/question-bank/qb-storage';
import { computePremiumReadiness, type PremiumReadiness } from './premium-readiness';

/** Readiness of chapter sets and exams for admins, from the live content stores. */
export async function getPremiumReadiness(): Promise<PremiumReadiness> {
  const [catalog, { questions }, exams] = await Promise.all([
    getLearningCatalog(),
    listQuestions({ pageSize: 100_000 }),
    listExams(),
  ]);
  return computePremiumReadiness(learningPrograms(catalog), questions, exams);
}
