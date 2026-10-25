/**
 * Textbook exercises → Question Bank, on isolated PostgreSQL only: a database
 * created next to `textbook_reference_test` (TEST_DATABASE_URL), never a real
 * one. Uses the real fixture of math_book_3.pdf (pages 19–20 and 29) and the
 * bank's own PATCH route for review and publishing.
 */
import postgres from 'postgres';
import { vi } from 'vitest';

vi.mock('@/lib/auth/admin', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/admin')>()),
  adminApiGuard: async () => null,
}));

import { PATCH } from '@/app/api/question-bank/[questionId]/route';
import { closeSql } from '@/lib/db/postgres';
import { runMigrations } from '@/lib/db/migrations';
import { listQuestions } from '@/lib/question-bank/qb-storage';
import { pickLessonSession } from '@/lib/practice/practice-rules';
import fixture from './fixtures/math-book-3-real.json';
import { exerciseSetFor, validateItem } from './extraction-response';
import {
  assignLesson,
  clearVerification,
  confirmSolution,
  importExercises,
  loadLessonPractice,
  saveExerciseDraft,
} from './practice-service';
import {
  insertTextbookArtifacts,
  insertTextbookDocument,
  listTextbookArtifacts,
  replaceTextbookAnchors,
  replaceTextbookToc,
  saveTextbookMapping,
} from './repository';
import type { TextbookArtifact, TextbookTocEntry } from './types';

const env = process.env;
const base = env.TEST_DATABASE_URL ? new URL(env.TEST_DATABASE_URL) : null;
const READY = base?.pathname.slice(1) === 'textbook_reference_test';
const DB = 'textbook_practice_test';

const DOC = 'textbook-28823755f9b0448a';
const P1 = 'knowledge-p1';
const P2 = 'knowledge-p2';
const T = '2026-10-24T00:00:00.000Z';
const node = (
  id: string,
  parentId: string | null,
  title: string,
  kind: string,
  nodeType: string,
  order = 1
) => ({
  id,
  parentId,
  title,
  kind,
  nodeType,
  order,
  status: 'DRAFT',
  description: '',
  createdAt: T,
  updatedAt: T,
  identitySource: 'TREE_IMPORT',
  hasLearningContent: kind === 'KNOWLEDGE',
});
const tree = {
  schemaVersion: 1,
  updatedAt: T,
  nodes: [
    node('k-math', null, 'Toán', 'GROUP', 'MON_HOC'),
    node('k-12', 'k-math', '12', 'GROUP', 'LOP'),
    node(
      'k-ch1',
      'k-12',
      'ỨNG DỤNG ĐẠO HÀM ĐỂ KHẢO SÁT VÀ VẼ ĐỒ THỊ CỦA HÀM SỐ',
      'GROUP',
      'CHUONG'
    ),
    node(P1, 'k-ch1', 'Tính đơn điệu của hàm số (P1)', 'KNOWLEDGE', 'KIEN_THUC', 1),
    node(P2, 'k-ch1', 'Tính đơn điệu của hàm số (P2)', 'KNOWLEDGE', 'KIEN_THUC', 2),
  ],
};
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
  normalizedHeading: heading.toLocaleLowerCase('vi'),
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
];

function extracted(entryId: string, items: object[], pages: number[]): TextbookArtifact[] {
  const entry = TOC.find((item) => item.id === entryId)!;
  return items.map((raw, index) => {
    const result = validateItem(raw, index, {
      documentId: DOC,
      entryId,
      extractionKey: `fixture-${entryId}`,
      pages,
      pdfPageOf: (page) => Math.floor(page / 2) + 1,
      exerciseSet: exerciseSetFor(entry, TOC),
      createdAt: T,
    });
    if (!result.ok) throw new Error(result.reason);
    return result.artifact;
  });
}
const exercises = extracted(
  'toc-6',
  fixture.exercises.map((e) => ({ kind: 'EXERCISE', title: `Câu ${e.questionNumber}`, ...e })),
  [19, 20]
);
const solutions = extracted(
  'toc-9',
  fixture.solutions.map((s) => ({ kind: 'SOLUTION', title: `Câu ${s.questionNumber}`, ...s })),
  [29]
);
const ex = (n: string) => exercises.find((a) => a.questionNumber === n)!;
const sol = (n: string) => solutions.find((a) => a.questionNumber === n)!;
const q13 = extracted(
  'toc-6',
  [
    {
      kind: 'EXERCISE',
      title: 'Câu 13',
      questionNumber: '13',
      printedPages: [20],
      content:
        'Câu 13: Cho hàm số $y = \\sqrt{2x - x^2}$. Hàm số đồng biến trên khoảng nào?\nA. $(-\\infty; 2)$\nB. $(0; 1)$\nC. $(1; 2)$\nD. $(1; +\\infty)$',
      choices: [
        { label: 'A', text: '$(-\\infty; 2)$' },
        { label: 'B', text: '$(0; 1)$' },
        { label: 'C', text: '$(1; 2)$' },
        { label: 'D', text: '$(1; +\\infty)$' },
      ],
    },
  ],
  [20]
)[0];
const s13 = extracted(
  'toc-9',
  [
    {
      kind: 'SOLUTION',
      title: 'Câu 13',
      questionNumber: '13',
      content:
        "Câu 13: Tập xác định $[0; 2]$. $y' = \\frac{-2x+2}{2\\sqrt{2x-x^2}} = \\frac{1-x}{\\sqrt{2x-x^2}}$. $y' > 0$ $\\forall x \\in (0; 1)$ nên hàm số đồng biến trên $(0;1)$.",
      printedPages: [30],
      exerciseSetLabel: 'Dạng 1: Bài tập không chứa tham số',
    },
  ],
  [30]
)[0];
const patch = (id: string, body: object) =>
  PATCH(new Request('http://test/api', { method: 'PATCH', body: JSON.stringify(body) }), {
    params: Promise.resolve({ questionId: id }),
  });

describe.skipIf(!READY)('textbook exercises into the Question Bank (isolated PostgreSQL)', () => {
  beforeAll(async () => {
    const server = postgres(base!.toString(), { max: 1, onnotice: () => {} });
    await server.unsafe(`drop database if exists ${DB}`);
    await server.unsafe(`create database ${DB}`);
    await server.end();
    const url = new URL(base!.toString());
    url.pathname = `/${DB}`;
    Object.assign(process.env, {
      DATABASE_URL: url.toString(),
      SUPABASE_URL: 'http://storage.invalid',
      SUPABASE_SERVICE_ROLE_KEY: 'unused-by-this-test',
      TEXTBOOK_STORAGE_BUCKET: 'textbook-practice-test',
    });
    const admin = postgres(url.toString(), { max: 1, onnotice: () => {} });
    await runMigrations(admin);
    await admin`insert into tutai.content_documents (key, body) values ('knowledge-tree/tree', ${admin.json(tree as never)})`;
    await admin.end();
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
      importedAt: T,
      sourceVersion: sha256,
      pageLayout: 'TWO_UP',
      tocPdfPages: [5],
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
    // As in Production: P1 uses theory and Dạng 1; the exercise list is not one of its references.
    for (const [entryId, status] of [
      ['toc-3', 'CONFIRMED'],
      ['toc-5', 'CONFIRMED'],
      ['toc-6', 'REJECTED'],
    ] as const)
      await saveTextbookMapping({
        id: `map-${entryId}`,
        documentId: DOC,
        knowledgeNodeId: P1,
        entryId,
        confidence: 1,
        status,
        confirmationRequired: false,
        updatedAt: T,
      });
    await insertTextbookArtifacts([...exercises, ...solutions]);
  }, 60_000);

  afterAll(async () => {
    await closeSql();
  });

  it('shows the P1 workspace: suggested lesson, suggestions, solution pages, counts', async () => {
    const workspace = (await loadLessonPractice(P1))!;
    const set = workspace.sets.find((item) => item.entryId === 'toc-6')!;
    expect(set.lesson).toMatchObject({ lessonId: P1, via: 'PROBLEM_TYPE' });
    expect(set.solutionSources[0].chunks.map((c) => [c.pages, c.extracted])).toEqual([
      [[29, 30, 31], true],
      [[32, 33], false],
    ]);
    const status = (n: string) => set.exercises.find((e) => e.questionNumber === n)!.status;
    expect(['1', '2', '3', '4', '7', '8'].map(status)).toEqual([
      'SUGGESTED',
      'SUGGESTED',
      'SUGGESTED',
      'NEEDS_CONFIRMATION',
      'NEEDS_CONFIRMATION',
      'UNRESOLVED',
    ]);
    expect(workspace.counts).toMatchObject({
      extracted: 8,
      solutionsConfirmed: 0,
      imported: 0,
      availableToStudents: 0,
    });
    expect(workspace.lessons.map((l) => l.id)).toEqual([P1, P2]);
    expect(workspace.pageLayouts[DOC][19]).toEqual({ pdfPage: 10, position: 'RIGHT' });
    expect(workspace.pageLayouts[DOC][29]).toEqual({ pdfPage: 15, position: 'RIGHT' });
  });

  it('persists a unique mathematical match automatically and imports it only as a draft', async () => {
    await insertTextbookArtifacts([q13, s13]);
    const first = await loadLessonPractice(P1);
    const view = first!.sets.flatMap((set) => set.exercises).find((item) => item.id === q13.id)!;
    expect(view).toMatchObject({
      status: 'MATCHED',
      answer: 'B',
      verification: {
        method: 'AUTO_VERIFIED_SOLUTION',
        solutionArtifactId: s13.id,
        verificationSummary: expect.arrayContaining([
          expect.stringMatching(/đạo hàm|phương án B/u),
        ]),
      },
    });
    const second = await loadLessonPractice(P1);
    expect(second?.counts.autoVerified).toBe(1);
    const outcome = await importExercises(P1, [q13.id], 'REVIEW_REQUIRED', 'it-admin');
    expect(outcome[0].result).toBe('CREATED');
    const question = (await listQuestions({ pageSize: 100_000 })).questions.find(
      (item) => item.externalId === textbookExternalId(q13.id)
    );
    expect(question).toMatchObject({
      editorialStatus: 'DRAFT',
      correctAnswer: 'B',
      textbookSource: { verification: 'AUTO_VERIFIED_SOLUTION' },
    });
  });

  it('imports a confirmed question once, even when two imports race', async () => {
    await confirmSolution(ex('3').id, sol('3').id, 'admin-1');
    // Câu 7 has only "Đáp án C.": it is refused until the Admin writes an explanation.
    // Câu 7's printed solution is only "Đáp án C.": the Admin acknowledges that nothing else can be compared.
    await expect(confirmSolution(ex('7').id, sol('7').id, 'admin-1')).rejects.toMatchObject({
      status: 409,
      conflicts: [expect.stringMatching(/^Chưa đối chiếu được nội dung toán/)],
    });
    await confirmSolution(ex('7').id, sol('7').id, 'admin-1', [
      'Chưa đối chiếu được nội dung toán: lời giải không nhắc lại hàm số hay đạo hàm của đề',
    ]);
    const [first, second] = await Promise.all([
      importExercises(P1, [ex('3').id, ex('7').id, ex('8').id], 'LICENSED', 'admin-1'),
      importExercises(P1, [ex('3').id], 'LICENSED', 'admin-1'),
    ]);
    const results = [...first, ...second]
      .filter((o) => o.exerciseId === ex('3').id)
      .map((o) => o.result)
      .sort();
    expect(results).toEqual(['CREATED', 'UNCHANGED']);
    expect(first.find((o) => o.exerciseId === ex('7').id)).toMatchObject({ result: 'SKIPPED' });
    expect(first.find((o) => o.exerciseId === ex('7').id)?.reason).toMatch(/Cần lời giải/);
    expect(first.find((o) => o.exerciseId === ex('8').id)?.reason).toMatch(/Chưa xác nhận đáp án/);
    const { questions } = await listQuestions({ pageSize: 100 });
    expect(questions).toHaveLength(1);
    expect(questions[0]).toMatchObject({
      editorialStatus: 'DRAFT',
      primaryKnowledgeNodeId: P1,
      subjectId: 'MATH',
      grade: 12,
      correctAnswer: 'A',
      textbookSource: {
        exerciseArtifactId: ex('3').id,
        solutionArtifactId: sol('3').id,
        verification: 'TEXTBOOK_SOLUTION',
      },
    });
    const stored = (await listTextbookArtifacts({ documentId: DOC })).find(
      (a) => a.id === ex('3').id
    )!;
    expect(stored.practice?.imported?.questionId).toBe(questions[0].id);
  });

  it('publishes only through the bank workflow, and never overwrites the published question', async () => {
    const [question] = (await listQuestions({ pageSize: 100 })).questions;
    expect(pickLessonSession([question], P1)).toEqual([]);
    expect((await patch(question.id, { editorialStatus: 'IN_REVIEW' })).status).toBe(200);
    const published = await patch(question.id, {
      editorialStatus: 'PUBLISHED',
      usageContexts: ['OPEN_PRACTICE'],
    });
    expect(published.status).toBe(200);
    const [live] = (await listQuestions({ pageSize: 100 })).questions;
    expect(pickLessonSession([live], P1).map((q) => q.id)).toEqual([question.id]);

    // Once published, the workspace no longer edits the question's answer, wording or lesson.
    await expect(
      saveExerciseDraft(
        ex('3').id,
        {
          stem: 'Đề đã sửa $y = x^3 + 3x^2 - 4$?',
          choices: ex('3').choices!,
          explanation: 'Lời giải đã sửa, đủ dài để giải thích.',
        },
        'admin-1'
      )
    ).rejects.toMatchObject({ status: 409 });
    await expect(clearVerification(ex('3').id)).rejects.toMatchObject({ status: 409 });
    await expect(assignLesson([ex('3').id], P2, 'admin-1')).rejects.toMatchObject({
      status: 409,
    });
    const again = await importExercises(P1, [ex('3').id], 'LICENSED', 'admin-1');
    expect(again[0]).toMatchObject({ result: 'UNCHANGED', questionId: question.id });
    const [after] = (await listQuestions({ pageSize: 100 })).questions;
    expect(after).toEqual(live);
    const workspace = (await loadLessonPractice(P1))!;
    expect(workspace.counts).toMatchObject({
      imported: 1,
      assignedHere: 1,
      availableToStudents: 1,
    });
  });

  it('assigns a question to P2 when the Admin says so; P2 practice then holds it', async () => {
    await assignLesson([ex('5').id], P2, 'admin-1');
    await confirmSolution(ex('5').id, sol('5').id, 'admin-1');
    const [outcome] = await importExercises(P1, [ex('5').id], 'LICENSED', 'admin-1');
    expect(outcome.result).toBe('CREATED');
    const question = (await listQuestions({ pageSize: 100 })).questions.find(
      (q) => q.id === outcome.questionId
    )!;
    expect(question.primaryKnowledgeNodeId).toBe(P2);
    const workspace = (await loadLessonPractice(P1))!;
    expect(workspace.counts).toMatchObject({ imported: 2, assignedHere: 1 });
  });

  it('refuses a hand-picked solution with evidence against it until the Admin acknowledges each point', async () => {
    // Câu 8 has no printed solution among the recorded pages; Câu 6's is about another question.
    const error = await confirmSolution(ex('8').id, sol('6').id, 'admin-1').catch((e) => e);
    expect(error).toMatchObject({ status: 409 });
    expect(error.conflicts).toEqual(
      expect.arrayContaining([
        'Khác số câu: đề Câu 8, lời giải Câu 6',
        expect.stringMatching(/^Chưa đối chiếu được nội dung toán/),
      ])
    );
    const untouched = (await listTextbookArtifacts({ documentId: DOC })).find(
      (a) => a.id === ex('8').id
    )!;
    expect(untouched.practice?.verification).toBeUndefined();
    // A partial acknowledgement is not enough.
    await expect(
      confirmSolution(ex('8').id, sol('6').id, 'admin-1', error.conflicts.slice(0, 1))
    ).rejects.toMatchObject({ status: 409 });
    const confirmed = await confirmSolution(ex('8').id, sol('6').id, 'admin-1', error.conflicts);
    expect(confirmed.practice?.verification).toMatchObject({
      method: 'TEXTBOOK_SOLUTION',
      acknowledgedConflicts: error.conflicts,
    });
  });
});
