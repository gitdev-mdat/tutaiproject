# Textbook exercises → student practice: audit and redesign (Mathematics)

**Lesson used end to end:** Toán 12 · *Tính đơn điệu của hàm số (P1)* (`knowledge-45c34e43-ad2e-47bf-8845-68782b67cfb9`)
**Branch:** `feature/textbook-practice-e2e-ux`, from `master` after #36 (`d62a50f`). Draft PR, **not for merge until the owner approves.**
**Status:** nothing deployed, nothing written to Production. Every browser run used an isolated local Postgres database (`tb_flow_e2e`, recreated before each run) and a local fake storage server. Production credentials were never loaded.

All screenshots and videos are real Chromium captures (Playwright) of a production build (`next build`, Turbopack) served with `next start`. The textbook pages are the real printed pages 19, 20 and 29 of `math_book_3`; the Gemini extraction of the answer key is the **recorded real output** already committed as `lib/textbook-reference/fixtures/math-book-3-real.json`, so no AI call was made and the runs are reproducible.

---

## 1. Root cause

The owner's screenshot (two questions "Chờ duyệt", rights "Cần xem xét", nothing reaching students) is the expected outcome of the old flow, not a one-off. Five causes, all reproduced in `results/before-1440.txt` and `screenshots/before/`:

1. **Three gates for one person.** A textbook exercise went *answer confirmed* → *imported as DRAFT* (textbook page) → *Gửi duyệt* → *Duyệt và xuất bản* (lesson page). The same Admin did all of them, on two pages. Nothing told them that importing was not publishing.
2. **Rights asked twice, defaulting to the blocking value.** The import step preselected "Chưa rõ" (`REVIEW_REQUIRED`). Publishing requires the rights to be resolved, so every imported question was blocked by default, and the Admin had to resolve rights again on the lesson page.
3. **A button that could only fail.** On the lesson page, "Duyệt và xuất bản" stayed enabled for a question whose rights were "Cần xem xét"; clicking it returned a 422 (`before-1440-publish-refused.png`). "Gửi duyệt" succeeded silently even though the question could never be published as it stood. That is exactly the state in the screenshot.
4. **Chapter-level questions never reached students.** A question placed on the chapter node (not a lesson) was published but no practice set picked it up.
5. **Students lost their place.** Coming back to `/practice` without the attempt id in the URL started from the intro with no way back into an unfinished attempt; seven count tiles on the admin page described states but not what to do next.

No copyright hold was bypassed by anyone: the system refused correctly. The problem was that it refused *late*, *without saying why*, after the Admin had already done the work.

---

## 2. Before vs after

### Admin: publish Câu 1, 3, 5, 6 of the P1 exercise page to students (rights not yet recorded)

| | Before | After |
|---|---|---|
| Pages | 2 (Bài tập từ sách → Luyện tập theo bài) | 1 (Bài tập từ sách) |
| Actions | **14** | **8** (first batch of a book) · **6** (later batches; the book's rights are remembered) |
| Rights | Asked at import (default "Chưa rõ"), asked again before publishing | Asked once, in the publish summary, with an explicit attestation; "Chưa rõ" disables publishing and offers "Chỉ lưu nháp" |
| Feedback | 422 after clicking; "Gửi duyệt" succeeded silently | Every blocked question lists its reason before anything is clicked; the server re-checks the same rules |
| Result | "Đã xuất bản" | "4 câu hỏi đã được xuất bản vào bài “Tính đơn điệu của hàm số (P1)”" + where students see them + "Xem như học sinh" |

Before (14): Trích lời giải → mở Câu 1 → đúng lời giải → Đưa 4 câu vào Ngân hàng → Nhập 4 câu dạng nháp → Duyệt và xuất bản (link to the lesson page) → chọn tất cả → Gửi duyệt → Duyệt và xuất bản (refused, 422) → chọn tất cả → chọn "Có giấy phép" → tick xác nhận → Lưu trạng thái quyền → Xuất bản.

After (8): Trích lời giải → mở Câu 1 → xác nhận lời giải → Chọn cả 4 câu → Xuất bản 4 câu → chọn "Có giấy phép" → tick xác nhận → Xuất bản 4 câu vào ….

| Before | After |
|---|---|
| ![](screenshots/before/before-1440-import-rights.png) | ![](screenshots/after-1440/admin-02-overview-after-answer-key.png) |
| ![](screenshots/before/before-1440-publish-refused.png) | ![](screenshots/after-1440/admin-12-publish-summary.png) |
| ![](screenshots/before/before-1440-published.png) | ![](screenshots/after-1440/admin-13-publish-success.png) |

### Student

| | Before | After |
|---|---|---|
| Wrong answer | "Chưa đúng" + explanation as one block | "Em chọn A · Đáp án đúng: D", then the solution step by step (staggered, respects reduced motion) |
| Leaving mid-attempt | Lost; restarting created a new attempt | "Làm tiếp (2/4)" resumes the same attempt at question 3 |
| Returning after finishing | Plain intro | "Kết quả tốt nhất của em: 3/4. Đã làm 2 lượt." + "Luyện lại" / "Làm lượt mới" |
| Chapter-level questions | Never shown | Included in "Ôn chương" |

| Before (390 px) | After (390 px) |
|---|---|
| ![](screenshots/before/before-session-390-q1.png) | ![](screenshots/after-390/student-06-wrong-feedback-solution.png) |
| ![](screenshots/before/before-student-390-practice.png) | ![](screenshots/after-390/student-07-return-resume.png) |

---

## 3. Admin workflow (after)

One screen, three stages shown as a strip at the top, each with a count and what it means:

1. **Trích và ghép đáp án:** extract the answer-key pages; strong matches are pre-verified, weak ones show the evidence and wait for "Đúng lời giải của câu này". Another question's solution is refused with its conflicts listed (Câu 8 ← Câu 2: "Khác số câu…").
2. **Kiểm tra và phân loại:** filters *Sẵn sàng xuất bản / Cần xử lý / Chưa có đáp án / Đã xuất bản / Tất cả*. Each question shows the page image, the answer and its source page, and **Nơi xuất bản**: a lesson of the chapter, or *Cả chương* (Ôn chương only). The destination is spelled out ("Học sinh gặp câu này ở: Luyện tập sau bài … và Ôn chương"). A hidden lesson is flagged. "Xem như học sinh" previews the exact question with grading, before publishing.
3. **Xuất bản:** a bar at the bottom ("5 câu sẵn sàng", "Chọn cả 5 câu", "Xuất bản 5 câu") opens a summary computed by a server dry run: questions per destination, every answer and solution (expandable), blocked and already-published questions with reasons, and the book's rights. Confirming publishes in one step; questions that are not eligible are held without stopping the others.

The lesson practice page keeps its role (review, edit, archive), with two changes: "Chờ duyệt" is now "Chờ xuất bản", and a question that cannot be published shows why (e.g. rights "Cần xem xét") with a link to "Bài tập từ sách", instead of an enabled button that fails (`screenshots/after-1440/admin-03-lesson-in-review-rights-blocked.png`).

### Two approaches compared

| | A. Step-by-step wizard (3 pages) | **B. One workspace + publish summary (chosen)** |
|---|---|---|
| Fit with current code | New routes and wizard state; duplicates the existing workspace | Reuses the existing textbook workspace, question bank, validation and audits |
| Admin effort | Forces linear order; going back to fix one answer costs pages | Fix anything in place; publish whatever is ready, any time |
| Batch work | One batch per pass through the wizard | Several destinations in one publish (4 → P1, 1 → chapter) |
| Safety | Same checks | Same checks, plus a dry run that shows exactly what the server will do |
| Mobile | Fine | List/detail with "Danh sách câu" back button; sticky publish bar (verified at 768 and 390) |

B was chosen because the task forbids a new architecture where the current one can be improved, and because the Admin's real work (fixing answers, moving questions) is non-linear.

---

## 4. What was changed

| Area | Change |
|---|---|
| `lib/textbook-reference/practice-import.ts` | `applyTextbookPublish`: import (deduplicated by fingerprint, as before) and publish in one call. Runs the existing `validateForReview`, `validateForPublishing` and practice exclusion rules; never publishes with `REVIEW_REQUIRED`; an existing `PUBLISHED` question is reported `ALREADY_PUBLISHED` and untouched; `ARCHIVED` is never revived. Writes the existing audit actions (`SOURCE_RIGHTS_CHANGED`, `SUBMITTED_FOR_REVIEW`, `PUBLISHED`). |
| `lib/textbook-reference/practice-service.ts`, `app/api/admin/textbooks/practice/route.ts` | `publish` action (Admin only, `adminApiGuard`) with `dryRun`. Rights `REVIEW_REQUIRED` → 422. A rights status must be attested unless it is the book's already-recorded status. Runs under the existing question-bank lock. Chapter nodes are valid destinations. |
| `lib/practice/practice-rules.ts` | `publishBlockers(question)`: the same publish validation, as readable reasons for the UI. |
| `lib/practice/practice-sets.ts` | "Ôn chương" also draws from questions placed on the chapter itself. |
| `lib/question-bank/qb-validation.ts` | Clearer rights message (what to do, not just what is wrong). |
| `components/admin/practice/textbook-exercises-workspace.tsx` | The 3-stage workspace, filters, destination select, publish bar and publish dialog. |
| `components/admin/practice/lesson-practice-workspace.tsx`, `student-preview.tsx`, `practice-labels.tsx` | Blockers shown, publish disabled when blocked, "Chờ xuất bản", preview extracted for reuse. |
| `features/lessons/components/practice-session.tsx` | Answer comparison, step-by-step solution (formulas spanning lines kept whole), resume, history, small motion polish. |

No schema or migration change. No change to other subjects, to Interactive Math P1, or to how attempts are stored.

---

## 5. End-to-end verification

Script: `e2e/after.mjs` (harness in `e2e/`, see "Reproducing"). Each viewport starts from a fresh database. Machine-readable results: `results/after-{1440,768,390}.json`.

**1440 × 900: 31/31 · 768 × 1024: 28/28 · 390 × 844: 28/28** (C1, C2 and E set up or check the legacy state once, at 1440).

| # | Scenario | 1440 | 768 | 390 |
|---|---|---|---|---|
| S1 | Answer key pages 29–31 extracted (recorded Gemini output) and shown as a 3-stage overview | ✅ | ✅ | ✅ |
| S2 | Câu 1 matched to its printed solution (evidence shown), Admin confirms: answer D from p. 29 | ✅ | ✅ | ✅ |
| S3 | Mismatch detected: another question's solution for Câu 8 is refused with its conflicts; Câu 8 stays without answer and cannot be published | ✅ | ✅ | ✅ |
| S3b | Missing answers are listed on their own ("Chưa có đáp án") | ✅ | ✅ | ✅ |
| S3c | Content issue explained in place (Câu 7) | ✅ | ✅ | ✅ |
| S4 | Câu 2 assigned to lesson P1 (subject Toán, grade 12, chapter inherited on publish) | ✅ | ✅ | ✅ |
| S5 | Câu 6 placed on the chapter itself: only in "Ôn chương" | ✅ | ✅ | ✅ |
| S5b | Chapter-level practice includes the chapter-level question and the lesson questions | ✅ | ✅ | ✅ |
| S6 | A wrong mapping (Câu 2 → P2) is corrected back to P1 before publishing | ✅ | ✅ | ✅ |
| S7 | Eligible questions published: 5 in the bank, OPEN + OPEN_PRACTICE, rights "Có giấy phép", hierarchy set | ✅ | ✅ | ✅ |
| S8 | Unresolved rights and unattested rights are refused by the server (422); nothing published | ✅ | ✅ | ✅ |
| S8b | A mixed batch: the dry run publishes Câu 3 and holds Câu 8 with its reason | ✅ | ✅ | ✅ |
| S8c | Choosing "Chưa rõ" keeps publishing disabled and offers saving drafts only | ✅ | ✅ | ✅ |
| S9a | Pre-publication summary: 4 questions → lesson P1, 1 → the chapter, rights attested, answers listed | ✅ | ✅ | ✅ |
| S9 | Bulk publication confirmed with "Xem như học sinh" per destination | ✅ | ✅ | ✅ |
| S10 | Student sees the published lesson practice: 4 questions for P1 | ✅ | ✅ | ✅ |
| S11 | Correct answer: graded on the server, "Chính xác!" with the solution | ✅ | ✅ | ✅ |
| S12 | Wrong answer: the student's choice and the right one, then the worked solution step by step | ✅ | ✅ | ✅ |
| S13 | Leaving and returning offers "Làm tiếp (2/4)" and resumes at question 3 with answers kept | ✅ | ✅ | ✅ |
| S14 | Retry of the missed question saved as its own MISTAKES attempt; first attempt unchanged; no streak rows written by practice | ✅ | ✅ | ✅ |
| S15 | Result saved: attempt COMPLETED 3/4 in `practice_attempts`, shown as 3/4 | ✅ | ✅ | ✅ |
| S15b | Practice history shown on return | ✅ | ✅ | ✅ |
| S16 | Publishing again creates nothing: `ALREADY_PUBLISHED`, one bank question per exercise | ✅ | ✅ | ✅ |
| S17 | Interactive Math P1 still renders for P1 | ✅ | ✅ | ✅ |
| S18 | Unanswered questions reach the student without answer or explanation (API checked) | ✅ | ✅ | ✅ |
| C1 | Owner's case: an in-review question with rights "Cần xem xét" says why it cannot be published; button disabled | ✅ | n/a | n/a |
| C2 | Owner's case: those two questions publish in place from the new flow (same ids, rights change audited) | ✅ | n/a | n/a |
| C3 | Every question the student gets is the same canonical bank question the Admin published | ✅ | ✅ | ✅ |
| R1 | A student gets 403 on the publish API, on PATCH and on reading a bank question | ✅ | ✅ | ✅ |
| E | No page errors in the browser | ✅ | n/a | n/a |
| O | No horizontal overflow | ✅ | ✅ | ✅ |

### Other checks

| Check | Result |
|---|---|
| `tsc --noEmit` | pass |
| `eslint` on changed files | pass (0 errors, 0 warnings) |
| `prettier --check` on changed files | pass (13 files elsewhere in the repo were already unformatted on `master`; untouched) |
| `vitest run` | 733 passed, 4 failed. The 4 failures (`features/roadmap/...`) fail identically on `master` and are unrelated. New tests: 4 for `applyTextbookPublish`, 1 for chapter-level review sets. |
| `next build` | pass |

---

## 6. Screenshots and video

**Video** (`video/`): `admin-1440.mp4` (answer key → classify → publish), `student-1440.mp4` (practice, wrong answer, resume, retry, Ôn chương), `admin-390.mp4`, `student-390.mp4`.

### Admin, 1440 × 900

| State | Screenshot |
|---|---|
| Before extracting the answer key | ![](screenshots/after-1440/admin-01-workspace-before-solutions.png) |
| 3-stage overview after the answer key | ![](screenshots/after-1440/admin-02-overview-after-answer-key.png) |
| Lesson page: in review, rights "Cần xem xét", reason shown, publish disabled | ![](screenshots/after-1440/admin-03-lesson-in-review-rights-blocked.png) |
| Câu 1: candidate solution with evidence | ![](screenshots/after-1440/admin-04-cau1-answer-key-match.png) |
| Câu 8: wrong solution refused with conflicts | ![](screenshots/after-1440/admin-05-cau8-mismatch-refused.png) |
| Filter: no answer yet | ![](screenshots/after-1440/admin-06-filter-missing-answers.png) |
| Destination: lesson | ![](screenshots/after-1440/admin-07-classification-lesson.png) |
| Destination: the chapter | ![](screenshots/after-1440/admin-08-classification-chapter.png) |
| Preview as a student | ![](screenshots/after-1440/admin-09-preview-as-student.png) |
| Content issue explained (Câu 7) | ![](screenshots/after-1440/admin-10-cau7-content-issue.png) |
| Rights "Chưa rõ": publishing disabled, drafts only | ![](screenshots/after-1440/admin-11-publish-rights-unclear.png) |
| Pre-publication summary | ![](screenshots/after-1440/admin-12-publish-summary.png) |
| Success | ![](screenshots/after-1440/admin-13-publish-success.png) |
| Published filter | ![](screenshots/after-1440/admin-14-published-filter.png) |

### Student, 1440 × 900

| State | Screenshot |
|---|---|
| Interactive Math P1 unchanged | ![](screenshots/after-1440/student-01-lesson-interactive.png) |
| Practice intro | ![](screenshots/after-1440/student-02-practice-intro.png) |
| Question / selected | ![](screenshots/after-1440/student-03-question.png) ![](screenshots/after-1440/student-04-selected.png) |
| Correct | ![](screenshots/after-1440/student-05-correct-feedback.png) |
| Wrong, step-by-step solution | ![](screenshots/after-1440/student-06-wrong-feedback-solution.png) |
| Return: "Làm tiếp (2/4)" | ![](screenshots/after-1440/student-07-return-resume.png) |
| Completion | ![](screenshots/after-1440/student-08-completion.png) |
| Retry of missed questions done | ![](screenshots/after-1440/student-09-retry-mistakes-done.png) |
| Intro with history | ![](screenshots/after-1440/student-10-intro-with-history.png) |
| Practice catalog, Ôn chương | ![](screenshots/after-1440/student-11-practice-catalog.png) ![](screenshots/after-1440/student-12-chapter-intro.png) ![](screenshots/after-1440/student-13-chapter-question.png) |

### 768 × 1024 and 390 × 844

| State | 768 | 390 |
|---|---|---|
| Overview | ![](screenshots/after-768/admin-02-overview-after-answer-key.png) | ![](screenshots/after-390/admin-02-overview-after-answer-key.png) |
| Mismatch refused | ![](screenshots/after-768/admin-05-cau8-mismatch-refused.png) | ![](screenshots/after-390/admin-05-cau8-mismatch-refused.png) |
| Destination | ![](screenshots/after-768/admin-07-classification-lesson.png) | ![](screenshots/after-390/admin-07-classification-lesson.png) |
| Summary | ![](screenshots/after-768/admin-12-publish-summary.png) | ![](screenshots/after-390/admin-12-publish-summary.png) |
| Success | ![](screenshots/after-768/admin-13-publish-success.png) | ![](screenshots/after-390/admin-13-publish-success.png) |
| Practice intro | ![](screenshots/after-768/student-02-practice-intro.png) | ![](screenshots/after-390/student-02-practice-intro.png) |
| Wrong answer, solution | ![](screenshots/after-768/student-06-wrong-feedback-solution.png) | ![](screenshots/after-390/student-06-wrong-feedback-solution.png) |
| Resume | ![](screenshots/after-768/student-07-return-resume.png) | ![](screenshots/after-390/student-07-return-resume.png) |
| Completion | ![](screenshots/after-768/student-08-completion.png) | ![](screenshots/after-390/student-08-completion.png) |

Reviewing the captures found two defects, both fixed before the final runs: a solution line break inside a `$…$` formula split it into two steps (raw LaTeX shown), and on phones the floating admin menu button covered "Chọn cả" in the publish bar.

---

## 7. Safety review

| Rule | How it holds |
|---|---|
| No silent bypass of rights holds | `REVIEW_REQUIRED` cannot be published from the UI (disabled), the API (422) or the domain function (throws). Changing a rights status requires an explicit attestation and is audited (`SOURCE_RIGHTS_CHANGED`). Rights already resolved on a question are never overwritten. |
| Attached answers not assumed correct | Only answers verified by a strong match or confirmed by the Admin are publishable; mismatches are refused with reasons (S3). |
| Valid curriculum destination | Only a non-archived lesson or its chapter; publishing re-runs the existing validation (subject, grade, chapter, knowledge node). |
| No answers exposed early | Student APIs unchanged; S18 checks the attempt payload. |
| No duplicates | Import still deduplicates by fingerprint/externalId; re-publishing returns `ALREADY_PUBLISHED` (S16). |
| Source references and answers kept | `textbookSource`, page references and existing answers are carried over; in-review questions are published in place (C2). |
| Attempts not corrupted | No change to attempt storage; S13–S15 check rows directly. |
| Interactive Math P1 intact | S17; no file of that feature changed. |
| No Production access | Local database only; `ADMIN_EMAILS` and storage keys are local test values. |

---

## 8. Known limitations

- The lesson practice page does not yet count chapter-level questions in its coverage numbers (they are listed under the chapter in "Bài tập từ sách" and reach students via Ôn chương).
- The existing question-bank PATCH endpoint still lets an Admin edit the content of a published question (unchanged behaviour, outside this task).
- 4 `features/roadmap` unit tests fail on `master` already.
- The browser run uses the recorded Gemini output for the answer key; live extraction quality on other books is outside this test.

---

## Reproducing

`e2e/` holds the harness: `env.sh` (local-only values), `fake-storage.mjs` (serves `qa-book.pdf`), `make-pdf.py` (builds `qa-book.pdf` from the scanned pages; set `QA_PAGES` to their folder; the scans are not committed), `seed.e2e.ts` / `worker.e2e.ts` (seed the tree, article and the real page 19–20 exercises; run the extraction worker on the recorded output), `reset.sh`, `start.sh <dir> <port>`, `before.mjs`, `after.mjs`. Requires a local Postgres at `127.0.0.1:5432`.

```sh
python3 make-pdf.py && node fake-storage.mjs &
pnpm build && ./start.sh "$PWD/../../../.." 3302
BASE=http://localhost:3302 VP=1440 node after.mjs   # also VP=768, VP=390
```
