// Real browser recording of a NEWLY supported question: Câu 20 (Production text, verbatim), whose
// calculator guide is generated from its solution. No question-specific configuration exists for it.
// Usage: VP=1440|390 node video2.mjs   → ../video/generated-q20-<VP>.webm (converted to mp4 afterwards)
import { chromium, BASE, H, reset, studentContext, S } from './lib.mjs';
import { mkdirSync, renameSync, readdirSync, rmSync } from 'node:fs';
const VP = Number(process.env.VP ?? 1440);
const DIR = `${S}/../video/raw2-${VP}`;
if (process.env.RESET !== '0') reset();
rmSync(DIR, { recursive: true, force: true });
mkdirSync(DIR, { recursive: true });
const browser = await chromium.launch();
const ctx = await studentContext(browser, VP, `vq${VP}`, { recordVideo: { dir: DIR, size: { width: VP, height: H[VP] } } });
const page = await ctx.newPage();
const wait = (ms) => page.waitForTimeout(ms);
const attr = (name) => page.getByTestId('tutor-step').getAttribute(`data-${name}`);
const key = (id) => page.locator(`[data-testid=calculator] [data-key="${id}"]`);
const press = (id) => (VP < 500 ? key(id).tap() : key(id).click());

await page.goto(`${BASE}/student/lessons/knowledge-qa-calculator-p2/practice`);
await page.getByTestId('practice-begin').click();
await page.getByTestId('practice-question').waitFor();
await wait(2500);
await page.getByTestId('choice-A').click();
await wait(800);
await page.getByTestId('practice-check').click();
await page.getByTestId('feedback').waitFor();
await page.getByTestId('feedback').scrollIntoViewIfNeeded();
await wait(2500);
await page.getByTestId('solution-guide').scrollIntoViewIfNeeded();
await wait(2500);
await page.getByTestId('tutor-start-watch').click();
await page.waitForFunction(() => document.querySelector('[data-testid=tutor-step]')?.getAttribute('data-step') === 'skip-g', null, { timeout: 40000 });
await wait(2000);
await page.getByTestId('tutor-play').click(); // pause
await wait(1200);
await page.getByTestId('tutor-mode-practice').click();
await wait(1500);
for (let n = 0; n < 200 && (await page.getByTestId('tutor-complete').count()) === 0; n++) {
  const expected = await attr('expected');
  if (!expected) {
    await wait((await page.getByTestId('tutor-checkpoint').count()) ? 3500 : 1000);
    await page.getByTestId('tutor-next').click();
    await wait(700);
    continue;
  }
  await press(expected);
  await wait(expected === 'DOWN' ? 420 : 520);
}
await page.getByTestId('tutor-complete').scrollIntoViewIfNeeded();
await wait(4000);
await ctx.close();
await browser.close();
const file = readdirSync(DIR).find((f) => f.endsWith('.webm'));
renameSync(`${DIR}/${file}`, `${S}/../video/generated-q20-${VP}.webm`);
rmSync(DIR, { recursive: true, force: true });
console.log('video', `generated-q20-${VP}.webm`);
