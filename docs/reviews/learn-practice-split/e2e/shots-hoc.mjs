// Screenshots of the Học (roadmap) page, the Practice page and a lesson, with reading progress
// injected into localStorage (where the app keeps it). Usage: node shots-hoc.mjs <truoc|sau>
import fs from 'node:fs';
import { chromium, H, SERVERS, overflow, psql } from './lib.mjs';
const label = process.argv[2];
const states = JSON.parse(fs.readFileSync('/tmp/claude-0/pp/states.json', 'utf8'));
const L1 = 'node-s0f2jitge', L2 = 'node-sg3wg6atb';
const T = '2026-11-20T08:00:00.000Z';
const reading = {
  new: {},
  mistakes: { [L1]: { reached: 4, total: 5, completedAt: T } },
  inprogress: { [L1]: { reached: 4, total: 5, completedAt: T }, [L2]: { reached: 1, total: 5, completedAt: null } },
  mastered: { [L1]: { reached: 4, total: 5, completedAt: T }, [L2]: { reached: 4, total: 5, completedAt: T } },
};
const browser = await chromium.launch();
const metrics = [];
for (const vp of [1440, 768, 390]) {
  const dir = `/tmp/claude-0/pp/anh-hoc/${label}/${vp}`;
  fs.mkdirSync(dir, { recursive: true });
  for (const [state, stages] of Object.entries(reading)) {
    const { db, username } = states[state];
    const id = psql(db, `select p.id from tutai.student_profiles p join tutai.users u on u.id = p.user_id where u.username = '${username}'`);
    const context = await browser.newContext({ viewport: { width: vp, height: H[vp] }, deviceScaleFactor: 2, storageState: `/tmp/claude-0/pp/auth/${state}.json` });
    const viewed = Object.fromEntries(Object.keys(stages).map((k) => [k, T]));
    const value = JSON.stringify({ version: 1, viewed, lastLessonId: Object.keys(stages).at(-1) ?? null, stages });
    await context.addInitScript(([k, v]) => { if (!localStorage.getItem('qa-seeded')) { localStorage.setItem(k, v); localStorage.setItem('qa-seeded', '1'); } }, [`tutai:lesson-progress:${id}`, value]);
    const page = await context.newPage();
    const errors = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    for (const [name, path] of [['hoc', '/student/roadmap'], ['luyen-tap', '/student/practice']]) {
      await page.goto(SERVERS[db] + path);
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${dir}/${name}-${state}.png`, fullPage: true });
      const m = await page.evaluate(() => {
        const main = document.querySelector('main');
        const nav = document.querySelector('nav[aria-label="Điều hướng học tập"]');
        return { height: document.documentElement.scrollHeight, words: (main?.innerText ?? '').split(/\s+/).filter(Boolean).length,
          navWords: (nav?.innerText ?? '').split(/\s+/).filter(Boolean).length,
          buttons: [...(main?.querySelectorAll('a,button') ?? [])].filter((a) => a.offsetParent).map((a) => a.innerText.trim().replace(/\s+/g, ' ')).filter(Boolean) };
      });
      metrics.push({ vp, page: `${name}-${state}`, ...m, overflow: await overflow(page), errors: [...errors] });
      console.log(vp, name, state, m.height, m.words, m.navWords, JSON.stringify(m.buttons).slice(0, 200));
    }
    await context.close();
  }
}
fs.writeFileSync(`/tmp/claude-0/pp/metrics-hoc-${label}.json`, JSON.stringify(metrics, null, 1));
await browser.close();
