# Interactive Math Lesson P1: prototype review

**Lesson:** Toán 12 · *Tính đơn điệu của hàm số (P1)* (`knowledge-45c34e43-ad2e-47bf-8845-68782b67cfb9`)
**Branch:** `feature/interactive-math-p1-prototype` (draft PR, not for merge until the owner approves)
**Status:** review-only prototype. Nothing was deployed and nothing was written to the Production database.

All screenshots below are real Chromium captures (Playwright) of a production build (`next build`, Turbopack) running locally against a Postgres database seeded with the **exact Production P1 article** (md5 checked against Production, read-only) and an **empty question bank**, as on Production today. No question records were created and no lesson content was invented.

---

## A. Before vs After

| | Before (current text journey) | After (interactive prototype) |
|---|---|---|
| First screen | A graph and three up/down dropdowns, the key idea ("f′ > 0 ⇒ đồng biến") already printed in the header | The curve draws itself, a dot runs along it, and the student taps where it turns. The key idea stays hidden until they have found it |
| The theorem | Read as text in parts 2 and 3 | Discovered: the student drags the tangent along the curve, paints the sign of f′ under it, then states the rule. The admin's own theorem text arrives right after, as "Em vừa tìm ra" |
| f′ = 0 at a point | One paragraph ("Mở rộng") | y = x³: predict, then drag across x = 0, then conclude |
| Worked example | Read step by step ("Xem bước tiếp") | Solved by the student: domain → derivative → roots of y′ = 0 → sign table → conclusion. The admin's step text is shown after each step as "Lời giải mẫu" |
| Practice with 0 bank questions | Nothing to do | "Đến lượt em": a new function (y = −x³ + 3x), graph locked until solved, then drawn as the check |
| Completion | A list | Progress ring and check, 3 "Em đã tự tìm ra" cards, how it went (first try / with hints / shown), recap, next lesson |

| Before | After |
|---|---|
| ![before desktop](screenshots/before-desktop-intro.png) | ![after desktop](screenshots/desktop-01-intro.png) |
| ![before desktop theorem](screenshots/before-desktop-theorem.png) | ![after desktop discovery](screenshots/desktop-04-discovery.png) |

| Before (390 px) | After (390 px) |
|---|---|
| ![before mobile](screenshots/before-mobile-intro.png) | ![after mobile](screenshots/mobile-01-intro.png) |
| ![before mobile theorem](screenshots/before-mobile-theorem.png) | ![after mobile discovery](screenshots/mobile-04-discovery.png) |

The "before" captures are the same build with `?view=classic`, which renders the current text journey unchanged.

---

## B. Screenshot gallery

### Desktop 1440 × 900

| State | Screenshot |
|---|---|
| Intro: the curve draws itself, a dot runs along it | ![](screenshots/desktop-01-intro.png) |
| Turning points found by tapping the graph | ![](screenshots/desktop-01-shape-found.png) |
| Up/down labelled, the lesson's big question | ![](screenshots/desktop-02-intro-done.png) |
| Tangent prediction answered, tangent and f′ shown | ![](screenshots/desktop-03-tangent.png) |
| Graph manipulation: M dragged across, sign of f′ painted under the graph | ![](screenshots/desktop-03-scanned.png) |
| Discovery explanation (admin's theorem, synced to the graph) | ![](screenshots/desktop-04-discovery.png) |
| f′ = 0 at a point (y = x³) | ![](screenshots/desktop-05-flat.png) |
| Roots of y′ = 0, with the admin's step 2 | ![](screenshots/desktop-06-roots.png) |
| Sign table filled by the student | ![](screenshots/desktop-06-sign-table.png) |
| Example solved, variation table | ![](screenshots/desktop-07-solved.png) |
| Challenge, graph locked | ![](screenshots/desktop-08-challenge.png) |
| Challenge solved, graph revealed as the check | ![](screenshots/desktop-09-challenge-solved.png) |
| Completion | ![](screenshots/desktop-10-completion.png) |
| Revisit a completed lesson (lands on the summary; key idea now shown) | ![](screenshots/desktop-11-revisit.png) |
| Revisit part 2: every answer shown, parts open | ![](screenshots/desktop-12-revisit-part2.png) |
| Keyboard only, reduced motion | ![](screenshots/desktop-13-keyboard.png) |

**Mistakes and hints (desktop):**

| | |
|---|---|
| Tap on a wrong spot | ![](screenshots/desktop-m01-shape-miss.png) |
| Hints open one level at a time | ![](screenshots/desktop-m02-hints.png) |
| Wrong tangent prediction, why it is wrong | ![](screenshots/desktop-m03-predict-wrong.png) |
| Three wrong derivatives: answer shown and explained | ![](screenshots/desktop-m04-revealed.png) |
| Wrong roots: "thay x = 1 vào y′ được −3, khác 0" | ![](screenshots/desktop-m04-roots-wrong.png) |
| Wrong sign: the cell is outlined and a test value is computed | ![](screenshots/desktop-m04-sign-wrong.png) |
| Completion after mistakes (8/17 first try · 8 with hints · 1 shown) | ![](screenshots/desktop-m05-completion.png) |

### Mobile 390 × 844

| State | Screenshot |
|---|---|
| Intro | ![](screenshots/mobile-01-intro.png) |
| Turning points found, labels, big question | ![](screenshots/mobile-02-intro-done.png) |
| Graph interaction (touch drag), tangent and f′ | ![](screenshots/mobile-03-tangent.png) |
| Sign of f′ painted by dragging | ![](screenshots/mobile-03-scanned.png) |
| Answer feedback (wrong, then hint) | ![](screenshots/mobile-m03-predict-wrong.png) |
| Explanation (discovery card) | ![](screenshots/mobile-04-discovery.png) |
| Challenge (problem first, locked graph after it) | ![](screenshots/mobile-08-challenge.png) |
| Challenge solved | ![](screenshots/mobile-09-challenge-solved.png) |
| Completion | ![](screenshots/mobile-10-completion.png) |
| Touch scrub on a phone | ![](screenshots/mobile-14-touch-scan.png) |

### Tablet 768 × 1024

| | |
|---|---|
| Intro | ![](screenshots/tablet-01-intro.png) |
| Discovery | ![](screenshots/tablet-04-discovery.png) |
| Example solved | ![](screenshots/tablet-07-solved.png) |
| Completion | ![](screenshots/tablet-10-completion.png) |

Full-page captures (`*-full.png`) are in the same folder. On full-page captures the sticky graph and sidebar can appear shifted: that is how Playwright stitches sticky elements, not how the page looks while scrolling.

---

## C. Full student journey

Six parts, each opened by doing its activity (Continue is locked until then):

1. **Đồ thị này đi đâu? (Quan sát → Dự đoán).** The curve of the GRAPH block draws itself; a dot runs left to right. The student taps where it changes direction (a wrong tap says the graph still goes one way there; hint 2 highlights the area). Then each piece is labelled Lên / Xuống and turns green / red. The lesson's big question closes the part: *làm sao biết đồ thị đi lên hay đi xuống mà không cần vẽ?* The INTRO text is behind "Vì sao bài này quan trọng?".
2. **Bí mật nằm ở độ dốc (Tương tác → Khám phá).** Predict the tangent on a rising piece; then drag M (mouse, finger, arrow keys or slider). The tangent is coloured by the sign of f′, its value is shown live, M snaps onto x where f′ = 0, and every place M has been is painted under the graph as the sign of f′. A checklist asks for the rising parts, the falling parts and both horizontal tangents. Then: "f′ > 0 thì đồ thị…?" with the f′ > 0 regions highlighted, and the same for f′ < 0. The discovery card shows the admin's hypothesis and theorem; hovering or focusing each line highlights the matching regions.
3. **f′ = 0 thì sao? (y = x³).** Predict whether the graph turns at x = 0, verify by dragging across, conclude "đồng biến trên ℝ"; the admin's "Mở rộng" text is the discovery card.
4. **Tự giải bài mẫu.** The EXAMPLE function, solved in four steps with chips and taps; after each step, the admin's own step text. The graph follows: zeros of y′ appear once found, pieces take their colour once the signs are right. Ends with the variation table drawing its arrows.
5. **Đến lượt em.** A new function, no worked solution, graph locked until the conclusion is right, then drawn as the confirmation. If the lesson has published practice questions, they follow here (P1 has none on Production, so none are shown).
6. **Hoàn thành.** Check animation, 3 "Em đã tự tìm ra" cards, results (first try / with hints / shown), recap, objectives, the existing next-step card (practice or next lesson), "Thử thách lại", "Xem lại từ đầu", optional sound (off by default).

Every wrong answer gets a reason for that specific mistake, hints open one level at a time, and the third miss shows and explains the answer, so a student is never stuck.

**Measured (journey 1, a script answering correctly at robot speed):** 6 parts, no horizontal overflow at any size, 17 questions + 2 explorations recorded.

---

## D. Mobile experience (390 × 844)

- The graph sits at the top and stays pinned (sticky) while the activity scrolls under it, so the instruction and the picture are on screen together; its height is about 27 % of the screen (180–260 px).
- Continue lives in a bottom dock, one thumb away, locked with "Làm xong để mở" until the part's activity is done.
- Touch: a horizontal finger move scrubs M; a vertical swipe on the graph still scrolls the page (verified: vertical swipe moved M = **false**, page scrolled = **true**). The handle has a 48 px hit area.
- For the locked challenge graph, the problem comes first and the placeholder goes below it.
- The graph caption leaves room for the fixed menu button.
- No horizontal overflow in any part (checked in every part at 390, 768 and 1440).

---

## E. Learning value

- **Observe → predict → interact → discover → apply → achieve**, in that order, with nothing revealed before the student tries: the key idea is hidden in the header, the tangent appears only after the prediction, the theorem only after the student has stated it, the challenge graph only after it is solved.
- The rule is **found on the graph**: the sign band the student paints by dragging *is* the sign table they fill in part 4.
- The worked example is **done, not read**, and compared step by step with the teacher's own text.
- The challenge **works with 0 questions in the bank**: its functions come from a new optional lesson field (`GRAPH_PRACTICE`, "Hàm cho học sinh tự làm") with a pilot fallback in `config/interactive-lessons.ts`. Every option, hint and check is computed from the function, so they cannot disagree with the graph.
- Typical slips become the wrong options: forgetting to multiply by the exponent, keeping the constant, keeping the exponent; roots off by sign or by one.

---

## F. Technical verification

### Architecture

- `lib/learning/interactive-lesson.ts`: builds the plan from the article blocks the admin already wrote (GRAPH, MAIN_CONTENT, EXAMPLE, RECAP, INTRO…) plus the analysed function. Nothing is written for one lesson; the plan is `null` for a lesson without a drawable polynomial graph.
- `lib/learning/function-model.ts`: new helpers (derivative options from slips, test values, non-turning points, domain).
- `components/learning/interactive/*`: the parts, the graph explorer (`explore-graph.tsx`, extends the existing `Plot` from `function-graph.tsx`), the guided solver, the shell.
- `components/learning/function-graph.tsx`: `Plot` gained optional `height`, `marks`, `paint`, `bands`, `drawIn`, `below`; the existing layers and the variation table are unchanged except an optional `animate`.
- Progress: same store and rules (`recordLessonStage`), interactive part ids; old text-lesson saves map to the matching part (`y-3` → `mo-rong`, verified in the browser). New optional `outcomes` per activity, keeping the best result; legacy saves read unchanged.
- No new dependency, no animation library, no migration, no DB writes. Animations are CSS keyframes and are all switched off under `prefers-reduced-motion` (verified: computed `animation-name: none`; the running dot is not started).

### Only P1, and how to turn it off

- On for the lessons listed in `config/interactive-lessons.ts` (only P1).
- Off without a rebuild: set `TUTAI_INTERACTIVE_LESSONS=off` on the server (or a comma list of lesson ids to keep on) and restart. The lesson page reads it on each request.
- Per view: `?view=classic` shows the current text journey (used for the "before" captures).
- Removing P1 from the config removes the experience entirely.

### Tests

| Check | Result |
|---|---|
| `tsc --noEmit` | clean |
| ESLint on changed files | clean (the repo's 3 pre-existing errors are in files this branch does not touch) |
| Vitest, full suite | 712 passed, 4 failed (55 skipped). The 4 failures (`roadmap-service`, `adaptive-learning-service`) fail identically on `master` |
| New unit tests | 23 in `lib/learning/interactive-lesson.test.ts` (math for y = x³ − 3x² + 2, y = −x³ + 3x, y = x³, a rational function fallback; derivative slips; test values; plan from the Production P1 blocks; admin override; aliases and progress restore; attempts, hints and reveal; config on/off; snapping; root candidates) + 4 in `features/lessons/lib/lesson-progress.test.ts` (legacy save unchanged, best outcome kept, completion untouched) |
| `next build` (Turbopack) | succeeds |

### Browser journeys (`e2e/journeys.mjs`, results in `e2e/results.json`)

| Journey | Sizes | Result |
|---|---|---|
| 1. All correct, start to completion | 1440, 768, 390 | pass at all three; no horizontal overflow in any part; no console errors |
| 2. Mistakes, hints and one revealed answer | 1440, 390 | pass; outcomes recorded 8 first try · 8 with hints · 1 shown |
| 3. Complete then revisit | 1440, 768, 390 | lands on the summary, key idea shown, earlier parts open with answers |
| 4. Touch, keyboard, slider, reduced motion | 390 touch, 1440 keyboard | touch scrub completes the scan; vertical swipe scrolls instead of moving M; arrow keys alone complete the scan; slider fallback finds both turning points; animations off |
| 5. Other lessons unaffected | 1440 | a lesson outside the config renders the text journey (`lesson-journey` present, `interactive-lesson` absent); `?view=classic` works; old progress `y-3` resumes on `mo-rong` |

For journey 5 the local QA database has a second published lesson (the P2 node) carrying a copy of the P1 article, so a non-pilot lesson with a graph could be opened. This exists only in the local QA database.

### Performance (390 px, 4× CPU slowdown)

| | Before (audit) | After |
|---|---|---|
| Moving M, input to painted frame | median 33 ms | median 33.3 ms, p95 39.9 ms |
| JS transferred for the lesson page | 198 KB | 223 KB |

The running dot moves with `requestAnimationFrame` and direct attribute updates, without re-rendering React.

---

## G. Known issues and limitations

- **Polynomials only.** The interactive path is used only when the GRAPH function is a polynomial; other lessons keep the text journey. The derivative step for rational functions is not built.
- **Practice functions for P1 come from the config fallback** until an admin fills "Hàm cho học sinh tự làm" in the editor (the field and its validation are in place). The admin preview tab still shows the text journey.
- **Progress stays in the browser** (localStorage), like today's lessons. Activity outcomes are not sent to the server.
- **"Chưa hiểu chỗ này?" (lesson assist) is not shown** in the interactive version.
- In the automated mobile run, a finger drag started within a few milliseconds of answering the f′ = 0 prediction was ignored once; the test now waits 0.4 s before dragging. Real students are unlikely to hit this, but it is not root-caused.
- Maths in summaries uses the existing inline renderer (serif, a little small in the graph caption).
- On full-page screenshots, sticky elements look shifted (capture artefact). At tablet width the app's existing floating menu button can sit over the part bar while scrolling, as on other pages.
- Copy (Vietnamese wording of prompts and hints) has not been reviewed by a teacher.

---

## H. Owner review

Please check, on the screenshots or locally:

1. Is the order right (find turning points → drag the tangent → state the rule → f′ = 0 → solve → challenge)?
2. Is the amount of interaction right for a 15-minute lesson, or should a part be shorter?
3. The wording of prompts, hints and the "why it's wrong" messages.
4. The look on a real phone (sticky graph + bottom dock).
5. Whether the practice functions should be filled by the admin field before any wider use.

Nothing here is merged or deployed. Recommendation and next steps are in the PR description.

### Run it locally

```bash
git checkout feature/interactive-math-p1-prototype
pnpm install
# A database with the P1 article (any copy of Production content, read-only export):
export DATABASE_URL=postgres://…
pnpm build && pnpm start          # or: pnpm dev
# Sign in as a student, open /student/lessons/knowledge-45c34e43-ad2e-47bf-8845-68782b67cfb9
# Compare with the current version: …?view=classic
# Turn the prototype off: TUTAI_INTERACTIVE_LESSONS=off pnpm start
```

Re-run the browser journeys against a running build:

```bash
BASE=http://localhost:3000 node docs/reviews/interactive-math-p1/e2e/journeys.mjs
# (if Playwright is installed elsewhere: PLAYWRIGHT_FROM=/path/to/dir/with/node_modules/)
```
