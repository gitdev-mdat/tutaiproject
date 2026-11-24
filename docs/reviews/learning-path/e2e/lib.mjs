import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
const require = createRequire('/opt/node22/lib/node_modules/');
export const { chromium } = require('playwright');
export const H = { 1440: 900, 768: 1024, 390: 844 };
export const SERVERS = { pp_qa: 'http://localhost:3401', pp_empty: 'http://localhost:3402', pp_scale: 'http://localhost:3403' , pp_one: 'http://localhost:3404' , pp_path: 'http://localhost:3405' };
export const ADMIN = 'qa-admin@tutai.invalid';
export const PASSWORD = 'Qa-practice-2026!';
export const psql = (db, q) => execSync(`psql -At postgres://postgres:postgres@127.0.0.1:5432/${db} -c "${q.replace(/"/g, '\\"')}"`).toString().trim();
export const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
export const onboardingBody = (over = {}) => ({ fullName: 'Nguyễn Minh', grade: '12', provinceCode: '01', primarySubject: 'MATH', currentScore: 6, targetScore: 8, acquisitionSource: 'Google', ...over });
export function api(context, base) {
  return async (method, path, data) => {
    const r = await context.request.fetch(base + path, { method, headers: { origin: base, 'content-type': 'application/json' }, data: data === undefined ? undefined : JSON.stringify(data) });
    let body = null; try { body = await r.json(); } catch {}
    return { status: r.status(), body, text: JSON.stringify(body) };
  };
}
export async function newStudent(context, base, tag) {
  const username = `qpp_${tag}_${Date.now().toString(36).slice(-5)}${Math.random().toString(36).slice(2, 5)}`.slice(0, 24);
  let r = await context.request.post(`${base}/api/auth/register`, { headers: { origin: base }, data: { username, email: `${username}@tutai.invalid`, password: PASSWORD, fullName: 'Nguyễn Minh', phone: '0912345678' } });
  if (!r.ok()) throw new Error(`register ${r.status()} ${await r.text()}`);
  r = await context.request.post(`${base}/api/onboarding`, { headers: { origin: base }, data: onboardingBody() });
  if (!r.ok()) throw new Error(`onboarding ${r.status()} ${await r.text()}`);
  return username;
}
export async function adminLogin(context, db) {
  const base = SERVERS[db];
  if (psql(db, `select count(*) from tutai.users where email='${ADMIN}'`) === '0') {
    const r = await context.request.post(`${base}/api/auth/register`, { headers: { origin: base }, data: { username: `qppadm${Date.now().toString(36).slice(-6)}`, email: ADMIN, password: PASSWORD, fullName: 'QA Admin', phone: '0912345679' } });
    if (!r.ok()) throw new Error(`admin register ${r.status()} ${await r.text()}`);
  }
  psql(db, `update tutai.users set email_verified_at = coalesce(email_verified_at, now()) where email='${ADMIN}'`);
  const login = await context.request.post(`${base}/api/auth/login`, { headers: { origin: base }, data: { identifier: ADMIN, password: PASSWORD } });
  if (!login.ok()) throw new Error(`admin login ${login.status()} ${await login.text()}`);
  await context.request.post(`${base}/api/onboarding`, { headers: { origin: base }, data: onboardingBody({ fullName: 'QA Admin' }) });
}
export const wrong = (r) => (r.choice ? { choice: r.choice === 'A' ? 'B' : 'A' } : r.statements
  ? { statements: Object.fromEntries(Object.entries(r.statements).map(([k, v]) => [k, !v])) }
  : r.value !== undefined ? { value: '999' } : r);
