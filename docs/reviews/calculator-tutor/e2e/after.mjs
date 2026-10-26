// AFTER (feature/interactive-calculator-tutor): the calculator tutor of Câu 1 (y = x / ln x) on the
// isolated QA stack. Usage: VP=1440|768|390 node after.mjs  (input: 1440 mouse, 768 keyboard, 390 touch)
import { chromium, BASE, P1, H, psql, reset, overflow, adminContext, studentContext, answerQ1, S } from './lib.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const VP = Number(process.env.VP ?? 1440);
const INPUT = { 1440: 'mouse', 768: 'keyboard', 390: 'touch' }[VP];
const OUT = `${S}/../screenshots/after-${VP}`;
mkdirSync(OUT, { recursive: true });
if (process.env.RESET !== '0') reset();

const results = [];
const check = (id, label, ok, detail = '') => {
  results.push({ id, label, ok: Boolean(ok), detail: String(detail).slice(0, 300) });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${label}${detail ? ` — ${String(detail).slice(0, 160)}` : ''}`);
};
const errors = [];
const browser = await chromium.launch();
const student = await studentContext(browser, VP, `a${VP}`);
const page = await student.newPage();
page.on('pageerror', (error) => errors.push(error.message));
const shot = (name, locator) => (locator ?? page).screenshot({ path: `${OUT}/${name}.png`, ...(locator ? {} : { fullPage: false }) });
const lcd = () => page.getByTestId('calc-lcd').innerText();
const stepAttr = async (name) => page.getByTestId('tutor-step').getAttribute(`data-${name}`);
const tutor = () => page.getByTestId('calculator-tutor');

// ---------------------------------------------------------------- before answering
await page.goto(`${BASE}/student/lessons/${P1}/practice`);
await page.getByTestId('practice-intro').waitFor();
await page.getByTestId('practice-begin').click();
await page.getByTestId('practice-question').waitFor();
const attemptId = new URL(page.url()).searchParams.get('attempt');
const view = attemptId ? await (await student.request.get(`${BASE}/api/student/practice/attempts/${attemptId}`)).json() : null;
const viewText = JSON.stringify(view ?? {});
check('P1', 'Before answering: no solution, guide or calculator on the page or in the attempt API', (await page.getByTestId('solution-guide').count()) === 0 && (await page.getByTestId('calculator').count()) === 0 && !/math12-monotonic|explanation"\s*:\s*"[^"]/.test(viewText), attemptId ? `attempt ${attemptId}` : 'no attempt id in URL');
if (VP === 1440) {
  const scripts = await page.evaluate(() => [...document.querySelectorAll('script[src]')].map((s) => s.src));
  let leaked = [];
  for (const src of scripts) {
    const body = await (await student.request.get(src)).text();
    if (/math12-monotonic-x-over-ln-x|Chọn D\.|fx570vnplus-table-x-over-ln-x/.test(body)) leaked.push(src);
  }
  check('P2', 'The guide (which states the answer) is not in any script the student page loads', leaked.length === 0, `${scripts.length} scripts checked${leaked.length ? `; leaked: ${leaked.join(', ')}` : ''}`);
}

// ---------------------------------------------------------------- answer and methods
await page.getByTestId('choice-B').click();
await page.getByTestId('practice-check').click();
await page.getByTestId('feedback').waitFor();
await page.waitForTimeout(1500);
const guide = page.getByTestId('solution-guide');
check('M1', 'After answering: the solution shows two separate methods, derivative first', (await guide.count()) === 1 && (await page.getByTestId('guide-tab-derivative').getAttribute('aria-selected')) === 'true' && (await page.getByTestId('guide-tab-calculator').count()) === 1);
const method1 = await page.getByTestId('method-derivative').innerText();
check('M2', 'Method 1: correct domain, derivative, x = e, conclusion D, sign table −, −, +', /D = \(0; \+∞\) [\\∖] \{1\}/.test(method1.replace(/\s+/g, ' ')) && /ln x - 1/.test(method1) && /Chọn D/.test(method1) && (await page.getByTestId('sign-table').count()) === 1, method1.replace(/\n/g, ' | ').slice(0, 220));
await page.getByTestId('feedback').scrollIntoViewIfNeeded();
await shot('02-methods', page.getByTestId('feedback'));
await page.getByTestId('guide-source').locator('summary').click();
await page.waitForTimeout(600);
const notes = await page.getByTestId('guide-source-notes').locator('li').count();
const sourceSteps = await page.getByTestId('guide-source-text').getByTestId('solution-steps').locator('li').count();
const sourceText = await page.getByTestId('guide-source-text').innerText();
check('M3', 'Original imported solution kept verbatim (17 lines, incl. "Start? Ta chọn x = 0" and "SHIFT x10^x") with 6 notes', sourceSteps === 17 && notes === 6 && /SHIFT x10\^x/.test(sourceText) && /Ta chọn x = 0/.test(sourceText), `${sourceSteps} lines, ${notes} notes`);
await shot('12-source-notes', page.getByTestId('guide-source'));
await page.getByTestId('guide-source').locator('summary').click();

// ---------------------------------------------------------------- method 2: watch
await page.getByTestId('guide-tab-calculator').click();
await tutor().waitFor();
await tutor().scrollIntoViewIfNeeded();
check('W0', 'Method 2 opens on a start screen: objective, domain, "Xem hướng dẫn" and "Tự bấm thử"', (await page.getByTestId('tutor-intro').count()) === 1 && /fx-570VN PLUS/.test(await page.getByTestId('tutor-model').innerText()));
await shot('03-tutor-start', VP === 390 ? undefined : tutor());
const requests = [];
page.on('request', (request) => { if (request.method() !== 'GET' && /\/api\//.test(request.url())) requests.push(`${request.method()} ${request.url()}`); });
const streak0 = psql(`select count(*) from tutai.lesson_completions`) + '/' + psql(`select count(*) from tutai.learning_days`);

await page.getByTestId('tutor-start-watch').click();
const layout = await tutor().getAttribute('data-layout');
check('L1', VP === 390 ? 'Phone: the tutor opens as a full-screen workspace with instruction and whole keypad on screen' : 'Tablet/desktop: instruction panel beside the calculator', VP === 390 ? layout === 'focus' : layout !== 'focus', `layout=${layout ?? 'inline'}`);
// Step 1 → MODE highlighted, then 7, and so on.
await page.locator('[data-testid=calculator] [data-target=true]').first().waitFor({ timeout: 4000 });
const firstTarget = await page.locator('[data-testid=calculator] [data-target=true]').first().getAttribute('data-key');
await page.waitForFunction(() => document.querySelector('[data-testid=tutor-step]')?.getAttribute('data-step') === 'enter-function' && Number(document.querySelector('[data-testid=tutor-step]')?.getAttribute('data-done')) >= 2, null, { timeout: 15000 });
const highlighted = await page.locator('[data-testid=calculator] [data-target=true]').first().getAttribute('data-key');
await shot('04-watch-highlight', VP === 390 ? undefined : tutor());
check('W1', 'Demonstration: highlights MODE first, then presses keys one by one with the screen updating', firstTarget === 'MODE' && highlighted === 'DIVIDE' && /f\(X\)=X/.test(await lcd()), `first=${firstTarget}, now=${highlighted}, lcd=${(await lcd()).replace(/\n/g, ' ')}`);
// Pause / resume
await page.getByTestId('tutor-play').click();
const pausedAt = await stepAttr('done');
await page.waitForTimeout(2600);
const stillAt = await stepAttr('done');
await page.getByTestId('tutor-play').click();
await page.waitForFunction((at) => Number(document.querySelector('[data-testid=tutor-step]')?.getAttribute('data-done')) > Number(at), pausedAt, { timeout: 5000 });
check('W2', 'Pause stops the demonstration; resume continues from the same key', pausedAt === stillAt, `paused at ${pausedAt}, after 2.6 s ${stillAt}`);
await page.waitForFunction(() => document.querySelector('[data-testid=tutor-step]')?.getAttribute('data-step') === 'skip-g', null, { timeout: 15000 });
await page.getByTestId('tutor-play').click(); // pause on step 3
await page.getByTestId('tutor-prev').click();
const fnScreen = await lcd();
await page.getByTestId('tutor-next').click(); // complete step 2 at once
const fnDone = await lcd();
await shot('05-function-entered', VP === 390 ? undefined : tutor());
check('W3', 'Previous goes back to step 2 at its start (f(X)= empty)', /f\(X\)=$/.test(fnScreen.replace(/\s|Math/g, '')), fnScreen.replace(/\n/g, ' '));
check('W3b', 'Function entered correctly on screen', /f\(X\)=X÷ln\(X\)/.test(fnDone.replace(/\s/g, '')), fnDone.replace(/\n/g, ' '));
// Replay
await page.getByTestId('tutor-replay').click();
const replayed = await stepAttr('done');
await page.waitForFunction(() => Number(document.querySelector('[data-testid=tutor-step]')?.getAttribute('data-done')) >= 1, null, { timeout: 5000 });
check('W4', 'Replay restarts the current step from its first key', replayed === '0');
await page.getByTestId('tutor-play').click();
// Jump through to the excluded points with Next, then let the demo run that step.
for (let i = 0; i < 6 && (await stepAttr('step')) !== 'excluded-points'; i++) {
  await page.getByTestId('tutor-next').click();
  await page.waitForTimeout(150);
}
await page.getByTestId('tutor-play').click();
await page.getByTestId('tutor-checkpoint').waitFor({ timeout: 20000 });
const errorTable = await page.getByTestId('calc-table').innerText();
const playing = await page.getByTestId('tutor-play').getAttribute('data-playing');
await shot('07b-table-error-rows', VP === 390 ? undefined : tutor());
check('W5', 'Demo pauses at the checkpoint: rows x = 0 and x = 1 shown as ERROR, explained as outside the domain', playing === 'false' && /ERROR/.test(errorTable) && /ERROR không phải là một giá trị/.test(await page.getByTestId('tutor-checkpoint').innerText()), errorTable.replace(/\n/g, ' '));

// ---------------------------------------------------------------- practice
const calcKey = (key) => page.locator(`[data-testid=calculator] [data-key="${key}"]`);
const KEYBOARD = { MODE: 'm', ALPHA: 'a', SHIFT: 's', LN: 'l', RPAREN: ')', LPAREN: '(', DIVIDE: '/', TIMES: '*', PLUS: '+', MINUS: '-', EQ: 'Enter', DOT: '.', DEL: 'Backspace', AC: 'Escape', UP: 'ArrowUp', DOWN: 'ArrowDown', LEFT: 'ArrowLeft', RIGHT: 'ArrowRight' };
async function pressKey(key) {
  if (INPUT === 'keyboard' && (KEYBOARD[key] || /^\d$/.test(key))) {
    const k = KEYBOARD[key] ?? key;
    if (k.length === 1) await page.keyboard.type(k);
    else await page.keyboard.press(k);
  } else if (INPUT === 'touch') await calcKey(key).tap();
  else await calcKey(key).click();
}
const focusCalc = () => (INPUT === 'keyboard' ? page.getByTestId('calculator').focus() : Promise.resolve());

await page.getByTestId('tutor-mode-practice').click();
await focusCalc();
const before = await lcd();
await pressKey('5');
await page.waitForTimeout(250);
const caption1 = await page.getByTestId('calc-caption').innerText();
const tone1 = await page.getByTestId('calc-caption').locator('[data-tone]').getAttribute('data-tone');
const after1 = await lcd();
const targetAfter1 = await page.locator('[data-testid=calculator] [data-target=true]').count();
await shot('08-wrong-key', VP === 390 ? undefined : tutor());
check('T1', 'Wrong key: gentle correction, key not applied (screen unchanged), no answer forced yet', tone1 === 'wrong' && /Chưa đúng phím/.test(caption1) && before === after1 && targetAfter1 === 0, caption1);
await pressKey('ALPHA');
await page.waitForTimeout(250);
const targetAfter2 = await page.locator('[data-testid=calculator] [data-target=true]').first().getAttribute('data-key').catch(() => null);
check('T2', 'Second wrong key: the expected key (MODE) is highlighted', targetAfter2 === 'MODE', `target=${targetAfter2}`);
await page.getByTestId('tutor-hint-button').click();
check('T3', 'Gợi ý shows the hint for the step', /MODE nằm ở hàng trên cùng/.test(await page.getByTestId('tutor-hint').innerText()));
await focusCalc();
await pressKey('MODE');
await pressKey('7');
check('T4', 'Correct keys advance: MODE → 7 opens TABLE (f(X)=)', /f\(X\)=/.test(await lcd()) && (await stepAttr('done')) === '2');
// Reset: start again from step 1
await page.getByTestId('tutor-next').click();
await focusCalc();
await pressKey('ALPHA');
await page.getByTestId('tutor-reset').click();
check('T5', 'Làm lại restarts the exercise at step 1 with a blank screen', (await stepAttr('step')) === 'open-table' && (await stepAttr('done')) === '0' && /0/.test(await lcd()));

// Complete the whole exercise with the chosen input method.
let presses = 0;
let rangeShot = false;
const t0 = Date.now();
await focusCalc();
while ((await page.getByTestId('tutor-complete').count()) === 0) {
  const expected = await stepAttr('expected');
  const stepId = await stepAttr('step');
  if (!expected) {
    if (stepId === 'read-1-4') {
      await shot('07-table-results', VP === 390 ? undefined : tutor());
      check('T7', 'TABLE (1; 4): minimum near x = e then increasing; selected X = 3 shows F = 2.73071768', /2\.7194/.test(await page.getByTestId('calc-table').innerText() + (await lcd())) || /2\.73071768/.test(await page.getByTestId('calc-selected').innerText()), (await page.getByTestId('calc-selected').innerText()));
    }
    if (stepId === 'range-0-1') {
      const rows = await page.getByTestId('calc-table').innerText();
      check('T6', 'TABLE (0; 1): Start 0.1, Step 0.1 → first values −0.043, −0.124, −0.249; no ERROR row', /-0\.043/.test(rows) && /-0\.124/.test(rows) && !/ERROR/.test(rows), rows.replace(/\n/g, ' '));
    }
    await page.getByTestId('tutor-next').click();
    await focusCalc();
    continue;
  }
  if (stepId === 'range-1-4' && !rangeShot && Number(await stepAttr('done')) === 6) {
    rangeShot = true;
    const screen = await lcd();
    await shot('06-range-config', VP === 390 ? undefined : tutor());
    check('T6b', 'Range configuration on screen: Start? 1.2 typed for the interval (1; 4)', /Start\?\s*1\.2/.test(screen), screen.replace(/\n/g, ' '));
  }
  await pressKey(expected);
  presses += 1;
  if (presses > 120) break;
}
const complete = await page.getByTestId('tutor-complete').innerText();
await page.waitForTimeout(500);
await shot('09-complete', VP === 390 ? undefined : tutor());
check('T8', `Practice completed with ${INPUT} input: success state and the "not a proof" conclusion`, /tự bấm xong/.test(complete) && /không phải là chứng minh/.test(complete), `${presses} presses in ${Math.round((Date.now() - t0) / 1000)} s`);
check('T9', 'No request was sent while watching or practising (no grading, streak or XP from the tutor)', requests.length === 0 && streak0 === psql(`select count(*) from tutai.lesson_completions`) + '/' + psql(`select count(*) from tutai.learning_days`), requests.join(', ') || `streak rows ${streak0}`);
// Free mode: a real calculator for this function
await page.getByTestId('tutor-free-mode').click();
await focusCalc();
for (const key of ['AC', 'EQ', 'EQ', '0', 'DOT', '5', 'EQ', '1', 'DOT', '5', 'EQ', '0', 'DOT', '2', '5', 'EQ', 'DOWN', 'DOWN', 'RIGHT']) await pressKey(key);
const freeTable = await page.getByTestId('calc-table').innerText();
check('T10', 'Free mode computes the student’s own range: Start 0.5, End 1.5, Step 0.25 → ERROR at x = 1 only', /ERROR/.test(freeTable) && (await page.getByTestId('calc-selected').innerText()) === 'ERROR', freeTable.replace(/\n/g, ' '));
await pressKey('ALPHA');
await pressKey('EXP');
const unsupported = await page.getByTestId('calc-caption').innerText();
check('T11', 'An unsupported operation says so instead of faking a result', /chỉ hỗ trợ|ngoài phạm vi/.test(unsupported), unsupported);
if (VP === 390) {
  await page.getByTestId('tutor-close').click();
  check('L2', 'Closing the phone workspace returns to the solution', (await page.getByTestId('tutor-intro').count()) === 1);
}
check('O', 'No horizontal overflow', (await overflow(page)) <= 0, await overflow(page));

// ---------------------------------------------------------------- other questions, lesson
await page.getByTestId('practice-next').click().catch(() => {});
await page.getByTestId('practice-question').waitFor();
await page.getByTestId('choice-D').click();
await page.getByTestId('practice-check').click();
await page.getByTestId('feedback').waitFor();
check('R1', 'A question without a verified guide keeps the existing step-by-step solution', (await page.getByTestId('solution-guide').count()) === 0 && (await page.getByTestId('solution-steps').count() + (await page.getByTestId('feedback').innerText()).length) > 0);
await page.goto(`${BASE}/student/lessons/${P1}`);
await page.getByTestId('interactive-lesson').waitFor({ timeout: 20000 });
check('R2', 'Interactive Math P1 still renders for the lesson', await page.getByTestId('interactive-lesson').isVisible());
await student.close();

// ---------------------------------------------------------------- admin preview
const admin = await adminContext(browser, VP);
const ap = await admin.newPage();
ap.on('pageerror', (error) => errors.push(error.message));
await ap.goto(`${BASE}/admin/practice/${P1}`);
await ap.getByTestId('select-question-q-b48ea52f-2c80-41f8-9740-852bbad40ed5').check();
await ap.getByTestId('open-student-preview').click();
await ap.getByTestId('student-preview').waitFor();
await ap.getByTestId('student-preview').getByTestId('choice-D').click();
await ap.getByTestId('preview-submit').click();
await ap.getByTestId('guide-verification').waitFor();
await ap.getByTestId('sequence-review').locator('summary').click();
const okChecks = await ap.locator('[data-testid=sequence-check][data-ok=true]').count();
const allChecks = await ap.locator('[data-testid=sequence-check]').count();
check('A1', 'Admin preview: guide marked verified, every step of the key sequence replays to its expected screen', okChecks === allChecks && allChecks === 8, `${okChecks}/${allChecks}`);
await ap.getByTestId('guide-verification').screenshot({ path: `${OUT}/11-admin-verification.png` });
await ap.getByTestId('guide-tab-calculator').click();
await ap.getByTestId('tutor-start-practice').click();
check('A2', 'Admin can try the tutorial in the preview (nothing stored)', (await ap.getByTestId('tutor-step').count()) === 1);
const studentForbidden = await (await (await studentContext(browser, VP, `a${VP}`)).request.get(`${BASE}/api/question-bank/q-b48ea52f-2c80-41f8-9740-852bbad40ed5`)).status();
check('A3', 'A student cannot read the bank question (and its explanation) through the admin API', studentForbidden === 401 || studentForbidden === 403 || studentForbidden === 404, studentForbidden);
check('E', 'No page errors', errors.length === 0, errors.join(' | '));
await browser.close();

writeFileSync(`${S}/results-${VP}.json`, JSON.stringify({ viewport: `${VP}x${H[VP]}`, input: INPUT, results }, null, 1));
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${VP}: ${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
