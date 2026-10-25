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
const T = '2026-10-17T14:45:57.642Z';
const tree = {
  schemaVersion: 1, updatedAt: T,
  nodes: [
    { id: 'knowledge-f466aa2a-9e0a-4843-9223-57ccfe4546e6', kind: 'GROUP', order: 1, title: 'Toán', nodeType: 'MON_HOC', parentId: null },
    { id: 'knowledge-eccd24a0-e3c2-4eb3-af4a-79a15b3b13d6', kind: 'GROUP', order: 1, title: '12', nodeType: 'LOP', parentId: 'knowledge-f466aa2a-9e0a-4843-9223-57ccfe4546e6' },
    { id: CH, kind: 'GROUP', order: 1, title: 'ỨNG DỤNG ĐẠO HÀM ĐỂ KHẢO SÁT VÀ VẼ ĐỒ THỊ CỦA HÀM SỐ', nodeType: 'CHUONG', parentId: 'knowledge-eccd24a0-e3c2-4eb3-af4a-79a15b3b13d6' },
    { id: P1, kind: 'KNOWLEDGE', order: 1, title: 'Tính đơn điệu của hàm số (P1)', nodeType: 'KIEN_THUC', parentId: CH, hasLearningContent: true },
  ].map((node) => ({ status: 'PUBLISHED', createdAt: T, updatedAt: T, description: '', identitySource: 'TREE_IMPORT', hasLearningContent: false, ...node })),
};
const articles = {
  schemaVersion: 1, updatedAt: T,
  articles: {
    [P1]: { id: `article-${P1}`, knowledgeNodeId: P1, title: 'Tính đơn điệu của hàm số (P1)', blocks: DON_DIEU_P1_CURRENT, status: 'PUBLISHED', publishToBlog: false, publishToLearning: true, createdAt: T, updatedAt: T },
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
const questions = [
  q1,
  other('2', 'Cho hàm số $y = x - \\ln(x + 1)$. Khẳng định nào dưới đây là đúng?',
    ['Hàm số có tập xác định là $\\mathbb{R} \\setminus \\{-1\\}$', 'Hàm số đồng biến trên $(-1; +\\infty)$', 'Hàm số đồng biến trên $(-\\infty; 0)$', 'Hàm số nghịch biến trên $(-1; 0)$'],
    'D', "Tập xác định: $D = (-1; +\\infty)$.\n$y' = \\frac{x}{x + 1}$; $y' < 0 \\Leftrightarrow -1 < x < 0$.", '2026-10-25T05:22:56.000Z'),
  other('3', 'Hỏi hàm số $y = x^3 + 3x^2 - 4$ nghịch biến trên khoảng nào?',
    ['$(-2; 0)$', '$(-\\infty; -2)$', '$(0; +\\infty)$', '$\\mathbb{R}$'],
    'A', "$y' = 3x^2 + 6x$; $y' < 0 \\Leftrightarrow -2 < x < 0$.", '2026-10-25T05:22:57.000Z'),
].map(published);

it('seeds QA', async () => {
  const admin = postgres(URL_, { max: 1, onnotice: () => {} });
  await runMigrations(admin);
  for (const [key, body] of [['knowledge-tree/tree', tree], ['knowledge-tree/articles', articles], ['question-bank/questions', questions]] as const)
    await admin`insert into tutai.content_documents (key, body) values (${key}, ${admin.json(body as never)}) on conflict (key) do update set body = excluded.body`;
  await admin.end();
});
