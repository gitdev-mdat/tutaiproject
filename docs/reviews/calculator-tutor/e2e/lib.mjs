import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
const require = createRequire('/opt/node22/lib/node_modules/');
export const { chromium } = require('playwright');
export const S = process.env.QA_DIR ?? new URL('.', import.meta.url).pathname.replace(/\/$/, '');
export const BASE = process.env.BASE ?? 'http://localhost:3302';
export const H = { 1440: 900, 768: 1024, 390: 844 };
export const P1 = 'knowledge-45c34e43-ad2e-47bf-8845-68782b67cfb9';
export const Q1 = 'q-b48ea52f-2c80-41f8-9740-852bbad40ed5';
const DB = 'postgres://postgres:postgres@127.0.0.1:5432/calc_tutor_e2e';
export const psql = (q) => execSync(`psql -At ${DB}`, { input: q }).toString().trim();
export const reset = () => execSync(`bash ${S}/reset.sh`, { stdio: 'inherit' });
export const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const ADMIN = 'qa-admin@tutai.invalid';
async function account(context, email, username, password, name) {
  if (psql(`select count(*) from tutai.users where email='${email}'`) === '0') {
    const r = await context.request.post(`${BASE}/api/auth/register`, { headers: { origin: BASE }, data: { username, email, password, fullName: name, phone: '0912345679' } });
    if (!r.ok()) throw new Error(`register ${r.status()} ${await r.text()}`);
  }
  psql(`update tutai.users set email_verified_at = coalesce(email_verified_at, now()) where email='${email}'`);
  const login = await context.request.post(`${BASE}/api/auth/login`, { headers: { origin: BASE }, data: { identifier: email, password } });
  if (!login.ok()) throw new Error(`login ${login.status()} ${await login.text()}`);
  await context.request.post(`${BASE}/api/onboarding`, { headers: { origin: BASE }, data: { fullName: name, grade: '12', provinceCode: '01', primarySubject: 'MATH', currentScore: 6, targetScore: 8, acquisitionSource: 'Google' } });
  return context;
}
export async function adminContext(browser, vp, extra = {}) {
  const context = await browser.newContext({ viewport: { width: vp, height: H[vp] }, ...extra });
  return account(context, ADMIN, 'qacalcadmin', 'Qa-calc-admin-2026!', 'QA Admin');
}
export async function studentContext(browser, vp, tag = 's1', extra = {}) {
  const context = await browser.newContext({ viewport: { width: vp, height: H[vp] }, isMobile: vp < 500, hasTouch: vp < 500, ...extra });
  return account(context, `qa-calc-${tag}@tutai.invalid`, `qacalc${tag}`, 'Qa-student-2026!', 'QA Học sinh');
}
/** Student answers Câu 1 with `choice` in a new lesson practice attempt and waits for feedback. */
export async function answerQ1(page, choice = 'D') {
  await page.goto(`${BASE}/student/lessons/${P1}/practice`);
  await page.getByTestId('practice-intro').waitFor();
  await page.getByTestId('practice-begin').click();
  await page.getByTestId('practice-question').waitFor();
  const stem = await page.getByTestId('practice-question').innerText();
  if (!/ln/.test(stem)) throw new Error(`first question is not Câu 1: ${stem.slice(0, 80)}`);
  await page.getByTestId(`choice-${choice}`).click();
  await page.getByTestId('practice-check').click();
  await page.getByTestId('feedback').waitFor();
}
