// @vitest-environment node

/**
 * Runs against a real PostgreSQL database named in TEST_DATABASE_URL (a
 * throwaway "_test" database; the tutai schema is created by the migrations).
 * Skipped when the variable is not set.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { closeSql, getSql } from '@/lib/db/postgres';
import { runMigrations } from '@/lib/db/migrations';
import {
  readContentDocument,
  updateContentDocument,
  type ContentDocumentSource,
} from './document-store';
import { findRetiredQuestions } from './retired-content';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

describe.skipIf(!TEST_DATABASE_URL)('content documents in PostgreSQL', () => {
  const saved = process.env.DATABASE_URL;
  const seed = { nodes: ['old sample node'] };
  const source: ContentDocumentSource<{ nodes: string[] }> = {
    key: 'test/tree',
    readFile: async () => seed,
    writeFile: async () => {
      throw new Error('database mode must not write files');
    },
    empty: () => ({ nodes: [] }),
  };

  beforeAll(async () => {
    if (!TEST_DATABASE_URL!.split('?')[0].endsWith('_test')) throw new Error('needs a *_test DB');
    process.env.DATABASE_URL = TEST_DATABASE_URL;
    await runMigrations(getSql());
  });
  beforeEach(async () => {
    await getSql()`delete from tutai.content_documents where key like 'test/%' or key like 'archive/%'`;
  });
  afterAll(async () => {
    await getSql()`delete from tutai.content_documents where key like 'test/%' or key like 'archive/%'`;
    await closeSql();
    process.env.DATABASE_URL = saved;
  });

  it('reads a missing row as empty, never from the seed file', async () => {
    expect(await readContentDocument(source)).toEqual({ nodes: [] });
  });

  it('starts the first write from empty, not from the seed file', async () => {
    const next = await updateContentDocument(source, (current) => ({
      nodes: [...current.nodes, 'new'],
    }));
    expect(next).toEqual({ nodes: ['new'] });
    expect(await readContentDocument(source)).toEqual({ nodes: ['new'] });
  });

  it('finds questions of an archived reset only by id', async () => {
    const question = { id: 'q-old', stem: 'Câu cũ', difficulty: 'FOUNDATIONAL' };
    await getSql()`
      insert into tutai.content_documents (key, body) values ('archive/test-reset', ${getSql().json(
        {
          documents: { 'question-bank/questions': { body: [question, { id: 'q-other' }] } },
        }
      )})`;
    const found = await findRetiredQuestions(['q-old', 'q-missing']);
    expect([...found.keys()]).toEqual(['q-old']);
    expect(found.get('q-old')).toMatchObject({ stem: 'Câu cũ' });
  });
});
