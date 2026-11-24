// Screenshots of the Học page across data sizes and reading states (QA DBs only).
// Usage: node shots-path.mjs <label>. Reading progress is injected into localStorage, where the app keeps it.
import fs from 'node:fs';
import { chromium, H, SERVERS, overflow, psql, newStudent } from './lib.mjs';
const label = process.argv[2];
const T = '2026-11-20T08:00:00.000Z';
// [name, db, how many lessons learned, is the next one started]
const scenarios = [
  ['mot-bai-moi', 'pp_one', 0, false],
  ['mot-bai-xong', 'pp_one', 1, false],
  ['it-bai-moi', 'pp_qa', 0, false],
  ['it-bai-dang-hoc', 'pp_qa', 1, true],
  ['it-bai-xong-het', 'pp_qa', 99, false],
  ['nhieu-bai-moi', 'pp_scale', 0, false],
  ['nhieu-bai-dang-hoc', 'pp_scale', 13, true],
  ['nhieu-bai-xong-het', 'pp_scale', 999, false],
  ['trong', 'pp_empty', 0, false],
];
const only = process.argv[3]?.split(',');
const browser = await chromium.launch();
const metrics = [];
for (const [name, db, learned, started] of scenarios) {
  if (only && !only.includes(name)) continue;
  const base = SERVERS[db];
  const reg = await browser.newContext();
  await reg.newPage();
  const username = await newStudent(reg, base, `sh${name.replace(/-/g, "").slice(0, 6)}`);
  const auth = await reg.storageState();
  await reg.close();
  const id = psql(db, `select p.id from tutai.student_profiles p join tutai.users u on u.id = p.user_id where u.username = '${username}'`);
  for (const vp of [1440, 768, 390]) {
    const dir = `/tmp/claude-0/pp/anh-path/${label}/${vp}`;
    fs.mkdirSync(dir, { recursive: true });
    const context = await browser.newContext({ viewport: { width: vp, height: H[vp] }, deviceScaleFactor: 2, storageState: auth });
    const page = await context.newPage();
    const errors = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.goto(`${base}/student/roadmap`);
    await page.waitForLoadState('networkidle').catch(() => {});
    // Lessons of the program on screen, in order (the page lists them all).
    const ids = await page.locator('[data-testid="roadmap-lesson"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-lesson')));
    const stages = {};
    ids.slice(0, learned).forEach((l) => (stages[l] = { reached: 4, total: 5, completedAt: T }));
    if (started && ids[learned]) stages[ids[learned]] = { reached: 1, total: 5, completedAt: null };
    const viewed = Object.fromEntries(Object.keys(stages).map((k) => [k, T]));
    const value = JSON.stringify({ version: 1, viewed, lastLessonId: Object.keys(stages).at(-1) ?? null, stages });
    await page.evaluate(([k, v]) => localStorage.setItem(k, v), [`tutai:lesson-progress:${id}`, value]);
    await page.reload();
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
    await page.screenshot({ path: `${dir}/${name}-man-dau.png` });
    const m = await page.evaluate(() => ({ height: document.documentElement.scrollHeight, words: (document.querySelector('main')?.innerText ?? '').split(/\s+/).filter(Boolean).length }));
    metrics.push({ vp, name, lessons: ids.length, ...m, overflow: await overflow(page), errors });
    console.log(label, vp, name, ids.length, m.height, m.words, (await overflow(page)) ? 'OVERFLOW' : '', errors.join(' | ').slice(0, 200));
    await context.close();
  }
}
fs.writeFileSync(`/tmp/claude-0/pp/metrics-path-${label}${only ? '-part' : ''}.json`, JSON.stringify(metrics, null, 1));
await browser.close();
