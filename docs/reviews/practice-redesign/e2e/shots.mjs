// Screenshots + metrics of /student/practice for every stored state. Usage: node shots.mjs <truoc|sau>
import fs from 'node:fs';
import { chromium, H, SERVERS, overflow } from './lib.mjs';
const label = process.argv[2];
const states = JSON.parse(fs.readFileSync('/tmp/claude-0/pp/states.json', 'utf8'));
const browser = await chromium.launch();
const metrics = [];
const pages = [
  ['new', ''], ['inprogress', ''], ['mistakes', ''], ['mistakes80', ''], ['notpassed', ''], ['mastered', ''],
  ['plus', ''], ['plus', '?view=chapter'], ['new', '?view=chapter'], ['admin', ''], ['admin', '?view=chapter'], ['empty', ''],
];
for (const vp of [1440, 768, 390]) {
  const dir = `/tmp/claude-0/pp/anh/${label}/${vp}`;
  fs.mkdirSync(dir, { recursive: true });
  for (const [state, q] of pages) {
    const { db } = states[state];
    const context = await browser.newContext({ viewport: { width: vp, height: H[vp] }, deviceScaleFactor: 2, storageState: `/tmp/claude-0/pp/auth/${state}.json` });
    const page = await context.newPage();
    const errors = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${SERVERS[db]}/student/practice${q}`);
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    const name = `${state}${q ? '-chuong' : ''}`;
    await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
    const m = await page.evaluate(() => {
      const main = document.querySelector('[data-testid="practice-page"]');
      const words = (main?.innerText ?? '').split(/\s+/).filter(Boolean).length;
      const first = document.querySelector('[data-testid="practice-page"] a[href*="/practice"]:not([data-testid^="tab-"]):not([data-testid="program-chip"]), [data-testid="practice-page"] a[href*="/lessons/"]');
      const r = first?.getBoundingClientRect();
      return { height: document.documentElement.scrollHeight, words, firstAction: first ? { text: first.innerText.trim().replace(/\s+/g, ' '), y: Math.round(r.top + window.scrollY) } : null };
    });
    metrics.push({ vp, page: name, ...m, overflow: await overflow(page), errors });
    console.log(vp, name, JSON.stringify(m), errors.length ? errors : '');
    await context.close();
  }
}
fs.writeFileSync(`/tmp/claude-0/pp/metrics-${label}.json`, JSON.stringify(metrics, null, 1));
await browser.close();
