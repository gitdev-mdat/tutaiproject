// Creates one account per learner state on the local QA DBs and stores their sessions.
// Usage: node states.mjs   → writes /tmp/claude-0/pp/states.json and auth/<state>.json
import fs from 'node:fs';
import { chromium, SERVERS, api, newStudent, adminLogin, psql, wrong } from './lib.mjs';
const KEY = JSON.parse(fs.readFileSync('/tmp/claude-0/pp/pp_qa.key.json', 'utf8')).key;
const L1 = 'node-s0f2jitge', L2 = 'node-sg3wg6atb', L3 = 'node-gtln', C1 = 'node-nrm3k7taj';
fs.mkdirSync('/tmp/claude-0/pp/auth', { recursive: true });
const browser = await chromium.launch();
const out = {};

async function answerAttempt(call, view, correctIds) {
  let last;
  for (const q of view.questions) {
    const k = KEY[q.id];
    const resp = correctIds(q.id) ? k : wrong(k);
    last = await call('POST', `/api/student/practice/attempts/${view.attempt.id}/answers`, { questionId: q.id, response: resp });
    if (last.status !== 200) throw new Error(`answer ${last.status} ${last.text}`);
  }
  return last.body.attempt;
}
const firstN = (view, n) => { const ids = new Set(view.questions.slice(0, n).map((q) => q.id)); return (id) => ids.has(id); };
async function lessonAttempt(call, lesson, nCorrect) {
  const s = await call('POST', `/api/student/practice/lessons/${lesson}`, { mode: 'LESSON' });
  if (s.status !== 200) throw new Error(`start ${s.status} ${s.text}`);
  return answerAttempt(call, s.body, firstN(s.body, nCorrect));
}

async function make(name, db, setup) {
  const context = await browser.newContext();
  const base = SERVERS[db];
  const call = api(context, base);
  let username = null;
  if (name.startsWith('admin')) await adminLogin(context, db);
  else username = await newStudent(context, base, name.slice(0, 6));
  if (setup) await setup(call, username);
  await context.storageState({ path: `/tmp/claude-0/pp/auth/${name}.json` });
  out[name] = { db, username };
  await context.close();
  console.log('ok', name);
}

await make('new', 'pp_qa');
await make('inprogress', 'pp_qa', async (call) => {
  const s = await call('POST', `/api/student/practice/lessons/${L1}`, { mode: 'LESSON' });
  for (const q of s.body.questions.slice(0, 3)) await call('POST', `/api/student/practice/attempts/${s.body.attempt.id}/answers`, { questionId: q.id, response: KEY[q.id] });
});
// The owner's screenshot: 10 questions, best 2/10, then a retry of the 8 missed with 2 right → "Sửa 6 câu sai".
await make('mistakes', 'pp_qa', async (call) => {
  const a = await lessonAttempt(call, L1, 2);
  const m = await call('POST', `/api/student/practice/lessons/${L1}`, { mode: 'MISTAKES', fromAttemptId: a.id });
  await answerAttempt(call, m.body, firstN(m.body, 2));
});
// Retry of missed questions scored ≥ 80 % (7/8) though the lesson is not passed.
await make('mistakes80', 'pp_qa', async (call) => {
  const a = await lessonAttempt(call, L1, 2);
  const m = await call('POST', `/api/student/practice/lessons/${L1}`, { mode: 'MISTAKES', fromAttemptId: a.id });
  await answerAttempt(call, m.body, firstN(m.body, 7));
});
await make('notpassed', 'pp_qa', async (call) => { await lessonAttempt(call, L1, 6); await lessonAttempt(call, L2, 3); });
await make('mastered', 'pp_qa', async (call) => { await lessonAttempt(call, L1, 4); await lessonAttempt(call, L1, 9); await lessonAttempt(call, L2, 5); });
await make('plus', 'pp_qa', async (call, username) => {
  const id = psql('pp_qa', `select p.id from tutai.student_profiles p join tutai.users u on u.id = p.user_id where u.username = '${username}'`);
  const subs = JSON.parse(fs.readFileSync('/tmp/claude-0/pp/subs.json', 'utf8'));
  subs.push({ userId: id, startsAt: '2026-01-01T00:00:00.000Z', endsAt: '2027-12-31T00:00:00.000Z', status: 'ACTIVE', updatedAt: '2026-01-01T00:00:00.000Z' });
  fs.writeFileSync('/tmp/claude-0/pp/subs.json', JSON.stringify(subs, null, 2));
  await lessonAttempt(call, L1, 8);
});
await make('admin', 'pp_qa', async (call) => {
  const s = await call('POST', `/api/student/practice/lessons/${L1}`, { mode: 'LESSON' });
  await answerAttempt(call, s.body, firstN(s.body, 2));
});
await make('empty', 'pp_empty');
fs.writeFileSync('/tmp/claude-0/pp/states.json', JSON.stringify(out, null, 1));
await browser.close();
