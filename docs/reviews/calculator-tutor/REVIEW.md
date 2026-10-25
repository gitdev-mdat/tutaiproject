# Interactive calculator tutor: pilot for y = x / ln x (Toán 12)

**Question:** math_book_3, Câu 1 (exercise p. 19, solution p. 29), Production `Q-MAT-TPG9WI` (`q-b48ea52f-2c80-41f8-9740-852bbad40ed5`), lesson *Tính đơn điệu của hàm số (P1)*.
**Branch:** `feature/interactive-calculator-tutor`, from `master` at `fcd81cb` (#37). Draft PR, **not for merge until the owner approves the learning experience.**
**Status:** nothing deployed, nothing written to Production. Production was only *read* once (one `select` of this question, to copy it verbatim into the QA seed). Every browser run used an isolated local Postgres database (`calc_tutor_e2e`, recreated before each run) and a production build (`next build` + `next start`).

**Final status: READY FOR OWNER VISUAL REVIEW**

---

## 1. Audit

### Where things live

| What | Where |
|---|---|
| Question + imported solution | `content_documents['question-bank/questions']`; the solution is one string, `question.explanation` |
| Import of textbook solutions | `lib/textbook-reference/practice-import.ts` (answer key → `explanation`, verbatim) |
| Multiple methods | **Not represented.** There is no method field; "Cách 1 / Cách 2" only exist as text inside `explanation` |
| Admin preview | `components/admin/practice/student-preview.tsx` (in-memory grading, opened from the lesson practice page and the textbook workspace) |
| Student solution | `FeedbackPanel` / `SolutionSteps` in `features/lessons/components/practice-session.tsx`, shown only after the server graded an answer |
| Math rendering | `QuestionMath` (`components/shared/question-content-renderer.tsx`, LaTeX subset of `lib/content/math-notation.ts`) |
| Animation | `tw-animate-css` classes behind `motion-safe:` (same as Interactive Math P1) |

### The imported solution as students see it today

17 numbered lines, two methods run together, no calculator screens ([before, 1440](screenshots/before/1440-student-solution-panel.png), [before, 390](screenshots/before/390-student-solution-panel.png)):

| Before (1440) | Before (390, full page) |
|---|---|
| ![](screenshots/before/1440-student-solution-panel.png) | ![](screenshots/before/390-student-solution-panel.png) |

### Mathematics (checked)

- Domain $D = (0; +\infty) \setminus \{1\}$; $y' = \frac{\ln x - 1}{(\ln x)^2}$; $y' = 0 \Leftrightarrow x = e$.
- Decreasing on $(0;1)$ and $(1;e)$, increasing on $(e;+\infty)$ → **D**. B is wrong because $1 \notin D$.

### Problems in the source and in the import

| # | Kind | Finding |
|---|---|---|
| 1 | Import error (visible to students) | The domain line contains a form-feed control character: `(0; +\frac{\infty}{\infty})` was stored with `\f` → it renders as "(0; +␌rac∞∞)". The printed book says $(0;+\infty)\setminus\{1\}$. |
| 2 | Invalid instruction | "Start? Ta chọn x = 0": $x = 0$ is outside the domain; the calculator shows ERROR on that row. |
| 3 | Wrong key | "End? SHIFT ×10ˣ (chính là e)". On this calculator family SHIFT ×10ˣ is **π**, ALPHA ×10ˣ is **e**, as the key picture printed in the book itself shows (π on the left/SHIFT side, e on the right/ALPHA side). |
| 4 | Misleading | The book's table runs 0 → e across $x = 1$ and stops before the function increases, so it never shows the increase on $(e;+\infty)$; sampled values are presented as if they proved monotonicity. |
| 5 | Missing | The four calculator screenshots of the book were not imported; "máy hiện như sau:" points to nothing. |
| 6 | Lost structure | The heading "Cách 1: Cách tư duy" was lost in import, so the two methods are one block. |
| 7 | Model-dependent | "MODE 7 TABLE" and "Ấn 2 lần =" are fx-570VN PLUS / ES PLUS behaviour (TABLE is item 7; the reset setting asks for g(X)). The fx-580VN X opens tables differently. |

The source text is **not modified**. It is shown under "Lời giải gốc đã nhập (sách tr. 29, giữ nguyên văn)" with these notes next to it.

---

## 2. Calculator integration: feasibility

| | Official CASIO emulator (ClassWiz Emulator / ClassPad.net) | **Focused Tú Tài teaching simulation (chosen)** |
|---|---|---|
| Rights | Licensed per teacher/school ([license codes](https://edu.casio.com/intl/software/emulators/licensecode-fxes)); no public embedding licence or API for third-party web apps found | Our own code and artwork; no CASIO ROM, firmware, logo or key art |
| Technical | Desktop software / ClassPad.net web app; no documented iframe/postMessage API to drive keys, highlight, or read the screen | Fully scriptable: highlight, demo, validate each key, read the screen |
| Model | fx-580VN X / ClassWiz family; does not match the source's MODE 7 (fx-570VN PLUS) | Matches the model the source uses |
| Teaching | A real calculator, but no guidance layer | Built for guidance: demo, practice, hints, checkpoints |
| Risk | Licence + integration unknown; would need CASIO's permission | Must be honest about scope (see below) |

MathLive / Compute Engine were not needed: the only expression grammar is digits, X, e, π, + − × ÷, ln, brackets, so a 120-line parser is lighter and fully tested. No new dependency was added.

**What it is:** a *guided teaching simulation* of the TABLE function of the **CASIO fx-570VN PLUS**, labelled as such in the UI ("Mô phỏng dạy học theo CASIO fx-570VN PLUS, không phải trình giả lập máy thật"). **What it is not:** an emulator. Keys outside the TABLE lesson (√, x², log, fraction, RCL, other modes, SETUP…) answer "nằm ngoài phạm vi bản mô phỏng" and change nothing.

**Key sequence verification** against official CASIO documentation:
- [fx-570VN PLUS user's guide (VI)](https://support.casio.com/storage/vi/manual/pdf/VI/004/fx-570VNPLUS_VI.pdf): mode list in order COMP, CMPLX, STAT, BASE-N, EQN, MATRIX, **TABLE (7)**, VECTOR…; TABLE setup "f(x)" / "f(x),g(x)", **reset default f(x),g(x)** (hence g(X)= is asked).
- [fx-570ES PLUS manual: creating a number table](https://support.casio.com/global/en/calc/manual/fx-570ESPLUS_991ESPLUS_en/using_calculation_modes/creating_number.html): Start/End/Step prompts, defaults 1/5/1, End ≥ Start, row limit, any variable other than X treated as constant.
- [fx-580VN X manual: Table](https://support.casio.com/global/vi/fx/manual/fx-580VNX_VI/using_calculation_modes/creating_number/function.html): 45 rows with f(x), 30 with f(x),g(x); used only to confirm we must not mix models.
- The official pages render keys as images, so the exact key glyphs (ALPHA ")" = X, ALPHA ×10ˣ = e) were confirmed from the key picture printed in the source page and the standard key layout of the model. **To confirm on a physical fx-570VN PLUS before release** (see limitations).
- Table cell formatting: the real screens printed on p. 29 show values **cut**, not rounded, to 6 characters (6.5817 for 6.58178, −1.174 for −1.17457). The simulation does the same; all 7 printed cells are reproduced exactly (unit test).

---

## 3. What was built

### Experience

After answering, the solution of this question becomes two tabs:

- **Cách 1: Giải bằng đạo hàm**: 6 short steps (domain with the reason, derivative, $y'=0$, sign on each interval, conclusion highlighted, why B is wrong) and a sign table.
- **Cách 2: Thực hành máy tính**: the calculator tutor.
- Below both: the imported source, collapsed, verbatim, with the 6 applicable notes.

The tutor teaches 8 steps / 66 key presses:

1. MODE 7 (TABLE) · 2. X ÷ ln(X) · 3. = = (skip g(X)) · 4. **Start 0, End 2, Step 0.5**: shows that x = 0 and x = 1 are ERROR rows, with a checkpoint "ERROR không phải là một giá trị" · 5. AC = = and **(0;1)**: Start 0.1, End 0.9, Step 0.1 · 6. read it (decreasing) · 7. **(1;4)**: Start 1.2, End 4, Step 0.2 (15 rows) · 8. read it: decreasing to 2.7194 at x = 2.8, then increasing; minimum near $e$ where $f(e)=e$. Conclusion: what the table rules out (A, C), and that it is **not a proof**; the derivative is.

- **Xem hướng dẫn**: highlights the next key (pulsing ring + a small pointer beside it, never on the label), presses it after ~1 s, updates the LCD and says what happened; pauses at checkpoints; Trước / Bỏ qua bước / Phát lại bước / Tạm dừng–Tiếp tục.
- **Tự bấm thử**: the student presses keys (mouse, touch, or keyboard: digits, Enter `=`, Esc `AC`, arrows, M `MODE`, A `ALPHA`, L `ln`). A correct key is applied by the real simulation; a wrong key is **not applied** and gets a gentle explanation ("Phím 5 không dùng ở bước này"); the second miss lights up the right key; Gợi ý shows a hint; Làm lại restarts. Completion shows a short success state, then **Thử tự do** (any range, computed for real) or Luyện lại.
- **Phone (≤ 639 px)**: the tutor opens as a full-screen workspace: mode switch in the top bar, the current instruction and controls on top, the whole keypad below, both on screen at 390 × 844; × returns to the solution.
- `prefers-reduced-motion`: no pulsing, pointer bounce or fades; the demo still advances key by key.

### Architecture

| File | Role |
|---|---|
| `lib/calculator-tutor/fx570vn-plus.ts` | The simulation: key faces, state machine (COMP → MODE menu → f(X) → g(X) → Start/End/Step → table / ERROR), expression parser/evaluator, ERROR for undefined values, Range ERROR (> 30 rows, End < Start), Syntax ERROR, 6-character cells. Pure, no React. |
| `lib/calculator-tutor/types.ts` | `CalculatorTutorial` (model, function, domain, steps with keys, explanations, hints, checkpoints, expected screens, references) and `SolutionGuide` (methods, source notes, verification). |
| `lib/calculator-tutor/guides/x-over-ln-x.ts` | The one verified guide. Hand-written configuration, never generated from extracted text. |
| `lib/calculator-tutor/registry.ts` | Matches a question to a guide (by id, or same book + question number + same formula) and attaches it to graded feedback. |
| `components/learning/calculator-tutor/*` | `CalculatorDevice`, `CalculatorTutor`, `SolutionGuideView`. |
| `lib/practice/practice-service.ts`, `lib/practice/grading.ts` | The guide is attached **on the server**, to the feedback of an answered question only (same moment the explanation is revealed). |
| `features/lessons/components/practice-session.tsx`, `components/admin/practice/student-preview.tsx` | Render the guide when present; otherwise unchanged. Admin sees a verification panel: who/when, checks, and the full key sequence replayed live with ✓ per step. |

No schema change, no migration, no new dependency, no change to grading, publication rules, attempts, streaks or XP. Admin does not author animations: a guide is data, and the animation comes from the sequence.

---

## 4. Screenshots (real Chromium, production build)

| # | State | 1440 × 900 (mouse) | 768 × 1024 (keyboard) | 390 × 844 (touch) |
|---|---|---|---|---|
| 1 | Original long solution | ![](screenshots/before/1440-student-solution-panel.png) | n/a | ![](screenshots/before/390-student-solution-panel.png) |
| 2 | Method selection (Cách 1 open) | ![](screenshots/after-1440/02-methods.png) | ![](screenshots/after-768/02-methods.png) | ![](screenshots/after-390/02-methods.png) |
| 3 | Tutorial start | ![](screenshots/after-1440/03-tutor-start.png) | ![](screenshots/after-768/03-tutor-start.png) | ![](screenshots/after-390/03-tutor-start.png) |
| 4 | Highlighted key in the demo | ![](screenshots/after-1440/04-watch-highlight.png) | ![](screenshots/after-768/04-watch-highlight.png) | ![](screenshots/after-390/04-watch-highlight.png) |
| 5 | Function entered | ![](screenshots/after-1440/05-function-entered.png) | ![](screenshots/after-768/05-function-entered.png) | ![](screenshots/after-390/05-function-entered.png) |
| 6 | TABLE range configuration | ![](screenshots/after-1440/06-range-config.png) | ![](screenshots/after-768/06-range-config.png) | ![](screenshots/after-390/06-range-config.png) |
| 7a | ERROR rows at x = 0, x = 1 | ![](screenshots/after-1440/07b-table-error-rows.png) | ![](screenshots/after-768/07b-table-error-rows.png) | ![](screenshots/after-390/07b-table-error-rows.png) |
| 7b | TABLE results on (1; 4) | ![](screenshots/after-1440/07-table-results.png) | ![](screenshots/after-768/07-table-results.png) | ![](screenshots/after-390/07-table-results.png) |
| 8 | Wrong-key feedback | ![](screenshots/after-1440/08-wrong-key.png) | ![](screenshots/after-768/08-wrong-key.png) | ![](screenshots/after-390/08-wrong-key.png) |
| 9 | Completion | ![](screenshots/after-1440/09-complete.png) | ![](screenshots/after-768/09-complete.png) | ![](screenshots/after-390/09-complete.png) |
| 10 | Source kept + notes | ![](screenshots/after-1440/12-source-notes.png) | ![](screenshots/after-768/12-source-notes.png) | ![](screenshots/after-390/12-source-notes.png) |
| 11 | Admin verification | ![](screenshots/after-1440/11-admin-verification.png) | ![](screenshots/after-768/11-admin-verification.png) | ![](screenshots/after-390/11-admin-verification.png) |

## 5. Video (real browser recordings, not mock-ups)

- [`video/student-1440.mp4`](video/student-1440.mp4) (94 s, desktop, mouse)
- [`video/student-390.mp4`](video/student-390.mp4) (94 s, phone, touch)

Both: answer → solution → Cách 1 → open Cách 2 → automatic demonstration (MODE, 7, X ÷ ln(X), = =) → pause → switch to Tự bấm thử → wrong key (5) and its correction → second wrong key lights up MODE → Gợi ý → all 66 presses with the checkpoints → completion. Recorded with Playwright `recordVideo` by `e2e/video.mjs`.

---

## 6. Mathematical verification (`lib/calculator-tutor/*.test.ts`, 32 tests)

- Each of the 8 steps is replayed key by key on the simulation and must leave exactly its declared screen (same check is shown live to Admin).
- Every table row of the guide: undefined exactly when $x \le 0$ or $x = 1$ (shown ERROR), otherwise equal to $x/\ln x$ computed independently (1e-9).
- (0;1) sampled values strictly decreasing; (1;4) minimum at x = 2.8, |2.8 − e| < 0.2, ≤ 30 rows.
- Sign of $y'$ at 0.5, 2, 4 = −, −, + (matches the sign table); Method 1 concludes D.
- Printed cells of p. 29 reproduced: −0.124, −0.436, −1.174, −3.585, 6.5817, 4.1608, 2.7902 (and 3.0623, 2.8853).
- Parser: precedence, implied multiplication, ERROR for ln of non-positive / division by zero, Syntax ERROR, SHIFT ×10ˣ = π vs ALPHA ×10ˣ = e, Range ERROR beyond 30 rows or End < Start, default 1/5/1, g(X) prompt.
- Unsupported keys and modes are refused without changing state.
- Matching: the guide attaches to this question only (not Câu 2, not another book's Câu 1); notes about the import error only appear when the imported text has it; the matching rule is not sent to clients.

## 7. Browser and regression tests (`e2e/after.mjs`)

**1440 × 900 mouse: 32/32 · 768 × 1024 keyboard only: 31/31 · 390 × 844 touch: 32/32** ([results-1440.json](e2e/results-1440.json), [results-768.json](e2e/results-768.json), [results-390.json](e2e/results-390.json); logs `e2e/run-*.log`).

| ID | Check |
|---|---|
| P1 | Before answering: no solution, guide or calculator on the page |
| P2 | (1440) none of the 15 scripts loaded by the student page contains the guide (it states the answer) |
| M1–M3 | Two separate methods; Method 1 content and sign table; original solution verbatim (17 lines) with 6 notes |
| L1–L2 | Inline two-column layout at 1440/768; full-screen workspace at 390, closable |
| W0–W5 | Start screen; demo highlights MODE then presses in order; pause holds for 2.6 s and resumes at the same key; Previous; Skip; Replay; pause at checkpoint with ERROR rows |
| T1–T5 | Wrong key not applied, gentle message; second miss highlights the right key; hint; correct keys advance; Làm lại |
| T6–T8 | (0;1) values; Start? 1.2 configuration; (1;4) results; full completion with the viewport's input method |
| T9 | **No API request** while watching/practising; `lesson_completions` / `learning_days` unchanged (no streak/XP) |
| T10–T11 | Free mode computes a new range (ERROR at x = 1); unsupported key says so |
| R1–R2 | A question without a guide keeps the old solution; Interactive Math P1 still renders |
| A1–A3 | Admin preview shows the verified guide, 8/8 steps replay to their screen; Admin can try it; a student gets 403 on the question API |
| O, E | No horizontal overflow; no page errors |

Other checks:

| Check | Result |
|---|---|
| `tsc --noEmit` | pass |
| `eslint` on changed files | pass |
| `prettier` on changed files | applied |
| `vitest run` | 765 passed, 4 failed: the same 4 `features/roadmap/...` tests fail identically on `master` (re-run on a clean `master` worktree), unrelated |
| `next build` | pass |

### Reproducing

```
bash docs/reviews/calculator-tutor/e2e/reset.sh            # isolated DB calc_tutor_e2e + seed
pnpm build && bash docs/reviews/calculator-tutor/e2e/start.sh $PWD 3303
BASE=http://localhost:3303 VP=1440 node docs/reviews/calculator-tutor/e2e/after.mjs   # 768, 390
BASE=http://localhost:3303 VP=1440 node docs/reviews/calculator-tutor/e2e/video.mjs
```

`e2e/question-q1-production.json` is the Production question copied verbatim (including the broken domain line). The seed changes only its publication fields (PUBLISHED, OPEN_PRACTICE, rights LICENSED) so a QA student can reach it, and adds two simple QA questions so the lesson has a practice set.

---

## 8. Preview URL

None. Vercel Preview may share the Production database, so nothing was deployed; review from the screenshots and videos, or run the steps above.

## 9. Known limitations

1. **Physical-device check pending.** Sequence and behaviour follow the official manuals; key glyph positions (ALPHA ")" = X, ALPHA ×10ˣ = e) and the exact ERROR rendering should be confirmed once on a real fx-570VN PLUS.
2. One model only. A student with an fx-580VN X needs a different sequence (Table is opened from the menu, not MODE 7); the type supports another model, but no second guide exists yet.
3. Pilot scope: one guide, linked by configuration. There is no Admin editor for guides; adding one is a code change reviewed in a PR (deliberate: AI-extracted text is never turned into commands).
4. In Production this question is still `IN_REVIEW` with rights "Cần xem xét", so students will see the tutor only once it is published through the existing flow. The broken domain line in its imported explanation is shown with a note but **not corrected**; fixing the stored text is an editorial decision (one-line edit in the question editor).
5. The simulation keeps 10 significant digits and cuts cells to 6 characters like the printed screens; the last digit of very small or very large values may differ from a real screen.
6. In the demo, the screen is updated from the simulation; the "pointer" is a decorative icon beside the key, not a recorded hand.
