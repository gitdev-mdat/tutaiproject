import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
const require = createRequire('/opt/node22/lib/node_modules/');
export const { chromium } = require('playwright');
export const S = process.env.QA_DIR ?? new URL('.', import.meta.url).pathname.replace(/\/$/, '');
export const BASE = process.env.BASE ?? 'http://localhost:3301';
export const H = { 1440: 900, 768: 1024, 390: 844 };
export const P1 = 'knowledge-45c34e43-ad2e-47bf-8845-68782b67cfb9';
export const P2 = 'knowledge-c5e8afbc-1daf-44e2-9a27-ee73f05b33e6';
export const CH = 'knowledge-7e1ba6a6-70f4-46e3-aa9e-d3ba5bace5aa';
export const DOC = 'textbook-28823755f9b0448a';
const ADMIN = 'qa-admin@tutai.invalid', PASSWORD = 'Qa-textbook-2026!';
export const psql = (q) => execSync(`psql -At postgres://postgres:postgres@127.0.0.1:5432/tb_flow_e2e`, { input: q }).toString().trim();
export const qb = () => JSON.parse(psql(`select coalesce(body::text, '[]') from tutai.content_documents where key='question-bank/questions'`) || '[]');
export const worker = () => execSync(`cd ${S}/../../../.. && pnpm vitest run --config ${S}/vitest.e2e.config.ts worker 2>&1 | grep -E "^JOB" || true`).toString();
export const reset = () => execSync(`bash ${S}/reset.sh`, { stdio: 'inherit' });
export const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
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
  return account(context, ADMIN, 'qatextbookadm', PASSWORD, 'QA Admin');
}
export async function studentContext(browser, vp, tag = 's1', extra = {}) {
  const context = await browser.newContext({ viewport: { width: vp, height: H[vp] }, isMobile: vp < 500, hasTouch: vp < 500, ...extra });
  return account(context, `qa-student-${tag}@tutai.invalid`, `qastudent${tag}`, 'Qa-student-2026!', 'QA Học sinh');
}
