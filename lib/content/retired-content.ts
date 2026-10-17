import 'server-only';

import { getSql } from '@/lib/db/postgres';
import type { Question } from '@/lib/question-bank/qb-types';

/**
 * Curriculum taken out of service by a content reset, kept in
 * tutai.content_documents under `archive/…` keys. Nothing reads it as
 * curriculum: it exists only so a student's past attempts can still show the
 * questions they answered. Each archive holds the retired documents verbatim:
 * `{ documents: { "question-bank/questions": { body: Question[] }, … } }`.
 */
type Archive = { documents?: Record<string, { body?: unknown }> };

export async function findRetiredQuestions(ids: string[]): Promise<Map<string, Question>> {
  const found = new Map<string, Question>();
  if (!ids.length || !process.env.DATABASE_URL) return found;
  const rows = await getSql()<{ body: Archive }[]>`
    select body from tutai.content_documents where key like 'archive/%' order by key desc`;
  const wanted = new Set(ids);
  for (const { body } of rows) {
    const questions = body.documents?.['question-bank/questions']?.body;
    if (!Array.isArray(questions)) continue;
    for (const question of questions as Question[]) {
      if (wanted.has(question.id) && !found.has(question.id)) found.set(question.id, question);
    }
  }
  return found;
}
