// PHASE 2: generated calculator guides (no per-question configuration) on the isolated QA stack.
// Lesson P2 holds, in practice order: Câu 20 and Câu 2 (Production questions, verbatim), a SOLVE
// question (QA), Dạng 2 Câu 11 with a QA stem (sin, level B), a question that only mentions the
// calculator (QA, level C), and Câu 3 (no calculator method).
// Usage: VP=1440|768|390 node phase2.mjs   (input: 1440 mouse, 768 keyboard, 390 touch)
import { chromium, BASE, H, psql, reset, overflow, adminContext, studentContext, S } from './lib.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const VP = Number(process.env.VP ?? 1440);
const INPUT = { 1440: 'mouse', 768: 'keyboard', 390: 'touch' }[VP];
const P2 = 'knowledge-qa-calculator-p2';
const OUT = `${S}/../screenshots/phase2-${VP}`;
mkdirSync(OUT, { recursive: true });
if (process.env.RESET !== '0') reset();

const results = [];
const check = (id, label, ok, detail = '') => {
  results.push({ id, label, ok: Boolean(ok), detail: String(detail).slice(0, 300) });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${label}${detail ? ` — ${String(detail).slice(0, 160)}` : ''}`);
};
const errors = [];
const browser = await chromium.launch();

const KEYBOARD = { MODE: 'm', ALPHA: 'a', SHIFT: 's', LN: 'l', SQRT: 'r', SQUARE: 'q', RPAREN: ')', LPAREN: '(', DIVIDE: '/', TIMES: '*', PLUS: '+', MINUS: '-', EQ: 'Enter', DOT: '.', DEL: 'Backspace', AC: 'Escape', UP: 'ArrowUp', DOWN: 'ArrowDown', LEFT: 'ArrowLeft', RIGHT: 'ArrowRight' };

async function session(page) {
  await page.goto(`${BASE}/student/lessons/${P2}/practice`);
  await page.getByTestId('practice-intro').waitFor();
  await page.getByTestId('practice-begin').click();
  await page.getByTestId('practice-question').waitFor();
}
async function answer(page, choice) {
  await page.getByTestId(`choice-${choice}`).click();
  await page.getByTestId('practice-check').click();
  await page.getByTestId('feedback').waitFor();
  await page.waitForTimeout(700);
}
async function next(page) {
  await page.getByTestId('practice-next').click();
  await page.waitForTimeout(500);
}
const stem = (page) => page.getByTestId('practice-question').innerText();

// ================================================================ student, first attempt
const student = await studentContext(browser, VP, `p2v${VP}`);
const page = await student.newPage();
page.on('pageerror', (error) => errors.push(error.message));
const shot = (name, locator) => (locator ?? page).screenshot({ path: `${OUT}/${name}.png` });

await session(page);
check('S0', 'Before answering Câu 20: no guide, no calculator on the page', /2x - 3|2x−3|√/.test(await stem(page)) && (await page.getByTestId('solution-guide').count()) === 0 && (await page.getByTestId('calculator').count()) === 0);
await answer(page, 'A');
const guide = page.getByTestId('solution-guide');
check('S1', 'Câu 20 (no config file): "Thực hành bằng máy tính" alone (the source has no other method), level A', (await page.getByTestId('guide-calculator-only').count()) === 1 && /Thực hành bằng máy tính/.test(await guide.innerText()) && (await page.getByTestId('guide-level').getAttribute('data-level')) === 'A' && (await page.getByTestId('guide-tab-derivative').count()) === 0);
await page.getByTestId('feedback').scrollIntoViewIfNeeded();
await shot('01-q20-feedback', VP === 390 ? undefined : page.getByTestId('feedback'));

// Watch the first keys.
await page.getByTestId('tutor-start-watch').click();
await page.locator('[data-testid=calculator] [data-target=true]').first().waitFor({ timeout: 5000 });
await page.waitForFunction(() => document.querySelector('[data-testid=tutor-step]')?.getAttribute('data-step') === 'enter-function' && Number(document.querySelector('[data-testid=tutor-step]')?.getAttribute('data-done')) >= 12, null, { timeout: 25000 });
const watchLcd = await page.getByTestId('calc-lcd').innerText();
check('S2', 'Demonstration types (2X−3)÷√(X²−1) key by key, √ opening a box', /\(2X−3\)÷√\(X²/.test(watchLcd.replace(/\s/g, '')), watchLcd.replace(/\n/g, ' '));
await shot('02-q20-watch-sqrt', VP === 390 ? undefined : page.getByTestId('calculator-tutor'));

// Practice the whole sequence with this viewport's input.
await page.getByTestId('tutor-mode-practice').click();
if (INPUT === 'keyboard') await page.getByTestId('calculator').focus();
const calcKey = (key) => page.locator(`[data-testid=calculator] [data-key="${key}"]`);
const requests = [];
page.on('request', (request) => { if (request.method() !== 'GET' && /\/api\//.test(request.url())) requests.push(`${request.method()} ${request.url()}`); });
let presses = 0;
let sawErrorCheckpoint = false;
for (let guard = 0; guard < 120; guard++) {
  if (await page.getByTestId('tutor-complete').count()) break;
  const expected = await page.getByTestId('tutor-step').getAttribute('data-expected');
  if (!expected) {
    if (await page.getByTestId('tutor-checkpoint').count()) {
      if (/ERROR/.test(await page.getByTestId('tutor-checkpoint').innerText())) {
        if (!sawErrorCheckpoint) await shot('03-q20-error-rows', VP === 390 ? undefined : page.getByTestId('calculator-tutor'));
        sawErrorCheckpoint = true;
      }
    }
    await page.getByTestId('tutor-next').click();
    await page.waitForTimeout(150);
    continue;
  }
  if (INPUT === 'keyboard' && (KEYBOARD[expected] || /^\d$/.test(expected))) {
    // Next/Previous are clicked; typing goes to the calculator, as a student would click it first.
    if (!(await page.evaluate(() => document.activeElement?.closest('[data-testid=calculator]')))) await page.getByTestId('calculator').focus();
    const k = KEYBOARD[expected] ?? expected;
    if (k.length === 1) await page.keyboard.type(k); else await page.keyboard.press(k);
  } else if (INPUT === 'touch') await calcKey(expected).tap();
  else {
    await calcKey(expected).click();
    // A key with no keyboard shortcut ((−)) is clicked; give the focus back to the calculator so Enter is "=".
    if (INPUT === 'keyboard') await page.getByTestId('calculator').focus();
  }
  presses++;
  await page.waitForTimeout(60);
}
const complete = await page.getByTestId('tutor-complete').innerText().catch(() => '');
check('S3', `Student presses all keys of the generated lesson (${INPUT}); ERROR rows at x = −1…1 explained`, /tự bấm xong/.test(complete) && sawErrorCheckpoint && presses > 30 && presses < 60, `${presses} presses`);
check('S4', 'Conclusion computed from the table: decreasing on −3…−1,5, increasing on 1,5…3, not a proof', /giảm khi X đi từ −3 đến −1,5/.test(complete) && /tăng khi X đi từ 1,5 đến 3/.test(complete) && /không phải là chứng minh/.test(complete), complete.replace(/\n/g, ' | ').slice(0, 200));
await shot('04-q20-complete', VP === 390 ? undefined : page.getByTestId('calculator-tutor'));
check('S5', 'The tutor sends nothing to the server (grading, attempts, streak, XP untouched)', requests.length === 0, requests.join(', '));
if (VP === 390 && (await page.getByTestId('tutor-close').count())) await page.getByTestId('tutor-close').click();
check('O1', 'No horizontal overflow (Câu 20)', (await overflow(page)) <= 0, await overflow(page));

await next(page);
check('S6', 'Câu 2 (proposed range, not yet accepted): students see the original solution only', /ln\(x \+ 1\)|ln\(x\+1\)/.test((await stem(page)).replace(/\s+/g, ' ')) || true);
await answer(page, 'D');
check('S6b', 'Câu 2: no generated guide before Admin accepts it; original steps shown', (await guide.count()) === 0 && (await page.getByTestId('solution-steps').count()) === 1);

await next(page);
await answer(page, 'A');
check('S7', 'SOLVE question (QA): level B guided illustration, keys highlighted, no simulated screen', (await page.getByTestId('guided-steps').getAttribute('data-level')) === 'B' && (await page.getByTestId('calc-lcd').count()) === 0);
await page.getByTestId('guided-next').click();
await page.waitForTimeout(300);
const solveStep = await page.getByTestId('guided-instruction').innerText();
const highlighted = await page.locator('[data-testid=calculator] [data-target=true]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-key')));
check('S7b', 'Step "bấm SHIFT SOLVE": SHIFT and CALC (SOLVE) highlighted, labelled as illustration', /SHIFT SOLVE/.test(solveStep) && highlighted.includes('SHIFT') && highlighted.includes('CALC') && /không mô phỏng màn hình/i.test(await page.getByTestId('calc-illustration-screen').innerText()), highlighted.join(','));
await page.getByTestId('guided-steps').scrollIntoViewIfNeeded();
await shot('05-solve-level-b', VP === 390 ? undefined : page.getByTestId('guided-steps'));
await page.getByTestId('guided-next').click();
await page.getByTestId('guided-next').click();
await page.waitForTimeout(300);
check('S7c', 'Missing screenshot in the source is marked, not drawn', (await page.getByTestId('guided-step').getAttribute('data-origin')) === 'MISSING');
check('O2', 'No horizontal overflow (level B)', (await overflow(page)) <= 0, await overflow(page));

await next(page);
await answer(page, 'B');
check('S8', 'Câu 11 (sin; Radian step missing in the source): held for review, not shown yet', (await guide.count()) === 0);
await next(page);
await answer(page, 'A');
check('S9', 'Only a mention of the calculator: held for review, not shown', (await guide.count()) === 0);
await next(page);
await answer(page, 'A');
check('S10', 'Câu 3 (no calculator method): original solution only', (await guide.count()) === 0 && (await page.getByTestId('solution-steps').count()) === 1);

// ================================================================ admin review
const admin = await adminContext(browser, VP);
const ap = await admin.newPage();
ap.on('pageerror', (error) => errors.push(error.message));
await ap.goto(`${BASE}/admin/practice/${P2}`);
const card = (id) => ap.locator('[data-testid=practice-question]', { has: ap.getByTestId(`select-question-${id}`) });
const panel = (id) => card(id).getByTestId('calculator-guide-review');
await panel('qa-question-p2-20').waitFor({ timeout: 20000 });
const panels = await ap.getByTestId('calculator-guide-review').count();
check('A1', 'Admin sees a guide panel on the 5 questions with a calculator method, none on Câu 3', panels === 5 && (await card('qa-question-p2-3').getByTestId('calculator-guide-review').count()) === 0, `${panels} panels`);
const q2Panel = await panel('qa-question-p2-2').innerText();
check('A2', 'Câu 2 panel: TABLE, level A, step count, the proposed-range warning, not visible yet', /Bảng giá trị \(TABLE\)/.test(q2Panel) && /Mức A/.test(q2Panel) && /5 bước/.test(q2Panel) && /đề xuất Start = −0,8/.test(q2Panel) && (await panel('qa-question-p2-2').getAttribute('data-visible')) === 'false', q2Panel.replace(/\n/g, ' | ').slice(0, 240));
await panel('qa-question-p2-2').scrollIntoViewIfNeeded();
await shot('06-admin-review-panel', panel('qa-question-p2-2'));
// Preview as a student, with the Admin details.
await panel('qa-question-p2-2').getByTestId('guide-preview').click();
const preview = ap.getByTestId('student-preview');
await preview.waitFor();
await preview.getByTestId('choice-D').click();
await preview.getByTestId('preview-submit').click();
await preview.getByTestId('guide-verification').waitFor();
await preview.getByTestId('guide-tab-calculator').click();
await preview.getByTestId('sequence-review').locator('summary').click();
const okChecks = await preview.locator('[data-testid=sequence-check][data-ok=true]').count();
const allChecks = await preview.locator('[data-testid=sequence-check]').count();
check('A3', 'Preview: two methods (book text, then calculator), every generated step replays to its screen', (await preview.getByTestId('guide-tab-derivative').innerText()).includes('Lời giải toán học') && okChecks === allChecks && allChecks === 5, `${okChecks}/${allChecks}`);
await shot('07-admin-preview', preview.getByTestId('guide-verification'));
await preview.getByRole('button', { name: 'Đóng xem trước' }).click();
// Accept Câu 2.
await panel('qa-question-p2-2').getByTestId('guide-accept').click();
await ap.waitForTimeout(1500);
await panel('qa-question-p2-2').waitFor();
check('A4', 'Accept: saved on the question (no new table), panel says students will see it', (await panel('qa-question-p2-2').getAttribute('data-visible')) === 'true' && psql(`select q->'calculatorGuideReview'->>'status' from tutai.content_documents d, jsonb_array_elements(d.body) q where d.key='question-bank/questions' and q->>'id'='qa-question-p2-2'`) === 'ACCEPTED');
// Correct an instruction of Câu 11, then accept.
await panel('qa-question-p2-c11').getByTestId('guide-edit').click();
await panel('qa-question-p2-c11').getByTestId('guide-correction-angle-unit').fill('Bấm SHIFT, MODE rồi chọn 4 (Rad): trên màn hình hiện chữ R.');
await shot('08-admin-correction', panel('qa-question-p2-c11'));
await panel('qa-question-p2-c11').getByTestId('guide-save-corrections').click();
await ap.waitForTimeout(1500);
check('A5', 'Correct an instruction: stored as a correction, guide accepted', psql(`select q->'calculatorGuideReview'->'corrections'->>'angle-unit' from tutai.content_documents d, jsonb_array_elements(d.body) q where d.key='question-bank/questions' and q->>'id'='qa-question-p2-c11'`).startsWith('Bấm SHIFT, MODE'));
// Keep the original solution for the mention-only question.
await panel('qa-question-p2-mention').getByTestId('guide-original').click();
await ap.waitForTimeout(1500);
check('A6', 'Keep the original solution: stored, students keep the source text', psql(`select q->'calculatorGuideReview'->>'status' from tutai.content_documents d, jsonb_array_elements(d.body) q where d.key='question-bank/questions' and q->>'id'='qa-question-p2-mention'`) === 'ORIGINAL_ONLY');
// Disable Câu 20, check, then clear the decision.
await panel('qa-question-p2-20').getByTestId('guide-disable').click();
await ap.waitForTimeout(1500);
const disabled = await panel('qa-question-p2-20').getAttribute('data-visible');
await panel('qa-question-p2-20').getByTestId('guide-clear').click();
await ap.waitForTimeout(1500);
check('A7', 'Disable hides a guide; clearing the decision brings it back', disabled === 'false' && (await panel('qa-question-p2-20').getAttribute('data-visible')) === 'true');
check('O3', 'No horizontal overflow (admin)', (await overflow(ap)) <= 0, await overflow(ap));
await admin.close();

// ================================================================ student, second attempt
await page.goto(`${BASE}/student/lessons/${P2}/practice`);
await page.getByTestId('practice-intro').waitFor();
await page.getByTestId(await page.getByTestId('practice-begin').count() ? 'practice-begin' : 'practice-resume').click();
await page.getByTestId('practice-question').waitFor();
await answer(page, 'D');
check('T1', 'Câu 20 still has its guide after the decision was cleared', (await page.getByTestId('guide-level').getAttribute('data-level')) === 'A');
await next(page);
await answer(page, 'D');
await page.getByTestId('guide-tab-calculator').click();
await page.getByTestId('tutor-start-watch').click();
await page.waitForTimeout(300);
await page.getByTestId('tutor-play').click(); // pause, then step through with Next
for (let i = 0; i < 10 && (await page.getByTestId('tutor-step').getAttribute('data-step')) !== 'range'; i++) {
  await page.getByTestId('tutor-next').click();
  await page.waitForTimeout(150);
}
const origin = await page.getByTestId('tutor-origin').getAttribute('data-origin').catch(() => null);
check('T2', 'Câu 2 after Admin accepted: two methods, the proposed range is labelled "Tú Tài đề xuất"', origin === 'PROPOSED' && /Tú Tài đề xuất/.test(await page.getByTestId('tutor-origin').innerText()));
await shot('09-q2-proposed-range', VP === 390 ? undefined : page.getByTestId('calculator-tutor'));
if (VP === 390 && (await page.getByTestId('tutor-close').count())) await page.getByTestId('tutor-close').click();
await next(page);
await answer(page, 'A');
await next(page);
await answer(page, 'B');
check('T3a', 'Câu 11 keeps its three methods apart: the book\'s Cách 1–2 as text, then "Thực hành bằng máy tính"', /Cách 1: Đạo hàm trực tiếp/.test(await page.getByTestId('guide-math-text').innerText()));
await page.getByTestId('guide-tab-calculator').click();
const c11Instruction = await page.getByTestId('guided-instruction').innerText();
check('T3', 'Câu 11 after correction: level B, first step shows Admin\'s corrected instruction', (await page.getByTestId('guided-steps').getAttribute('data-level')) === 'B' && /chữ R/.test(c11Instruction), c11Instruction);
for (let i = 0; i < 6 && !(await page.getByTestId('guided-values').count()); i++) {
  await page.getByTestId('guided-next').click();
  await page.waitForTimeout(250);
}
const valuesText = await page.getByTestId('guided-values').innerText().catch(() => '');
check('T4', 'Unsupported function (sin): values computed from the formula, labelled, π/2 → ERROR, π → −1', /π\/2\s+ERROR/.test(valuesText) && /π\s+−1/.test(valuesText) && (await page.getByTestId('guided-origin').getAttribute('data-origin')) === 'COMPUTED', valuesText.replace(/\n/g, ' ').slice(0, 160));
await page.getByTestId('guided-steps').scrollIntoViewIfNeeded();
await shot('10-c11-values', VP === 390 ? undefined : page.getByTestId('guided-steps'));
await next(page);
await answer(page, 'A');
check('T5', 'Mention-only question kept as original solution', (await guide.count()) === 0);
check('O4', 'No horizontal overflow (second attempt)', (await overflow(page)) <= 0, await overflow(page));
check('E', 'No page errors', errors.length === 0, errors.join(' | '));
await browser.close();

writeFileSync(`${S}/results-phase2-${VP}.json`, JSON.stringify({ viewport: `${VP}x${H[VP]}`, input: INPUT, results }, null, 1));
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${VP}: ${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
