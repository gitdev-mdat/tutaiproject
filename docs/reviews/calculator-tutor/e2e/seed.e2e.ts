import { it } from 'vitest';
// QA seed for the isolated local DB calc_tutor_e2e (never Production). Câu 1 is the Production
// question Q-MAT-TPG9WI copied verbatim (read-only query, 2026-10-25), including its imported
// explanation; only its publication fields are changed here so a QA student can reach it.
import { readFileSync } from 'node:fs';
import postgres from 'postgres';
import { runMigrations } from '@/lib/db/migrations';
import { DON_DIEU_P1_CURRENT } from '@/lib/knowledge-tree/__fixtures__/don-dieu-p1-2026-10-19';

const DIR = process.env.QA_DIR ?? __dirname;
const URL_ = 'postgres://postgres:postgres@127.0.0.1:5432/calc_tutor_e2e';
const CH = 'knowledge-7e1ba6a6-70f4-46e3-aa9e-d3ba5bace5aa';
const P1 = 'knowledge-45c34e43-ad2e-47bf-8845-68782b67cfb9';
// Phase 2: a second lesson holding the questions of the generated guides, so Câu 1 stays first in P1.
const P2 = 'knowledge-qa-calculator-p2';
const T = '2026-10-17T14:45:57.642Z';
const tree = {
  schemaVersion: 1, updatedAt: T,
  nodes: [
    { id: 'knowledge-f466aa2a-9e0a-4843-9223-57ccfe4546e6', kind: 'GROUP', order: 1, title: 'Toán', nodeType: 'MON_HOC', parentId: null },
    { id: 'knowledge-eccd24a0-e3c2-4eb3-af4a-79a15b3b13d6', kind: 'GROUP', order: 1, title: '12', nodeType: 'LOP', parentId: 'knowledge-f466aa2a-9e0a-4843-9223-57ccfe4546e6' },
    { id: CH, kind: 'GROUP', order: 1, title: 'ỨNG DỤNG ĐẠO HÀM ĐỂ KHẢO SÁT VÀ VẼ ĐỒ THỊ CỦA HÀM SỐ', nodeType: 'CHUONG', parentId: 'knowledge-eccd24a0-e3c2-4eb3-af4a-79a15b3b13d6' },
    { id: P1, kind: 'KNOWLEDGE', order: 1, title: 'Tính đơn điệu của hàm số (P1)', nodeType: 'KIEN_THUC', parentId: CH, hasLearningContent: true },
    { id: P2, kind: 'KNOWLEDGE', order: 2, title: 'Tính đơn điệu: dùng máy tính (QA)', nodeType: 'KIEN_THUC', parentId: CH, hasLearningContent: true },
  ].map((node) => ({ status: 'PUBLISHED', createdAt: T, updatedAt: T, description: '', identitySource: 'TREE_IMPORT', hasLearningContent: false, ...node })),
};
const articles = {
  schemaVersion: 1, updatedAt: T,
  articles: {
    [P1]: { id: `article-${P1}`, knowledgeNodeId: P1, title: 'Tính đơn điệu của hàm số (P1)', blocks: DON_DIEU_P1_CURRENT, status: 'PUBLISHED', publishToBlog: false, publishToLearning: true, createdAt: T, updatedAt: T },
    [P2]: { id: `article-${P2}`, knowledgeNodeId: P2, title: 'Tính đơn điệu: dùng máy tính (QA)', blocks: DON_DIEU_P1_CURRENT, status: 'PUBLISHED', publishToBlog: false, publishToLearning: true, createdAt: T, updatedAt: T },
  },
};

const published = (q: Record<string, unknown>) => ({
  ...q,
  editorialStatus: 'PUBLISHED',
  usageContexts: ['OPEN_PRACTICE'],
  source: { ...(q.source as object), rightsStatus: 'LICENSED' },
});
const q1 = JSON.parse(readFileSync(`${DIR}/question-q1-production.json`, 'utf8'));
const other = (n: string, stem: string, options: string[], answer: string, explanation: string, createdAt: string) => ({
  ...q1, id: `qa-question-${n}`, code: `Q-QA-${n}`, stem, explanation, correctAnswer: answer, createdAt,
  options: options.map((content, i) => ({ key: 'ABCD'[i], content })),
  externalId: `qa:${n}`, contentHash: `qa-${n}`, fingerprints: { full: `qa-${n}`, stem: `qa-${n}`, stemAndOptions: `qa-${n}` },
  textbookSource: { ...q1.textbookSource, questionNumber: n, exerciseArtifactId: `qa-art-${n}`, solutionArtifactId: `qa-sol-${n}` },
});
const questions: Record<string, unknown>[] = [
  q1,
  other('2', 'Cho hàm số $y = x - \\ln(x + 1)$. Khẳng định nào dưới đây là đúng?',
    ['Hàm số có tập xác định là $\\mathbb{R} \\setminus \\{-1\\}$', 'Hàm số đồng biến trên $(-1; +\\infty)$', 'Hàm số đồng biến trên $(-\\infty; 0)$', 'Hàm số nghịch biến trên $(-1; 0)$'],
    'D', "Tập xác định: $D = (-1; +\\infty)$.\n$y' = \\frac{x}{x + 1}$; $y' < 0 \\Leftrightarrow -1 < x < 0$.", '2026-10-25T05:22:56.000Z'),
  other('3', 'Hỏi hàm số $y = x^3 + 3x^2 - 4$ nghịch biến trên khoảng nào?',
    ['$(-2; 0)$', '$(-\\infty; -2)$', '$(0; +\\infty)$', '$\\mathbb{R}$'],
    'A', "$y' = 3x^2 + 6x$; $y' < 0 \\Leftrightarrow -2 < x < 0$.", '2026-10-25T05:22:57.000Z'),
].map(published);

// Phase 2 (lesson P2), in practice order. Câu 2 and Câu 20 are the Production questions, copied
// verbatim from the read-only snapshot (lib/calculator-tutor/fixtures/math-book-3.json); the
// others are QA questions written for the cases the bank does not have yet (marked QA).
const snapshot = JSON.parse(readFileSync(`${DIR}/../../../../lib/calculator-tutor/fixtures/math-book-3.json`, 'utf8'));
const real = (n: string) => snapshot.questions.find((q: { questionNumber: string }) => q.questionNumber === n);
const c11 = snapshot.artifacts.find((a: { id: string }) => a.id === 'art-09bdd4e541a1885da5485b79f6a61fc0');
const inP2 = (n: string, q: { stem: string; options: { key: string; content: string }[]; correctAnswer: string; explanation: string }, minute: number) => ({
  ...other(n, q.stem, q.options.map((o) => o.content), q.correctAnswer, q.explanation, `2026-10-25T06:${String(minute).padStart(2, '0')}:00.000Z`),
  primaryKnowledgeNodeId: P2, topicId: P2,
});
const option = (contents: string[]) => contents.map((content, i) => ({ key: 'ABCD'[i], content }));
const p2 = [
  inP2('p2-20', real('20'), 1),
  inP2('p2-2', real('2'), 2),
  inP2('p2-solve', {
    stem: '(QA) Phương trình $x^3 - 3x + 1 = 0$ có một nghiệm thuộc khoảng nào?',
    options: option(['$(0; 1)$', '$(1; 2)$', '$(2; 3)$', '$(3; 4)$']), correctAnswer: 'A',
    explanation: 'Cách 2: Dùng máy tính.\nNhập phương trình $x^3 - 3x + 1 = 0$, bấm SHIFT SOLVE.\nNhập giá trị ban đầu 0 rồi bấm =.\nMáy hiện:\n\nVậy phương trình có nghiệm gần 0,347, thuộc $(0; 1)$. Chọn A.',
  }, 3),
  inP2('p2-c11', {
    stem: '(QA, từ lời giải Dạng 2 Câu 11 tr. 32–33) Tìm $m$ để hàm số $y = \\frac{\\sin x + m}{\\sin x - m}$ nghịch biến trên $\\left(\\frac{\\pi}{2}; \\pi\\right)$.',
    options: option(['$m = 0$', '$m < 0$', '$m \\ge 1$', '$0 < m < 1$']), correctAnswer: 'B', explanation: c11.content,
  }, 4),
  inP2('p2-mention', {
    stem: '(QA) Hàm số $y = x^2 - 2x$ nghịch biến trên khoảng nào?',
    options: option(['$(-\\infty; 1)$', '$(1; +\\infty)$', '$(0; 2)$', '$\\mathbb{R}$']), correctAnswer: 'A',
    explanation: "$y' = 2x - 2 < 0 \\Leftrightarrow x < 1$.\nTa có thể dùng máy tính cầm tay để kiểm tra lại kết quả.",
  }, 5),
  inP2('p2-3', real('3'), 6),
].map(published);
questions.push(...p2);

it('seeds QA', async () => {
  const admin = postgres(URL_, { max: 1, onnotice: () => {} });
  await runMigrations(admin);
  for (const [key, body] of [['knowledge-tree/tree', tree], ['knowledge-tree/articles', articles], ['question-bank/questions', questions]] as const)
    await admin`insert into tutai.content_documents (key, body) values (${key}, ${admin.json(body as never)}) on conflict (key) do update set body = excluded.body`;
  await admin.end();
});
