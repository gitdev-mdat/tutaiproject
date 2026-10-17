// @vitest-environment node

/**
 * Imports questions into a real PostgreSQL database named in TEST_DATABASE_URL
 * (a throwaway "_test" database). Skipped when the variable is not set.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeSql, getSql } from '@/lib/db/postgres';
import { runMigrations } from '@/lib/db/migrations';
import { commitImport } from './qb-import';
import { listQuestions } from './qb-storage';
import type { ImportTargetField } from './qb-types';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const KEYS = [
  'knowledge-tree/tree',
  'question-bank/questions',
  'question-bank/audits',
  'question-bank/import-jobs',
];

const node = (
  id: string,
  parentId: string | null,
  title: string,
  kind: string,
  nodeType: string
) => ({
  id,
  parentId,
  title,
  kind,
  nodeType,
  order: 1,
  status: 'DRAFT',
  description: '',
  identitySource: 'TREE_IMPORT',
  createdAt: '2026-10-17T00:00:00Z',
  updatedAt: '2026-10-17T00:00:00Z',
});

describe.skipIf(!TEST_DATABASE_URL)('question import commit', () => {
  const saved = process.env.DATABASE_URL;

  beforeAll(async () => {
    if (!TEST_DATABASE_URL!.split('?')[0].endsWith('_test')) throw new Error('needs a *_test DB');
    process.env.DATABASE_URL = TEST_DATABASE_URL;
    const sql = getSql();
    await runMigrations(sql);
    await sql`delete from tutai.content_documents where key in ${sql(KEYS)}`;
    await sql`insert into tutai.content_documents (key, body) values ('knowledge-tree/tree', ${sql.json(
      {
        schemaVersion: 1,
        updatedAt: '2026-10-17T00:00:00Z',
        nodes: [
          node('subj', null, 'Toán học', 'GROUP', 'MON_HOC'),
          node('grade', 'subj', 'Lớp 12', 'GROUP', 'LOP'),
          node('chap', 'grade', 'Chương 1', 'GROUP', 'CHUONG'),
          node('lesson', 'chap', 'Bài 1', 'KNOWLEDGE', 'KIEN_THUC'),
        ],
      }
    )})`;
  });
  afterAll(async () => {
    const sql = getSql();
    await sql`delete from tutai.content_documents where key in ${sql(KEYS)}`;
    await closeSql();
    process.env.DATABASE_URL = saved;
  });

  it('keeps the lesson link and accepts a Knowledge Tree node id as concept code', async () => {
    const mapped = {
      external_id: 'imp-1',
      question_type: 'MULTIPLE_CHOICE_SINGLE',
      stem: 'Câu nhập thử?',
      option_a: '1',
      option_b: '2',
      option_c: '3',
      option_d: '4',
      correct_answer: 'B',
      difficulty: 'ADVANCED',
      knowledge_node_id: 'lesson',
      concept_codes: 'lesson',
      knowledge_coverage: 'FOCUS',
      cognitive_level: 'APPLICATION',
      usage_contexts: 'OPEN_PRACTICE',
    } as Record<ImportTargetField, string>;
    const result = await commitImport({
      jobId: 'job-1',
      idempotencyKey: 'key-1',
      fileName: 'a.json',
      format: 'JSON',
      rows: [{ mapped }],
      defaults: {},
      allowPartial: false,
    });
    expect(result).toMatchObject({ successCount: 1, failedCount: 0 });
    const [question] = (await listQuestions({ pageSize: 10 })).questions;
    expect(question).toMatchObject({
      externalId: 'imp-1',
      primaryKnowledgeNodeId: 'lesson',
      subjectId: 'MATH',
      grade: 12,
      chapterId: 'chap',
      knowledgeCoverage: 'FOCUS',
      cognitiveLevel: 'APPLICATION',
      difficulty: 'ADVANCED',
      conceptCodes: ['lesson'],
      editorialStatus: 'DRAFT',
    });
    expect(
      (await listQuestions({ curriculumItemId: 'lesson', pageSize: 10 })).questions
    ).toHaveLength(1);
  });
});
