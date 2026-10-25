// BEFORE (master fcd81cb): the imported solution of Câu 1 as students and Admin see it today.
import { chromium, BASE, P1, reset, adminContext, studentContext, answerQ1, S } from './lib.mjs';
import { mkdirSync } from 'node:fs';
const OUT = `${S}/../screenshots/before`; mkdirSync(OUT, { recursive: true });
reset();
const browser = await chromium.launch();
for (const vp of [1440, 390]) {
  const student = await studentContext(browser, vp, `b${vp}`);
  const page = await student.newPage();
  await answerQ1(page, 'B');
  await page.getByTestId('feedback').scrollIntoViewIfNeeded();
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${OUT}/${vp}-student-solution-full.png`, fullPage: true });
  await page.getByTestId('feedback').screenshot({ path: `${OUT}/${vp}-student-solution-panel.png` });
  console.log(vp, 'steps', await page.getByTestId('solution-steps').locator('li').count());
  await student.close();
}
const admin = await adminContext(browser, 1440);
const page = await admin.newPage();
await page.goto(`${BASE}/admin/practice/${P1}`);
await page.waitForLoadState('networkidle');
await page.screenshot({ path: `${OUT}/1440-admin-lesson-practice.png` });
await browser.close();
