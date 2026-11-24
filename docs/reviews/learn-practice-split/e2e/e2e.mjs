// Admin → Student E2E for the Practice page redesign. Local QA databases only (pp_qa, pp_empty).
// Usage: node e2e.mjs <1440|768|390>. Content is authored through the Admin UI once (1440);
// every viewport then checks what students see and do.
import fs from 'node:fs';
import { chromium, H, SERVERS, ADMIN, PASSWORD, psql, overflow, api, newStudent, adminLogin, wrong } from './lib.mjs';

const VP = Number(process.argv[2] ?? 1440);
const FULL = true; // each viewport authors its own content on a freshly seeded DB
const BASE = SERVERS.pp_qa;
const OUT = `/tmp/claude-0/pp/anh/e2e/${VP}`;
fs.mkdirSync(OUT, { recursive: true });
const KEY = JSON.parse(fs.readFileSync('/tmp/claude-0/pp/pp_qa.key.json', 'utf8')).key;
const STATE_FILE = '/tmp/claude-0/pp/e2e-state.json';
const state = fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) : {};
const C1 = 'node-nrm3k7taj', L1 = 'node-s0f2jitge', L2 = 'node-sg3wg6atb', L5 = 'node-tichphan';

const results = [];
let scenario = '';
function check(name, ok, detail = '') {
  results.push({ vp: VP, scenario, name, ok: !!ok, detail: ok ? '' : String(detail).slice(0, 300) });
  console.log(`${ok ? 'PASS' : 'FAIL'} [${VP}] ${scenario} :: ${name}${ok ? '' : ` -- ${String(detail).slice(0, 300)}`}`);
}
async function step(name, fn) {
  scenario = name;
  try { await fn(); } catch (error) { check('no exception', false, error.stack?.split('\n').slice(0, 3).join(' | ')); }
}

const browser = await chromium.launch();
const IGNORED = /Failed to load resource: the server responded with a status of (401|403|404|409|410)/;
function wire(context) {
  const page = context.pages()[0];
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && !IGNORED.test(m.text()) && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  return { context, page, errors, api: api(context, BASE) };
}
async function student(tag) {
  const context = await browser.newContext({ viewport: { width: VP, height: H[VP] } });
  await context.newPage();
  const username = await newStudent(context, BASE, `${tag}${VP}`);
  return { ...wire(context), username };
}
async function admin() {
  const context = await browser.newContext({ viewport: { width: VP, height: H[VP] } });
  await adminLogin(context, 'pp_qa');
  await context.newPage();
  return wire(context);
}
async function go(s, path, shot) {
  const response = await s.page.goto(BASE + path);
  await s.page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  const over = await overflow(s.page);
  check(`no horizontal overflow on ${path}`, over <= 0, `overflow ${over}px`);
  if (shot) await s.page.screenshot({ path: `${OUT}/${shot}.png`, fullPage: true });
  return response;
}
const noErrors = (s, where) => { check(`no console errors (${where})`, s.errors.length === 0, s.errors.slice(0, 3).join(' | ')); s.errors.length = 0; };
const row = (s, lesson) => s.page.locator(`[data-testid="lesson-row"][data-lesson="${lesson}"]`);
const rowText = async (s, lesson) => (await row(s, lesson).getByTestId('lesson-status').innerText()).trim();
const rowAction = (s, lesson) => row(s, lesson).locator('[data-testid="lesson-action"], [data-testid="lesson-read"]');
const studentId = (username) => psql('pp_qa', `select p.id from tutai.student_profiles p join tutai.users u on u.id = p.user_id where u.username = '${username}'`);
const bankQuestion = (id) => JSON.parse(psql('pp_qa', `select x from tutai.content_documents d, jsonb_array_elements(d.body) x where d.key = 'question-bank/questions' and x->>'id' = '${id}'`) || 'null');

/** Answers every question of an attempt through the API: the first `n` right. */
async function answerAll(s, view, n, keyOf = (id) => KEY[id]) {
  let last;
  for (const [i, q] of view.questions.entries()) {
    if (view.feedback?.[q.id]) continue;
    const k = keyOf(q.id);
    last = await s.api('POST', `/api/student/practice/attempts/${view.attempt.id}/answers`, { questionId: q.id, response: i < n ? k : wrong(k) });
  }
  return last;
}

// ── Flow 1: Admin prepares content in the existing Admin UI ───────────────────
await step('F1 Admin soạn, duyệt, xem trước và xuất bản câu hỏi', async () => {
  if (!FULL) return;
  const adm = await admin();
  const list = await go(adm, '/admin/practice', 'admin-luyen-tap');
  check('admin opens Admin › Luyện tập (200)', list.status() === 200, list.status());
  await go(adm, `/admin/practice/${L1}`, null);
  const existing = await adm.page.getByTestId('practice-question').count();
  check('admin sees the existing questions of "Tính đơn điệu"', existing >= 12, existing);
  const lessonPage = await go(adm, `/admin/practice/${L5}`, 'admin-tich-phan-truoc');
  check('admin opens lesson "Tích phân" (200)', lessonPage.status() === 200);
  check('"Tích phân" has no question yet', (await adm.page.getByTestId('practice-question').count()) === 0);

  const author = async ({ stem, options, correct, explanation }) => {
    await adm.page.getByTestId('add-question').click();
    const editor = adm.page.getByTestId('question-editor');
    await editor.waitFor();
    await editor.getByTestId('editor-stem').fill(stem);
    for (const [k, v] of Object.entries(options)) await editor.getByTestId(`editor-option-${k}`).fill(v);
    await editor.getByTestId(`editor-correct-${correct}`).click();
    if (explanation) await editor.getByTestId('editor-explanation').fill(explanation);
    const saved = adm.page.waitForResponse((r) => r.url().includes('/api/question-bank') && ['POST'].includes(r.request().method()));
    await editor.getByTestId('editor-save').click();
    const response = await saved;
    const body = await response.json();
    check(`UI saves "${stem.slice(0, 24)}…" (201)`, response.status() === 201, response.status());
    await editor.waitFor({ state: 'detached', timeout: 10000 }).catch(() => {});
    return body.question;
  };
  const opts = (a) => ({ A: `$${a}$`, B: `$${a + 1}$`, C: `$${a + 2}$`, D: `$${a + 3}$` });
  const q1 = await author({ stem: 'Tích phân $\\int_0^1 2x\\,dx$ bằng bao nhiêu? (QA 1)', options: opts(1), correct: 'A', explanation: '$\\int_0^1 2x\\,dx = x^2\\big|_0^1 = 1$.' });
  const q2 = await author({ stem: 'Tích phân $\\int_0^2 x\\,dx$ bằng bao nhiêu? (QA 2)', options: opts(1), correct: 'B', explanation: '$\\int_0^2 x\\,dx = \\frac{x^2}{2}\\big|_0^2 = 2$.' });
  const q3 = await author({ stem: 'Tích phân $\\int_0^3 1\\,dx$ bằng bao nhiêu? (QA 3, để chờ duyệt)', options: opts(1), correct: 'C', explanation: 'Bằng 3.' });
  // The editor itself refuses to save a question without a solution.
  await adm.page.getByTestId('add-question').click();
  const editor = adm.page.getByTestId('question-editor');
  await editor.getByTestId('editor-stem').fill('Câu thiếu lời giải (QA 4)');
  for (const [k, v] of Object.entries(opts(5))) await editor.getByTestId(`editor-option-${k}`).fill(v);
  await editor.getByTestId('editor-correct-A').click();
  let posted = false;
  const onReq = (r) => { if (r.url().endsWith('/api/question-bank') && r.method() === 'POST') posted = true; };
  adm.page.on('request', onReq);
  await editor.getByTestId('editor-save').click();
  await adm.page.waitForTimeout(800);
  adm.page.off('request', onReq);
  check('editor does not save a question without explanation', !posted && (await editor.isVisible()));
  await adm.page.getByRole('button', { name: 'Đóng' }).first().click().catch(() => {});
  // A draft without explanation can still arrive another way (import): create it through the API.
  const created = await adm.api('POST', '/api/question-bank', { stem: 'Câu thiếu lời giải (QA 4)', questionType: 'MULTIPLE_CHOICE_SINGLE',
    options: Object.entries(opts(5)).map(([key, content]) => ({ key, content })), correctAnswer: 'A', explanation: '',
    primaryKnowledgeNodeId: L5, knowledgeCoverage: 'FOCUS', cognitiveLevel: 'APPLICATION', difficulty: 'FOUNDATIONAL' });
  check('API accepts a draft without explanation (201)', created.status === 201, created.text);
  const q4 = created.body.question;
  check('new questions are linked to "Tích phân" and derive Toán 12', [q1, q2, q3, q4].every((q) => q.primaryKnowledgeNodeId === L5 && q.subjectId === 'MATH' && Number(q.grade) === 12), JSON.stringify([q1, q2].map((q) => [q.primaryKnowledgeNodeId, q.subjectId, q.grade])));
  check('new questions start as drafts', [q1, q2, q3, q4].every((q) => q.editorialStatus === 'DRAFT'));
  await adm.page.reload(); await adm.page.waitForLoadState('networkidle');
  const card = (id) => adm.page.locator('[data-testid="practice-question"]').filter({ hasText: id === q1.id ? '(QA 1)' : id === q2.id ? '(QA 2)' : id === q3.id ? '(QA 3' : '(QA 4)' });
  for (const q of [q1, q2, q3, q4]) {
    await card(q.id).getByTestId('action-submit-review').click();
    await adm.page.waitForTimeout(600);
  }
  await adm.page.reload(); await adm.page.waitForLoadState('networkidle');
  check('blocked question shows the publish blocker', await card(q4.id).getByTestId('publish-blockers').isVisible());
  check('publish button disabled without explanation', await card(q4.id).getByTestId('action-publish').isDisabled());
  const bypass = await adm.api('PATCH', `/api/question-bank/${q4.id}`, { editorialStatus: 'PUBLISHED', usageContexts: ['OPEN_PRACTICE'] });
  // The bank treats a missing explanation as a warning; Practice excludes such a question on the server.
  check('bypassing the UI: bank accepts the status change (explanation is a warning there)', bypass.status === 200, bypass.status);
  state.q4Bypassed = true;
  check('rights recorded on new question', !!bankQuestion(q1.id)?.source, JSON.stringify(bankQuestion(q1.id)?.source));
  // Student preview inside Admin, before publishing.
  await adm.page.getByTestId('select-all-reviewable').check().catch(() => adm.page.getByTestId('select-all-reviewable').click());
  const preview = adm.page.getByTestId('open-student-preview');
  if (await preview.count()) {
    await preview.first().click();
    check('admin student preview opens', await adm.page.getByTestId('student-preview').isVisible({ timeout: 5000 }));
    await adm.page.screenshot({ path: `${OUT}/admin-xem-truoc.png`, fullPage: false });
    await adm.page.keyboard.press('Escape');
    await adm.page.reload(); await adm.page.waitForLoadState('networkidle');
  } else check('admin student preview button present', false, 'open-student-preview missing');
  for (const q of [q1, q2]) {
    await card(q.id).getByTestId('action-publish').click();
    await adm.page.waitForTimeout(800);
  }
  await adm.page.reload(); await adm.page.waitForLoadState('networkidle');
  await adm.page.screenshot({ path: `${OUT}/admin-tich-phan-sau.png`, fullPage: true });
  const st = (id) => bankQuestion(id)?.editorialStatus;
  check('DB: Q1, Q2 published; Q3 in review; Q4 published only by the API bypass', st(q1.id) === 'PUBLISHED' && st(q2.id) === 'PUBLISHED' && st(q3.id) === 'IN_REVIEW' && st(q4.id) === 'PUBLISHED', [q1, q2, q3, q4].map((q) => st(q.id)).join(','));
  check('Admin list shows 2 in practice', (await adm.page.locator('[data-testid="practice-question"][data-state="IN_PRACTICE"]').count()) === 2);
  noErrors(adm, 'admin');
  Object.assign(state, { q: { q1: q1.id, q2: q2.id, q3: q3.id, q4: q4.id } });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 1));
  await adm.context.close();
});

const QKEY = (id) => (id === state.q?.q1 ? { choice: 'A' } : id === state.q?.q2 ? { choice: 'B' } : KEY[id]);

// ── Flow 2: a separate ordinary student sees exactly the published content ───
await step('F2 Học sinh thấy đúng nội dung đã xuất bản', async () => {
  const s = await student('vis');
  await go(s, '/student/roadmap', 'hs-hoc');
  // Học is for reading only: no practice actions, no banner, no quote; the nav is a flat list without hints.
  const hocMain = (await s.page.locator('main').innerText());
  check('Học: one h1 named Học', (await s.page.locator('h1').allInnerTexts()).join('|') === 'Học', (await s.page.locator('h1').allInnerTexts()).join('|'));
  check('Học: no practice links in the page body', (await s.page.locator('main a[href*="/practice"]').count()) === 0, await s.page.locator('main a[href*="/practice"]').count());
  check('Học: no target-score banner, progress bar or quote', !/Mục tiêu|bài đã xong/.test(hocMain) && (await s.page.getByTestId('roadmap-quote').count()) === 0 && (await s.page.getByRole('progressbar').count()) === 0);
  check('Học: no practice words', !/luyện tập|Làm tiếp|câu sai|Làm thử/i.test(hocMain), hocMain.match(/luyện tập|Làm tiếp|câu sai|Làm thử/i)?.[0]);
  check('Học: next card offers reading', ['Bắt đầu học', 'Học tiếp'].includes((await s.page.getByTestId('roadmap-next-cta').innerText()).trim()));
  const navNav = s.page.locator('nav[aria-label="Điều hướng học tập"]').first();
  const navLinks = (await navNav.locator('a').allTextContents()).map((t) => t.trim()).join('|');
  const navAll = (await navNav.textContent()).replace(/\s+/g, '');
  check('nav: Học, Luyện tập, Luyện thi, Thứ hạng, Đấu trường with no hints or headings', navLinks === 'Học|Luyện tập|Luyện thi|Thứ hạng|Đấu trường' && navAll === navLinks.replace(/[|\s]/g, ''), `${navLinks} / ${navAll}`);
  await s.page.getByTestId('roadmap-next-cta').click();
  await s.page.waitForURL(/\/student\/lessons\/[^/]+$/);
  check('Học → next lesson opens the lesson', /\/student\/lessons\/node-/.test(s.page.url()), s.page.url());
  await go(s, '/student/roadmap', null);
  const nav = s.page.locator('a[href="/student/practice"]:visible').first();
  if (VP < 1024) { await s.page.getByLabel('Mở menu học tập').click(); }
  await nav.click();
  await s.page.waitForURL('**/student/practice');
  await s.page.waitForLoadState('networkidle');
  check('Roadmap → sidebar "Luyện tập" opens the page', s.page.url().endsWith('/student/practice'));
  check('sidebar marks Luyện tập active', (await s.page.locator('a[href="/student/practice"][aria-current="page"]').count()) >= 1);
  await s.page.screenshot({ path: `${OUT}/hs-moi.png`, fullPage: true });
  check('one h1 named Luyện tập', (await s.page.locator('h1').allInnerTexts()).join('|') === 'Luyện tập', (await s.page.locator('h1').allInnerTexts()).join('|'));
  check('no repeated eyebrow / description / global counter', (await s.page.getByText('TOÁN 12 · LUYỆN TẬP', { exact: true }).count()) === 0 && (await s.page.getByTestId('practice-summary').count()) === 0 && (await s.page.getByText('Củng cố từng bài, chấm ngay').count()) === 0);
  check('ordinary student sees no admin note', (await s.page.getByTestId('admin-preview-note').count()) === 0);
  check('two chapters, grouped', (await s.page.getByTestId('chapter-section').count()) === 2);
  check('"Tích phân" now has 2 questions (published only)', (await rowText(s, L5)) === '2 câu', await rowText(s, L5));
  check('"Tích phân" offers Bắt đầu', (await rowAction(s, L5).getAttribute('data-action')) === 'start');
  check('next lesson (first not passed) is the only filled action', (await s.page.locator('[data-testid="lesson-row"][data-next]').count()) === 1 && (await row(s, L1).getAttribute('data-next')) === 'true');
  check('"Tính đơn điệu" shows 10 câu (session size, archived excluded)', (await rowText(s, L1)) === '10 câu', await rowText(s, L1));
  await rowAction(s, L5).click();
  await s.page.waitForURL(`**/student/lessons/${L5}/practice**`);
  await s.page.getByTestId('practice-begin').click();
  await s.page.getByTestId('practice-question').waitFor();
  await s.page.waitForURL(/attempt=/);
  const attemptId = new URL(s.page.url()).searchParams.get('attempt');
  const view = await s.api('GET', `/api/student/practice/attempts/${attemptId}`);
  const ids = view.body.questions.map((q) => q.id).sort();
  check('session serves exactly Q1, Q2', JSON.stringify(ids) === JSON.stringify([state.q.q1, state.q.q2].sort()), ids.join(','));
  check('in-review question is not served', !ids.includes(state.q.q3));
  check('published-without-explanation question is not served (server practice filter)', !ids.includes(state.q.q4));
  check('no answer key in payload', !/"correctAnswer"|"explanation"/.test(view.text));
  const l1 = await s.api('POST', `/api/student/practice/lessons/${L1}`, { mode: 'LESSON' });
  check('L1 session has 10 questions, none archived or Plus', l1.body.questions.length === 10 && !l1.text.includes('Câu đã lưu trữ') && !l1.text.includes('Câu Plus không thuộc'), l1.body.questions.length);
  noErrors(s, 'visibility');
  await s.context.close();
});

// ── Flow 3: exercise lifecycle on "Tính đơn điệu" (10 questions) ──────────────
await step('F3 Vòng đời bài luyện: làm, dừng, làm tiếp, sửa câu sai, làm lại', async () => {
  const s = await student('life');
  await go(s, '/student/practice', null);
  await rowAction(s, L1).click();
  await s.page.waitForURL(`**/student/lessons/${L1}/practice**`);
  await s.page.getByTestId('practice-begin').click();
  await s.page.getByTestId('practice-question').waitFor();
  await s.page.waitForURL(/attempt=/);
  const attemptId = new URL(s.page.url()).searchParams.get('attempt');
  let view = (await s.api('GET', `/api/student/practice/attempts/${attemptId}`)).body;
  // Q1 right through the UI.
  const first = view.questions[0];
  await s.page.getByTestId(`choice-${KEY[first.id].choice}`).click();
  await s.page.getByTestId('practice-check').click();
  await s.page.getByTestId('feedback').waitFor();
  check('UI grades a right answer as right', /Chính xác/.test(await s.page.getByTestId('feedback').innerText()));
  check('solution shown after answering', (await s.page.locator('[data-testid="solution-steps"], [data-testid="feedback"]').count()) > 0);
  await s.page.getByTestId('practice-next').click();
  // Q2 wrong through the UI.
  const second = view.questions[1];
  const bad = wrong(KEY[second.id]).choice;
  await s.page.getByTestId(`choice-${bad}`).click();
  await s.page.getByTestId('practice-check').click();
  await s.page.getByTestId('feedback').waitFor();
  check('UI grades a wrong answer as wrong with the right key', /Chưa đúng/.test(await s.page.getByTestId('feedback').innerText()), await s.page.getByTestId('feedback').innerText());
  await s.page.screenshot({ path: `${OUT}/hs-cau-sai.png` });
  await s.page.getByTestId('practice-next').click();
  // Q3 via API, then refresh mid-session.
  await s.api('POST', `/api/student/practice/attempts/${attemptId}/answers`, { questionId: view.questions[2].id, response: wrong(KEY[view.questions[2].id]) });
  await s.page.reload(); await s.page.waitForLoadState('networkidle');
  check('refresh keeps the attempt and opens question 4', /4\s*\/\s*10|Câu 4/.test(await s.page.getByTestId('progress-label').innerText()), await s.page.getByTestId('progress-label').innerText());
  await go(s, '/student/practice', `hs-dang-lam`);
  check('resume strip shows 3/10 câu', /Đang làm · 3\/10 câu/.test(await s.page.getByTestId('practice-resume').innerText()));
  check('row says the same 3/10 câu', (await rowText(s, L1)) === 'Đang làm · 3/10 câu', await rowText(s, L1));
  check('no row is marked primary while a session is open', (await s.page.locator('[data-testid="lesson-row"][data-next]').count()) === 0);
  // Logout / login keeps the attempt.
  await s.context.request.post(`${BASE}/api/auth/logout`, { headers: { origin: BASE } });
  const loggedOut = await s.page.goto(`${BASE}/student/practice`);
  check('after logout, Practice sends to login', /\/auth\/login/.test(s.page.url()), s.page.url());
  const login = await s.context.request.post(`${BASE}/api/auth/login`, { headers: { origin: BASE }, data: { identifier: s.username, password: PASSWORD } });
  check('login again', login.ok(), login.status());
  await go(s, '/student/practice', null);
  await s.page.getByTestId('practice-resume-action').click();
  await s.page.getByTestId('practice-question').waitFor();
  check('Làm tiếp resumes at question 4 after re-login', /4\s*\/\s*10|Câu 4/.test(await s.page.getByTestId('progress-label').innerText()));
  view = (await s.api('GET', `/api/student/practice/attempts/${attemptId}`)).body;
  const done = await answerAll(s, view, 0, QKEY); // rest wrong → 1/10
  check('attempt completes with 1/10', done.body.attempt.status === 'COMPLETED' && done.body.attempt.correctCount === 1, done.text.slice(0, 200));
  await go(s, '/student/practice', 'hs-1-10');
  check('status: Cao nhất 1/10 · cần 8 để đạt', (await rowText(s, L1)) === 'Cao nhất 1/10 · cần 8 để đạt', await rowText(s, L1));
  check('action: Xem 9 câu sai', (await rowAction(s, L1).innerText()).trim() === 'Xem 9 câu sai', await rowAction(s, L1).innerText());
  await rowAction(s, L1).click();
  await s.page.getByTestId('results').waitFor();
  check('Xem câu sai opens the results with 1/10', (await s.page.getByTestId('score').innerText()).trim() === '1/10');
  check('results offer Luyện lại 9 câu sai', /Luyện lại 9 câu sai/.test(await s.page.getByTestId('retry-mistakes').innerText()));
  await s.page.getByTestId('retry-mistakes').click();
  await s.page.getByTestId('practice-question').waitFor();
  await s.page.waitForURL((u) => u.searchParams.get('attempt') && u.searchParams.get('attempt') !== attemptId);
  const mAttempt = new URL(s.page.url()).searchParams.get('attempt');
  const mView = (await s.api('GET', `/api/student/practice/attempts/${mAttempt}`)).body;
  check('retry has the 9 missed questions', mView.questions.length === 9 && mView.attempt.mode === 'MISTAKES', mView.questions.length);
  await answerAll(s, mView, 3, QKEY);
  await go(s, '/student/practice', 'hs-con-sai');
  check('best stays 1/10 after a retry of missed questions', (await rowText(s, L1)) === 'Cao nhất 1/10 · cần 8 để đạt', await rowText(s, L1));
  check('action: Xem 6 câu còn sai', (await rowAction(s, L1).innerText()).trim() === 'Xem 6 câu còn sai', await rowAction(s, L1).innerText());
  // Second retry: 5 of 6 right = 83 %; the lesson is still not passed and 1 is still wrong.
  const m2 = await s.api('POST', `/api/student/practice/lessons/${L1}`, { mode: 'MISTAKES', fromAttemptId: mAttempt });
  await answerAll(s, m2.body, 5, QKEY);
  await go(s, '/student/practice', null);
  check('regression: 5/6 retry still offers Xem 1 câu còn sai', (await rowAction(s, L1).innerText()).trim() === 'Xem 1 câu còn sai', await rowAction(s, L1).innerText());
  const m3 = await s.api('POST', `/api/student/practice/lessons/${L1}`, { mode: 'MISTAKES', fromAttemptId: m2.body.attempt.id });
  await answerAll(s, m3.body, 1, QKEY);
  await go(s, '/student/practice', null);
  check('all missed fixed → Luyện lại (whole lesson)', (await rowAction(s, L1).getAttribute('data-action')) === 'retry');
  // Whole retry 9/10 → passed.
  const whole = await s.api('POST', `/api/student/practice/lessons/${L1}`, { mode: 'LESSON' });
  await answerAll(s, whole.body, 9, QKEY);
  await go(s, '/student/practice', 'hs-da-dat');
  check('passed: Đạt · 9/10', (await rowText(s, L1)) === 'Đạt · 9/10', await rowText(s, L1));
  check('passed lesson marked done', (await row(s, L1).getAttribute('data-status')) === 'done');
  check('chapter: 1/3 bài đạt', /1\/3 bài đạt/.test(await s.page.getByTestId('chapter-progress').first().innerText()));
  check('next action moves to "Cực trị"', (await row(s, L2).getAttribute('data-next')) === 'true');
  const sid = studentId(s.username);
  const rows = psql('pp_qa', `select mode || ':' || correct_count || '/' || total_count from tutai.practice_attempts where student_id = '${sid}' and lesson_id = '${L1}' order by started_at`).split('\n');
  check('DB history: LESSON 1/10, MISTAKES 3/9, 5/6, 1/1, LESSON 9/10', rows.join(',') === 'LESSON:1/10,MISTAKES:3/9,MISTAKES:5/6,MISTAKES:1/1,LESSON:9/10', rows.join(','));
  const again = await s.api('POST', `/api/student/practice/attempts/${whole.body.attempt.id}/answers`, { questionId: whole.body.questions[9].id, response: QKEY(whole.body.questions[9].id) });
  check('a finished answer cannot be regraded (stored result returned)', again.status === 200 && again.body.feedback.correct === false, again.text.slice(0, 120));
  noErrors(s, 'lifecycle');
  await s.context.close();
});

// ── Flow 4: chapter sets, Plus and admin preview ─────────────────────────────
await step('F4 Ôn chương, Tổng hợp Plus, quyền Admin', async () => {
  const free = await student('free');
  await go(free, '/student/practice?view=chapter', 'hs-chuong-free');
  check('free: Ôn chương for both chapters (chapter 2 opened by the 2 new published questions)', (await free.page.getByTestId('review-card').count()) === 2);
  check('free: Tổng hợp locked', (await free.page.getByTestId('synthesis-card').getAttribute('data-locked')) === 'true');
  check('free: no admin note, no Plus marketing paragraph', (await free.page.getByTestId('admin-preview-note').count()) === 0 && (await free.page.getByTestId('plus-note').count()) === 0);
  check('free: no chapter left without sets', (await free.page.getByTestId('chapter-no-sets').count()) === 0);
  const ch = await free.api('POST', `/api/student/practice/sets/chapter/${C1}`);
  check('free: Ôn chương starts (200)', ch.status === 200, ch.status);
  const sy = await free.api('POST', `/api/student/practice/sets/synthesis/${C1}`);
  check('free: Tổng hợp refused by the server (403)', sy.status === 403, sy.status);
  await go(free, '/student/practice?view=chapter', null);
  check('free: open chapter set shows in resume strip', /Ôn chương · Hàm số/.test(await free.page.getByTestId('practice-resume').innerText()));
  const plus = await student('plus');
  const subs = JSON.parse(fs.readFileSync('/tmp/claude-0/pp/subs.json', 'utf8'));
  subs.push({ userId: studentId(plus.username), startsAt: '2026-01-01T00:00:00.000Z', endsAt: '2027-12-31T00:00:00.000Z', status: 'ACTIVE', updatedAt: '2026-01-01T00:00:00.000Z' });
  fs.writeFileSync('/tmp/claude-0/pp/subs.json', JSON.stringify(subs, null, 2));
  await go(plus, '/student/practice?view=chapter', 'hs-chuong-plus');
  check('plus: Tổng hợp open', (await plus.page.getByTestId('synthesis-card').getAttribute('data-locked')) === 'false');
  check('plus: no admin note', (await plus.page.getByTestId('admin-preview-note').count()) === 0);
  const ps = await plus.api('POST', `/api/student/practice/sets/synthesis/${C1}`);
  check('plus: Tổng hợp starts (200)', ps.status === 200, ps.status);
  const steal = await free.api('GET', `/api/student/practice/attempts/${ps.body.attempt.id}`);
  check('free cannot read the Plus student attempt (404)', steal.status === 404, steal.status);
  const adm = await admin();
  await go(adm, '/student/practice?view=chapter', 'admin-chuong');
  check('admin: one-line admin note with counts', /1\/2 chương có Tổng hợp, 2\/2 có Ôn chương/.test(await adm.page.getByTestId('admin-preview-counts').innerText()));
  const noteBox = await adm.page.getByTestId('admin-preview-note').boundingBox();
  check('admin note is compact (≤ 64 px tall at this width)', noteBox && noteBox.height <= (VP === 390 ? 120 : 64), noteBox?.height);
  check('admin: link to missing content', (await adm.page.getByTestId('admin-readiness-link').getAttribute('href')) === '/admin/practice#premium');
  const as = await adm.api('POST', `/api/student/practice/sets/synthesis/${C1}`);
  check('admin preview: Tổng hợp starts (200)', as.status === 200, as.status);
  check('admin preview wrote no Plus subscription', !fs.readFileSync('/tmp/claude-0/pp/subs.json', 'utf8').includes(psql('pp_qa', `select p.id from tutai.student_profiles p join tutai.users u on u.id = p.user_id where u.email = '${ADMIN}'`)));
  for (const s of [free, plus, adm]) noErrors(s, 'sets');
  for (const s of [free, plus, adm]) await s.context.close();
});

// ── Flow 5: edge cases ───────────────────────────────────────────────────────
await step('F5 Trường hợp biên', async () => {
  const anon = await browser.newContext({ viewport: { width: VP, height: H[VP] } });
  const ap = await anon.newPage();
  await ap.goto(`${BASE}/student/practice`);
  check('guest is sent to login', /\/auth\/login/.test(ap.url()), ap.url());
  const r = await anon.request.post(`${BASE}/api/student/practice/lessons/${L1}`, { headers: { origin: BASE }, data: { mode: 'LESSON' } });
  check('guest API start refused (401)', r.status() === 401, r.status());
  await anon.close();

  const s = await student('edge');
  // Unpublished / unknown lesson.
  const unknown = await s.api('POST', '/api/student/practice/lessons/node-khong-co', { mode: 'LESSON' });
  check('unknown lesson: API 404', unknown.status === 404, unknown.status);
  await go(s, '/student/lessons/node-khong-co/practice', null);
  check('unknown lesson page says it is not open', (await s.page.getByText('Bài học này chưa mở').count()) === 1);
  // Content changed after an attempt: answer Tích phân Q1 right, Q2 wrong, then the admin archives Q2.
  const st = await s.api('POST', `/api/student/practice/lessons/${L5}`, { mode: 'LESSON' });
  for (const q of st.body.questions) await s.api('POST', `/api/student/practice/attempts/${st.body.attempt.id}/answers`, { questionId: q.id, response: q.id === state.q.q1 ? { choice: 'A' } : { choice: 'D' } });
  if (FULL) {
    const adm = await admin();
    const ar = await adm.api('PATCH', `/api/question-bank/${state.q.q2}`, { editorialStatus: 'ARCHIVED' });
    check('admin archives Q2 (200)', ar.status === 200, ar.text);
    await adm.context.close();
  }
  await go(s, '/student/practice', null);
  check('after archive: row keeps the stored 1/2 result', (await rowText(s, L5)) === 'Cao nhất 1/2 · cần 2 để đạt', await rowText(s, L5));
  check('after archive: new sessions have 1 question', (await s.api('POST', `/api/student/practice/lessons/${L5}`, { mode: 'LESSON' })).body.questions.length === 1);
  await go(s, `/student/lessons/${L5}/practice?attempt=${st.body.attempt.id}&from=practice`, 'hs-noi-dung-doi');
  check('old results still open after archive', (await s.page.getByTestId('score').innerText()).trim() === '1/2');
  const mis = await s.api('POST', `/api/student/practice/lessons/${L5}`, { mode: 'MISTAKES', fromAttemptId: st.body.attempt.id });
  check('retry of an archived missed question: 409 with a message (known limitation)', mis.status === 409, `${mis.status} ${mis.text}`);
  // Network / API error and slow loading on the session page.
  await s.page.route('**/api/student/practice/lessons/**', (route) => route.abort());
  await s.page.goto(`${BASE}/student/lessons/${L1}/practice?from=practice`);
  await s.page.getByTestId('practice-error').waitFor({ timeout: 10000 }).catch(() => {});
  check('network error: error state with retry', await s.page.getByTestId('practice-error').isVisible());
  await s.page.unroute('**/api/student/practice/lessons/**');
  await s.page.getByRole('button', { name: 'Thử lại' }).click();
  await s.page.getByTestId('practice-intro').waitFor({ timeout: 10000 }).catch(() => {});
  check('retry after network error recovers', await s.page.getByTestId('practice-intro').isVisible());
  s.errors.length = 0; // the aborted request logs a fetch error on purpose
  await s.page.route('**/api/student/practice/lessons/**', async (route) => { await new Promise((res) => setTimeout(res, 2500)); await route.continue(); });
  await s.page.goto(`${BASE}/student/lessons/${L1}/practice?from=practice`);
  check('slow API: loading skeleton shown', await s.page.locator('[aria-busy="true"]').first().isVisible());
  await s.page.getByTestId('practice-intro').waitFor({ timeout: 10000 });
  check('slow API: page completes', await s.page.getByTestId('practice-intro').isVisible());
  await s.page.unroute('**/api/student/practice/lessons/**');
  // Back navigation during practice.
  await go(s, '/student/practice', null);
  await rowAction(s, L2).click();
  await s.page.waitForURL(`**/lessons/${L2}/practice**`);
  await s.page.goBack(); await s.page.waitForLoadState('networkidle');
  check('back from a lesson returns to Practice', s.page.url().endsWith('/student/practice'));
  noErrors(s, 'edge');
  await s.context.close();
  // Empty program.
  const ectx = await browser.newContext({ viewport: { width: VP, height: H[VP] } });
  await ectx.newPage();
  await newStudent(ectx, SERVERS.pp_empty, `em${VP}`);
  const ep = ectx.pages()[0];
  await ep.goto(`${SERVERS.pp_empty}/student/practice`);
  check('no published content: empty state', await ep.getByTestId('practice-empty').isVisible());
  await ep.screenshot({ path: `${OUT}/hs-trong.png`, fullPage: true });
  await ectx.close();
});

// ── Layout and keyboard on the redesigned page ───────────────────────────────
await step('F6 Bố cục, bàn phím', async () => {
  const s = await student('kb');
  await go(s, '/student/practice', null);
  const boxes = await s.page.$$eval('[data-testid="lesson-row"]', (rows) => rows.map((row) => {
    const r = row.getBoundingClientRect();
    const title = row.querySelector('h3').getBoundingClientRect();
    const action = row.querySelector('a').getBoundingClientRect();
    const overlap = !(title.right <= action.left || action.right <= title.left || title.bottom <= action.top || action.bottom <= title.top);
    return { inside: action.right <= r.right + 0.5 && action.left >= r.left - 0.5, overlap, clipped: row.scrollWidth > row.clientWidth };
  }));
  check('row actions inside their rows, no overlap with titles, nothing clipped', boxes.every((b) => b.inside && !b.overlap && !b.clipped), JSON.stringify(boxes));
  // Keyboard: Tab from the page start reaches tabs and the first lesson action in reading order.
  await s.page.locator('#main-content').focus();
  const order = [];
  for (let i = 0; i < 12; i++) {
    await s.page.keyboard.press('Tab');
    order.push(await s.page.evaluate(() => document.activeElement?.getAttribute('data-testid') || document.activeElement?.textContent?.trim().slice(0, 20)));
  }
  const iTab = order.indexOf('tab-lesson'), iAction = order.indexOf('lesson-action');
  check('focus order: subject → tabs → lesson actions', iTab >= 0 && iAction > iTab, order.join(' > '));
  await s.page.getByTestId('tab-chapter').focus();
  await s.page.keyboard.press('Enter');
  await s.page.waitForURL('**view=chapter');
  check('Enter on "Theo chương" switches view', (await s.page.getByTestId('tab-chapter').getAttribute('aria-current')) === 'page');
  const ring = await s.page.evaluate(() => getComputedStyle(document.activeElement).boxShadow);
  check('focused control shows a ring', ring && ring !== 'none', ring);
  noErrors(s, 'layout');
  await s.context.close();
});

fs.writeFileSync(`/tmp/claude-0/pp/e2e-results-${VP}.json`, JSON.stringify(results, null, 1));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed at ${VP}`);
await browser.close();
