/**
 * Exercise-page extraction end to end on an isolated PostgreSQL database named
 * exactly `textbook_reference_test` (TEST_DATABASE_URL), with the book's real
 * outline, anchors and links copied from Production. The provider is scripted,
 * so every failure mode is reproducible and free; with TEST_TEXTBOOK_PDF set,
 * pages 19–20 are rendered from the real scanned PDF instead of stand-in images.
 */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';
import { vi } from 'vitest';

vi.mock('./pdf-pages', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./pdf-pages')>();
  if (process.env.TEST_TEXTBOOK_PDF) return actual;
  return {
    ...actual,
    renderPrintedPageCrops: async (
      _bytes: Uint8Array,
      pages: Array<{ printedPage: number; pdfPage: number; position: 'LEFT' | 'RIGHT' }>
    ) => pages.map((page) => ({ ...page, width: 1100, height: 1556, bytes: Buffer.from('png') })),
  };
});

import { closeSql } from '@/lib/db/postgres';
import { runMigrations } from '@/lib/db/migrations';
import { queueTextbookExtraction, TextbookRequestError } from './extraction-service';
import {
  approvedArtifactsForNode,
  insertTextbookArtifacts,
  insertTextbookDocument,
  listTextbookArtifacts,
  listTextbookJobs,
  replaceTextbookAnchors,
  replaceTextbookToc,
  reviewTextbookArtifact,
  saveTextbookMapping,
} from './repository';
import { selectLessonReferences } from './reference-service';
import type { VisionProvider } from './vision-provider';
import { processNextTextbookJob } from './worker';
import type { TextbookArtifact, TextbookTocEntry } from './types';

const env = process.env;
const dbName = env.TEST_DATABASE_URL ? new URL(env.TEST_DATABASE_URL).pathname.slice(1) : '';
const READY = dbName === 'textbook_reference_test';

const DOC = 'textbook-28823755f9b0448a';
const NODE = 'knowledge-45c34e43-ad2e-47bf-8845-68782b67cfb9'; // P1 "Tính đơn điệu của hàm số"
const worker = { id: 'it-exercise-worker', hostname: 'test', startedAt: new Date().toISOString() };

const toc = (
  id: string,
  parentId: string | null,
  level: number,
  heading: string,
  start: number,
  end: number
): TextbookTocEntry => ({
  id,
  parentId,
  level,
  originalHeading: heading,
  normalizedHeading: heading.normalize('NFC').toLocaleLowerCase('vi'),
  printedStartPage: start,
  printedEndPage: end,
  locations: [],
  status: 'OBSERVED',
});
const TOC = [
  toc('toc-1', null, 1, 'Chủ đề 1: Hàm số và các ứng dụng của đạo hàm', 13, 136),
  toc('toc-2', 'toc-1', 2, 'I.I. Tính đơn điệu của hàm số', 13, 33),
  toc('toc-3', 'toc-2', 3, 'A. Lý thuyết', 13, 13),
  toc('toc-4', 'toc-2', 3, 'B. Bài tập trong các đề thi thử của các trường', 14, 33),
  toc('toc-5', 'toc-4', 4, 'Dạng 1: Bài toán không chứa tham số', 14, 18),
  toc('toc-6', 'toc-4', 4, 'Bài tập rèn luyện kỹ năng', 19, 20),
  toc('toc-7', 'toc-4', 4, 'Dạng 2: Bài toán chứa tham số', 21, 27),
  toc('toc-8', 'toc-4', 4, 'Bài tập rèn luyện kỹ năng', 28, 28),
  toc('toc-9', 'toc-4', 4, 'Hướng dẫn giải chi tiết', 29, 33),
  toc(
    'toc-10',
    'toc-1',
    2,
    'I.II. Cực trị của hàm số và giá trị lớn nhất, giá trị nhỏ nhất của hàm số',
    34,
    97
  ),
];

/** Scripted provider: each call takes the next answer and records what it was sent. */
const script: Array<Awaited<ReturnType<VisionProvider>>> = [];
const sent: Array<{ prompt: string; images: number }> = [];
const provider: VisionProvider = async ({ prompt, images }) => {
  sent.push({ prompt, images: images.length });
  const next = script.shift();
  if (!next) throw new Error('The test provider has no scripted answer left.');
  return next;
};
const answer = (body: object, finishReason = 'STOP') => ({
  text: JSON.stringify(body),
  usage: { input: 2600, output: 900 },
  finishReason,
});
const mcq = (number: number, statement: string, page: number) => ({
  kind: 'EXERCISE',
  questionNumber: String(number),
  title: `Câu ${number}`,
  content: `Câu ${number}: ${statement}\nA. $(-\\infty; 0)$\nB. $(0; 2)$\nC. $(2; +\\infty)$\nD. $(-1; 1)$`,
  choices: [
    { label: 'A', text: '$(-\\infty; 0)$' },
    { label: 'B', text: '$(0; 2)$' },
    { label: 'C', text: '$(2; +\\infty)$' },
    { label: 'D', text: '$(-1; 1)$' },
  ],
  printedPages: [page],
});

const approvedSeed: TextbookArtifact[] = [
  ['THEORY', 'toc-3', 13, 'A. Lý thuyết - Tính đơn điệu của hàm số'],
  ['METHOD', 'toc-5', 14, 'Sử dụng máy tính Casio để xét tính đơn điệu của hàm số'],
  ['WORKED_EXAMPLE', 'toc-5', 14, 'Ví dụ 1: Xét tính nghịch biến của hàm số $y = \\sqrt{x - x^2}$'],
  ['THEORY', 'toc-5', 14, 'Quy tắc xét tính đơn điệu của hàm số'],
].map(([kind, entryId, page, title], index) => ({
  id: `approved-${index}`,
  documentId: DOC,
  entryId: entryId as string,
  kind: kind as TextbookArtifact['kind'],
  title: title as string,
  content: `${title}: nội dung đã duyệt, đủ dài để được chọn làm tư liệu cho AI soạn nháp.`,
  mathematicalNotation: [],
  printedPages: [page as number],
  pdfPages: [page === 13 ? 7 : 8],
  reviewStatus: 'NEEDS_REVIEW',
  verificationNotes: [],
  extractionKey: createHash('sha256').update(`seed-${entryId}-${page}`).digest('hex'),
  createdAt: '2026-10-24T07:16:21.000Z',
}));

async function runQueued() {
  const outcome = await processNextTextbookJob(worker, {
    provider,
    readPdf: async () =>
      env.TEST_TEXTBOOK_PDF ? readFile(env.TEST_TEXTBOOK_PDF) : Buffer.from(''),
  });
  if (!outcome) throw new Error('No job was queued.');
  return outcome.job;
}

async function approvedSnapshot() {
  const rows = await listTextbookArtifacts({ documentId: DOC });
  return createHash('sha256')
    .update(
      JSON.stringify(
        rows
          .filter((row) => row.id.startsWith('approved-'))
          .map((row) => ({
            id: row.id,
            reviewStatus: row.reviewStatus,
            content: row.content,
            title: row.title,
          }))
      )
    )
    .digest('hex');
}

describe.skipIf(!READY)('exercise-only textbook pages on isolated PostgreSQL', () => {
  let snapshot = '';
  const extract = (printedPages: number[], entryIds: string[]) =>
    queueTextbookExtraction({ documentId: DOC, knowledgeNodeId: NODE, entryIds, printedPages });

  beforeAll(async () => {
    Object.assign(process.env, {
      DATABASE_URL: env.TEST_DATABASE_URL,
      SUPABASE_URL: 'http://storage.invalid',
      SUPABASE_SERVICE_ROLE_KEY: 'unused-by-this-test',
      TEXTBOOK_STORAGE_BUCKET: 'textbook-reference-test',
    });
    const admin = postgres(env.TEST_DATABASE_URL!, { max: 1, onnotice: () => {} });
    try {
      await runMigrations(admin);
      await admin`truncate tutai.textbook_documents, tutai.textbook_uploads, tutai.textbook_workers cascade`;
    } finally {
      await admin.end();
    }
    const sha256 = '28823755f9b0448a113ece6dd1f33195d001366e4a08d34995df00040c7f6e76';
    await insertTextbookDocument({
      id: DOC,
      originalFilename: 'math_book_3.pdf',
      title: 'math_book_3',
      sha256,
      byteSize: 49892506,
      pdfPageCount: 202,
      storageKey: `documents/${sha256}.pdf`,
      status: 'INDEXED',
      importedAt: '2026-10-22T04:31:10.565Z',
      sourceVersion: sha256,
      pageLayout: 'TWO_UP',
      tocPdfPages: [5, 6, 7],
      tocIndexCompleteness: 'PARTIAL',
      processingErrors: [],
      anchors: [],
      tocEntries: [],
    });
    await replaceTextbookAnchors(DOC, [
      { printedPage: 13, pdfPage: 7, position: 'RIGHT', evidence: 'Admin' },
      { printedPage: 39, pdfPage: 20, position: 'RIGHT', evidence: 'Admin' },
    ]);
    await replaceTextbookToc(DOC, TOC, 'PARTIAL');
    for (const entryId of ['toc-3', 'toc-5', 'toc-6', 'toc-9'])
      await saveTextbookMapping({
        id: `map-${DOC}-${entryId}-${NODE}`,
        documentId: DOC,
        knowledgeNodeId: NODE,
        entryId,
        confidence: 1,
        status: 'CONFIRMED',
        confirmationRequired: false,
        updatedAt: new Date().toISOString(),
      });
    await insertTextbookArtifacts(approvedSeed);
    for (const artifact of approvedSeed)
      await reviewTextbookArtifact(artifact.id, 'APPROVED', 'it');
    snapshot = await approvedSnapshot();
  }, 60_000);

  afterAll(async () => {
    await closeSql();
  });

  it('1 reports the v8 failure honestly: an empty answer for readable pages is an unusable response, with usage kept', async () => {
    const { job: queued } = await extract([19, 20], ['toc-6']);
    expect(queued.promptVersion).toBe('textbook-knowledge-v9');
    script.push(
      answer({
        pages: [
          { printedPage: 19, status: 'READ' },
          { printedPage: 20, status: 'READ' },
        ],
        items: [],
        unreadable: [],
      })
    );
    const job = await runQueued();
    expect(job).toMatchObject({
      status: 'FAILED',
      errorCode: 'INVALID_RESPONSE',
      retryable: true,
      providerCalls: 1,
      tokenUsage: { input: 2600, output: 900 },
    });
    expect(job.error).not.toMatch(/Gemini returned|không xác định/);
    expect(
      job.diagnostics?.images.map((image) => [image.printedPage, image.pdfPage, image.position])
    ).toEqual([
      [19, 10, 'RIGHT'],
      [20, 11, 'LEFT'],
    ]);
    expect(sent.at(-1)).toMatchObject({ images: 2 });
    const [stored] = await listTextbookJobs({ jobKey: job.extractionKey });
    expect(stored).toMatchObject({
      status: 'FAILED',
      errorCode: 'INVALID_RESPONSE',
      providerCalls: 1,
    });
    expect(await listTextbookArtifacts({ extractionKey: job.extractionKey })).toEqual([]);
  });

  it('2 keeps every valid question when one is out of range and one is unreadable (partial success)', async () => {
    await extract([19, 20], ['toc-6']);
    script.push(
      answer({
        pages: [
          { printedPage: 19, status: 'READ' },
          { printedPage: 20, status: 'PARTLY_READABLE', note: 'Mờ ở cuối trang' },
        ],
        items: [
          mcq(1, 'Hàm số $y = x^3 - 3x^2 + 2$ nghịch biến trên khoảng nào?', 19),
          mcq(2, 'Hàm số $y = x^4 - 2x^2 + 1$ đồng biến trên khoảng nào?', 19),
          {
            ...mcq(3, 'Cho hàm số $y = \\frac{x+1}{x-1}$. Khẳng định nào đúng?', 20),
            hasDiagram: false,
          },
          { ...mcq(4, 'Lạc trang', 25) },
        ],
        unreadable: [
          { printedPage: 20, reference: 'Câu 5', reason: 'Chữ bị nhòe, không đọc được công thức.' },
        ],
      })
    );
    const job = await runQueued();
    expect(job).toMatchObject({ status: 'COMPLETED', outcome: 'PARTIAL', providerCalls: 1 });
    expect(job.diagnostics).toMatchObject({
      itemsReturned: 4,
      itemsAccepted: 3,
      questions: 3,
      rejectedItems: [{ reference: 'Câu 4', reason: expect.stringContaining('không thuộc') }],
      unreadable: [{ printedPage: 20, reference: 'Câu 5' }],
    });
    const questions = await listTextbookArtifacts({ extractionKey: job.extractionKey });
    expect(questions).toHaveLength(3);
    for (const item of questions)
      expect(item).toMatchObject({
        kind: 'EXERCISE',
        entryId: 'toc-6',
        reviewStatus: 'NEEDS_REVIEW',
        solutionStatus: 'UNRESOLVED',
        answer: { status: 'UNRESOLVED' },
        exerciseSet: { chapterEntryId: 'toc-2', problemType: 'dạng 1' },
      });
    expect(questions.find((item) => item.questionNumber === '3')).toMatchObject({
      printedPages: [20],
      pdfPages: [11],
    });
    expect(questions[0].choices).toHaveLength(4);
  });

  it('3 a repeated request reuses the stored questions: no Gemini call, no duplicates', async () => {
    const before = sent.length;
    const again = await extract([19, 20], ['toc-6']);
    expect(again).toMatchObject({ cacheHit: true });
    expect(again.artifacts).toHaveLength(3);
    expect(sent.length).toBe(before);
    expect(
      (await listTextbookArtifacts({ documentId: DOC })).filter((item) => item.kind === 'EXERCISE')
    ).toHaveLength(3);
  });

  it('4 matches a solution printed on page 29 only when set, number and mathematics agree', async () => {
    await extract([29], ['toc-9']);
    script.push(
      answer({
        pages: [{ printedPage: 29, status: 'READ' }],
        items: [
          {
            kind: 'SOLUTION',
            questionNumber: '1',
            title: 'Câu 1',
            exerciseSetLabel: 'Dạng 1',
            answerChoice: 'B',
            content: "Câu 1. Chọn B.\nTa có $y' = 3x^2 - 6x$; $y' < 0 \\Leftrightarrow 0 < x < 2$.",
            printedPages: [29],
          },
          // Same set and number as Câu 2, but a different function: unrelated, must not pair.
          {
            kind: 'SOLUTION',
            questionNumber: '2',
            title: 'Câu 2',
            exerciseSetLabel: 'Dạng 1',
            answerChoice: 'C',
            content: "Câu 2. Chọn C.\nTa có $y' = 6x^2 - 6$.",
            printedPages: [29],
          },
          // Câu 3 of the other set ("Dạng 2"): never paired with Dạng 1's Câu 3.
          {
            kind: 'SOLUTION',
            questionNumber: '3',
            title: 'Câu 3',
            exerciseSetLabel: 'Dạng 2',
            answerChoice: 'A',
            content: 'Câu 3. Xét $y = \\frac{x+1}{x-1}$ ...',
            printedPages: [29],
          },
        ],
        unreadable: [],
      })
    );
    const job = await runQueued();
    expect(job).toMatchObject({ status: 'COMPLETED', outcome: 'COMPLETE' });
    expect(job.diagnostics?.solutionsMatched).toBe(1);
    const all = await listTextbookArtifacts({ documentId: DOC });
    const byNumber = (kind: string, number: string) =>
      all.find((item) => item.kind === kind && item.questionNumber === number)!;
    expect(byNumber('EXERCISE', '1')).toMatchObject({
      solutionStatus: 'MATCHED',
      pairedArtifactId: byNumber('SOLUTION', '1').id,
      answer: { status: 'FROM_SOLUTION', choice: 'B' },
      reviewStatus: 'NEEDS_REVIEW',
    });
    expect(byNumber('EXERCISE', '2')).toMatchObject({
      solutionStatus: 'UNRESOLVED',
      answer: { status: 'UNRESOLVED' },
    });
    expect(byNumber('EXERCISE', '2').pairedArtifactId).toBeUndefined();
    expect(byNumber('EXERCISE', '3').pairedArtifactId).toBeUndefined();
  });

  it('5 unresolved questions stay out of AI drafting even when approved; approved theory is unchanged', async () => {
    const all = await listTextbookArtifacts({ documentId: DOC });
    const unresolved = all.find((item) => item.kind === 'EXERCISE' && item.questionNumber === '2')!;
    await reviewTextbookArtifact(unresolved.id, 'APPROVED', 'it');
    const approved = await approvedArtifactsForNode(NODE);
    const references = selectLessonReferences(approved, new Map([[DOC, 'math_book_3']]));
    expect(references.map((item) => item.artifactId)).not.toContain(unresolved.id);
    expect(references.map((item) => item.artifactId)).toEqual(
      expect.arrayContaining(['approved-0', 'approved-1', 'approved-2', 'approved-3'])
    );
    await reviewTextbookArtifact(unresolved.id, 'NEEDS_REVIEW', 'it');
    expect(await approvedSnapshot()).toBe(snapshot);
  });

  it('6 a cut-off answer keeps the questions that finished', async () => {
    await extract([19], ['toc-6']);
    const body = JSON.stringify({
      pages: [{ printedPage: 19, status: 'READ' }],
      items: [
        mcq(1, 'Hàm số $y = x^3 - 3x^2 + 2$ nghịch biến trên khoảng nào?', 19),
        mcq(2, 'Hàm số $y = x^4 - 2x^2 + 1$ đồng biến trên khoảng nào?', 19),
      ],
    });
    script.push({
      text: body.slice(0, body.length - 60),
      usage: { input: 1300, output: 32768 },
      finishReason: 'MAX_TOKENS',
    });
    const job = await runQueued();
    expect(job).toMatchObject({
      status: 'COMPLETED',
      outcome: 'PARTIAL',
      diagnostics: { truncated: true, itemsAccepted: 1, finishReason: 'MAX_TOKENS' },
    });
  });

  it('7 retries are bounded: an unreadable scan is not resent, and three failures stop further calls', async () => {
    await extract([20], ['toc-6']);
    script.push(
      answer({
        pages: [{ printedPage: 20, status: 'UNREADABLE', note: 'Bản quét quá mờ' }],
        items: [],
        unreadable: [],
      })
    );
    const unreadable = await runQueued();
    expect(unreadable).toMatchObject({
      status: 'FAILED',
      errorCode: 'UNREADABLE',
      retryable: false,
    });
    const calls = sent.length;
    await expect(extract([20], ['toc-6'])).rejects.toBeInstanceOf(TextbookRequestError);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await extract([30], ['toc-9']);
      script.push({ text: 'not json', usage: { input: 1, output: 1 }, finishReason: 'STOP' });
      expect(await runQueued()).toMatchObject({ status: 'FAILED', errorCode: 'INVALID_RESPONSE' });
    }
    await expect(extract([30], ['toc-9'])).rejects.toThrow(/3 lần/);
    expect(sent.length).toBe(calls + 3);
  });

  it('7b outages and quota limits never block the pages', async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await extract([31], ['toc-9']);
      const failing: VisionProvider = async () => {
        throw new Error(JSON.stringify({ error: { code: 429, status: 'RESOURCE_EXHAUSTED' } }));
      };
      const outcome = await processNextTextbookJob(worker, {
        provider: failing,
        readPdf: async () => Buffer.from(''),
      });
      expect(outcome?.job).toMatchObject({ status: 'FAILED', errorCode: 'QUOTA', retryable: true });
    }
    await expect(extract([31], ['toc-9'])).resolves.toMatchObject({ cacheHit: false });
  });

  it('8 nothing reaches students or the Question Bank', async () => {
    const admin = postgres(env.TEST_DATABASE_URL!, { max: 1, onnotice: () => {} });
    try {
      const tables = await admin`
        select table_name from information_schema.tables
        where table_schema = 'tutai' and table_name ~ '(question|practice|exam)'`;
      for (const { table_name } of tables) {
        const [{ count }] = await admin.unsafe(
          `select count(*)::int as count from tutai.${table_name}`
        );
        expect({ table: table_name, count }).toEqual({ table: table_name, count: 0 });
      }
      // The Question Bank is a content document; extraction never writes one.
      const bank = await admin`
        select key from tutai.content_documents where key like 'question-bank/%'`;
      expect(bank).toHaveLength(0);
    } finally {
      await admin.end();
    }
  });

  it('runs on the real scanned pages when TEST_TEXTBOOK_PDF is set', async () => {
    if (!env.TEST_TEXTBOOK_PDF) return;
    const bytes = await readFile(env.TEST_TEXTBOOK_PDF);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(
      '28823755f9b0448a113ece6dd1f33195d001366e4a08d34995df00040c7f6e76'
    );
  });
});
