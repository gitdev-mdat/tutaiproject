// Admin → Student E2E for the interactive lesson P1: publishing, the six parts, the one-time
// celebration, revisits, review, practice and saved progress. Local QA database pp_lesson only
// (Production-shaped Toán 12 + the P1 lesson snapshot), never Production.
// Usage: node e2e-lesson.mjs <width>   (run after: bash reset-lesson.sh pp_lesson_draft_base)
import fs from 'node:fs';
import { chromium, SERVERS, newStudent, adminLogin, psql, overflow } from './lib.mjs';

const width = Number(process.argv[2] ?? 1440);
const HEIGHTS = { 1440: 900, 1920: 1080, 390: 844, 360: 640 };
const height = HEIGHTS[width] ?? 900;
const mobile = width < 768;
const BASE = SERVERS.pp_lesson;
const DB = 'pp_lesson';
const P1 = 'knowledge-45c34e43-ad2e-47bf-8845-68782b67cfb9';
const P1_TITLE = 'Tính đơn điệu của hàm số (P1)';
const DRAFT = 'Bài nháp chưa mở (QA)';
const KEY = JSON.parse(fs.readFileSync('/tmp/claude-0/pp/pp_one.key.json', 'utf8')).key;
const OUT = `/tmp/claude-0/pp/anh-lesson/e2e/${width}`;
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) if (f.startsWith('loi-')) fs.unlinkSync(`${OUT}/${f}`);

const results = [];
let scenario = '';
function check(name, ok, detail = '') {
  results.push({ width, scenario, name, ok: !!ok, detail: ok ? '' : String(detail).slice(0, 300) });
  console.log(`${ok ? 'PASS' : 'FAIL'} [${width}] ${scenario} :: ${name}${ok ? '' : ` -- ${String(detail).slice(0, 300)}`}`);
}
let page, context;
async function step(name, fn) {
  scenario = name;
  try { await fn(); } catch (error) {
    check('step finished without error', false, error.stack ?? error);
    await page?.screenshot({ path: `${OUT}/loi-${name.slice(0, 3).trim()}.png`, fullPage: true }).catch(() => {});
  }
}
const browser = await chromium.launch();

async function studentContext(tag, { sound = null, reduced = false } = {}) {
  const ctx = await browser.newContext({
    viewport: { width, height }, hasTouch: mobile, isMobile: mobile, deviceScaleFactor: 1,
    reducedMotion: reduced ? 'reduce' : 'no-preference',
  });
  await ctx.addInitScript(() => {
    window.__plays = [];
    window.__fw = 0;
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      window.__plays.push((this.currentSrc || this.src).split('/').pop());
      return play.call(this).catch(() => {});
    };
    new MutationObserver((records) => {
      for (const r of records) for (const n of r.addedNodes)
        if (n.nodeType === 1 && (n.matches?.('[data-testid="fireworks"]') || n.querySelector?.('[data-testid="fireworks"]'))) window.__fw += 1;
    }).observe(document, { childList: true, subtree: true });
  });
  if (sound) await ctx.addInitScript((v) => { try { localStorage.setItem('tutai:lesson-sound', v); } catch {} }, sound);
  const username = await newStudent(ctx, BASE, `${tag}${width}`);
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e)));
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return { ctx, p, errors, username };
}
const shot = (name, full = false) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
const counts = () => page.evaluate(() => ({ complete: window.__plays.filter((s) => s === 'lesson-complete.mp3').length, streak: window.__plays.filter((s) => s === 'streak-up.mp3').length, fireworks: window.__fw }));
const stageId = () => page.getByTestId('interactive-lesson').getAttribute('data-stage-id');
const mode = () => page.getByTestId('finish').getAttribute('data-mode');
const progress = () => page.evaluate(() => Object.entries(localStorage).filter(([k]) => k.startsWith('tutai:lesson-progress')).map(([, v]) => v).join(''));
const openLesson = async (id = P1) => { await page.goto(`${BASE}/student/lessons/${id}`); await page.waitForLoadState('networkidle'); };

async function next() {
  const button = page.getByTestId(mobile ? 'dock-continue' : 'stage-continue');
  await button.waitFor();
  for (let i = 0; i < 25 && (await button.isDisabled()); i += 1) await page.waitForTimeout(150);
  if (await button.isDisabled()) { await shot(`debug-locked-${await stageId()}`, true); throw new Error(`locked on ${await stageId()}`); }
  await button.click();
  await page.waitForTimeout(600);
}
async function graphPoint(testId, x) {
  const surface = page.getByTestId(testId).getByTestId('graph-surface');
  await surface.scrollIntoViewIfNeeded();
  const box = await surface.boundingBox();
  const w = Number(await surface.getAttribute('data-plot-width'));
  const xMin = Number(await surface.getAttribute('data-x-min'));
  const xMax = Number(await surface.getAttribute('data-x-max'));
  const pad = 18;
  const px = pad + ((x - xMin) / (xMax - xMin)) * (w - 2 * pad);
  return { x: box.x + (px * box.width) / w, y: box.y + box.height * 0.5, xMin, xMax, box };
}
async function tapGraph(testId, x) {
  const p = await graphPoint(testId, x);
  if (mobile) await page.touchscreen.tap(p.x, p.y); else await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(250);
}
async function sweep(testId) {
  if (mobile) {
    const cdp = await context.newCDPSession(page);
    const a = await graphPoint(testId, 0);
    const span = a.xMax - a.xMin;
    const y = a.box.y + a.box.height * 0.55;
    const s = await graphPoint(testId, a.xMin);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: s.x, y }] });
    for (let i = 1; i <= 120; i += 1) {
      const p = await graphPoint(testId, a.xMin + (span * i) / 120);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: p.x, y }] });
      await page.waitForTimeout(12);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    return;
  }
  const handle = page.getByTestId(testId).getByTestId('drag-point');
  const hb = await handle.boundingBox();
  const a = await graphPoint(testId, 0);
  const span = a.xMax - a.xMin;
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  for (let i = 0; i <= 120; i += 1) {
    const p = await graphPoint(testId, a.xMin + (span * i) / 120);
    await page.mouse.move(p.x, p.y, { steps: 1 });
    await page.waitForTimeout(12);
  }
  await page.mouse.up();
}
// Brings a control into the band a student sees on a phone: below the pinned graph, above the dock.
async function tap(locator) {
  await locator.waitFor();
  await locator.evaluate((el) => { const r = el.getBoundingClientRect(); if (window.innerWidth < 768) window.scrollBy(0, r.top - window.innerHeight * 0.62); });
  await page.waitForTimeout(120);
  await locator.click();
}
const pick = (group, id) => tap(page.getByTestId(group).getByTestId(`choice-${id}`));
async function solver({ roots, signs, pieces }) {
  await pick('choices-domain', 'r');
  await pick('choices-derivative', 'd0');
  for (const r of roots) await tap(page.getByTestId(`root-${r}`));
  await tap(page.getByTestId('check-roots'));
  for (let i = 0; i < signs.length; i += 1) {
    const cell = page.getByTestId(`sign-${i}`);
    await tap(cell);
    if (signs[i] < 0) await tap(cell);
  }
  await tap(page.getByTestId('check-signs'));
  for (let i = 0; i < pieces.length; i += 1) await tap(page.getByTestId(`conclude-${i}-${pieces[i]}`));
  await tap(page.getByTestId('check-conclusion'));
}
//const MAIN = { roots: ['0', '2'], signs: [1, -1, 1], pieces: ['up', 'down', 'up'] };
//const PRACTICE = { roots: ['−1', '1'], signs: [-1, 1, -1], pieces: ['down', 'up', 'down'] };

const MAIN = { roots: ['0', '2'], signs: [1, -1, 1], pieces: ['up', 'down', 'up'] };
const PRACTICE = { roots: ['−1', '1'], signs: [-1, 1, -1], pieces: ['down', 'up', 'down'] };

let beforeFinish = null;
async function walkAll({ checks = true } = {}) {
  await page.getByTestId('interactive-lesson').waitFor();
  await page.waitForTimeout(1600);
  const kinds = [];
  const doPart = async (fn, name) => {
    const id = await stageId();
    kinds.push(id);
    if (checks) {
      check(`${id}: one heading, no repeated "Phần n ·" eyebrow`, (await page.getByTestId('part-heading').count()) === 1 && !/Phần \d+ ·/.test(await page.getByTestId('part-heading').innerText()));
      const cont = page.getByTestId(mobile ? 'dock-continue' : 'stage-continue');
      check(`${id}: continue is locked until the activity is done`, await cont.isDisabled());
    }
    await fn();
    if (checks) check(`${id}: no horizontal overflow`, (await overflow(page)) <= 0, await overflow(page));
    if (name) await shot(name, !mobile);
    if (id === 'thu-suc') beforeFinish = await counts();
    await next();
  };
  await doPart(async () => {
    await tapGraph('graph-shape', 0); await tapGraph('graph-shape', 2);
    await tap(page.getByTestId('piece-0-up')); await tap(page.getByTestId('piece-1-down')); await tap(page.getByTestId('piece-2-up'));
  }, null);
  await doPart(async () => { await pick('predict-tangent', 'len'); await sweep('graph-slope'); await pick('rule-positive', 'len'); await pick('rule-negative', 'xuong'); }, null);
  await doPart(async () => { await pick('flat-predict', 'giu-chieu'); await page.waitForTimeout(400); await sweep('graph-flat'); await pick('flat-conclude', 'ca-truc'); }, null);
  await doPart(async () => {
    await solver(MAIN); await page.waitForTimeout(2600);
    if (checks) {
      check('vi-du: one success note, not two', (await page.getByText('Kết luận của em khớp với đồ thị.').count()) === 0 && (await page.getByText('Chính xác, em tự tìm ra!').count()) >= 1);
      const folded = await page.locator('[data-testid="model-step"][data-folded="true"]').count();
      check('vi-du: worked solution folded after a first-try answer ("Xem lời giải mẫu")', folded >= 1, folded);
      check('vi-du: variation table shown', (await page.getByTestId('variation-table').count()) + (await page.getByText('Bảng biến thiên', { exact: false }).count()) > 0);
    }
  }, null);
  await doPart(async () => { await solver(PRACTICE); await page.waitForTimeout(1200); }, null);
  return kinds;
}

// ── Admin ────────────────────────────────────────────────────────────────────
const actx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await adminLogin(actx, DB);
const admin = await actx.newPage();
const adminErrors = [];
admin.on('console', (m) => m.type() === 'error' && adminErrors.push(m.text()));
const rowMenu = (title) => admin.getByRole('button', { name: `Thao tác với ${title}`, exact: true });
const chapterOf = (title) => admin.locator('li[id^="chapter-"]').filter({ has: rowMenu(title) });

const early = await studentContext('early');
page = early.p; context = early.ctx;

await step('A1 Bài chưa xuất bản không mở được', async () => {
  await openLesson();
  check('draft P1: the lesson does not open for a student', (await page.getByTestId('interactive-lesson').count()) === 0, (await page.locator('main').innerText()).slice(0, 120));
  await shot('a1-hs-bai-chua-mo');
  await page.goto(`${BASE}/student/roadmap`); await page.getByTestId('roadmap').waitFor();
  check('draft P1 is not on the learning path', !(await page.locator('main').innerText()).includes(P1_TITLE));
});

await step('A2 Admin xuất bản bài qua Admin UI, thêm một bài nháp', async () => {
  await admin.goto(`${BASE}/admin/knowledge`); await admin.waitForLoadState('networkidle');
  await rowMenu(P1_TITLE).click();
  await admin.getByRole('menuitem', { name: 'Soạn bài học' }).click();
  const sheet = admin.getByRole('dialog');
  await sheet.locator('#article-OBJECTIVE').waitFor();
  await admin.screenshot({ path: `${OUT}/a2-admin-soan-bai.png` });
  const response = admin.waitForResponse((r) => r.request().method() !== 'GET' && /knowledge|article/.test(r.url()));
  await sheet.getByRole('button', { name: 'Lưu và hiển thị cho học sinh' }).click();
  const r = await response;
  check(`admin publishes P1 from the lesson editor (${r.status()})`, r.ok(), r.status());
  await admin.waitForTimeout(400);
  await admin.getByRole('button', { name: 'Đóng trình soạn bài' }).click();
  const art = JSON.parse(psql(DB, `select body->'articles'->'${P1}' from tutai.content_documents where key='knowledge-tree/articles'`));
  check('article is PUBLISHED for learning', art.status === 'PUBLISHED' && art.publishToLearning === true, `${art.status} ${art.publishToLearning}`);
  check('the lesson content survives the save (graph y = x^3 - 3x^2 + 2 kept)', art.blocks.some((b) => b.type === 'GRAPH' && b.content === 'y = x^3 - 3x^2 + 2'), JSON.stringify(art.blocks.map((b) => b.type)));
  // A second lesson in the same chapter, saved as a draft only.
  await chapterOf(P1_TITLE).getByRole('button', { name: 'Thêm kiến thức' }).click();
  const dialog = admin.getByRole('dialog');
  await dialog.locator('#node-title').fill(DRAFT);
  await dialog.locator('button[type="submit"]').click();
  await admin.locator('#article-OBJECTIVE').waitFor();
  await admin.locator('#article-OBJECTIVE').fill('Bài kiểm thử, chưa mở cho học sinh.');
  await admin.locator('#article-MAIN_CONTENT').fill('Nội dung kiểm thử QA.');
  await admin.locator('#article-EXAMPLE').fill('Ví dụ kiểm thử QA.');
  const saved = admin.waitForResponse((r) => r.request().method() !== 'GET' && /knowledge|article/.test(r.url()));
  await admin.getByRole('button', { name: 'Lưu bản nháp' }).click();
  check('admin saves the second lesson as a draft', (await saved).ok());
  await admin.waitForTimeout(400);
  await admin.getByRole('button', { name: 'Đóng trình soạn bài' }).click();
  const real = adminErrors.filter((e) => !e.includes('/api/admin/textbooks') && !e.includes('status of 503'));
  check('admin: no console errors (textbook storage 503 excluded)', real.length === 0, real.join(' | '));
});

const draftId = psql(DB, `select n->>'id' from tutai.content_documents, jsonb_array_elements(body->'nodes') n where key='knowledge-tree/tree' and n->>'title'='${DRAFT}'`);

await step('A3 Học sinh thấy bài vừa xuất bản, bài nháp vẫn ẩn', async () => {
  await page.goto(`${BASE}/student/roadmap`); await page.getByTestId('roadmap').waitFor(); await page.waitForTimeout(500);
  const text = await page.locator('main').innerText();
  check('P1 now on the learning path', text.includes(P1_TITLE));
  check('the draft lesson is not on the path', !text.includes(DRAFT));
  await openLesson(draftId);
  check('draft lesson URL does not open', (await page.getByTestId('interactive-lesson').count()) === 0 && (await page.getByTestId('lesson-journey').count()) === 0, draftId);
  await shot('a3-hs-bai-nhap');
});
await early.ctx.close();

// ── Student: first completion ────────────────────────────────────────────────
const s = await studentContext('ls');
page = s.p; context = s.ctx;
let saved1 = '';
await step('S1 Từ lộ trình mở bài và học đủ 6 phần', async () => {
  await page.goto(`${BASE}/student/roadmap`); await page.getByTestId('roadmap').waitFor();
  await page.locator(`[data-testid="roadmap-lesson"][data-lesson="${P1}"]`).click();
  await page.waitForURL(`**/student/lessons/${P1}**`);
  check('roadmap opens the lesson', page.url().includes(P1));
  check('sound is on by default (header icon pressed)', (await page.getByTestId('sound-setting').getAttribute('aria-pressed')) === 'true');
  const kinds = await walkAll();
  check('went through the five activity parts in order', kinds.join(',') === 'bat-dau,kham-pha,mo-rong,vi-du,thu-suc', kinds.join(','));
  check('no celebration before the last part', beforeFinish.fireworks === 0 && beforeFinish.complete === 0, JSON.stringify(beforeFinish));
});

await step('S2 Lần đầu hoàn thành: ăn mừng và âm thanh đúng một lần', async () => {
  check('on the finish part', (await stageId()) === 'tong-ket');
  await page.waitForTimeout(4000);
  const c = await counts();
  check('fireworks played once', c.fireworks === 1, JSON.stringify(c));
  check('completion sound played once', c.complete === 1, JSON.stringify(c));
  check('streak accent at most once (new day)', c.streak <= 1, JSON.stringify(c));
  check('mode is the first-time celebration', (await mode()) === 'celebrate', await mode());
  check('title: "Tuyệt vời! Em đã tự khám phá cả bài."', (await page.getByTestId('finish-title').innerText()).includes('Tuyệt vời'));
  check('no replay button, no sound toggle on the summary', (await page.getByTestId('replay-celebration').count()) === 0 && (await page.getByTestId('sound-toggle').count()) === 0 && (await page.getByTestId('finish-banner').count()) === 0);
  const next = await page.getByTestId('finish-next').boundingBox();
  check('the next step is visible without scrolling', next && next.y < height, next && next.y);
  check('fireworks gone after the celebration', (await page.getByTestId('fireworks').count()) === 0);
  check('no horizontal overflow on the summary', (await overflow(page)) <= 0);
  saved1 = await progress();
  check('progress saved as completed', saved1.includes('"completedAt"'));
});

await step('S3 Quay lại một phần rồi về cuối: không ăn mừng lại', async () => {
  await page.getByTestId('part-bat-dau').click(); await page.waitForTimeout(600);
  check('part 1 opens in review (continue open at once)', !(await page.getByTestId(mobile ? 'dock-continue' : 'stage-continue').isDisabled()));
  await page.getByTestId('part-tong-ket').click(); await page.waitForTimeout(2500);
  const c = await counts();
  check('no second fireworks', c.fireworks === 1, JSON.stringify(c));
  check('no second sound', c.complete === 1, JSON.stringify(c));
  check('summary stays calm (no animation mode)', (await mode()) !== 'celebrate', await mode());
});

await step('S4 Tải lại trang: trạng thái đã học, không hiệu ứng', async () => {
  await page.reload(); await page.getByTestId('interactive-lesson').waitFor(); await page.waitForTimeout(2500);
  const c = await counts();
  check('reload opens on the summary', (await stageId()) === 'tong-ket');
  check('reload: no fireworks, no sound', c.fireworks === 0 && c.complete === 0 && c.streak === 0, JSON.stringify(c));
  check('reload: quiet revisit mode', (await mode()) === 'revisit', await mode());
  check('reload: "Em đã học xong bài này" and "Đã học xong" in the header', (await page.getByTestId('finish-title').innerText()).includes('Em đã học xong') && (await page.getByTestId('lesson-learned').isVisible()));
  check('reload: no replay button, no sound toggle', (await page.getByTestId('replay-celebration').count()) === 0 && (await page.getByTestId('sound-toggle').count()) === 0);
  await shot('s4-xem-lai');
});

await step('S5 Về lộ trình rồi mở lại bài', async () => {
  await page.goto(`${BASE}/student/roadmap`); await page.getByTestId('roadmap').waitFor(); await page.waitForTimeout(600);
  const row = page.locator(`[data-testid="roadmap-lesson"][data-lesson="${P1}"]`);
  check('roadmap marks P1 learned', (await row.getAttribute('data-completed')) === 'true');
  await shot('s5-lo-trinh');
  await row.click();
  await page.getByTestId('interactive-lesson').waitFor(); await page.waitForTimeout(2500);
  const c = await counts();
  check('reopen: no fireworks, no sound', c.fireworks === 0 && c.complete === 0, JSON.stringify(c));
  check('reopen: quiet revisit mode', (await mode()) === 'revisit', await mode());
});

await step('S6 Xem lại các phần', async () => {
  for (const id of ['bat-dau', 'kham-pha', 'mo-rong', 'vi-du', 'thu-suc']) {
    await page.getByTestId(`part-${id}`).click(); await page.waitForTimeout(500);
    check(`review ${id}: opens with its answers, continue open`, (await stageId()) === id && !(await page.getByTestId(mobile ? 'dock-continue' : 'stage-continue').isDisabled()));
  }
  check('review vi-du/thu-suc: worked solution folded', (await page.locator('[data-testid="model-step"][data-folded="false"], [data-testid="model-step"]:not([data-folded])').count()) === 0);
  await page.getByTestId('part-tong-ket').click(); await page.waitForTimeout(800);
  const c = await counts();
  check('reviewing every part triggers no celebration', c.fireworks === 0 && c.complete === 0, JSON.stringify(c));
  await page.getByTestId('restart').click(); await page.waitForTimeout(500);
  check('"Xem lại từ đầu" opens part 1', (await stageId()) === 'bat-dau');
});

await step('S7 Luyện tập từ bài học và tiếp tục', async () => {
  await openLesson(); await page.getByTestId('interactive-lesson').waitFor(); await page.waitForTimeout(800);
  await page.getByTestId('practice-start').click();
  await page.waitForURL(`**/student/lessons/${P1}/practice**`);
  await page.getByTestId('practice-begin').click();
  await page.getByTestId('practice-question').waitFor();
  await page.waitForURL(/attempt=/);
  await shot('s7-luyen-tap');
  const attemptId = new URL(page.url()).searchParams.get('attempt');
  const view = await (await context.request.get(`${BASE}/api/student/practice/attempts/${attemptId}`)).json();
  const q = view.questions[0];
  if (KEY[q.id]?.choice) {
    await page.getByTestId(`choice-${KEY[q.id].choice}`).click();
    await page.getByTestId('practice-check').click();
    await page.getByTestId('feedback').waitFor();
    check('practice question graded in the UI', /Chính xác/.test(await page.getByTestId('feedback').innerText()));
  } else {
    const r = await context.request.post(`${BASE}/api/student/practice/attempts/${attemptId}/answers`, { headers: { origin: BASE }, data: { questionId: q.id, response: KEY[q.id] } });
    check('practice answer accepted', r.ok(), r.status());
  }
  await openLesson(); await page.getByTestId('interactive-lesson').waitFor(); await page.waitForTimeout(1500);
  check('back on the lesson the card offers to continue practice', (await page.getByTestId('practice-continue').count()) === 1);
  const c = await counts();
  check('coming back from practice: no celebration', c.fireworks === 0 && c.complete === 0, JSON.stringify(c));
  await page.getByTestId('practice-continue').click();
  await page.waitForURL(/attempt=/);
  check('"Luyện tiếp" returns to the same attempt', new URL(page.url()).searchParams.get('attempt') === attemptId);
});

await step('S8 Tiến độ được giữ nguyên', async () => {
  await openLesson(); await page.waitForTimeout(800);
  check('lesson progress unchanged after revisits, review and practice', (await progress()) === saved1);
  const ids = psql(DB, `select p.id || ',' || u.id from tutai.student_profiles p join tutai.users u on u.id=p.user_id where u.username='${s.username}'`).split(',');
  const days = psql(DB, `select count(*) from tutai.learning_days where lesson_id='${P1}' and student_id in ('${ids[0]}','${ids[1]}')`);
  check('one learning day recorded on the server for P1 (idempotent completion)', days === '1', days);
  check('no console errors (student)', s.errors.length === 0, s.errors.slice(0, 3).join(' | '));
});
await s.ctx.close();

// ── Variants: sound off, reduced motion ─────────────────────────────────────
if (process.argv.includes('--variants')) {
  for (const [tag, opts, expect] of [['off', { sound: 'off' }, { fireworks: 1, complete: 0 }], ['rm', { reduced: true }, { fireworks: 0, complete: 1 }]]) {
    const v = await studentContext(tag, opts);
    page = v.p; context = v.ctx;
    await step(`V ${tag === 'off' ? 'Âm thanh đã tắt' : 'Giảm chuyển động'}`, async () => {
      await openLesson();
      await walkAll({ checks: false });
      await page.waitForTimeout(3500);
      const c = await counts();
      check(`${tag}: fireworks ${expect.fireworks}, sound ${expect.complete}`, c.fireworks === expect.fireworks && c.complete === expect.complete, JSON.stringify(c));
      if (tag === 'off') check('off: header icon shows sound off', (await page.getByTestId('sound-setting').getAttribute('aria-pressed')) === 'false');
    });
    await v.ctx.close();
  }
}

fs.writeFileSync(`/tmp/claude-0/pp/e2e-lesson-results-${width}.json`, JSON.stringify(results, null, 1));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} PASS at ${width}`);
await browser.close();
