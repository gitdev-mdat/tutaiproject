import { it } from 'vitest';
// QA seed for the isolated local DB tb_flow_e2e (never Production). Real extracted exercises of
// printed pp. 19-20 (recorded Gemini output), the Production P1 article fixture, a QA P2 article.
import { readFileSync } from 'node:fs';
import postgres from 'postgres';
import { closeSql } from '@/lib/db/postgres';
import { runMigrations } from '@/lib/db/migrations';
import { DON_DIEU_P1_CURRENT } from '@/lib/knowledge-tree/__fixtures__/don-dieu-p1-2026-10-19';
import {
  insertTextbookArtifacts, insertTextbookDocument, replaceTextbookAnchors, replaceTextbookToc,
  reviewTextbookArtifact, saveTextbookMapping,
} from '@/lib/textbook-reference/repository';
import type { TextbookArtifact, TextbookTocEntry } from '@/lib/textbook-reference/types';

const DIR = process.env.QA_DIR ?? __dirname;
const URL_ = 'postgres://postgres:postgres@127.0.0.1:5432/tb_flow_e2e';
const SHA = '16ea6f0cd93222c1f170dfb851225f905cc770771fce60a50743bd299146a5fb';
const DOC = 'textbook-28823755f9b0448a';
const CH = 'knowledge-7e1ba6a6-70f4-46e3-aa9e-d3ba5bace5aa';
const P1 = 'knowledge-45c34e43-ad2e-47bf-8845-68782b67cfb9';
const P2 = 'knowledge-c5e8afbc-1daf-44e2-9a27-ee73f05b33e6';
const T = '2026-10-17T14:45:57.642Z';
const tree = {
  schemaVersion: 1, updatedAt: T,
  nodes: [
    { id: 'knowledge-f466aa2a-9e0a-4843-9223-57ccfe4546e6', kind: 'GROUP', order: 1, title: 'Toán', nodeType: 'MON_HOC', parentId: null },
    { id: 'knowledge-eccd24a0-e3c2-4eb3-af4a-79a15b3b13d6', kind: 'GROUP', order: 1, title: '12', nodeType: 'LOP', parentId: 'knowledge-f466aa2a-9e0a-4843-9223-57ccfe4546e6' },
    { id: CH, kind: 'GROUP', order: 1, title: 'ỨNG DỤNG ĐẠO HÀM ĐỂ KHẢO SÁT VÀ VẼ ĐỒ THỊ CỦA HÀM SỐ', nodeType: 'CHUONG', parentId: 'knowledge-eccd24a0-e3c2-4eb3-af4a-79a15b3b13d6' },
    { id: P1, kind: 'KNOWLEDGE', order: 1, title: 'Tính đơn điệu của hàm số (P1)', nodeType: 'KIEN_THUC', parentId: CH, hasLearningContent: true },
    { id: P2, kind: 'KNOWLEDGE', order: 2, title: 'Tính đơn điệu của hàm số (P2)', nodeType: 'KIEN_THUC', parentId: CH, hasLearningContent: true },
  ].map((node) => ({ status: 'PUBLISHED', createdAt: T, updatedAt: T, description: '', identitySource: 'TREE_IMPORT', hasLearningContent: false, ...node })),
};
const article = (id: string, title: string, blocks: unknown[]) => ({
  id: `article-${id}`, knowledgeNodeId: id, title, blocks, status: 'PUBLISHED', publishToBlog: false, publishToLearning: true, createdAt: T, updatedAt: T,
});
const articles = {
  schemaVersion: 1, updatedAt: T,
  articles: {
    [P1]: article(P1, 'Tính đơn điệu của hàm số (P1)', DON_DIEU_P1_CURRENT),
    [P2]: article(P2, 'Tính đơn điệu của hàm số (P2)', [
      { id: 'block-title', type: 'TITLE', content: 'Tính đơn điệu của hàm số (P2)' },
      { id: 'i', type: 'INTRO', content: 'Bài QA: hàm số chứa tham số m (nội dung kiểm thử, chỉ có trong DB QA).' },
      { id: 'm', type: 'MAIN_CONTENT', content: '**Ý chính.** Hàm số $y = f(x; m)$ đồng biến trên $K$ khi $f\'(x; m) \\ge 0$ với mọi $x \\in K$.' },
      { id: 'r', type: 'RECAP', content: '- Điều kiện đồng biến với tham số.' },
    ]),
  },
};
const toc = (id: string, parentId: string | null, level: number, heading: string, start: number, end: number): TextbookTocEntry => ({
  id, parentId, level, originalHeading: heading, normalizedHeading: heading.toLocaleLowerCase('vi'),
  printedStartPage: start, printedEndPage: end, locations: [], status: 'OBSERVED',
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
  toc('toc-10', 'toc-1', 2, 'I.II. Cực trị của hàm số và giá trị lớn nhất, giá trị nhỏ nhất của hàm số', 34, 97),
];

it('seeds QA', async () => {
  Object.assign(process.env, { DATABASE_URL: URL_, SUPABASE_URL: 'http://127.0.0.1:54321', SUPABASE_SERVICE_ROLE_KEY: 'qa-service-key', TEXTBOOK_STORAGE_BUCKET: 'qa-textbooks' });
  const admin = postgres(URL_, { max: 1, onnotice: () => {} });
  await runMigrations(admin);
  await admin`insert into tutai.content_documents (key, body) values ('knowledge-tree/tree', ${admin.json(tree as never)}) on conflict (key) do update set body = excluded.body`;
  await admin`insert into tutai.content_documents (key, body) values ('knowledge-tree/articles', ${admin.json(articles as never)}) on conflict (key) do update set body = excluded.body`;
  await admin.end();
  await insertTextbookDocument({
    id: DOC, originalFilename: 'math_book_3.pdf', title: 'math_book_3', sha256: SHA, byteSize: 1711271, pdfPageCount: 20,
    storageKey: `documents/${SHA}.pdf`, status: 'INDEXED', importedAt: '2026-10-22T04:31:10.565Z', sourceVersion: SHA,
    pageLayout: 'TWO_UP', tocPdfPages: [5, 6, 7], tocIndexCompleteness: 'PARTIAL', processingErrors: [], anchors: [], tocEntries: [],
  });
  await replaceTextbookAnchors(DOC, [
    { printedPage: 13, pdfPage: 7, position: 'RIGHT', evidence: 'Admin' },
    { printedPage: 39, pdfPage: 20, position: 'RIGHT', evidence: 'Admin' },
  ]);
  await replaceTextbookToc(DOC, TOC, 'PARTIAL');
  const links: Array<[string, string, 'CONFIRMED' | 'REJECTED']> = [
    [P1, 'toc-3', 'CONFIRMED'], [P1, 'toc-5', 'CONFIRMED'], [P1, 'toc-6', 'REJECTED'], [P2, 'toc-7', 'CONFIRMED'],
  ];
  for (const [knowledgeNodeId, entryId, status] of links)
    await saveTextbookMapping({ id: `map-${DOC}-${entryId}-${knowledgeNodeId}`, documentId: DOC, knowledgeNodeId, entryId, confidence: 1, status, confirmationRequired: false, updatedAt: T });
  const real = JSON.parse(readFileSync(`${DIR}/p19-20.json`, 'utf8'));
  const exercises = (real.accepted as TextbookArtifact[]).map((a) => ({ ...a, documentId: DOC }));
  const theory: TextbookArtifact[] = [
    ['THEORY', 'toc-3', 13, 'A. Lý thuyết - Tính đơn điệu của hàm số'],
    ['METHOD', 'toc-5', 14, 'Sử dụng máy tính Casio để xét tính đơn điệu của hàm số'],
  ].map(([kind, entryId, page, title], index) => ({
    id: `qa-approved-${index}`, documentId: DOC, entryId: entryId as string, kind: kind as TextbookArtifact['kind'], title: title as string,
    content: `${title}: nội dung đã duyệt (QA).`, mathematicalNotation: [], printedPages: [page as number], pdfPages: [page === 13 ? 7 : 8],
    reviewStatus: 'NEEDS_REVIEW', verificationNotes: [], extractionKey: `qa-${entryId}-${page}`, createdAt: '2026-10-24T07:16:21.000Z',
  }));
  await insertTextbookArtifacts([...theory, ...exercises]);
  for (const artifact of theory) await reviewTextbookArtifact(artifact.id, 'APPROVED', 'qa');
  await closeSql();
});
