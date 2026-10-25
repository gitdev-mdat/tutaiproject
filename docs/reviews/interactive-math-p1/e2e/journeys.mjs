// Real-browser journeys for the interactive P1 lesson, against a local build whose
// database holds the Production P1 content (no question bank records).
//
//   BASE=http://localhost:3300 node docs/reviews/interactive-math-p1/e2e/journeys.mjs
//
// Needs Playwright with Chromium. Writes screenshots and results.json next to this file.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(process.env.PLAYWRIGHT_FROM ?? import.meta.url);
const { chromium } = require('playwright');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, '..', 'screenshots');
const BASE = process.env.BASE ?? 'http://localhost:3300';
const P1 = 'knowledge-45c34e43-ad2e-47bf-8845-68782b67cfb9';
const OTHER = 'knowledge-c5e8afbc-1daf-44e2-9a27-ee73f05b33e6';
const SIZES = { desktop: [1440, 900], tablet: [768, 1024], mobile: [390, 844] };
const ONLY = (process.env.ONLY ?? '').split(',').filter(Boolean);
const results = {};
fs.mkdirSync(SHOTS, { recursive: true });

// ─── helpers ────────────────────────────────────────────────────────────────

async function student(context, tag) {
  const username = `qa_ip1_${tag}_${Date.now().toString(36)}`;
  let r = await context.request.post(`${BASE}/api/auth/register`, {
    headers: { origin: BASE },
    data: {
      username,
      email: `${username}@tutai.invalid`,
      password: 'Qa-p1-proto-2026!',
      fullName: 'Học sinh QA',
      phone: '0912345678',
    },
  });
  if (!r.ok()) throw new Error(`register ${r.status()} ${await r.text()}`);
  r = await context.request.post(`${BASE}/api/onboarding`, {
    headers: { origin: BASE },
    data: {
      fullName: 'Học sinh QA',
      grade: '12',
      provinceCode: '01',
      primarySubject: 'MATH',
      currentScore: 6,
      targetScore: 8,
      acquisitionSource: 'Google',
    },
  });
  if (!r.ok()) throw new Error(`onboarding ${r.status()} ${await r.text()}`);
}

const browsers = [];
async function open(name, size, options = {}) {
  const [width, height] = SIZES[size];
  const browser = await chromium.launch();
  browsers.push(browser);
  const context = await browser.newContext({
    viewport: { width, height },
    hasTouch: size !== 'desktop',
    isMobile: size === 'mobile',
    deviceScaleFactor: size === 'desktop' ? 1 : 2,
    reducedMotion: options.reducedMotion ? 'reduce' : 'no-preference',
  });
  await student(context, name);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return { browser, context, page, errors };
}

const shot = async (page, file, full = false) => {
  await page.waitForTimeout(450);
  await page.screenshot({ path: path.join(SHOTS, `${file}.png`), fullPage: full });
  return `screenshots/${file}.png`;
};

const stageId = (page) =>
  page.getByTestId('interactive-lesson').getAttribute('data-stage-id');

async function overflowX(page) {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
}

async function next(page) {
  const mobile = (page.viewportSize()?.width ?? 1440) < 768;
  const button = page.getByTestId(mobile ? 'dock-continue' : 'stage-continue');
  await button.waitFor();
  // The part unlocks right after its last answer renders.
  for (let i = 0; i < 20 && (await button.isDisabled()); i += 1) await page.waitForTimeout(150);
  if (await button.isDisabled()) {
    await page.screenshot({ path: path.join(HERE, `debug-locked-${await stageId(page)}.png`), fullPage: true });
    throw new Error(`continue locked on ${await stageId(page)}`);
  }
  await button.click();
  await page.waitForTimeout(500);
}

/** Screen point of a graph x on the explore surface. */
async function graphPoint(page, testId, x) {
  const surface = page.getByTestId(testId).getByTestId('graph-surface');
  const box = await surface.boundingBox();
  const width = Number(await surface.getAttribute('data-plot-width'));
  const xMin = Number(await surface.getAttribute('data-x-min'));
  const xMax = Number(await surface.getAttribute('data-x-max'));
  const pad = 18;
  const px = pad + ((x - xMin) / (xMax - xMin)) * (width - 2 * pad);
  return { x: box.x + (px * box.width) / width, y: box.y + box.height * 0.5, xMin, xMax };
}

async function tapGraph(page, testId, x, touch) {
  const point = await graphPoint(page, testId, x);
  if (touch) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(250);
}

/** Drags M across the whole graph with the mouse, slowly enough to snap onto each zero. */
async function sweepMouse(page, testId) {
  const handle = page.getByTestId(testId).getByTestId('drag-point');
  const box = await handle.boundingBox();
  const a = await graphPoint(page, testId, 0);
  const span = a.xMax - a.xMin;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  for (let i = 0; i <= 120; i += 1) {
    const p = await graphPoint(page, testId, a.xMin + (span * i) / 120);
    await page.mouse.move(p.x, p.y, { steps: 1 });
    await page.waitForTimeout(12);
  }
  await page.mouse.up();
}

/** The same with a finger: real touch events through the DevTools protocol. */
async function sweepTouch(page, testId) {
  const cdp = await page.context().newCDPSession(page);
  const surface = await page.getByTestId(testId).getByTestId('graph-surface').boundingBox();
  const a = await graphPoint(page, testId, 0);
  const span = a.xMax - a.xMin;
  const y = surface.y + surface.height * 0.55;
  const start = await graphPoint(page, testId, a.xMin);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: start.x, y }],
  });
  for (let i = 1; i <= 120; i += 1) {
    const p = await graphPoint(page, testId, a.xMin + (span * i) / 120);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: p.x, y }] });
    await page.waitForTimeout(12);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

/** Keyboard only: focus M and walk it across with the arrow keys. */
async function sweepKeyboard(page, testId) {
  const handle = page.getByTestId(testId).getByTestId('drag-point');
  await handle.focus();
  await page.keyboard.press('Home');
  for (let i = 0; i < 90; i += 1) await page.keyboard.press('ArrowRight');
}

const pick = (page, group, id) => page.getByTestId(group).getByTestId(`choice-${id}`).click();

// ─── stage actions ──────────────────────────────────────────────────────────

async function doShape(page, { touch = false, mistakes = false, file = null } = {}) {
  if (mistakes) {
    await tapGraph(page, 'graph-shape', 1, touch); // still going down there
    if (file) await shot(page, `${file}-shape-miss`);
    await page.getByTestId('ask-hint').first().click();
  }
  await tapGraph(page, 'graph-shape', 0, touch);
  await tapGraph(page, 'graph-shape', 2, touch);
  if (file) await shot(page, `${file}-shape-found`);
  if (mistakes) await page.getByTestId('piece-0-down').click();
  await page.getByTestId('piece-0-up').click();
  await page.getByTestId('piece-1-down').click();
  await page.getByTestId('piece-2-up').click();
}

async function doSlope(page, { sweep = sweepMouse, mistakes = false, shots = null } = {}) {
  if (mistakes) {
    await pick(page, 'predict-tangent', 'ngang');
    if (shots) await shot(page, `${shots}-predict-wrong`);
  }
  await pick(page, 'predict-tangent', 'len');
  if (shots) await shot(page, `${shots}-tangent`);
  await sweep(page, 'graph-slope');
  if (shots) await shot(page, `${shots}-scanned`);
  if (mistakes) await pick(page, 'rule-positive', 'xuong');
  await pick(page, 'rule-positive', 'len');
  await pick(page, 'rule-negative', 'xuong');
}

async function doFlat(page, { sweep = sweepMouse, mistakes = false } = {}) {
  if (mistakes) await pick(page, 'flat-predict', 'doi-chieu');
  await pick(page, 'flat-predict', 'giu-chieu');
  await page.waitForTimeout(400); // the feedback lands before the student starts dragging
  await sweep(page, 'graph-flat');
  await pick(page, 'flat-conclude', 'ca-truc');
}

/** The four steps. `signs` and `pieces` are the right answers for the function. */
async function doSolver(page, { roots, signs, pieces, mistakes = false, reveal = false, shots = null }) {
  if (mistakes) await pick(page, 'choices-domain', 'r-0');
  await pick(page, 'choices-domain', 'r');
  if (reveal) {
    // Three wrong derivatives: the answer is shown and explained.
    const group = page.getByTestId('choices-derivative');
    for (let i = 0; i < 3; i += 1) {
      const wrong = group.locator('button:not([disabled])').filter({ hasNot: page.locator('svg') });
      const ids = await group.locator('button:not([disabled])').evaluateAll((buttons) =>
        buttons.map((button) => button.dataset.testid)
      );
      const id = ids.find((value) => value !== 'choice-d0');
      if (!id) break;
      await group.getByTestId(id).click();
      void wrong;
    }
    if (shots) await shot(page, `${shots}-revealed`);
  } else {
    if (mistakes) {
      const group = page.getByTestId('choices-derivative');
      const ids = await group.locator('button').evaluateAll((buttons) =>
        buttons.map((button) => button.dataset.testid)
      );
      await group.getByTestId(ids.find((value) => value !== 'choice-d0')).click();
      if (shots) await shot(page, `${shots}-derivative-wrong`);
    }
    await pick(page, 'choices-derivative', 'd0');
  }
  if (mistakes) {
    await page.getByTestId('root-1').click();
    await page.getByTestId('check-roots').click();
    if (shots) await shot(page, `${shots}-roots-wrong`);
    await page.getByTestId('root-1').click();
  }
  for (const root of roots) await page.getByTestId(`root-${root}`).click();
  await page.getByTestId('check-roots').click();
  if (shots) await shot(page, `${shots}-roots`);
  // Sign cells: one click gives +, two give −.
  for (let i = 0; i < signs.length; i += 1) {
    const cell = page.getByTestId(`sign-${i}`);
    const wanted = mistakes && i === 0 ? -signs[i] : signs[i];
    await cell.click();
    if (wanted < 0) await cell.click();
  }
  if (shots) await shot(page, `${shots}-sign-table`);
  await page.getByTestId('check-signs').click();
  if (mistakes) {
    if (shots) await shot(page, `${shots}-sign-wrong`);
    await page.getByTestId('sign-0').click();
    await page.getByTestId('check-signs').click();
  }
  for (let i = 0; i < pieces.length; i += 1) await page.getByTestId(`conclude-${i}-${pieces[i]}`).click();
  await page.getByTestId('check-conclusion').click();
}

const MAIN = { roots: ['0', '2'], signs: [1, -1, 1], pieces: ['up', 'down', 'up'] };
const PRACTICE = { roots: ['−1', '1'], signs: [-1, 1, -1], pieces: ['down', 'up', 'down'] };

// ─── journeys ───────────────────────────────────────────────────────────────

async function allCorrect(size) {
  const s = size;
  const { browser, page, errors } = await open(`ok${s[0]}`, size);
  const t0 = Date.now();
  const log = { size, overflow: {}, stages: [] };
  await page.goto(`${BASE}/student/lessons/${P1}`);
  await page.getByTestId('interactive-lesson').waitFor();
  await page.waitForTimeout(1600); // let the curve draw itself
  log.keyIdeaBeforeLearned = await page.getByTestId('key-idea').count();
  log.continueLockedAtStart = await page
    .getByTestId(s === 'mobile' ? 'dock-continue' : 'stage-continue')
    .isDisabled();
  await shot(page, `${s}-01-intro`);
  await doShape(page, { touch: s !== 'desktop', file: s === 'desktop' ? `${s}-01` : null });
  await shot(page, `${s}-02-intro-done`, s === 'desktop');
  log.overflow.shape = await overflowX(page);
  log.stages.push(await stageId(page));
  await next(page);

  await doSlope(page, {
    sweep: s === 'desktop' ? sweepMouse : sweepTouch,
    shots: s === 'tablet' ? null : `${s}-03`,
  });
  await shot(page, `${s}-04-discovery`, s !== 'mobile');
  log.trail = await page.getByTestId('sign-trail').textContent().catch(() => null);
  log.overflow.slope = await overflowX(page);
  log.stages.push(await stageId(page));
  await next(page);

  await doFlat(page, { sweep: s === 'desktop' ? sweepMouse : sweepTouch });
  await shot(page, `${s}-05-flat`, s !== 'mobile');
  log.overflow.flat = await overflowX(page);
  log.stages.push(await stageId(page));
  await next(page);

  await doSolver(page, { ...MAIN, shots: s === 'desktop' ? `${s}-06` : null });
  await page.waitForTimeout(2500); // the variation table draws its arrows one by one
  await shot(page, `${s}-07-solved`, true);
  log.overflow.solve = await overflowX(page);
  log.stages.push(await stageId(page));
  await next(page);

  log.challengeHiddenBefore = await page.getByTestId('graph-hidden').count();
  await shot(page, `${s}-08-challenge`);
  await doSolver(page, PRACTICE);
  await page.waitForTimeout(400);
  log.challengeHiddenAfter = await page.getByTestId('graph-hidden').count();
  await shot(page, `${s}-09-challenge-solved`, s !== 'mobile');
  log.overflow.challenge = await overflowX(page);
  log.stages.push(await stageId(page));
  await next(page);

  await page.waitForTimeout(900);
  await shot(page, `${s}-10-completion`);
  await shot(page, `${s}-10-completion-full`, true);
  log.stages.push(await stageId(page));
  log.overflow.finish = await overflowX(page);
  log.stats = await page.getByTestId('finish-stats').innerText().catch(() => null);
  log.ms = Date.now() - t0;
  log.storage = await page.evaluate(() =>
    Object.fromEntries(Object.entries(localStorage).filter(([k]) => k.startsWith('tutai:lesson')))
  );

  // Journey 3: revisit a completed lesson.
  await page.goto(`${BASE}/student/lessons/${P1}`);
  await page.getByTestId('interactive-lesson').waitFor();
  await page.waitForTimeout(800);
  log.revisit = {
    stage: await stageId(page),
    keyIdea: await page.getByTestId('key-idea').innerText().catch(() => null),
  };
  if (s === 'desktop') await shot(page, `${s}-11-revisit`);
  await page.getByTestId('part-kham-pha').click();
  await page.waitForTimeout(500);
  log.revisit.partTwoAnswered = await page.locator('[data-beat="done"]').count();
  log.revisit.continueOpen = !(await page
    .getByTestId(s === 'mobile' ? 'dock-continue' : 'stage-continue')
    .isDisabled());
  if (s === 'desktop') await shot(page, `${s}-12-revisit-part2`);
  log.errors = errors;
  await browser.close();
  results[`allCorrect-${size}`] = log;
}

async function mistakes(size) {
  const s = size;
  const { browser, page, errors } = await open(`mis${s[0]}`, size);
  const log = { size };
  await page.goto(`${BASE}/student/lessons/${P1}`);
  await page.getByTestId('interactive-lesson').waitFor();
  await page.waitForTimeout(1600);
  await doShape(page, { touch: s !== 'desktop', mistakes: true, file: `${s}-m01` });
  await shot(page, `${s}-m02-hints`);
  await next(page);
  await doSlope(page, {
    sweep: s === 'desktop' ? sweepMouse : sweepTouch,
    mistakes: true,
    shots: `${s}-m03`,
  });
  await next(page);
  await doFlat(page, { sweep: s === 'desktop' ? sweepMouse : sweepTouch, mistakes: true });
  await next(page);
  await doSolver(page, { ...MAIN, mistakes: true, reveal: true, shots: `${s}-m04` });
  await next(page);
  await doSolver(page, { ...PRACTICE, mistakes: false });
  await next(page);
  await page.waitForTimeout(900);
  await shot(page, `${s}-m05-completion`);
  log.stats = await page.getByTestId('finish-stats').innerText().catch(() => null);
  log.outcomes = await page.evaluate(
    (lesson) => {
      const key = Object.keys(localStorage).find((k) => k.startsWith('tutai:lesson-progress:'));
      return JSON.parse(localStorage.getItem(key)).outcomes?.[lesson];
    },
    P1
  );
  log.errors = errors;
  await browser.close();
  results[`mistakes-${size}`] = log;
}

/** Journey 4: touch on a phone, the keyboard, and the slider fallback; reduced motion. */
async function inputs() {
  const log = {};
  {
    const { browser, page, errors } = await open('kbd', 'desktop', { reducedMotion: true });
    await page.goto(`${BASE}/student/lessons/${P1}`);
    await page.getByTestId('interactive-lesson').waitFor();
    log.reducedMotion = await page.evaluate(() => {
      const element = document.querySelector('.tt-rise, .tt-draw');
      return element ? getComputedStyle(element).animationName : 'no animated element';
    });
    // Turning points with the slider fallback, no pointer.
    await page.getByTestId('keyboard-mode').click();
    const slider = page.getByTestId('explore-slider');
    for (const x of [0, 2]) {
      await slider.evaluate((input, value) => {
        const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        set.call(input, String(value));
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }, x);
      await page.getByTestId('mark-here').click();
    }
    log.sliderFoundBoth = (await page.locator('[data-testid="beat-direction"]').count()) === 1;
    for (const [i, d] of ['up', 'down', 'up'].entries()) {
      await page.getByTestId(`piece-${i}-${d}`).focus();
      await page.keyboard.press('Enter');
    }
    await page.waitForFunction(
      () => !document.querySelector('[data-testid="stage-continue"]')?.disabled
    );
    await page.getByTestId('stage-continue').focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    await pick(page, 'predict-tangent', 'len');
    await sweepKeyboard(page, 'graph-slope');
    log.keyboardScanComplete = (await page.getByTestId('rule-positive').count()) === 1;
    log.ariaValueText = await page.getByTestId('drag-point').first().getAttribute('aria-valuetext');
    await shot(page, 'desktop-13-keyboard');
    log.errors = errors;
    await browser.close();
  }
  {
    const { browser, page, errors } = await open('touch', 'mobile');
    await page.goto(`${BASE}/student/lessons/${P1}`);
    await page.getByTestId('interactive-lesson').waitFor();
    await page.waitForTimeout(1500);
    await doShape(page, { touch: true });
    await next(page);
    await pick(page, 'predict-tangent', 'len');
    // A vertical swipe on the graph must scroll the page, not move M.
    const before = await page.evaluate(() => window.scrollY);
    const xBefore = await page.getByTestId('drag-point').getAttribute('aria-valuenow');
    const surface = await page.getByTestId('graph-slope').getByTestId('graph-surface').boundingBox();
    const cdp = await page.context().newCDPSession(page);
    const cx = surface.x + surface.width * 0.7;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: surface.y + 120 }] });
    for (let i = 1; i <= 10; i += 1)
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx, y: surface.y + 120 - i * 12 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(300);
    log.verticalSwipeMovedM =
      (await page.getByTestId('drag-point').getAttribute('aria-valuenow')) !== xBefore;
    log.verticalSwipeScrolled = (await page.evaluate(() => window.scrollY)) !== before;
    await page.evaluate(() => window.scrollTo(0, 0));
    await sweepTouch(page, 'graph-slope');
    log.touchScanComplete = (await page.getByTestId('rule-positive').count()) === 1;
    await shot(page, 'mobile-14-touch-scan');
    log.touchErrors = errors;
    await browser.close();
  }
  results.inputs = log;
}

/** Journey 5: lessons outside the pilot keep the text journey; old progress maps over. */
async function regression() {
  const log = {};
  const { browser, page, errors } = await open('reg', 'desktop');
  await page.goto(`${BASE}/student/lessons/${OTHER}`);
  await page.waitForTimeout(1200);
  log.otherLesson = {
    classic: await page.getByTestId('lesson-journey').count(),
    interactive: await page.getByTestId('interactive-lesson').count(),
  };
  await shot(page, 'regression-other-lesson');
  await page.goto(`${BASE}/student/lessons/${P1}?view=classic`);
  await page.waitForTimeout(1200);
  log.classicView = await page.getByTestId('lesson-journey').count();
  // A student who had reached "3. Quy trình" (y-3) on the text lesson.
  await page.evaluate(
    ([lesson]) => {
      const key = Object.keys(localStorage).find((k) => k.startsWith('tutai:lesson-progress:'));
      const state = JSON.parse(localStorage.getItem(key));
      state.stages[lesson] = { reached: 3, total: 7, stageId: 'y-3', completedAt: null };
      localStorage.setItem(key, JSON.stringify(state));
    },
    [P1]
  );
  await page.goto(`${BASE}/student/lessons/${P1}`);
  await page.getByTestId('interactive-lesson').waitFor();
  await page.waitForTimeout(600);
  log.legacyY3ResumesOn = await stageId(page);
  await shot(page, 'regression-legacy-resume');
  log.errors = errors;
  await browser.close();
  results.regression = log;
}

/** "Before": the same lesson in the current (text) journey, same sizes. */
async function before() {
  for (const size of ['desktop', 'mobile']) {
    const { browser, page } = await open(`bef${size[0]}`, size);
    await page.goto(`${BASE}/student/lessons/${P1}?view=classic`);
    await page.getByTestId('lesson-journey').waitFor();
    await page.waitForTimeout(800);
    await shot(page, `before-${size}-intro`);
    // Second part (the theorem) and the example, as they are today.
    for (let i = 0; i < 2; i += 1) {
      const cont = page.getByTestId('stage-continue');
      if (await cont.isDisabled()) {
        await page.getByTestId('predict-0-up').click();
        await page.getByTestId('predict-1-down').click();
        await page.getByTestId('predict-2-up').click();
        await page.getByTestId('predict-check').click();
      }
      await cont.click();
      await page.waitForTimeout(500);
    }
    await shot(page, `before-${size}-theorem`);
    await browser.close();
  }
}

/** Drag update-to-paint on a phone at 4× CPU slowdown. */
async function perf() {
  const { browser, page } = await open('perf', 'mobile');
  await page.goto(`${BASE}/student/lessons/${P1}`);
  await page.getByTestId('interactive-lesson').waitFor();
  await page.waitForTimeout(1500);
  await doShape(page, { touch: true });
  await next(page);
  await pick(page, 'predict-tangent', 'len');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const timing = await page.evaluate(async () => {
    const input = document.querySelector('[data-testid="explore-slider"]');
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    const min = Number(input.min);
    const max = Number(input.max);
    const t = [];
    for (let i = 0; i < 120; i += 1) {
      const t0 = performance.now();
      set.call(input, String(min + ((max - min) * i) / 119));
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      t.push(performance.now() - t0);
    }
    t.sort((a, b) => a - b);
    return { median: +t[60].toFixed(1), p95: +t[114].toFixed(1), max: +t[119].toFixed(1) };
  });
  const js = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .filter((entry) => entry.name.endsWith('.js'))
      .reduce((sum, entry) => sum + (entry.encodedBodySize || 0), 0)
  );
  results.perf = { cpu4xUpdateToPaintMs: timing, jsKB: Math.round(js / 1024) };
  await browser.close();
}

const plan = [
  ['allCorrect-desktop', () => allCorrect('desktop')],
  ['allCorrect-mobile', () => allCorrect('mobile')],
  ['allCorrect-tablet', () => allCorrect('tablet')],
  ['mistakes-desktop', () => mistakes('desktop')],
  ['mistakes-mobile', () => mistakes('mobile')],
  ['inputs', inputs],
  ['regression', regression],
  ['before', before],
  ['perf', perf],
];
for (const [name, run] of plan) {
  if (ONLY.length && !ONLY.includes(name)) continue;
  const t0 = Date.now();
  try {
    await run();
    console.log(`✓ ${name} (${Date.now() - t0} ms)`);
  } catch (error) {
    results[`${name}-failed`] = String(error?.stack ?? error);
    console.log(`✗ ${name}: ${error?.message ?? error}`);
  }
  // A failed journey leaves its browser open: close everything before the next one.
  await Promise.all(browsers.splice(0).map((browser) => browser.close().catch(() => {})));
}
const file = path.join(HERE, ONLY.length ? `results-${ONLY.join('+')}.json` : 'results.json');
fs.writeFileSync(file, JSON.stringify(results, null, 1));
console.log('written', file);
process.exit(0);
