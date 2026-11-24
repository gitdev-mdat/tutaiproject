// Walks the P1 interactive lesson end to end as a fresh student and captures every part,
// the first completion, and the revisits, counting reward sounds and fireworks.
// Usage: node lesson-walk.mjs <truoc|sau> <width> [--sound=default|on|off] [--reduced]
import fs from 'node:fs';
import path from 'node:path';
import { chromium, SERVERS, newStudent, overflow } from './lib.mjs';

const [, , PHASE = 'truoc', W = '1440', ...flags] = process.argv;
const width = Number(W);
const HEIGHTS = { 1440: 900, 1920: 1080, 390: 844, 360: 640 };
const height = HEIGHTS[width] ?? 900;
const mobile = width < 768;
const sound = (flags.find((f) => f.startsWith('--sound=')) ?? '--sound=default').slice(8);
const reduced = flags.includes('--reduced');
const BASE = SERVERS.pp_lesson;
const P1 = 'knowledge-45c34e43-ad2e-47bf-8845-68782b67cfb9';
const OUT = `/tmp/claude-0/pp/anh-lesson/${PHASE}/${width}${sound !== 'default' ? '-' + sound : ''}${reduced ? '-rm' : ''}`;
fs.mkdirSync(OUT, { recursive: true });
const log = { phase: PHASE, width, sound, reduced, steps: [], errors: [] };
const note = (k, v) => { log.steps.push({ k, v }); console.log(k, JSON.stringify(v)); };

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width, height },
  hasTouch: mobile,
  isMobile: mobile,
  deviceScaleFactor: 1,
  reducedMotion: reduced ? 'reduce' : 'no-preference',
  recordVideo: PHASE === 'sau' && !reduced && sound === 'default' ? { dir: OUT, size: { width, height } } : undefined,
});
// Count reward-sound plays and fireworks per page load.
await context.addInitScript(() => {
  window.__plays = [];
  window.__fw = 0;
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    window.__plays.push(this.currentSrc || this.src);
    return play.call(this).catch(() => {});
  };
  new MutationObserver((records) => {
    for (const r of records) for (const n of r.addedNodes)
      if (n.nodeType === 1 && (n.matches?.('[data-testid="fireworks"]') || n.querySelector?.('[data-testid="fireworks"]'))) window.__fw += 1;
  }).observe(document, { childList: true, subtree: true });
});
await newStudent(context, BASE, `lw${width}`);
const page = await context.newPage();
page.on('pageerror', (e) => log.errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') log.errors.push(m.text()); });
if (sound !== 'default')
  await context.addInitScript((v) => { try { localStorage.setItem('tutai:lesson-sound', v); } catch {} }, sound);

const shot = async (name, full = false) => {
  await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: full });
};
const counts = async () => page.evaluate(() => ({ plays: window.__plays.map((s) => s.split('/').pop()), fireworks: window.__fw }));
const stageId = () => page.getByTestId('interactive-lesson').getAttribute('data-stage-id');

async function next() {
  const button = page.getByTestId(mobile ? 'dock-continue' : 'stage-continue');
  await button.waitFor();
  for (let i = 0; i < 25 && (await button.isDisabled()); i += 1) await page.waitForTimeout(150);
  if (await button.isDisabled()) { await shot(`debug-locked-${await stageId()}`, true); throw new Error(`locked on ${await stageId()}`); }
  await button.click();
  await page.waitForTimeout(600);
}
async function graphPoint(testId, x) {
  const surface = page.getByTestId(testId).getByTestId('graph-surface');
  await surface.scrollIntoViewIfNeeded();
  const box = await surface.boundingBox();
  const w = Number(await surface.getAttribute('data-plot-width'));
  const xMin = Number(await surface.getAttribute('data-x-min'));
  const xMax = Number(await surface.getAttribute('data-x-max'));
  const pad = 18;
  const px = pad + ((x - xMin) / (xMax - xMin)) * (w - 2 * pad);
  return { x: box.x + (px * box.width) / w, y: box.y + box.height * 0.5, xMin, xMax, box };
}
async function tapGraph(testId, x) {
  const p = await graphPoint(testId, x);
  if (mobile) await page.touchscreen.tap(p.x, p.y); else await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(250);
}
async function sweep(testId) {
  if (mobile) {
    const cdp = await context.newCDPSession(page);
    const a = await graphPoint(testId, 0);
    const span = a.xMax - a.xMin;
    const y = a.box.y + a.box.height * 0.55;
    const s = await graphPoint(testId, a.xMin);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: s.x, y }] });
    for (let i = 1; i <= 120; i += 1) {
      const p = await graphPoint(testId, a.xMin + (span * i) / 120);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: p.x, y }] });
      await page.waitForTimeout(12);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    return;
  }
  const handle = page.getByTestId(testId).getByTestId('drag-point');
  const hb = await handle.boundingBox();
  const a = await graphPoint(testId, 0);
  const span = a.xMax - a.xMin;
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  for (let i = 0; i <= 120; i += 1) {
    const p = await graphPoint(testId, a.xMin + (span * i) / 120);
    await page.mouse.move(p.x, p.y, { steps: 1 });
    await page.waitForTimeout(12);
  }
  await page.mouse.up();
}
// Brings a control into the band a student sees on a phone: below the pinned graph, above the dock.
async function tap(locator) {
  await locator.waitFor();
  await locator.evaluate((el) => { const r = el.getBoundingClientRect(); if (window.innerWidth < 768) window.scrollBy(0, r.top - window.innerHeight * 0.62); });
  await page.waitForTimeout(120);
  await locator.click();
}
const pick = (group, id) => tap(page.getByTestId(group).getByTestId(`choice-${id}`));
async function solver({ roots, signs, pieces }) {
  await pick('choices-domain', 'r');
  await pick('choices-derivative', 'd0');
  for (const r of roots) await tap(page.getByTestId(`root-${r}`));
  await tap(page.getByTestId('check-roots'));
  for (let i = 0; i < signs.length; i += 1) {
    const cell = page.getByTestId(`sign-${i}`);
    await tap(cell);
    if (signs[i] < 0) await tap(cell);
  }
  await tap(page.getByTestId('check-signs'));
  for (let i = 0; i < pieces.length; i += 1) await tap(page.getByTestId(`conclude-${i}-${pieces[i]}`));
  await tap(page.getByTestId('check-conclusion'));
}
const MAIN = { roots: ['0', '2'], signs: [1, -1, 1], pieces: ['up', 'down', 'up'] };
const PRACTICE = { roots: ['−1', '1'], signs: [-1, 1, -1], pieces: ['down', 'up', 'down'] };

// Measures of the part's own chrome above the first activity.
const chrome = () => page.evaluate(() => {
  const main = document.querySelector('[data-testid="interactive-lesson"]');
  const section = main?.querySelector('section') ?? main;
  const firstControl = section?.querySelector('button:not([data-testid^="part-"]):not([data-testid="journey-back"]), [data-testid="graph-surface"]');
  const r = firstControl?.getBoundingClientRect();
  return { firstActivityTop: r ? Math.round(r.top + window.scrollY) : null, pageHeight: document.documentElement.scrollHeight };
});

const t0 = Date.now();
await page.goto(`${BASE}/student/lessons/${P1}`);
await page.getByTestId('interactive-lesson').waitFor();
await page.waitForTimeout(1600);
note('soundSetting', await page.evaluate(() => localStorage.getItem('tutai:lesson-sound')));

// 1 Quan sát
note('stage', await stageId());
note('chrome-1', await chrome());
await shot('01-quan-sat');
await tapGraph('graph-shape', 0);
await tapGraph('graph-shape', 2);
await tap(page.getByTestId('piece-0-up'));
await tap(page.getByTestId('piece-1-down'));
await tap(page.getByTestId('piece-2-up'));
await shot('01-quan-sat-xong', true);
note('overflow-1', await overflow(page));
await next();

// 2 Khám phá
note('stage', await stageId());
await shot('02-kham-pha');
await pick('predict-tangent', 'len');
await sweep('graph-slope');
await pick('rule-positive', 'len');
await pick('rule-negative', 'xuong');
await shot('02-kham-pha-xong', true);
note('overflow-2', await overflow(page));
await next();

// 3 Mở rộng
note('stage', await stageId());
await shot('03-mo-rong');
await pick('flat-predict', 'giu-chieu');
await page.waitForTimeout(400);
await sweep('graph-flat');
await pick('flat-conclude', 'ca-truc');
await shot('03-mo-rong-xong', true);
note('overflow-3', await overflow(page));
await next();

// 4 Áp dụng
note('stage', await stageId());
await shot('04-ap-dung');
await solver(MAIN);
await page.waitForTimeout(2600);
await shot('04-ap-dung-xong', true);
note('overflow-4', await overflow(page));
await next();

// 5 Tự làm
note('stage', await stageId());
await shot('05-tu-lam');
await solver(PRACTICE);
await page.waitForTimeout(1200);
await shot('05-tu-lam-xong', true);
note('overflow-5', await overflow(page));
note('before-finish', await counts());
if (flags.includes('--gif')) {
  // Frames of the first-time celebration, for the review GIF.
  const button = page.getByTestId(mobile ? 'dock-continue' : 'stage-continue');
  await button.click();
  const t = Date.now();
  for (let i = 0; Date.now() - t < 4200; i += 1)
    await page.screenshot({ path: path.join(OUT, `gif-${String(i).padStart(3, '0')}-${Date.now() - t}.png`) });
} else await next();

// 6 Hoàn thành, first time
note('stage', await stageId());
await page.waitForTimeout(500);
await shot('07-an-mung');
await page.waitForTimeout(3500);
await shot('08-tong-ket');
await shot('08-tong-ket-full', true);
note('overflow-6', await overflow(page));
note('first-finish', await counts());
note('ms-to-finish', Date.now() - t0);
note('finish-testids', await page.evaluate(() => [...new Set([...document.querySelectorAll('[data-testid]')].map((e) => e.dataset.testid))].filter((t) => /finish|replay|sound|found|streak|restart|retry|practice|next|key-idea|completed|review/.test(t))));
const storage1 = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage).filter(([k]) => k.startsWith('tutai:lesson-progress'))));
note('progress', storage1);

// Go back one part, then return to the end: no second celebration.
const parts = await page.locator('[data-testid="part-bar"] button[data-testid^="part-"]').evaluateAll((els) => els.map((e) => e.dataset.testid));
note('parts', parts);
const finishPart = parts[parts.length - 1];
if (parts.length > 1) {
  await page.getByTestId(parts[0]).click();
  await page.waitForTimeout(700);
  note('back-to', await stageId());
  await shot('09a-xem-lai-phan-1');
  await page.getByTestId(finishPart).click();
  await page.waitForTimeout(2500);
  note('after-back-and-return', await counts());
}

// Refresh.
await page.reload();
await page.getByTestId('interactive-lesson').waitFor();
await page.waitForTimeout(2500);
note('reload-stage', await stageId());
await shot('09-xem-lai');
await shot('09-xem-lai-full', true);
note('after-reload', await counts());

// Roadmap, then reopen the lesson from it.
await page.goto(`${BASE}/student/roadmap`);
await page.getByTestId('roadmap').waitFor();
await page.waitForTimeout(800);
await shot('11-lo-trinh');
await page.goto(`${BASE}/student/lessons/${P1}`);
await page.getByTestId('interactive-lesson').waitFor();
await page.waitForTimeout(2500);
note('reopen-stage', await stageId());
note('after-reopen', await counts());

// Practice from the lesson.
const practice = page.locator('[data-testid="practice-start"], [data-testid="practice-continue"]').first();
if (await practice.count()) {
  await practice.scrollIntoViewIfNeeded();
  await practice.click();
  await page.waitForURL((u) => !u.pathname.includes('/student/lessons/'), { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);
  note('practice-url', page.url().replace(BASE, ''));
  await shot('10-luyen-tap');
}
const storage2 = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage).filter(([k]) => k.startsWith('tutai:lesson-progress'))));
note('progress-preserved', JSON.stringify(storage2) === JSON.stringify(storage1) || storage2);

fs.writeFileSync(path.join(OUT, 'log.json'), JSON.stringify(log, null, 2));
await context.close();
await browser.close();
console.log('errors', log.errors.length, log.errors.slice(0, 5));
