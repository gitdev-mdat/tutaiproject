/**
 * Textbook-grounded drafting, end to end on a real, isolated PostgreSQL
 * database named exactly `lesson_grounding_test` (never any other):
 *
 *   TEST_GROUNDING_DATABASE_URL=postgres://…/lesson_grounding_test pnpm test grounded-draft
 *
 * A controlled fixture (one lesson, one confirmed book link, one approved and
 * one unapproved extract, an already published lesson) goes through the real
 * admin route, the real reference selection, the real prompt builder and the
 * real Gemini provider code. Only the network call is replaced: the Gemini
 * client records the exact request it receives.
 */
import { createHash } from 'node:crypto';
import postgres from 'postgres';
import { vi } from 'vitest';

const session = vi.hoisted(() => ({
  user: null as null | { id: string; email: string | null; emailVerifiedAt: string | null },
}));
vi.mock('@/lib/auth/session', () => ({
  getAuthSession: async () => (session.user ? { user: session.user } : null),
}));
const gemini = vi.hoisted(() => ({ requests: [] as Array<Record<string, unknown>> }));
vi.mock('@/lib/ai/gemini-client', () => ({
  gemini: {
    models: {
      generateContent: async (request: Record<string, unknown>) => {
        gemini.requests.push(request);
        return {
          text: JSON.stringify({
            plan: { prerequisites: [], newNotation: [], teacherNotes: ['Dùng Tư liệu 1.'] },
            INTRO: 'Khi nào một hàm số đi lên?',
            OBJECTIVE: '- Xét được tính đơn điệu của hàm số bằng dấu đạo hàm.',
            MAIN_CONTENT:
              "**Dấu của đạo hàm.** Nếu $f'(x) > 0$ với mọi $x$ thuộc khoảng $K$ thì hàm số đồng biến trên $K$.",
            EXAMPLE: "Ví dụ 1. Xét $y = x^3$.\nLời giải.\nBước 1: Tính $y' = 3x^2$.",
            RECAP: '- Dấu đạo hàm cho biết chiều biến thiên.',
            COMMON_MISTAKE: '- Quên tập xác định.',
            GRAPH: '',
          }),
        };
      },
    },
  },
}));

import { closeSql, getSql } from '@/lib/db/postgres';
import { runMigrations } from '@/lib/db/migrations';
import { writeKnowledgeTree } from './knowledge-tree-storage';
import { readKnowledgeArticles, writeKnowledgeArticles } from './knowledge-article-storage';
import {
  saveTextbookMapping,
  insertTextbookArtifacts,
  reviewTextbookArtifact,
} from '@/lib/textbook-reference/repository';
import type { TextbookArtifact } from '@/lib/textbook-reference/types';
import type { KnowledgeTreeNode } from './knowledge-tree-types';

const url = process.env.TEST_GROUNDING_DATABASE_URL;
const READY = !!url && new URL(url).pathname.slice(1) === 'lesson_grounding_test';

const NODE = 'node-don-dieu-p1';
const OTHER = 'node-cuc-tri';
const BOOK = 'book-grounding';
const APPROVED_TEXT =
  "Định lí. Cho hàm số $y = f(x)$ có đạo hàm trên khoảng $K$. Nếu $f'(x) > 0$ với mọi $x \\in K$ thì hàm số đồng biến trên $K$. [mã-đối-chiếu-7Q2]";
const UNAPPROVED_TEXT = 'Câu 9: Bài tập chưa duyệt, không được gửi cho AI. [mã-chưa-duyệt-X81]';

const node = (
  id: string,
  title: string,
  parentId: string | null,
  order: number,
  kind: 'GROUP' | 'KNOWLEDGE'
): KnowledgeTreeNode => ({
  id,
  title,
  description: '',
  parentId,
  order,
  status: 'PUBLISHED',
  kind,
  identitySource: 'TREE_NATIVE',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
});

const artifact = (
  id: string,
  kind: TextbookArtifact['kind'],
  content: string
): TextbookArtifact => ({
  id,
  documentId: BOOK,
  entryId: 'toc-3',
  kind,
  title: kind === 'THEORY' ? 'Điều kiện đủ để hàm số đồng biến' : 'Câu 9',
  content,
  mathematicalNotation: [],
  printedPages: [13],
  pdfPages: [7],
  reviewStatus: 'NEEDS_REVIEW',
  verificationNotes: [],
  extractionKey: 'k'.repeat(64),
  createdAt: new Date().toISOString(),
});

const ADMIN = {
  id: 'admin-1',
  email: 'admin@test.local',
  emailVerifiedAt: new Date().toISOString(),
};
const STUDENT = {
  id: 'student-1',
  email: 'student@test.local',
  emailVerifiedAt: new Date().toISOString(),
};

describe.skipIf(!READY)('textbook-grounded lesson drafting (isolated database)', () => {
  let articlesBefore = '';
  const env = process.env;

  const saved: Record<string, string | undefined> = {};

  beforeAll(async () => {
    const admin = postgres(url!.replace(/\/lesson_grounding_test$/, '/postgres'), { max: 1 });
    await admin.unsafe('drop database if exists lesson_grounding_test with (force)');
    await admin.unsafe('create database lesson_grounding_test');
    await admin.end();
    const settings = {
      DATABASE_URL: url,
      SUPABASE_URL: 'http://127.0.0.1:9',
      SUPABASE_SERVICE_ROLE_KEY: 'unused-in-this-test',
      TEXTBOOK_STORAGE_BUCKET: 'unused',
      TEXTBOOK_INLINE_PROCESSING: 'off',
      ADMIN_EMAILS: ADMIN.email,
      GEMINI_API_KEY: 'test-key-never-sent',
      KNOWLEDGE_AI_PROVIDER: 'gemini',
    };
    for (const key of Object.keys(settings)) saved[key] = env[key];
    Object.assign(env, settings);
    await runMigrations(getSql());
    await writeKnowledgeTree({
      schemaVersion: 1,
      updatedAt: new Date().toISOString(),
      nodes: [
        node('math', 'Toán', null, 1, 'GROUP'),
        node('g12', 'Lớp 12', 'math', 1, 'GROUP'),
        node('ch1', 'Ứng dụng đạo hàm', 'g12', 1, 'GROUP'),
        node(NODE, 'Tính đơn điệu của hàm số (P1)', 'ch1', 1, 'KNOWLEDGE'),
        node(OTHER, 'Cực trị của hàm số (P1)', 'ch1', 2, 'KNOWLEDGE'),
      ],
    });
    // P1 is already published to students.
    await writeKnowledgeArticles({
      schemaVersion: 1,
      updatedAt: new Date().toISOString(),
      articles: {
        [NODE]: {
          id: `article-${NODE}`,
          knowledgeNodeId: NODE,
          title: 'Tính đơn điệu của hàm số (P1)',
          status: 'PUBLISHED',
          publishToBlog: false,
          publishToLearning: true,
          createdAt: '2026-10-19T00:00:00.000Z',
          updatedAt: '2026-10-19T00:00:00.000Z',
          blocks: [
            { id: 'block-title', type: 'TITLE', content: 'Tính đơn điệu của hàm số (P1)' },
            { id: 'o', type: 'OBJECTIVE', content: '- Nội dung đã xuất bản.' },
            { id: 'm', type: 'MAIN_CONTENT', content: 'Bài học học sinh đang học.' },
            { id: 'e', type: 'EXAMPLE', content: 'Ví dụ đã xuất bản.' },
          ],
        },
      },
    });
    articlesBefore = JSON.stringify(await readKnowledgeArticles());
    const sql = getSql();
    await sql`
      insert into tutai.textbook_documents (id, sha256, status, metadata)
      values (${BOOK}, ${'a'.repeat(64)}, 'INDEXED', ${sql.json({
        id: BOOK,
        originalFilename: 'math_book_3.pdf',
        title: 'math_book_3',
        sha256: 'a'.repeat(64),
        pdfPageCount: 200,
        storageKey: 'documents/x.pdf',
        importedAt: new Date().toISOString(),
        sourceVersion: '1',
        pageLayout: 'TWO_UP',
        tocIndexCompleteness: 'COMPLETE',
        processingErrors: [],
      } as never)})`;
    const toc = [
      ['toc-2', null, 2, 'I.I. Tính đơn điệu của hàm số', 13, 33],
      ['toc-3', 'toc-2', 3, 'A. Lý thuyết', 13, 13],
    ] as const;
    for (const [index, [id, parentId, level, heading, start, end]] of toc.entries())
      await sql`
        insert into tutai.textbook_toc_entries (document_id, id, parent_id, position, payload)
        values (${BOOK}, ${id}, ${parentId}, ${index}, ${sql.json({
          id,
          parentId,
          level,
          originalHeading: heading,
          normalizedHeading: heading.toLowerCase(),
          printedStartPage: start,
          printedEndPage: end,
          locations: [],
          status: 'VERIFIED',
        } as never)})`;
    await saveTextbookMapping({
      id: `map-${BOOK}-toc-3-${NODE}`,
      documentId: BOOK,
      entryId: 'toc-3',
      knowledgeNodeId: NODE,
      confidence: 1,
      status: 'CONFIRMED',
      confirmationRequired: false,
      updatedAt: new Date().toISOString(),
    });
    await insertTextbookArtifacts([
      artifact('art-approved', 'THEORY', APPROVED_TEXT),
      artifact('art-unapproved', 'EXERCISE', UNAPPROVED_TEXT),
    ]);
  });

  afterAll(async () => {
    await closeSql();
    // Leave no setting behind for the test files that run after this one.
    for (const [key, value] of Object.entries(saved))
      if (value === undefined) delete env[key];
      else env[key] = value;
  });

  const call = async (method: 'GET' | 'POST' | 'PATCH', body?: unknown, nodeId = NODE) => {
    const route = await import('@/app/api/knowledge-tree/[nodeId]/article/ai-draft/route');
    const request = new Request(`http://localhost/api/knowledge-tree/${nodeId}/article/ai-draft`, {
      method,
      headers: {
        host: 'localhost',
        origin: 'http://localhost',
        'content-type': 'application/json',
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });
    const handler = route[method] as (r: Request, c: unknown) => Promise<Response>;
    return handler(request, { params: Promise.resolve({ nodeId }) });
  };

  it('without an approved extract the lesson cannot be drafted "from the book"', async () => {
    session.user = ADMIN;
    const preview = await (await call('GET')).json();
    expect(preview.context.references).toMatchObject({ approved: 0, items: [] });
    expect(preview.context.references.readiness).toMatchObject({
      linkedSections: 1,
      approved: 0,
      needsReview: 2,
    });
    const refused = await call('POST', { mode: 'TEXTBOOK' });
    expect(refused.status).toBe(409);
    expect((await refused.json()).code).toBe('NO_REFERENCES');
    expect(gemini.requests).toHaveLength(0);
  });

  it('sends the approved extract text, and only it, in the real Gemini request', async () => {
    await reviewTextbookArtifact('art-approved', 'APPROVED', ADMIN.id);
    session.user = ADMIN;
    const response = await call('POST', { mode: 'TEXTBOOK' });
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(gemini.requests).toHaveLength(1);
    const sent = JSON.stringify(gemini.requests[0].contents);
    expect(sent).toContain('mã-đối-chiếu-7Q2'); // the approved text itself, not only its title
    expect(sent).toContain('math_book_3, tr. 13');
    expect(sent).not.toContain('mã-chưa-duyệt-X81');
    expect(sent).not.toContain('Câu 9');

    // Provenance: exactly what was supplied, checked against the sent prompt.
    const prompt = (gemini.requests[0].contents as Array<{ parts: Array<{ text: string }> }>)[0]
      .parts[0].text;
    expect(body.provenance).toMatchObject({
      knowledgeNodeId: NODE,
      mode: 'TEXTBOOK',
      status: 'PROPOSED',
      stored: true,
      promptSha256: createHash('sha256').update(prompt).digest('hex'),
      references: [
        {
          artifactId: 'art-approved',
          documentId: BOOK,
          entryId: 'toc-3',
          printedPages: [13],
          includedInPrompt: true,
          contentSha256: createHash('sha256').update(APPROVED_TEXT).digest('hex'),
        },
      ],
    });
    const [row] = await getSql()`
      select knowledge_node_id, mode, status, payload from tutai.lesson_draft_generations
      where id = ${body.provenance.id}`;
    expect(row).toMatchObject({ knowledge_node_id: NODE, mode: 'TEXTBOOK', status: 'PROPOSED' });
    // The stored record holds ids and hashes, never the textbook text.
    expect(JSON.stringify(row.payload)).not.toContain('mã-đối-chiếu-7Q2');

    // A reviewable draft, and the published lesson is untouched.
    expect(body.draft.MAIN_CONTENT).toContain('đồng biến');
    expect(body.context.references.used).toBe(true);
    expect(JSON.stringify(await readKnowledgeArticles())).toBe(articlesBefore);
  });

  it('general drafting never sends the book and says so', async () => {
    session.user = ADMIN;
    const body = await (await call('POST', { mode: 'GENERAL' })).json();
    const sent = JSON.stringify(gemini.requests.at(-1)!.contents);
    expect(sent).not.toContain('mã-đối-chiếu-7Q2');
    expect(sent).not.toContain('Tư liệu tham khảo');
    expect(body.provenance).toMatchObject({ mode: 'GENERAL', references: [] });
    expect(body.context.references.used).toBe(false);
  });

  it('references stay with their lesson: another lesson gets nothing from P1’s link', async () => {
    session.user = ADMIN;
    const refused = await call('POST', { mode: 'TEXTBOOK' }, OTHER);
    expect(refused.status).toBe(409);
  });

  it('records apply and save as forward-only steps, for the right lesson only', async () => {
    session.user = ADMIN;
    const draft = await (await call('POST', { mode: 'TEXTBOOK' })).json();
    const id = draft.provenance.id;
    expect(
      (await (await call('PATCH', { generationId: id, status: 'SAVED' }, OTHER)).json()).recorded
    ).toBe(false);
    expect(
      (
        await (
          await call('PATCH', {
            generationId: id,
            status: 'APPLIED',
            blocks: ['MAIN_CONTENT', 'BOGUS'],
          })
        ).json()
      ).generation
    ).toMatchObject({ status: 'APPLIED', appliedBlocks: ['MAIN_CONTENT'] });
    expect(
      (await (await call('PATCH', { generationId: id, status: 'SAVED' })).json()).generation.status
    ).toBe('SAVED');
    expect(
      (await (await call('PATCH', { generationId: id, status: 'APPLIED' })).json()).recorded
    ).toBe(false);
    const preview = await (await call('GET')).json();
    expect(preview.context.history[0]).toMatchObject({ id, status: 'SAVED', mode: 'TEXTBOOK' });
  });

  it('a student or a signed-out visitor reaches none of it', async () => {
    const textbooks = await import('@/app/api/admin/textbooks/route');
    for (const user of [STUDENT, null]) {
      session.user = user;
      const expected = user ? 403 : 401;
      const lesson = await textbooks.GET(
        new Request(`http://localhost/api/admin/textbooks?nodeId=${NODE}`)
      );
      expect(lesson.status).toBe(expected);
      expect(await lesson.text()).not.toContain('mã-đối-chiếu-7Q2');
      for (const method of ['GET', 'POST', 'PATCH'] as const) {
        const response = await call(method, method === 'GET' ? undefined : { mode: 'TEXTBOOK' });
        expect(response.status).toBe(expected);
        expect(await response.text()).not.toContain('mã-đối-chiếu-7Q2');
      }
    }
    // Student lesson content is the published article, unchanged by all of the above.
    expect(JSON.stringify(await readKnowledgeArticles())).toBe(articlesBefore);
  });
});
