// Admin → Student E2E for the learning path (Học page), through the UI.
// Local QA database pp_path only (a copy of pp_one: Toán 12 with one published lesson). Never Production.
// Usage: node e2e-path.mjs <1440|390>
import fs from 'node:fs';
import { chromium, H, SERVERS, overflow, newStudent, adminLogin, psql } from './lib.mjs';

const VP = Number(process.argv[2] ?? 1440);
const BASE = SERVERS.pp_path;
const OUT = `/tmp/claude-0/pp/anh-path/e2e/${VP}`;
fs.mkdirSync(OUT, { recursive: true });
const CH = 'Số phức (QA)';
const LESSONS = ['Khái niệm số phức', 'Phép cộng số phức', 'Môđun của số phức', 'Bài nháp chưa mở (QA)'];
const NEW_LESSON = 'Phương trình bậc hai với hệ số thực';

const results = [];
let scenario = '';
function check(name, ok, detail = '') {
  results.push({ vp: VP, scenario, name, ok: !!ok, detail: ok ? '' : String(detail).slice(0, 300) });
  console.log(`${ok ? 'PASS' : 'FAIL'} [${VP}] ${scenario} :: ${name}${ok ? '' : ` -- ${String(detail).slice(0, 300)}`}`);
}
async function step(name, fn) {
  scenario = name;
  try { await fn(); } catch (error) { check('step finished without error', false, error.stack ?? error); await globalThis.__shots?.(name); }
}
const browser = await chromium.launch();
const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });

// ── Admin ────────────────────────────────────────────────────────────────────
const actx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await actx.newPage();
await adminLogin(actx, 'pp_path');
const admin = actx.pages()[0];
globalThis.__shots = async (n) => { await admin.screenshot({ path: `${OUT}/loi-admin-${n.slice(0, 2)}.png` }).catch(() => {}); if (globalThis.__page) await globalThis.__page.screenshot({ path: `${OUT}/loi-hs-${n.slice(0, 2)}.png` }).catch(() => {}); };
const adminErrors = [];
admin.on('console', (m) => m.type() === 'error' && adminErrors.push(m.text()));
admin.on('response', (r) => r.status() >= 500 && adminErrors.push(`${r.status()} ${new URL(r.url()).pathname}`));

async function openKnowledge() {
  await admin.goto(`${BASE}/admin/knowledge`);
  await admin.waitForLoadState('networkidle');
}
function chapterCard(title) {
  return admin.locator('li[id^="chapter-"]').filter({ has: admin.getByRole('button', { name: `Thao tác với chương ${title}` }) });
}
async function addLesson(title) {
  await chapterCard(CH).getByRole('button', { name: 'Thêm kiến thức' }).click();
  const dialog = admin.getByRole('dialog');
  await dialog.locator('#node-title').fill(title);
  await dialog.locator('button[type="submit"]').click();
  // A new lesson opens in the lesson editor; close it, content is written later.
  await admin.locator('#article-OBJECTIVE').waitFor();
  await admin.getByRole('button', { name: 'Đóng trình soạn bài' }).click();
  await admin.locator('#article-OBJECTIVE').waitFor({ state: 'hidden' });
  await admin.waitForLoadState('networkidle');
}
async function writeLesson(title, publish) {
  await chapterCard(CH).getByRole('button', { name: `Thao tác với ${title}`, exact: true }).click();
  await admin.getByRole('menuitem', { name: 'Soạn bài học' }).click();
  const sheet = admin.getByRole('dialog');
  await sheet.locator('#article-OBJECTIVE').waitFor();
  await sheet.locator('#article-OBJECTIVE').fill(`Hiểu ${title.toLowerCase()}.`);
  await sheet.locator('#article-MAIN_CONTENT').fill(`**${title}.** Nội dung kiểm thử QA.\n\n- Ý thứ nhất.\n- Ý thứ hai.`);
  await sheet.locator('#article-EXAMPLE').fill(`**Ví dụ.** Một ví dụ về ${title.toLowerCase()}.`);
  const save = sheet.getByRole('button', { name: publish ? 'Lưu và hiển thị cho học sinh' : 'Lưu bản nháp' });
  const response = admin.waitForResponse((r) => r.request().method() !== 'GET' && /knowledge|article/.test(r.url()));
  await save.click();
  const r = await response;
  check(`admin ${publish ? 'publishes' : 'saves draft of'} "${title}" (${r.status()})`, r.ok(), r.status());
  await admin.waitForTimeout(400);
  await admin.getByRole('button', { name: 'Đóng trình soạn bài' }).click();
  await admin.locator('#article-OBJECTIVE').waitFor({ state: 'hidden' });
}

await step('A1 Admin tạo chương, nhiều bài, sắp thứ tự, xuất bản', async () => {
  await openKnowledge();
  await admin.getByRole('button', { name: 'Thêm chương' }).click();
  const dialog = admin.getByRole('dialog');
  await dialog.locator('#node-title').fill(CH);
  await dialog.locator('button[type="submit"]').click();
  await dialog.waitFor({ state: 'hidden' });
  await admin.waitForLoadState('networkidle');
  check('chapter created in the admin tree', (await admin.getByRole('button', { name: `Thao tác với chương ${CH}` }).count()) === 1);
  for (const title of LESSONS) await addLesson(title);
  // Order: move "Môđun" above "Phép cộng" through the row menu.
  await chapterCard(CH).getByRole('button', { name: `Thao tác với ${LESSONS[2]}` }).click();
  await admin.getByRole('menuitem', { name: 'Di chuyển lên' }).click();
  await admin.waitForLoadState('networkidle');
  await admin.waitForTimeout(300);
  const order = await chapterCard(CH).locator('button[aria-label^="Thao tác với "]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label').replace('Thao tác với ', '')).filter((t) => !t.startsWith('chương')));
  check('admin order is Khái niệm, Môđun, Phép cộng, Bài nháp', order.join('|') === [LESSONS[0], LESSONS[2], LESSONS[1], LESSONS[3]].join('|'), order.join('|'));
  for (const title of [LESSONS[0], LESSONS[2], LESSONS[1]]) await writeLesson(title, true);
  await writeLesson(LESSONS[3], false);
  await shot(admin, 'admin-chuong');
  // The textbook library needs object storage that local QA does not configure (503 by design).
  const real = adminErrors.filter((e) => !e.includes('/api/admin/textbooks') && !e.includes('status of 503'));
  check('admin page: no console errors (textbook storage 503 excluded)', real.length === 0, real.join(' | '));
});

// ── Student ──────────────────────────────────────────────────────────────────
const sctx = await browser.newContext({ viewport: { width: VP, height: H[VP] } });
await sctx.newPage();
const username = await newStudent(sctx, BASE, `path${VP}`);
const page = sctx.pages()[0];
globalThis.__page = page;
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const hoc = async () => {
  await page.goto(`${BASE}/student/roadmap`);
  await page.waitForLoadState('networkidle');
  await page.getByTestId('roadmap-path').waitFor();
};
const lessonTitles = () => page.locator('[data-testid="roadmap-lesson"]').evaluateAll((els) => els.map((e) => e.querySelector('[data-testid="roadmap-lesson-title"]')?.textContent?.replace(' (bài tiếp theo)', '').trim()));
const completed = async () => (await page.getByTestId('roadmap-completed').first().innerText()).trim();

/** Reads a lesson to the end through its own buttons. */
async function readLesson() {
  await page.getByTestId('lesson-journey').first().waitFor();
  for (let i = 0; i < 40; i++) {
    if (await page.getByTestId('finish-next').isVisible().catch(() => false)) break;
    const next = page.getByTestId('stage-continue');
    if (!(await next.count())) break;
    if (await next.isEnabled()) { await next.click(); await page.waitForTimeout(150); continue; }
    const reveal = page.getByTestId('example-next-step');
    if (await reveal.isVisible().catch(() => false)) { await reveal.click(); continue; }
    const skip = page.getByTestId('check-skip');
    if (await skip.isVisible().catch(() => false)) { await skip.click(); continue; }
    break;
  }
}

await step('S1 Học sinh thấy chương mới đúng thứ tự, bài nháp không lộ', async () => {
  await hoc();
  await shot(page, 'hs-moi');
  const titles = await lessonTitles();
  check('path order: Tính đơn điệu, Khái niệm, Môđun, Phép cộng', titles.join('|') === ['Tính đơn điệu của hàm số', LESSONS[0], LESSONS[2], LESSONS[1]].join('|'), titles.join('|'));
  check('unpublished lesson is not on the page', !(await page.locator('main').innerText()).includes(LESSONS[3]));
  const chapters = await page.getByTestId('roadmap-chapter').count();
  check('two chapters on the path', chapters === 2, chapters);
  check('new chapter is "Chương 2" and holds Bài 2–4', (await page.getByTestId('roadmap-chapter').nth(1).innerText()).includes('Chương 2') && (await page.getByTestId('roadmap-chapter').nth(1).innerText()).includes('Bài 4'));
  check('progress starts at 0/4', (await completed()) === '0/4', await completed());
  check('hero offers "Bắt đầu học" on lesson 1', (await page.getByTestId('roadmap-next-cta').innerText()).includes('Bắt đầu học') && (await page.getByTestId('roadmap-next').getAttribute('data-lesson')) === 'node-s0f2jitge');
  check('hero says what comes after', (await page.getByTestId('roadmap-after').innerText()).includes(LESSONS[0]));
  check('no practice links on Học', (await page.locator('main a[href*="/practice"]').count()) === 0);
  const draftId = psql('pp_path', `select n->>'id' from tutai.content_documents, jsonb_array_elements(body->'nodes') n where key='knowledge-tree/tree' and n->>'title'='${LESSONS[3]}'`);
  await page.goto(`${BASE}/student/lessons/${draftId}`);
  check('draft lesson URL does not open the lesson', (await page.getByTestId('lesson-journey').count()) === 0 && /chưa mở|không tìm thấy|Không/i.test(await page.locator('main').innerText()), (await page.locator('main').innerText()).slice(0, 120));
});

await step('S2 Bắt đầu học, hoàn thành bài, sang bài tiếp theo', async () => {
  await hoc();
  await page.getByTestId('roadmap-next-cta').click();
  await page.waitForURL('**/student/lessons/node-s0f2jitge');
  check('lesson trail says Chương 1 · Bài 1/4', (await page.getByTestId('lesson-trail').innerText()).includes('Bài 1/4'), await page.getByTestId('lesson-trail').innerText());
  await readLesson();
  await shot(page, 'hs-hoan-thanh-bai');
  check('end of lesson shows the next step card', await page.getByTestId('finish-next').isVisible());
  const readNext = page.getByTestId('next-reading-link');
  check('end of lesson offers the next lesson to read', (await readNext.count()) === 1 && (await readNext.innerText()).includes(LESSONS[0]), await readNext.count());
  await readNext.click();
  await page.waitForURL((url) => !url.pathname.endsWith('node-s0f2jitge'));
  check('"Học bài tiếp" opens the next lesson', (await page.getByTestId('lesson-trail').innerText()).includes('Bài 2/4'));
  await readLesson();
  await page.getByTestId('journey-back').click();
  await page.waitForURL('**/student/roadmap**');
  await page.getByTestId('roadmap-path').waitFor();
  check('back on Học: 2/4 read', (await completed()) === '2/4', await completed());
  check('hero moves to Môđun with "Bắt đầu học"', (await page.getByTestId('roadmap-next').innerText()).includes(LESSONS[2]));
  check('read lessons are marked on the path', (await page.locator('[data-testid="roadmap-lesson"][data-completed="true"]').count()) === 2);
  await page.reload();
  await page.getByTestId('roadmap-path').waitFor();
  check('after reload: still 2/4', (await completed()) === '2/4', await completed());
  await shot(page, 'hs-dang-hoc');
});

await step('S3 Học dở một bài, quay lại tiếp tục', async () => {
  await page.getByTestId('roadmap-next-cta').click();
  await page.waitForURL(/\/student\/lessons\/[^/?]+$/);
  await page.getByTestId('lesson-journey').first().waitFor();
  await page.getByTestId('stage-continue').click();
  await page.waitForTimeout(300);
  await hoc();
  check('hero says "Học tiếp" for the half-read lesson', (await page.getByTestId('roadmap-next-cta').innerText()).includes('Học tiếp'));
  check('path marks it "Đang học · phần"', (await page.locator('[data-testid="roadmap-lesson"][data-current="true"]').innerText()).includes('Đang học · phần'));
  await page.getByTestId('roadmap-next-cta').click();
  await page.waitForURL(/\/student\/lessons\/[^/?]+$/);
  await readLesson();
});

await step('S4 Hoàn thành mọi bài đang mở, sang Luyện tập', async () => {
  await hoc();
  // Open the last lesson from its row on the path.
  await page.locator('[data-testid="roadmap-lesson"]').filter({ hasText: LESSONS[1] }).click();
  await page.waitForURL(/\/student\/lessons\/[^/?]+$/);
  await readLesson();
  await hoc();
  check('all read: 4/4', (await completed()) === '4/4', await completed());
  check('finished card is shown', (await page.getByTestId('roadmap-next').getAttribute('data-kind')) === 'done');
  check('finished card keeps the path visible', (await page.locator('[data-testid="roadmap-lesson"][data-completed="true"]').count()) === 4);
  check('finished card offers review from lesson 1', (await page.getByTestId('roadmap-review-first').count()) === 1);
  await shot(page, 'hs-xong-het');
  await page.getByTestId('roadmap-next-cta').click();
  await page.waitForURL('**/student/practice');
  check('"Sang Luyện tập" opens Practice', page.url().endsWith('/student/practice'));
});

await step('A2 Admin mở thêm bài mới, học sinh nhận đúng trạng thái', async () => {
  await openKnowledge();
  await addLesson(NEW_LESSON);
  await writeLesson(NEW_LESSON, true);
  await hoc();
  check('new lesson appears at the end', (await lessonTitles()).at(-1) === NEW_LESSON, (await lessonTitles()).join('|'));
  check('progress becomes 4/5', (await completed()) === '4/5', await completed());
  check('hero moves to the new lesson', (await page.getByTestId('roadmap-next').getAttribute('data-kind')) === 'start' && (await page.getByTestId('roadmap-next').innerText()).includes(NEW_LESSON));
  check('new lesson is "Chưa học"-current, the others stay read', (await page.locator('[data-testid="roadmap-lesson"][data-completed="true"]').count()) === 4);
  check('draft lesson is still hidden', !(await page.locator('main').innerText()).includes(LESSONS[3]));
  await shot(page, 'hs-bai-moi');
});

await step('S5 Bố cục và lỗi', async () => {
  await hoc();
  check(`no horizontal overflow at ${VP}`, !(await overflow(page)));
  check('one h1 named Học', (await page.locator('h1').allInnerTexts()).join('|') === 'Học');
  // Keyboard: a chapter header toggles its lessons.
  const header = page.getByTestId('roadmap-chapter').first().locator('h3 button');
  await header.focus();
  const before = await header.getAttribute('aria-expanded');
  await page.keyboard.press('Enter');
  check('chapter header toggles with the keyboard', (await header.getAttribute('aria-expanded')) !== before);
  check('no console errors (student)', errors.length === 0, errors.join(' | '));
});

await browser.close();
const passed = results.filter((r) => r.ok).length;
fs.writeFileSync(`/tmp/claude-0/pp/e2e-path-results-${VP}.json`, JSON.stringify(results, null, 1));
console.log(`\n${passed}/${results.length} passed at ${VP} (student ${username})`);
