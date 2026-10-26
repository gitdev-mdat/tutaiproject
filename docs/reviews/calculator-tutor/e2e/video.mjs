// Real browser recording (Playwright, Chromium) of the student journey, at human pace.
// Usage: VP=1440|390 node video.mjs   → ../video/student-<VP>.webm (converted to mp4 afterwards)
import { chromium, studentContext, answerQ1, H, S } from './lib.mjs';
import { mkdirSync, renameSync, readdirSync, rmSync } from 'node:fs';
const VP = Number(process.env.VP ?? 1440);
const DIR = `${S}/../video/raw-${VP}`;
rmSync(DIR, { recursive: true, force: true });
mkdirSync(DIR, { recursive: true });
const browser = await chromium.launch();
const ctx = await studentContext(browser, VP, `v${VP}`, { recordVideo: { dir: DIR, size: { width: VP, height: H[VP] } } });
const page = await ctx.newPage();
const wait = (ms) => page.waitForTimeout(ms);
const attr = (name) => page.getByTestId('tutor-step').getAttribute(`data-${name}`);
const key = (id) => page.locator(`[data-testid=calculator] [data-key="${id}"]`);
const press = (id) => (VP < 500 ? key(id).tap() : key(id).click());

await answerQ1(page, 'B');
await page.getByTestId('feedback').scrollIntoViewIfNeeded();
await wait(2500);
await page.getByTestId('method-derivative').scrollIntoViewIfNeeded();
await wait(2500);
await page.getByTestId('guide-tab-calculator').click();
await page.getByTestId('calculator-tutor').scrollIntoViewIfNeeded();
await wait(2000);
await page.getByTestId('tutor-start-watch').click();
await page.waitForFunction(() => document.querySelector('[data-testid=tutor-step]')?.getAttribute('data-step') === 'skip-g', null, { timeout: 30000 });
await wait(2500);
await page.getByTestId('tutor-play').click(); // pause
await wait(1500);
await page.getByTestId('tutor-mode-practice').click();
await wait(1500);
await press('5'); // wrong key
await wait(2200);
await press('ALPHA'); // wrong again: the right key lights up
await wait(2000);
await page.getByTestId('tutor-hint-button').click();
await wait(1800);
for (let n = 0; n < 200 && (await page.getByTestId('tutor-complete').count()) === 0; n++) {
  const expected = await attr('expected');
  if (!expected) {
    await wait((await page.getByTestId('tutor-checkpoint').count()) ? 3200 : 1000);
    await page.getByTestId('tutor-next').click();
    await wait(700);
    continue;
  }
  await press(expected);
  await wait(expected === 'DOWN' ? 420 : 520);
}
await wait(4000);
await ctx.close();
await browser.close();
const file = readdirSync(DIR).find((f) => f.endsWith('.webm'));
renameSync(`${DIR}/${file}`, `${S}/../video/student-${VP}.webm`);
rmSync(DIR, { recursive: true, force: true });
console.log('video', `student-${VP}.webm`);
