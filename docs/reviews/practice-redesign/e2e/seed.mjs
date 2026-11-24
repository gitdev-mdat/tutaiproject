// Isolated local QA databases for the Practice & Exams redesign (never Production).
// Usage (from the repo, after `db:migrate` on the target DB): node /tmp/claude-0/pp/seed.mjs <db>
// Sets: pe_one (Production-shaped: 1 lesson, 6 free questions, no Plus, no exams),
//       pe_multi (several chapters, Plus "Tổng hợp", free + Plus exams), pe_empty (nothing published).
import postgres from 'postgres';
import fs from 'node:fs';

const db = process.argv[2];
const T = '2026-10-01T00:00:00.000Z';
const nodes = [];
const articles = {};
const questions = [];
const exams = [];
const key = {}; // question id -> correct response (for the E2E runner)

const node = (id, kind, order, title, parentId, status = 'PUBLISHED', description = '') => {
  const sourceGraphNodeType = parentId === null ? 'SUBJECT' : parentId.startsWith('subj_') ? 'GRADE' : kind === 'GROUP' ? 'DOMAIN' : 'CONCEPT';
  nodes.push({ id, kind, order, title, status, parentId, createdAt: T, updatedAt: T, description, identitySource: 'CANONICAL_GRAPH', sourceGraphNodeType });
};

function article(id, title, idea) {
  articles[id] = {
    id: `article-${id}`, title, status: 'PUBLISHED', publishToLearning: true, publishToBlog: false,
    knowledgeNodeId: id, createdAt: T, updatedAt: T,
    blocks: [
      { id: 'block-title', type: 'TITLE', content: title },
      { id: 'i', type: 'INTRO', content: `${idea}` },
      { id: 'm', type: 'MAIN_CONTENT', content: `**Ý chính.** ${idea}\n\n- Nội dung kiểm thử, chỉ có trong DB QA.` },
      { id: 'e', type: 'EXAMPLE', content: `**Ví dụ.** Áp dụng ${title.toLowerCase()} vào một hàm số cụ thể.` },
      { id: 'r', type: 'RECAP', content: `- ${idea}` },
    ],
  };
}

let seq = 0;
/** One question; `answer` is the option key (MCQ), a number string (NUMERIC) or statements map (TRUE_FALSE). */
function q(lesson, chapter, stem, answer, extra = {}) {
  seq += 1;
  const id = extra.id ?? `qa-${lesson}-${seq}`;
  const type = extra.questionType ?? (typeof answer === 'object' ? 'TRUE_FALSE' : /^[A-D]$/.test(answer) ? 'MULTIPLE_CHOICE_SINGLE' : 'NUMERIC');
  const base = {
    id, code: `QA-${seq}`, stem, questionType: type, grade: 12, subjectId: extra.subjectId ?? 'MATH',
    options: type === 'MULTIPLE_CHOICE_SINGLE' ? (extra.options ?? ['A', 'B', 'C', 'D'].map((k) => ({ key: k, content: `Phương án ${k}` }))) : [],
    correctAnswer: type === 'TRUE_FALSE' ? 'TRUE' : answer,
    explanation: extra.explanation ?? `Lời giải: đáp án đúng là ${typeof answer === 'object' ? 'như bảng Đúng/Sai' : answer}.`,
    source: { sourceType: 'ORIGINAL', rightsStatus: 'OWNED' },
    topicId: lesson, chapterId: chapter, lessonId: lesson, createdAt: new Date(Date.parse(T) + seq * 1000).toISOString(), updatedAt: T,
    isSpecial: false, accessTier: 'OPEN', examSetIds: [], skillCodes: [], conceptCodes: [], contentHash: id,
    importOrigin: 'MANUAL', usageContexts: ['OPEN_PRACTICE'], editorialStatus: 'PUBLISHED', roadmapEligible: false,
    knowledgeCoverage: 'FOCUS', primaryKnowledgeNodeId: lesson, relatedKnowledgeNodeIds: [], prerequisiteConceptCodes: [],
    difficulty: 'FOUNDATIONAL', cognitiveLevel: 'COMPREHENSION',
  };
  if (type === 'TRUE_FALSE') {
    base.trueFalseStatements = Object.entries(answer).map(([sid, isTrue], i) => ({ id: sid, content: extra.statements?.[i] ?? `Mệnh đề ${i + 1}`, isTrue }));
    key[id] = { statements: answer };
  } else if (type === 'NUMERIC') key[id] = { value: answer };
  else key[id] = { choice: answer };
  const { statements, ...rest } = extra;
  const question = { ...base, ...rest };
  questions.push(question);
  return question;
}

// ── Mathematics 12 skeleton with the Production ids ────────────────────────────
node('subj_math', 'GROUP', 1, 'Toán học', null);
node('grade_12', 'GROUP', 1, 'Lớp 12', 'subj_math');
node('node-nrm3k7taj', 'GROUP', 3, 'Hàm số và ứng dụng đạo hàm', 'grade_12', 'DRAFT');
node('node-s0f2jitge', 'KNOWLEDGE', 3, 'Tính đơn điệu của hàm số', 'node-nrm3k7taj', 'PUBLISHED',
  'Đọc dấu của đạo hàm để biết hàm số đồng biến hay nghịch biến trên từng khoảng.');
node('node-sg3wg6atb', 'KNOWLEDGE', 4, 'Cực trị của hàm số', 'node-nrm3k7taj', 'PUBLISHED',
  'Nếu f′ đổi dấu khi qua x₀ thì hàm số đạt cực trị tại x₀.');
node('node-gtln', 'KNOWLEDGE', 5, 'Giá trị lớn nhất và nhỏ nhất', 'node-nrm3k7taj', 'PUBLISHED',
  'Tìm GTLN, GTNN của hàm số trên một đoạn bằng cách so sánh giá trị tại điểm tới hạn và hai đầu mút.');
node('node-3ohrzxw98', 'GROUP', 4, 'Nguyên hàm và tích phân', 'grade_12', 'DRAFT');
node('node-ez69x03zv', 'KNOWLEDGE', 1, 'Nguyên hàm', 'node-3ohrzxw98', 'DRAFT', 'F là nguyên hàm của f khi F′ = f.');
node('node-tichphan', 'KNOWLEDGE', 2, 'Tích phân', 'node-3ohrzxw98', 'DRAFT', 'Tích phân tính bằng hiệu F(b) − F(a).');

const C1 = 'node-nrm3k7taj';
const C2 = 'node-3ohrzxw98';
const L1 = 'node-s0f2jitge';
const L2 = 'node-sg3wg6atb';
const L3 = 'node-gtln';
const L4 = 'node-ez69x03zv';
const L5 = 'node-tichphan';

if (db !== 'pp_empty') {
  article(L1, 'Tính đơn điệu của hàm số', 'Hàm số đồng biến trên khoảng mà f′(x) > 0 và nghịch biến trên khoảng mà f′(x) < 0.');
  // Same shape as Production: 6 published free questions, 1 archived.
  q(L1, C1, 'Hàm số $y = x^4 - 2x^2 - 7$ nghịch biến trên khoảng nào?', 'A', { options: [
    { key: 'A', content: '$(0; 1)$' }, { key: 'B', content: '$(0; +\\infty)$' }, { key: 'C', content: '$(-1; 0)$' }, { key: 'D', content: '$(-\\infty; 0)$' }],
    explanation: ['Tập xác định: $D = \\mathbb{R}$.', "$y' = 4x^3 - 4x$.", "$y' = 0 \\iff 4x^3 - 4x = 0 \\iff x = 0$ hoặc $x = 1$ hoặc $x = -1$.",
      "Bảng xét dấu: $y' < 0$ trên $(-\\infty; -1)$ và $(0; 1)$; $y' > 0$ trên $(-1; 0)$ và $(1; +\\infty)$.",
      'Vậy hàm số nghịch biến trên $(-\\infty; -1)$ và $(0; 1)$.', 'Trong bốn phương án, chỉ khoảng $(0; 1)$ nằm trọn trong một khoảng nghịch biến.',
      'Phương án B sai vì trên $(0; +\\infty)$ hàm số đổi chiều tại $x = 1$.', 'Phương án C sai vì trên $(-1; 0)$ hàm số đồng biến.',
      'Phương án D sai vì trên $(-\\infty; 0)$ hàm số đổi chiều tại $x = -1$.', 'Đáp án: A.'].join('\n') });
  q(L1, C1, 'Hàm số $y = x^3 - 3x$ nghịch biến trên khoảng nào?', 'B', { options: [
    { key: 'A', content: '$(-\\infty; -1)$' }, { key: 'B', content: '$(-1; 1)$' }, { key: 'C', content: '$(1; +\\infty)$' }, { key: 'D', content: '$(-\\infty; +\\infty)$' }] });
  q(L1, C1, 'Nếu $f\'(x) > 0$ với mọi $x \\in (a; b)$ thì hàm số $f$ trên $(a; b)$:', 'B', { options: [
    { key: 'A', content: 'Nghịch biến' }, { key: 'B', content: 'Đồng biến' }, { key: 'C', content: 'Không đổi' }, { key: 'D', content: 'Chưa kết luận được' }] });
  q(L1, C1, 'Hàm số $y = -x^2 + 4x$ đồng biến trên khoảng nào?', 'C', { difficulty: 'INTERMEDIATE', options: [
    { key: 'A', content: '$(2; +\\infty)$' }, { key: 'B', content: '$(-\\infty; 4)$' }, { key: 'C', content: '$(-\\infty; 2)$' }, { key: 'D', content: '$(0; 4)$' }] });
  q(L1, C1, 'Hàm số nào sau đây đồng biến trên $\\mathbb{R}$?', 'A', { difficulty: 'INTERMEDIATE', cognitiveLevel: 'APPLICATION', options: [
    { key: 'A', content: '$y = x^3 + x$' }, { key: 'B', content: '$y = x^2$' }, { key: 'C', content: '$y = -x$' }, { key: 'D', content: '$y = x^4$' }] });
  q(L1, C1, 'Xét hàm số $y = x^3 - 3x^2$.', { s1: true, s2: false, s3: true, s4: true }, { difficulty: 'INTERMEDIATE', cognitiveLevel: 'APPLICATION',
    statements: ['$y\' = 3x^2 - 6x$', 'Hàm số đồng biến trên $(0; 2)$', 'Hàm số nghịch biến trên $(0; 2)$', 'Hàm số đồng biến trên $(2; +\\infty)$'] });
  q(L1, C1, 'Có bao nhiêu giá trị nguyên của $m \\in [-5; 5]$ để $y = x^3 - 3mx$ đồng biến trên $\\mathbb{R}$?', '6', { difficulty: 'ADVANCED', cognitiveLevel: 'APPLICATION' });
  for (let i = 1; i <= 5; i++)
    q(L1, C1, `Hàm số $y = ${i + 1}x + ${i}$ đồng biến hay nghịch biến trên $\\mathbb{R}$? (câu ${i})`, 'A', { options: [
      { key: 'A', content: 'Đồng biến' }, { key: 'B', content: 'Nghịch biến' }, { key: 'C', content: 'Không đổi' }, { key: 'D', content: 'Chưa kết luận được' }] });
  q(L1, C1, 'Câu đã lưu trữ (không được dùng).', 'A', { editorialStatus: 'ARCHIVED' });
}

if (db === 'pp_qa') {
  article(L2, 'Cực trị của hàm số', 'Hàm số đạt cực trị tại x₀ khi f′ đổi dấu qua x₀.');
  article(L3, 'Giá trị lớn nhất và nhỏ nhất', 'So sánh giá trị tại các điểm tới hạn và hai đầu mút của đoạn.');
  article(L4, 'Nguyên hàm', 'F là nguyên hàm của f trên K khi F′(x) = f(x) với mọi x thuộc K.');
  article(L5, 'Tích phân', 'Tích phân của f trên [a; b] bằng F(b) − F(a).');
  for (let i = 1; i <= 5; i++)
    q(L2, C1, `Hàm số $y = x^3 - ${3 * i}x$ có bao nhiêu điểm cực trị? (câu ${i})`, 'C', { difficulty: i < 3 ? 'FOUNDATIONAL' : 'INTERMEDIATE', options: [
      { key: 'A', content: '0' }, { key: 'B', content: '1' }, { key: 'C', content: '2' }, { key: 'D', content: '3' }] });
  for (let i = 1; i <= 4; i++)
    q(L3, C1, `Giá trị lớn nhất của $y = -x^2 + ${2 * i}x$ trên $\\mathbb{R}$ bằng bao nhiêu? (câu ${i})`, String(i * i), { difficulty: i < 2 ? 'FOUNDATIONAL' : 'INTERMEDIATE' });
  for (let i = 1; i <= 4; i++)
    q(L4, C2, `Nguyên hàm của $f(x) = ${i + 1}x^{${i}}$ là:`, 'A', { difficulty: 'FOUNDATIONAL', options: [
      { key: 'A', content: `$x^{${i + 1}} + C$` }, { key: 'B', content: `$${i + 1}x^{${i + 1}} + C$` }, { key: 'C', content: `$x^{${i}} + C$` }, { key: 'D', content: `$${i}x^{${i - 1}} + C$` }] });
  // L5 (Tích phân) has no practice yet: sparse chapter.

  // Premium "Tổng hợp" for chapter 1: Plus + PLUS_SPECIAL, integrative, harder.
  const plus = (lesson, stem, answer, extra) =>
    q(lesson, C1, stem, answer, { accessTier: 'PLUS', usageContexts: ['PLUS_SPECIAL'], difficulty: 'ADVANCED', cognitiveLevel: 'APPLICATION', ...extra });
  plus(L1, 'Tìm tất cả $m$ để $y = \\frac{x + m}{x + 1}$ đồng biến trên từng khoảng xác định. Có bao nhiêu số nguyên $m \\in [-3; 3]$ thoả mãn?', '4',
    { knowledgeCoverage: 'CROSS', relatedKnowledgeNodeIds: [L2], explanation: '$y\' = \\frac{1 - m}{(x+1)^2} > 0 \\iff m < 1$, nên $m \\in \\{-3; -2; -1; 0\\}$: có 4 giá trị.' });
  plus(L2, 'Hàm số $y = x^3 - 3x^2 + m$ có giá trị cực đại và cực tiểu trái dấu khi $m$ thuộc khoảng nào?', 'B', {
    knowledgeCoverage: 'CROSS', relatedKnowledgeNodeIds: [L1, L3], difficulty: 'HIGH_DISCRIMINATION', cognitiveLevel: 'HIGHER_APPLICATION', isSpecial: true,
    specialReason: 'Kết hợp cực trị với điều kiện về dấu, dạng hay bị nhầm.',
    options: [{ key: 'A', content: '$(-\\infty; 0)$' }, { key: 'B', content: '$(0; 4)$' }, { key: 'C', content: '$(4; +\\infty)$' }, { key: 'D', content: '$(-4; 0)$' }] });
  plus(L3, 'Một tấm tôn hình vuông cạnh 12 cm, cắt ở bốn góc bốn hình vuông cạnh $x$ rồi gấp thành hộp không nắp. Thể tích lớn nhất của hộp là bao nhiêu cm³?', '128', {
    knowledgeCoverage: 'CROSS', relatedKnowledgeNodeIds: [L1], difficulty: 'HIGH_DISCRIMINATION', cognitiveLevel: 'HIGHER_APPLICATION', isSpecial: true,
    specialReason: 'Bài toán thực tế cần lập hàm rồi khảo sát.' });
  plus(L2, 'Xét hàm số $y = x^4 - 2x^2$.', { s1: true, s2: true, s3: false, s4: true }, {
    knowledgeCoverage: 'CROSS', relatedKnowledgeNodeIds: [L1],
    statements: ['Hàm số có ba điểm cực trị', 'Hàm số nghịch biến trên $(0; 1)$', 'Giá trị cực tiểu bằng 0', 'Đồ thị nhận trục tung làm trục đối xứng'] });
  plus(L1, 'Hàm số $y = \\sin x - x$ trên $\\mathbb{R}$:', 'D', { difficulty: 'INTERMEDIATE', options: [
    { key: 'A', content: 'Đồng biến' }, { key: 'B', content: 'Có cực đại' }, { key: 'C', content: 'Có cực tiểu' }, { key: 'D', content: 'Nghịch biến' }] });
  plus(L3, 'GTNN của $y = x + \\frac{4}{x}$ trên $(0; +\\infty)$ bằng?', '4', { cognitiveLevel: 'APPLICATION' });
  // Chapter 2 has only 2 Plus questions: below the threshold, no "Tổng hợp" set is offered.
  q(L4, C2, 'Plus chương 2, câu 1', 'A', { accessTier: 'PLUS', usageContexts: ['PLUS_SPECIAL'], difficulty: 'ADVANCED' });
  q(L4, C2, 'Plus chương 2, câu 2', 'A', { accessTier: 'PLUS', usageContexts: ['PLUS_SPECIAL'], difficulty: 'ADVANCED' });
  // A Plus question that is not PLUS_SPECIAL stays out of "Tổng hợp".
  q(L1, C1, 'Câu Plus không thuộc Tổng hợp', 'A', { accessTier: 'PLUS', usageContexts: ['SEMESTER_EXAM'] });

  // Exam-only questions.
  const examQs = [];
  for (let i = 1; i <= 12; i++)
    examQs.push(q(i % 2 ? L1 : L2, C1, `Câu thi ${i}: đạo hàm của $y = x^${(i % 4) + 2}$ là`, 'B', {
      options: [['A', `$x^${(i % 4) + 1}$`], ['B', `$${(i % 4) + 2}x^${(i % 4) + 1}$`], ['C', `$${(i % 4) + 2}x^${(i % 4) + 2}$`], ['D', `$${(i % 4) + 1}x^${(i % 4) + 2}$`]].map(([key, content]) => ({ key, content })),
      usageContexts: ['SEMESTER_EXAM', 'NATIONAL_EXAM_MOCK'], difficulty: i > 9 ? 'ADVANCED' : i > 5 ? 'INTERMEDIATE' : 'FOUNDATIONAL',
      cognitiveLevel: i > 9 ? 'HIGHER_APPLICATION' : 'COMPREHENSION' }));
  const lessonQs = questions.filter((x) => x.editorialStatus === 'PUBLISHED' && x.accessTier === 'OPEN' && x.usageContexts.includes('OPEN_PRACTICE'));
  const plusQs = questions.filter((x) => x.accessTier === 'PLUS' && x.chapterId === C1 && x.usageContexts.includes('PLUS_SPECIAL'));
  const exam = (id, name, examType, durationMinutes, qs, extra = {}) => {
    const publishedAt = new Date(Date.parse(T) + exams.length * 3600_000).toISOString();
    exams.push({
      id, name, subjectId: 'MATH', grade: 12, examType, durationMinutes, questionIds: qs.map((x) => x.id),
      sourceName: extra.sourceName ?? '', sourceUrl: '', rightsStatus: 'INTERNAL_CONTENT', importMethod: 'QUESTION_BANK',
      importStatus: 'COMPLETED', publishStatus: extra.publishStatus ?? 'PUBLISHED', rawExamCode: '', normalizedExamCode: '',
      createdAt: T, updatedAt: publishedAt, createdBy: 'admin', updatedBy: 'admin',
      ...(extra.accessTier ? { accessTier: extra.accessTier } : {}),
      ...(extra.curatorNote ? { curatorNote: extra.curatorNote } : {}),
      ...(extra.publishStatus === 'DRAFT' ? {} : {
        publishedAt,
        publishedSnapshot: { version: 1, publishedAt, metadata: { name, subjectId: 'MATH', grade: 12, examType, durationMinutes, questionIds: qs.map((x) => x.id), rawExamCode: '', normalizedExamCode: '' }, questions: qs },
      }),
    });
  };
  exam('exam-chuong-1', 'Đề ôn tập chương Ứng dụng đạo hàm', 'CHAPTER', 20, [...lessonQs.slice(0, 4), ...examQs.slice(0, 4)]);
  exam('exam-hk1', 'Đề kiểm tra học kỳ I', 'SEMESTER', 45, examQs.slice(0, 10));
  exam('exam-thpt-1', 'Đề thi thử THPT số 1', 'NATIONAL_EXAM_MOCK', 90, [...examQs, ...lessonQs.slice(4, 6)]);
  exam('exam-plus-vdc', 'Tuyển chọn vận dụng cao: Khảo sát hàm số', 'NATIONAL_EXAM_MOCK', 30, [...plusQs, examQs[10], examQs[11]], {
    accessTier: 'PLUS', curatorNote: 'Gom các câu phân hoá thường gặp ở phần cuối đề, có lời giải từng bước.' });
  exam('exam-plus-hk1', 'Đề học kỳ I nâng cao', 'SEMESTER', 45, [...examQs.slice(4, 12), ...plusQs.slice(0, 2)], { accessTier: 'PLUS' });
  exam('exam-draft', 'Đề nháp chưa xuất bản', 'OTHER', 15, examQs.slice(0, 3), { publishStatus: 'DRAFT' });

  // Physics 12: a second program, one lesson with practice.
  node('subj_phys', 'GROUP', 2, 'Vật lí', null);
  node('subj_phys_g12', 'GROUP', 1, 'Lớp 12', 'subj_phys');
  node('phys_c1', 'GROUP', 1, 'Dao động cơ', 'subj_phys_g12');
  node('phys_l1', 'KNOWLEDGE', 1, 'Dao động điều hoà', 'phys_c1', 'PUBLISHED', 'Li độ biến thiên theo hàm cos của thời gian.');
  article('phys_l1', 'Dao động điều hoà', 'x = A cos(ωt + φ).');
  for (let i = 1; i <= 3; i++) q('phys_l1', 'phys_c1', `Câu Vật lí ${i}: biên độ của $x = ${i}\\cos(2t)$ là bao nhiêu?`, String(i), { subjectId: 'PHYSICS' });
}

const admin = postgres('postgres://postgres:postgres@127.0.0.1:5432/postgres', { onnotice() {} });
const docs = {
  'knowledge-tree/tree': { nodes, updatedAt: T, schemaVersion: 1 },
  'knowledge-tree/articles': { articles, updatedAt: T, schemaVersion: 1 },
  'question-bank/questions': questions,
  'question-bank/audits': [],
  'exams/exams': exams,
};
const sql = postgres(`postgres://postgres:postgres@127.0.0.1:5432/${db}`, { onnotice() {} });
for (const [k, body] of Object.entries(docs)) {
  await sql`insert into tutai.content_documents (key, body) values (${k}, ${sql.json(body)})
    on conflict (key) do update set body = excluded.body, updated_at = now()`;
}
await sql.end();
await admin.end();
fs.writeFileSync(`/tmp/claude-0/pp/${db}.key.json`, JSON.stringify({ key, exams: exams.map((e) => ({ id: e.id, accessTier: e.accessTier ?? 'FREE', questionIds: e.questionIds, publishStatus: e.publishStatus })) }, null, 1));
console.log(db, 'nodes', nodes.length, 'articles', Object.keys(articles).length, 'questions', questions.length, 'exams', exams.length);
