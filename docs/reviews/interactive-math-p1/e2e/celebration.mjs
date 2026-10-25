// Real-browser checks of the completion celebration and the daily learning
// streak, against a local production build (TUTAI_LEARNING_STREAK=on) whose
// local PostgreSQL has migration 0008. Never point it at Production: it
// writes streak rows for throwaway QA students.
//
//   PGURL=postgres://postgres:postgres@127.0.0.1:5432/p1audit BASE=http://localhost:3300 \
//     node docs/reviews/interactive-math-p1/e2e/celebration.mjs
//
// Each student starts on "Đến lượt em" (seeded in localStorage), solves it and
// lands on the completion screen. Earlier learning days are seeded in the
// local database: shifting a student's days back is the same as moving the
// clock forward. Writes screenshots, videos and celebration-results.json.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(process.env.PLAYWRIGHT_FROM ?? import.meta.url);
const { chromium } = require('playwright');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, '..', 'screenshots', 'celebration');
const VIDEOS = path.join(HERE, '..', 'videos');
const BASE = process.env.BASE ?? 'http://localhost:3300';
const PGURL = process.env.PGURL ?? 'postgres://postgres:postgres@127.0.0.1:5432/p1audit';
if (!/127\.0\.0\.1|localhost/.test(PGURL)) throw new Error('local database only');
const P1 = 'knowledge-45c34e43-ad2e-47bf-8845-68782b67cfb9';
// Another published lesson, for "a second lesson the same day".
const OTHER = 'knowledge-c5e8afbc-1daf-44e2-9a27-ee73f05b33e6';
const SIZES = { desktop: [1440, 900], tablet: [768, 1024], mobile: [390, 844] };
const ONLY = (process.env.ONLY ?? '').split(',').filter(Boolean);
const results = {};
fs.mkdirSync(SHOTS, { recursive: true });
fs.mkdirSync(VIDEOS, { recursive: true });

// ─── database (local only) ──────────────────────────────────────────────────

const psql = (query) =>
  execFileSync('psql', [PGURL, '-Atc', query], { encoding: 'utf8' }).trim();

const vnToday = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

function daysAgo(n) {
  const date = new Date(`${vnToday()}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - n);
  return date.toISOString().slice(0, 10);
}

const profileOf = (username) =>
  psql(
    `select sp.id from tutai.student_profiles sp join tutai.users u on u.id = sp.user_id where u.username = '${username}'`
  );

/** Earlier learning days, as if the student had learned on them. */
function seedDays(profile, ...ago) {
  for (const n of ago) {
    psql(
      `insert into tutai.learning_days (student_id, day, lesson_id) values ('${profile}', '${daysAgo(n)}', 'seed-${n}') on conflict do nothing`
    );
    psql(
      `insert into tutai.lesson_completions (student_id, lesson_id, completed_day) values ('${profile}', 'seed-${n}', '${daysAgo(n)}') on conflict do nothing`
    );
  }
}

const dbState = (profile) => ({
  days: psql(
    `select string_agg(day::text || ':' || lesson_id, ',' order by day) from tutai.learning_days where student_id = '${profile}'`
  ),
  completions: psql(
    `select string_agg(lesson_id, ',' order by lesson_id) from tutai.lesson_completions where student_id = '${profile}'`
  ),
});

// ─── browser ────────────────────────────────────────────────────────────────

const browsers = [];

async function open(name, size, options = {}) {
  const [width, height] = SIZES[size];
  const browser = await chromium.launch({ args: options.args ?? [] });
  browsers.push(browser);
  const context = await browser.newContext({
    viewport: { width, height },
    hasTouch: size !== 'desktop',
    isMobile: size === 'mobile',
    deviceScaleFactor: size === 'desktop' ? 1 : 2,
    reducedMotion: options.reducedMotion ? 'reduce' : 'no-preference',
    ...(options.video
      ? { recordVideo: { dir: path.join(VIDEOS, 'raw'), size: { width, height } } }
      : {}),
  });
  // Count every sound the page tries to play, and how it went.
  await context.addInitScript((blocked) => {
    window.__sounds = [];
    const original = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function play() {
      const entry = { src: this.src.replace(location.origin, ''), at: performance.now() };
      window.__sounds.push(entry);
      if (blocked) {
        entry.result = 'blocked';
        return Promise.reject(new DOMException('blocked by test', 'NotAllowedError'));
      }
      return original.call(this).then(
        () => (entry.result = 'played'),
        (error) => {
          entry.result = `rejected:${error.name}`;
          throw error;
        }
      );
    };
  }, !!options.blockAudio);
  const username = `qa_c_${name.slice(0, 8)}_${Date.now().toString(36)}`;
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
  const page = await context.newPage();
  const videoStart = Date.now();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  const posts = [];
  page.on('response', (response) => {
    if (response.url().endsWith('/complete') && response.request().method() === 'POST') {
      posts.push(response.status());
    }
  });
  return {
    browser,
    context,
    page,
    errors,
    posts,
    profile: profileOf(username),
    username,
    videoStart,
  };
}

/** Opens P1 on "Đến lượt em", as a student who did the first four parts. */
async function toChallenge(page, { sound = false } = {}) {
  await page.goto(`${BASE}/student/lessons/${P1}`);
  await page.getByTestId('interactive-lesson').waitFor();
  // Wait for the page to save its first "viewed" record, so it does not
  // write over the seeded progress.
  await page.waitForFunction(() =>
    Object.keys(localStorage).some((k) => k.startsWith('tutai:lesson-progress:'))
  );
  await page.waitForTimeout(500);
  await page.evaluate(
    ({ lesson, sound }) => {
      const key = Object.keys(localStorage).find((k) => k.startsWith('tutai:lesson-progress:'));
      const state = JSON.parse(localStorage.getItem(key));
      state.stages[lesson] = { reached: 4, total: 6, stageId: 'thu-suc', completedAt: null };
      state.outcomes = {
        [lesson]: {
          'bat-dau/doi-chieu': 'first-try',
          'kham-pha/du-doan': 'first-try',
          'kham-pha/quy-tac-duong': 'first-try',
          'kham-pha/quy-tac-am': 'with-help',
          'mo-rong/ket-luan': 'first-try',
          'vi-du/dao-ham': 'first-try',
          'vi-du/nghiem': 'first-try',
          'vi-du/dau': 'first-try',
          'vi-du/ket-luan': 'first-try',
        },
      };
      localStorage.setItem(key, JSON.stringify(state));
      localStorage.setItem('tutai:lesson-sound', sound ? 'on' : 'off');
    },
    { lesson: P1, sound }
  );
  await page.reload();
  await page.getByTestId('interactive-lesson').waitFor();
  // The server renders the first part; the saved part is restored on hydration.
  await page
    .waitForFunction(
      () =>
        document.querySelector('[data-testid="interactive-lesson"]')?.dataset.stageId === 'thu-suc',
      null,
      { timeout: 8000 }
    )
    .catch(() => {});
  const stage = await page.getByTestId('interactive-lesson').getAttribute('data-stage-id');
  if (stage !== 'thu-suc') {
    const dump = await page.evaluate(() => JSON.stringify(localStorage));
    throw new Error(`expected thu-suc, on ${stage}: ${dump.slice(0, 600)}`);
  }
}

const pick = (page, group, id) => page.getByTestId(group).getByTestId(`choice-${id}`).click();

async function solveChallenge(page) {
  await pick(page, 'choices-domain', 'r');
  await pick(page, 'choices-derivative', 'd0');
  for (const root of ['−1', '1']) await page.getByTestId(`root-${root}`).click();
  await page.getByTestId('check-roots').click();
  for (const [i, sign] of [-1, 1, -1].entries()) {
    const cell = page.getByTestId(`sign-${i}`);
    await cell.click();
    if (sign < 0) await cell.click();
  }
  await page.getByTestId('check-signs').click();
  for (const [i, piece] of ['down', 'up', 'down'].entries()) {
    await page.getByTestId(`conclude-${i}-${piece}`).click();
  }
  await page.getByTestId('check-conclusion').click();
  await page.waitForTimeout(400);
}

async function finish(page) {
  const mobile = (page.viewportSize()?.width ?? 1440) < 768;
  const button = page.getByTestId(mobile ? 'dock-continue' : 'stage-continue');
  for (let i = 0; i < 20 && (await button.isDisabled()); i += 1) await page.waitForTimeout(150);
  await button.click();
  await page.getByTestId('finish').waitFor();
}

const shot = async (page, file, full = false) => {
  await page.screenshot({ path: path.join(SHOTS, `${file}.png`), fullPage: full });
  return `screenshots/celebration/${file}.png`;
};

async function streakInfo(page) {
  const streak = page.getByTestId('streak');
  if (!(await streak.count())) return null;
  return {
    status: await streak.getAttribute('data-status'),
    current: await streak.getAttribute('data-current'),
    text: (await streak.innerText()).replace(/\s+/g, ' '),
  };
}

async function overflowX(page) {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
}

/** Pixels of the fireworks canvas that are not transparent, as a share. */
async function canvasInk(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('[data-testid="fireworks"]');
    if (!canvas) return null;
    const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    let ink = 0;
    for (let i = 3; i < data.length; i += 16) if (data[i] > 0) ink += 1;
    return Math.round((ink / (data.length / 16)) * 1000) / 10;
  });
}

// ─── scenarios ──────────────────────────────────────────────────────────────

/** 1–4: first completion, the fireworks, the streak rolling 2 → 3 (consecutive days). */
async function consecutive(size, { video = false } = {}) {
  const s = size;
  const { page, context, errors, posts, profile } = await open(`c${s[0]}`, size, { video });
  seedDays(profile, 2, 1); // learned the day before yesterday and yesterday
  await toChallenge(page);
  await solveChallenge(page);
  await shot(page, `${s}-0-before`);
  const log = { size, before: dbState(profile) };
  await finish(page);
  const t0 = Date.now();
  const frames = [
    [60, 'a-banner'],
    [750, 'b-fireworks-peak'],
    [1250, 'c-streak-rolling'],
    [4000, 'd-final'],
  ];
  log.ink = {};
  for (const [at, name] of frames) {
    await page.waitForTimeout(Math.max(0, at - (Date.now() - t0)));
    await shot(page, `${s}-${name}`);
    log.ink[name] = await canvasInk(page);
  }
  log.canvasGone = (await page.getByTestId('fireworks').count()) === 0;
  log.streak = await streakInfo(page);
  log.after = dbState(profile);
  log.overflow = await overflowX(page);
  log.posts = posts;
  // The controls under where the fireworks were are clickable again.
  await page.getByTestId('sound-toggle').click({ trial: true });
  log.controlsClickable = true;
  if (s === 'desktop') await shot(page, `${s}-e-final-full`, true);
  log.sounds = await page.evaluate(() => window.__sounds);
  log.errors = errors;
  await context.close();
  results[`consecutive-${size}`] = log;
}

/** First streak day ever (0 → 1), then reopen and refresh: nothing is awarded again. */
async function firstDayAndReopen() {
  const { page, errors, posts, profile } = await open('first', 'desktop');
  await toChallenge(page);
  await solveChallenge(page);
  await finish(page);
  await page.waitForTimeout(3600);
  const log = { first: await streakInfo(page), afterFirst: dbState(profile) };
  await shot(page, 'desktop-first-day');

  // 6. Reopen the completed lesson.
  await page.goto(`${BASE}/student/lessons/${P1}`);
  await page.getByTestId('finish').waitFor();
  await page.waitForTimeout(1500);
  log.reopen = {
    stage: await page.getByTestId('interactive-lesson').getAttribute('data-stage-id'),
    fireworks: await page.getByTestId('fireworks').count(),
    streak: await streakInfo(page),
    db: dbState(profile),
  };
  await shot(page, 'desktop-reopen');

  // "Xem lại hiệu ứng": visual only, no request.
  const before = posts.length;
  await page.getByTestId('replay-celebration').click();
  await page.waitForTimeout(700);
  log.replay = {
    fireworks: await page.getByTestId('fireworks').count(),
    ink: await canvasInk(page),
    newRequests: posts.length - before,
  };
  await shot(page, 'desktop-replay');
  await page.waitForTimeout(3200);
  log.replay.db = dbState(profile);
  log.replay.streak = await streakInfo(page);
  log.posts = posts;
  log.errors = errors;
  results.firstDayAndReopen = log;
}

/** 5: a second lesson the same day keeps the streak, no new day. */
async function sameDay() {
  const { page, errors, profile, context } = await open('same', 'mobile');
  // Another lesson finished earlier today, through the same API.
  const earlier = await context.request.post(`${BASE}/api/student/lessons/${OTHER}/complete`, {
    headers: { origin: BASE },
  });
  const log = { earlier: { status: earlier.status(), body: await earlier.json() } };
  await toChallenge(page);
  await solveChallenge(page);
  await finish(page);
  await page.waitForTimeout(3600);
  log.streak = await streakInfo(page);
  log.db = dbState(profile);
  await shot(page, 'mobile-same-day');
  log.errors = errors;
  results.sameDay = log;
}

/** 7: refresh right after finishing, while the request may be in flight. */
async function refresh() {
  const { page, errors, profile, posts } = await open('refresh', 'tablet');
  seedDays(profile, 1);
  await toChallenge(page);
  await solveChallenge(page);
  await finish(page);
  await page.waitForTimeout(150);
  await page.reload();
  await page.getByTestId('finish').waitFor();
  await page.waitForTimeout(1500);
  const log = {
    stage: await page.getByTestId('interactive-lesson').getAttribute('data-stage-id'),
    streak: await streakInfo(page),
    db: dbState(profile),
    posts,
    overflow: await overflowX(page),
  };
  await shot(page, 'tablet-after-refresh');
  // And once more, later.
  await page.reload();
  await page.getByTestId('finish').waitFor();
  await page.waitForTimeout(1200);
  log.again = { streak: await streakInfo(page), db: dbState(profile) };
  log.errors = errors;
  results.refresh = log;
}

/** 8: two tabs and a burst of duplicate requests at the same moment. */
async function concurrent() {
  const { context, profile } = await open('conc', 'desktop');
  const fire = () =>
    context.request
      .post(`${BASE}/api/student/lessons/${P1}/complete`, { headers: { origin: BASE } })
      .then(async (response) => (await response.json()).status);
  const statuses = await Promise.all(Array.from({ length: 8 }, fire));
  // Two tabs finishing two different lessons at the same time.
  const tabs = await Promise.all([
    fire(),
    context.request
      .post(`${BASE}/api/student/lessons/${OTHER}/complete`, { headers: { origin: BASE } })
      .then(async (response) => (await response.json()).status),
  ]);
  results.concurrent = { statuses, tabs, db: dbState(profile) };
}

/** 9–11: sound off, sound turned on by a click, playback blocked. */
async function sound() {
  const log = {};
  {
    const { page, context } = await open('soff', 'desktop');
    await toChallenge(page, { sound: false });
    await solveChallenge(page);
    await finish(page);
    await page.waitForTimeout(2500);
    log.off = {
      sounds: await page.evaluate(() => window.__sounds),
      toggle: await page.getByTestId('sound-toggle').innerText(),
    };
    await page.getByTestId('sound-toggle').scrollIntoViewIfNeeded();
    await shot(page, 'desktop-sound-off');
    // Turned on with a click: a preview plays, the setting is remembered.
    await page.getByTestId('sound-toggle').click();
    await page.waitForTimeout(600);
    log.turnedOn = {
      sounds: await page.evaluate(() => window.__sounds),
      toggle: await page.getByTestId('sound-toggle').innerText(),
      stored: await page.evaluate(() => localStorage.getItem('tutai:lesson-sound')),
      pressed: await page.getByTestId('sound-toggle').getAttribute('aria-pressed'),
    };
    await shot(page, 'desktop-sound-on');
    await page.reload();
    await page.getByTestId('finish').waitFor();
    log.afterReload = await page.getByTestId('sound-toggle').innerText();
    await context.close();
  }
  {
    // Sound on before finishing: the bells with the fireworks, the accent
    // with the new day; each once.
    const { page, context, profile } = await open('son', 'desktop');
    seedDays(profile, 1);
    await toChallenge(page, { sound: true });
    await solveChallenge(page);
    await finish(page);
    await page.waitForTimeout(3000);
    log.onAtFinish = {
      sounds: await page.evaluate(() => window.__sounds),
      streak: await streakInfo(page),
    };
    await context.close();
  }
  {
    const { page, context, errors } = await open('sblock', 'mobile', { blockAudio: true });
    await toChallenge(page, { sound: true });
    await solveChallenge(page);
    await finish(page);
    await page.waitForTimeout(3000);
    log.blocked = {
      sounds: await page.evaluate(() => window.__sounds),
      streak: await streakInfo(page),
      finishShown: await page.getByTestId('finish').isVisible(),
      errors,
    };
    await context.close();
  }
  results.sound = log;
}

/** 12: reduced motion: no fireworks, the final state at once. */
async function reducedMotion() {
  const { page, errors, profile } = await open('rm', 'mobile', { reducedMotion: true });
  seedDays(profile, 1);
  await toChallenge(page);
  await solveChallenge(page);
  await finish(page);
  await page.waitForTimeout(900);
  const log = {
    fireworks: await page.getByTestId('fireworks').count(),
    streak: await streakInfo(page),
    numberShown: await page.getByTestId('streak-number').innerText(),
    animations: await page.evaluate(() =>
      [...document.querySelectorAll('[data-testid="finish"] *')]
        .map((element) => getComputedStyle(element).animationName)
        .filter((name) => name && name !== 'none')
    ),
  };
  await shot(page, 'mobile-reduced-motion');
  log.errors = errors;
  results.reducedMotion = log;
}

/** On a failed or disabled streak request the lesson still completes, with no streak claimed. */
async function failures() {
  const log = {};
  for (const [name, reply] of [
    ['error', { status: 500, body: JSON.stringify({ status: 'error', error: 'x' }) }],
    ['disabled', { status: 200, body: JSON.stringify({ status: 'disabled' }) }],
    ['network', null],
  ]) {
    const { page, context } = await open(`f${name}`, 'mobile');
    await page.route('**/complete', (route) =>
      reply ? route.fulfill({ ...reply, contentType: 'application/json' }) : route.abort()
    );
    await toChallenge(page);
    await solveChallenge(page);
    await finish(page);
    await page.waitForTimeout(2000);
    log[name] = {
      finished: await page.getByTestId('finish').isVisible(),
      completedAt: await page.evaluate((lesson) => {
        const key = Object.keys(localStorage).find((k) => k.startsWith('tutai:lesson-progress:'));
        return JSON.parse(localStorage.getItem(key)).stages[lesson].completedAt;
      }, P1),
      streak: await streakInfo(page),
      error: await page
        .getByTestId('streak-error')
        .innerText()
        .catch(() => null),
    };
    if (name === 'error') await shot(page, 'mobile-streak-error');
    await context.close();
  }
  results.failures = log;
}

/**
 * The demo videos: no screenshots while recording, so nothing interrupts the
 * motion. Finish "Đến lượt em" on a third consecutive day, watch, then replay.
 * Trimmed afterwards to start 2 s before the last click.
 */
async function video(size) {
  const { page, context, profile, videoStart } = await open(`v${size[0]}`, size, { video: true });
  seedDays(profile, 2, 1);
  await toChallenge(page);
  await solveChallenge(page);
  await page.waitForTimeout(1500);
  const clickAt = Date.now();
  await finish(page);
  await page.waitForTimeout(4800);
  await page.getByTestId('replay-celebration').scrollIntoViewIfNeeded();
  await page.getByTestId('replay-celebration').click();
  await page.waitForTimeout(4500);
  const file = await page.video().path();
  await context.close();
  results[`video-${size}`] = {
    raw: path.relative(HERE, file),
    trimFrom: Math.max(0, (clickAt - videoStart) / 1000 - 2),
    streak: dbState(profile),
  };
}

/** Frame times during the fireworks on a phone-sized screen with the CPU slowed 4×. */
async function perf() {
  const { page, context } = await open('perf', 'mobile');
  await toChallenge(page);
  await solveChallenge(page);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.evaluate(() => {
    window.__frames = [];
    let last = performance.now();
    const tick = (now) => {
      window.__frames.push(now - last);
      last = now;
      if (window.__frames.length < 400) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await finish(page);
  await page.waitForTimeout(3800);
  const frames = await page.evaluate(() => window.__frames.slice(2));
  const sorted = [...frames].sort((a, b) => a - b);
  const at = (q) => Math.round(sorted[Math.floor(q * (sorted.length - 1))] * 10) / 10;
  results.perf = {
    cpu: '4x slower, 390×844 @2x',
    frames: frames.length,
    medianMs: at(0.5),
    p95Ms: at(0.95),
    maxMs: Math.round(sorted.at(-1) * 10) / 10,
    over50ms: frames.filter((value) => value > 50).length,
  };
  await context.close();
}

const plan = [
  ['perf', perf],
  ['video-desktop', () => video('desktop')],
  ['video-mobile', () => video('mobile')],
  ['consecutive-desktop', () => consecutive('desktop')],
  ['consecutive-mobile', () => consecutive('mobile')],
  ['consecutive-tablet', () => consecutive('tablet')],
  ['firstDayAndReopen', firstDayAndReopen],
  ['sameDay', sameDay],
  ['refresh', refresh],
  ['concurrent', concurrent],
  ['sound', sound],
  ['reducedMotion', reducedMotion],
  ['failures', failures],
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
  await Promise.all(browsers.splice(0).map((browser) => browser.close().catch(() => {})));
}
const file = path.join(
  HERE,
  ONLY.length ? `celebration-results-${ONLY.join('+')}.json` : 'celebration-results.json'
);
fs.writeFileSync(file, JSON.stringify(results, null, 1));
console.log('written', file);
process.exit(0);
