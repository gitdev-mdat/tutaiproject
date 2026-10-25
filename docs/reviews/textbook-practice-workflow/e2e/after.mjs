// AFTER (feature/textbook-practice-e2e-ux): the full Admin -> Student journey on the isolated QA stack.
// Usage: BASE=http://localhost:3302 VP=1440 node after.mjs   (VP 1440 runs every scenario; 768/390 the visual ones)
import fs from 'node:fs';
import { chromium, BASE, P1, P2, CH, adminContext, studentContext, worker, reset, qb, psql, overflow, S } from './lib.mjs';

const VP = Number(process.env.VP ?? 1440);
const FULL = VP === 1440;
const OUT = `${S}/after-${VP}`;
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(`${OUT}/shots`, { recursive: true });
fs.mkdirSync(`${OUT}/video`, { recursive: true });
const results = [];
const check = (id, name, ok, info = '') => {
  results.push({ id, name, ok: !!ok, info: String(info).slice(0, 500) });
  console.log(`${ok ? 'PASS' : 'FAIL'} [${id}] ${name}${info ? ' · ' + String(info).slice(0, 220) : ''}`);
};
const errors = [];
const exId = (n) => psql(`select id from tutai.textbook_artifacts where payload->>'kind'='EXERCISE' and payload->>'questionNumber'='${n}'`);
const audits = () => JSON.parse(psql(`select coalesce(body::text, '[]') from tutai.content_documents where key='question-bank/audits'`) || '[]');

reset();
const browser = await chromium.launch();
const admin = await adminContext(browser, VP, { recordVideo: { dir: `${OUT}/video`, size: { width: VP, height: VP === 390 ? 844 : VP === 768 ? 1024 : 900 } } });
const page = await admin.newPage();
page.on('pageerror', (e) => errors.push(`admin: ${e.message}`));
const shot = (n, full = false) => page.screenshot({ path: `${OUT}/shots/admin-${n}.png`, fullPage: full });
const ws = `${BASE}/admin/practice/${P1}/textbook`;
const row = (n) => page.locator(`[data-testid="exercise-row"][data-number="${n}"]`);
const detail = () => page.getByTestId('exercise-detail');
const open = async (n) => { await row(n).getByRole('button').click(); await detail().waitFor(); await page.waitForTimeout(400); };
const back = async () => { if (VP < 1024) { await page.getByRole('button', { name: 'Danh sách câu' }).click(); await page.waitForTimeout(300); } };
const post = (data) => admin.request.post(`${BASE}/api/admin/textbooks/practice`, { headers: { origin: BASE }, data });

// ── 1-2. Answer key extraction and matching ────────────────────────────────
await page.goto(ws);
await page.getByTestId('practice-stages').waitFor();
await page.waitForTimeout(600);
await shot('01-workspace-before-solutions', FULL);
await page.getByTestId('solution-sources').getByTestId('extract-solutions').first().click();
await page.waitForTimeout(1200);
const jobs = worker();
await page.reload();
await page.getByTestId('practice-stages').waitFor();
await page.waitForTimeout(800);
const stagesText = (await page.getByTestId('practice-stages').innerText()).replace(/\n/g, ' | ');
check('S1', 'Answer key pages 29–31 extracted (recorded Gemini output) and shown as a 3-stage overview', /COMPLETED/.test(jobs) && /3\/22 câu có đáp án/.test(stagesText), `${jobs.trim()} · ${stagesText}`);
await shot('02-overview-after-answer-key', FULL);

// Legacy state from the owner's screenshot: two questions imported with "Cần xem xét" and sent to review (old flow, via its API).
if (FULL) {
  await post({ action: 'import', lessonId: P1, exerciseIds: [exId('3'), exId('5')], rightsStatus: 'REVIEW_REQUIRED' });
  for (const q of qb()) await admin.request.patch(`${BASE}/api/question-bank/${q.id}`, { headers: { origin: BASE }, data: { editorialStatus: 'IN_REVIEW' } });
  await page.goto(`${BASE}/admin/practice/${P1}`);
  await page.getByTestId('bulk-review').waitFor();
  const card = page.locator('[data-testid="practice-question"][data-state="IN_REVIEW"]').first();
  const disabled = await card.getByTestId('action-publish').isDisabled();
  const why = await card.getByTestId('publish-blockers').innerText().catch(() => '');
  await card.scrollIntoViewIfNeeded();
  await shot('03-lesson-in-review-rights-blocked');
  check('C1', 'Lesson practice: an in-review question with rights "Cần xem xét" shows why it cannot be published; the button is disabled', disabled && /quyền sử dụng/.test(why) && /Bài tập từ sách/.test(why), why.replace(/\n/g, ' | '));
  await page.goto(ws);
  await page.getByTestId('practice-stages').waitFor();
  await page.waitForTimeout(600);
}

await open('1');
const cand = await detail().getByTestId('candidate').first().innerText();
await shot('04-cau1-answer-key-match', FULL);
await detail().getByTestId('confirm-candidate').first().click();
await detail().getByTestId('verified').waitFor();
const v1 = await detail().getByTestId('verified').innerText();
check('S2', 'Câu 1 matched to its printed solution (evidence shown), Admin confirms: answer D from p. 29', /Khớp|Cần đối chiếu/.test(cand) && /Đáp án D/.test(v1) && /tr\. 29/.test(v1), v1.split('\n')[0]);
await back();

// ── 3. Missing / mismatched answer ─────────────────────────────────────────
await open('8');
await detail().getByTestId('other-solution').selectOption({ label: 'Câu 2 · tr. 29' }).catch(async () => {
  const labels = await detail().getByTestId('other-solution').locator('option').allInnerTexts();
  await detail().getByTestId('other-solution').selectOption({ label: labels.find((l) => /^Câu \d/.test(l)) });
});
await detail().getByTestId('use-other-solution').click();
await detail().getByTestId('acknowledge-conflicts').waitFor();
const conflicts = await detail().getByTestId('acknowledge-conflicts').innerText();
await shot('05-cau8-mismatch-refused', FULL);
await detail().getByTestId('acknowledge-conflicts').getByRole('button', { name: 'Hủy' }).click();
const blockers8 = await detail().getByTestId('blockers').innerText();
const v8 = psql(`select coalesce(payload->'practice'->'verification'->>'method','none') from tutai.textbook_artifacts where id='${exId('8')}'`);
check('S3', 'Mismatch detected: another question’s solution for Câu 8 is refused with its conflicts; Câu 8 stays without answer and cannot be published', /Khác số câu/.test(conflicts) && v8 === 'none' && /Chưa xác nhận đáp án/.test(blockers8), conflicts.replace(/\n/g, ' | '));
await back();
await page.getByTestId('filter-MISSING').click();
const missing = await page.getByTestId('exercise-row').count();
check('S3b', 'Missing answers are listed on their own ("Chưa có đáp án")', missing >= 14, `${missing} rows`);
await shot('06-filter-missing-answers');
await page.getByTestId('filter-ALL').click();

// ── 4-6. Classification: lesson, chapter, fixing a wrong mapping ───────────
await open('2');
await detail().getByTestId('confirm-candidate').first().click();
await detail().getByTestId('verified').waitFor();
await detail().getByTestId('exercise-lesson').selectOption(P2);
await page.waitForTimeout(1200);
const wrong = psql(`select payload->'practice'->'lesson'->>'lessonId' from tutai.textbook_artifacts where id='${exId('2')}'`);
await detail().getByTestId('exercise-lesson').selectOption(P1);
await page.waitForTimeout(1200);
const fixed = psql(`select payload->'practice'->'lesson'->>'lessonId' from tutai.textbook_artifacts where id='${exId('2')}'`);
const dest2 = await detail().getByTestId('destination').innerText();
check('S4', 'Câu 2 assigned to lesson P1 (subject Toán, grade 12, chapter inherited on publish)', fixed === P1 && /Luyện tập sau bài “Tính đơn điệu của hàm số \(P1\)”/.test(dest2), dest2.replace(/\n/g, ' | '));
check('S6', 'A wrong mapping (Câu 2 → P2) is corrected back to P1 before publishing', wrong === P2 && fixed === P1, `${wrong} → ${fixed}`);
await shot('07-classification-lesson', FULL);
await back();
await open('6');
await detail().getByTestId('exercise-lesson').selectOption(CH);
await page.waitForTimeout(1200);
const dest6 = await detail().getByTestId('destination').innerText();
check('S5', 'Câu 6 placed on the chapter itself: only in "Ôn chương"', /Ôn chương “ỨNG DỤNG ĐẠO HÀM/.test(dest6) && psql(`select payload->'practice'->'lesson'->>'lessonId' from tutai.textbook_artifacts where id='${exId('6')}'`) === CH, dest6.replace(/\n/g, ' | '));
await shot('08-classification-chapter', FULL);
// Preview as a student, before publishing
await detail().getByTestId('exercise-student-preview').click();
await page.getByTestId('student-preview').waitFor();
await page.getByTestId('student-preview').getByTestId('choice-A').click();
await page.getByTestId('preview-submit').click();
await page.getByTestId('student-preview').getByTestId('feedback').waitFor();
await shot('09-preview-as-student');
await page.getByRole('button', { name: 'Đóng xem trước' }).click();
await back();
await open('7');
const b7 = await detail().getByTestId('blockers').innerText().catch(() => '');
await shot('10-cau7-content-issue', FULL);
check('S3c', 'Content issue explained in place (Câu 7: the book prints only the answer letter, or its pairing is unconfirmed)', /lời giải|Chưa xác nhận đáp án/.test(b7), b7.replace(/\n/g, ' | '));
await back();

// ── 8. Unsafe publication refused ──────────────────────────────────────────
const r1 = await post({ action: 'publish', lessonId: P1, exerciseIds: [exId('1')], rightsStatus: 'REVIEW_REQUIRED', attested: true });
const r2 = await post({ action: 'publish', lessonId: P1, exerciseIds: [exId('1')], rightsStatus: 'LICENSED', attested: false });
const r3 = (await (await post({ action: 'publish', lessonId: P1, exerciseIds: [exId('3'), exId('8')], rightsStatus: 'LICENSED', attested: true, dryRun: true })).json()).outcomes;
check('S8', 'Unresolved rights and unattested rights are refused by the server (422); nothing published', r1.status() === 422 && r2.status() === 422 && qb().every((q) => q.editorialStatus !== 'PUBLISHED'), `${r1.status()} ${(await r1.json()).error} / ${r2.status()} ${(await r2.json()).error}`);
check('S8b', 'A mixed batch: the dry run publishes Câu 3 and holds Câu 8 with its reason', r3.find((o) => o.questionNumber === '3')?.result === 'PUBLISHED' && r3.find((o) => o.questionNumber === '8')?.result === 'BLOCKED', JSON.stringify(r3.map((o) => [o.questionNumber, o.result, o.reasons[0] ?? ''])));

// ── 7, 9. Bulk publication of the eligible questions ───────────────────────
await page.getByTestId('filter-READY').click();
const readyRows = await page.locator('[data-testid="exercise-row"][data-stage="READY"]').count();
await page.getByTestId('select-all-ready').click();
await page.getByTestId('publish-open').click();
await page.getByTestId('publish-destinations').waitFor();
await page.waitForTimeout(400);
await page.getByTestId('publish-rights-status').selectOption('REVIEW_REQUIRED');
const hold = await page.getByTestId('rights-hold').innerText();
const disabledWhenUnclear = await page.getByTestId('publish-confirm').isDisabled();
await shot('11-publish-rights-unclear');
check('S8c', 'Choosing "Chưa rõ" keeps publishing disabled and offers saving drafts only', disabledWhenUnclear && /chưa xuất bản được/.test(hold) && (await page.getByTestId('publish-save-drafts').isVisible()), hold);
await page.getByTestId('publish-rights-status').selectOption('LICENSED');
await page.getByTestId('publish-rights-attest').check();
await page.getByTestId('publish-show-questions').click();
const destText = await page.getByTestId('publish-destinations').innerText();
const label = await page.getByTestId('publish-confirm').innerText();
await shot('12-publish-summary', true);
check('S9a', 'Pre-publication summary: 4 questions → lesson P1, 1 → the chapter, rights attested, answers listed', /4 câu → Bài “Tính đơn điệu của hàm số \(P1\)”/.test(destText) && /1 câu → Cả chương/.test(destText) && /Xuất bản 5 câu/.test(label), `${readyRows} ready · ${label} · ${destText.split('\n').slice(0, 4).join(' | ')}`);
await page.getByTestId('publish-confirm').click();
await page.getByTestId('publish-result').waitFor();
await page.waitForTimeout(600);
const resultText = await page.getByTestId('publish-result').innerText();
await shot('13-publish-success');
const published = qb().filter((q) => q.editorialStatus === 'PUBLISHED');
check('S7', 'Eligible questions published: 5 in the bank, OPEN + OPEN_PRACTICE, rights "Có giấy phép", hierarchy set', published.length === 5 && published.every((q) => q.accessTier === 'OPEN' && q.usageContexts.includes('OPEN_PRACTICE') && q.source.rightsStatus === 'LICENSED' && q.chapterId === CH && q.subjectId === 'MATH' && q.grade === 12), published.map((q) => `${q.textbookSource.questionNumber}:${q.primaryKnowledgeNodeId === CH ? 'chapter' : q.primaryKnowledgeNodeId === P1 ? 'P1' : '?'}`).join(' '));
check('S9', 'Bulk publication confirmed: "4 câu hỏi đã được xuất bản vào bài …" and "1 câu … Ôn chương", with "Xem như học sinh"', /4 câu hỏi đã được xuất bản vào bài “Tính đơn điệu của hàm số \(P1\)”/.test(resultText) && /1 câu hỏi đã được xuất bản vào Ôn chương/.test(resultText) && (await page.getByTestId('view-as-student').count()) === 2, resultText.replace(/\n/g, ' | '));
const legacy = published.filter((q) => ['3', '5'].includes(q.textbookSource.questionNumber));
const acts = audits().filter((a) => legacy.some((q) => q.id === a.questionId)).map((a) => a.action);
if (FULL) check('C2', 'The two questions from the screenshot (in review, "Cần xem xét") were published in place: same ids, rights change audited', legacy.length === 2 && acts.filter((a) => a === 'SOURCE_RIGHTS_CHANGED').length === 2 && acts.filter((a) => a === 'PUBLISHED').length === 2, acts.join(','));
await page.getByTestId('publish-close').click();
await page.getByTestId('filter-PUBLISHED').click();
await page.waitForTimeout(500);
await shot('14-published-filter', FULL);

// ── 16. Deduplication and status filtering ─────────────────────────────────
const again = (await (await post({ action: 'publish', lessonId: P1, exerciseIds: [exId('3'), exId('6')], rightsStatus: 'LICENSED', attested: false })).json()).outcomes;
const ext = qb().map((q) => q.externalId);
check('S16', 'Publishing again creates nothing: ALREADY_PUBLISHED, one bank question per exercise, rights already known for this book', again.every((o) => o.result === 'ALREADY_PUBLISHED') && new Set(ext).size === ext.length && qb().length === 5, JSON.stringify(again.map((o) => o.result)));

// Role permissions
const student0 = await studentContext(browser, VP, `role${VP}`);
const denied = await student0.request.post(`${BASE}/api/admin/textbooks/practice`, { headers: { origin: BASE }, data: { action: 'publish', lessonId: P1, exerciseIds: [exId('9')], rightsStatus: 'LICENSED', attested: true } });
const deniedPatch = await student0.request.patch(`${BASE}/api/question-bank/${published[0].id}`, { headers: { origin: BASE }, data: { editorialStatus: 'ARCHIVED' } });
const deniedRead = await student0.request.get(`${BASE}/api/question-bank/${published[0].id}`);
check('R1', 'A student cannot use Admin publishing APIs (publish, PATCH, read a bank question with its answer)', [denied.status(), deniedPatch.status(), deniedRead.status()].every((s) => s === 401 || s === 403), `${denied.status()} ${deniedPatch.status()} ${deniedRead.status()}`);
await student0.close();
await page.close();
await admin.close();

// ── Student ────────────────────────────────────────────────────────────────
const svp = VP;
const student = await studentContext(browser, svp, `s${VP}`, { recordVideo: { dir: `${OUT}/video`, size: { width: svp, height: VP === 390 ? 844 : VP === 768 ? 1024 : 900 } } });
const sp = await student.newPage();
sp.on('pageerror', (e) => errors.push(`student: ${e.message}`));
const sshot = (n, full = false) => sp.screenshot({ path: `${OUT}/shots/student-${n}.png`, fullPage: full });
const streak0 = psql(`select count(*) from tutai.lesson_completions`) + '/' + psql(`select count(*) from tutai.learning_days`);

await sp.goto(`${BASE}/student/lessons/${P1}`);
await sp.getByTestId('interactive-lesson').waitFor({ timeout: 20000 });
await sp.waitForTimeout(1500);
check('S17', 'Interactive Math P1 still renders for P1', await sp.getByTestId('interactive-lesson').isVisible(), '');
await sshot('01-lesson-interactive');
await sp.goto(`${BASE}/student/lessons/${P1}/practice`);
await sp.getByTestId('practice-intro').waitFor();
const intro = await sp.getByTestId('practice-intro').innerText();
check('S10', 'Student sees the published lesson practice: 4 questions for P1', /4 câu/.test(intro), intro.replace(/\n/g, ' | '));
await sshot('02-practice-intro');
await sp.getByTestId('practice-begin').click();
await sp.getByTestId('practice-question').waitFor();
await sp.waitForTimeout(500);
const attemptId = new URL(sp.url()).searchParams.get('attempt');
const view = await (await student.request.get(`${BASE}/api/student/practice/attempts/${attemptId}`)).json();
const bank = Object.fromEntries(qb().map((q) => [q.id, q]));
const leaks = JSON.stringify(view.questions).match(/correctAnswer|explanation|"isTrue"/g);
check('S18', 'Unanswered questions reach the student without answer or explanation', !leaks && Object.keys(view.feedback).length === 0 && view.questions.length === 4, `keys: ${Object.keys(view.questions[0]).join(',')}`);
const canonical = view.questions.every((q) => bank[q.id] && bank[q.id].stem === q.stem && JSON.stringify(bank[q.id].options.map((o) => [o.key, o.content])) === JSON.stringify(q.options.map((o) => [o.key, o.content])));
check('C3', 'Every question shown is the same canonical bank question the Admin published (id, stem, options)', canonical, view.questions.map((q) => bank[q.id]?.code).join(' '));
await sshot('03-question');
const answer = (i) => bank[view.questions[i].id].correctAnswer;
const wrongOf = (i) => ['A', 'B', 'C', 'D'].find((k) => k !== answer(i));
// Q1 correct
await sp.getByTestId(`choice-${answer(0)}`).click();
await sshot('04-selected');
await sp.getByTestId('practice-check').click();
await sp.getByTestId('feedback').waitFor();
await sp.waitForTimeout(1200);
check('S11', 'Correct answer: graded on the server, "Chính xác!" with the solution', (await sp.getByTestId('feedback').getAttribute('data-correct')) === 'true', (await sp.getByTestId('feedback').innerText()).split('\n')[0]);
await sshot('05-correct-feedback', true);
await sp.getByTestId('practice-next').click();
await sp.waitForTimeout(500);
// Q2 wrong
await sp.getByTestId(`choice-${wrongOf(1)}`).click();
await sp.getByTestId('practice-check').click();
await sp.getByTestId('feedback').waitFor();
await sp.waitForTimeout(1500);
const fb = await sp.getByTestId('feedback').innerText();
check('S12', 'Wrong answer: states the student’s choice and the right one, then the worked solution step by step', (await sp.getByTestId('feedback').getAttribute('data-correct')) === 'false' && /Em chọn/.test(fb) && /Đáp án đúng/.test(fb) && (await sp.getByTestId('solution-steps').count()) === 1, fb.replace(/\n/g, ' | ').slice(0, 200));
await sp.getByTestId('feedback').scrollIntoViewIfNeeded();
await sshot('06-wrong-feedback-solution');
await sshot('06b-wrong-feedback-full', true);
// 13. Leave and return
await sp.goto(`${BASE}/student/lessons`);
await sp.waitForTimeout(800);
await sp.goto(`${BASE}/student/lessons/${P1}/practice`);
await sp.getByTestId('practice-intro').waitFor();
const resumeText = await sp.getByTestId('practice-resume').innerText().catch(() => '');
await sshot('07-return-resume');
await sp.getByTestId('practice-resume').click();
await sp.getByTestId('practice-question').waitFor();
await sp.waitForTimeout(500);
const progressLabel = await sp.getByTestId('progress-label').innerText();
check('S13', 'Leaving and returning offers "Làm tiếp (2/4)" and resumes at question 3 with answers kept', /Làm tiếp \(2\/4\)/.test(resumeText) && progressLabel === '3/4' && new URL(sp.url()).searchParams.get('attempt') === attemptId, `${resumeText} · ${progressLabel}`);
for (const i of [2, 3]) {
  await sp.getByTestId(`choice-${answer(i)}`).click();
  await sp.getByTestId('practice-check').click();
  await sp.getByTestId('feedback').waitFor();
  await sp.waitForTimeout(400);
  await sp.getByTestId('practice-next').click();
  await sp.waitForTimeout(600);
}
await sp.getByTestId('results').waitFor();
await sp.waitForTimeout(800);
const score = await sp.getByTestId('score').innerText();
await sshot('08-completion', true);
const row1 = psql(`select status||' '||correct_count||'/'||total_count from tutai.practice_attempts where id='${attemptId}'`);
check('S15', 'Result saved: attempt COMPLETED 3/4 in practice_attempts, shown as 3/4', score === '3/4' && row1 === 'COMPLETED 3/4', `${score} · ${row1}`);
// 14. Retry the missed question, then the whole set
await sp.getByTestId('retry-mistakes').click();
await sp.getByTestId('practice-question').waitFor();
await sp.waitForTimeout(400);
const mistakesId = new URL(sp.url()).searchParams.get('attempt');
const mview = await (await student.request.get(`${BASE}/api/student/practice/attempts/${mistakesId}`)).json();
await sp.getByTestId(`choice-${bank[mview.questions[0].id].correctAnswer}`).click();
await sp.getByTestId('practice-check').click();
await sp.getByTestId('feedback').waitFor();
await sp.getByTestId('practice-next').click();
await sp.getByTestId('results').waitFor();
await sp.waitForTimeout(600);
await sshot('09-retry-mistakes-done');
const mrow = psql(`select mode||' '||status||' '||correct_count||'/'||total_count from tutai.practice_attempts where id='${mistakesId}'`);
const firstKept = psql(`select status||' '||correct_count||'/'||total_count from tutai.practice_attempts where id='${attemptId}'`);
const streak1 = psql(`select count(*) from tutai.lesson_completions`) + '/' + psql(`select count(*) from tutai.learning_days`);
check('S14', 'Retry of the missed question saved as its own MISTAKES attempt; the first attempt is unchanged; no streak or celebration is awarded by practice retries', mrow === 'MISTAKES COMPLETED 1/1' && firstKept === 'COMPLETED 3/4' && streak0 === streak1, `${mrow} · first ${firstKept} · streak rows ${streak0} → ${streak1}`);
await sp.goto(`${BASE}/student/lessons/${P1}/practice`);
await sp.getByTestId('practice-intro').waitFor();
const hist = await sp.getByTestId('practice-history').innerText().catch(() => '');
await sshot('10-intro-with-history');
check('S15b', 'Practice history shown on return: best result and completed attempts', /3\/4/.test(hist), hist);

// Chapter-level practice
await sp.goto(`${BASE}/student/practice`);
await sp.waitForTimeout(1500);
await sshot('11-practice-catalog', true);
await sp.goto(`${BASE}/student/practice/chapter/${CH}`);
await sp.waitForTimeout(1500);
await sshot('12-chapter-intro');
const startBtn = sp.getByRole('button', { name: /Bắt đầu|Làm bài|Luyện/ }).first();
await startBtn.click();
await sp.waitForTimeout(1500);
const chAttempt = psql(`select id||' '||array_length(question_ids,1) from tutai.practice_attempts where mode='CHAPTER' order by started_at desc limit 1`);
const [chId, chCount] = chAttempt.split(' ');
const chIds = psql(`select array_to_string(question_ids, ',') from tutai.practice_attempts where id='${chId}'`).split(',');
const chapterQ = qb().find((q) => q.primaryKnowledgeNodeId === CH);
check('S5b', 'Chapter-level practice ("Ôn chương") includes the chapter-level question and the lesson questions', Number(chCount) === 5 && chIds.includes(chapterQ.id), `${chCount} questions, chapter-level ${chapterQ.code} included=${chIds.includes(chapterQ.id)}`);
await sshot('13-chapter-question');

if (FULL) {
  check('E', 'No page errors in the browser', errors.length === 0, errors.join(' | '));
}
const ofl = await overflow(sp);
check('O', `No horizontal overflow at ${VP}px (student)`, ofl <= 0, `${ofl}px`);
await sp.close();
await student.close();
await browser.close();
fs.writeFileSync(`${OUT}/results.json`, JSON.stringify({ viewport: VP, base: BASE, at: new Date().toISOString(), results, errors }, null, 2));
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} passed at ${VP}px`);
