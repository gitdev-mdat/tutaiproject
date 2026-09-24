# 1. Executive diagnosis

**Observed evidence.** The rendered page was reviewed at 1440×900, 320×568, 360×800, 390×844, and 430×932. Its visible order is Hero → subject proof → personalized learning loop → daily product experience → arena → pricing. The premium navy/blue identity, explicit “lớp 12” eyebrow, 9+ outcome, and dominant blue CTA make relevance fast to recognize. Mobile has no horizontal overflow at 390 px. The primary CTA opens `/onboarding/goal`, a four-step goal flow.

**Reviewer inference.** Initial relevance is clear, but the page is mentally expensive after that: the promise is stronger than the proof, the CTA does not preview its commitment, and several visually rich proof objects ask for interpretation. This is not evidence that richness or multiple actions are inherently harmful; it is a mismatch between what a new visitor needs first and what receives visual weight. Exactly three preferred changes are: (1) make one state-aware roadmap CTA explain its next step, (2) replace/compress decorative hero proof into one legible, credible product state, and (3) move a concise trust/free expectation beside the first commitment and defer secondary complexity.

# 2. Predicted scan path

**Desktop, observed hierarchy then inference:** 1) “9+” headline, 2) graduate image, 3) blue “Xây lộ trình của em”, 4) roadmap/progress overlay, 5) explanatory paragraph, 6) header navigation/header CTA. The headline and image dominate by scale; saturated blue makes the CTA next. The many header choices and layered cards become parallel scan branches.

**Mobile:** 1) logo/menu, 2) audience eyebrow, 3) four-line 9+ headline, 4) explanation, 5) dominant CTA, 6) graduate/product composite. At 390×844 there are **7 distinct attention targets** in the first viewport: logo, menu, eyebrow, headline, explanatory copy, CTA, and composite visual. Only one message (personalized grade-12 route toward the target), one emotional visual, and one dominant action should survive; logo/menu may remain functional but quiet, while decorative formulas/cards should not become separate targets.

Complexity classification: headline/CTA/audience cue are **useful**; a single readable product state is **useful**; graduate imagery is **decorative**; multiple tiny metrics/formulas/overlays are **unnecessary at this stage**. Decision treatment: primary journey **KEEP**; explanation **SIMPLIFY**; detailed adaptive mechanics **DEFER**; redundant decorative metrics **REMOVE**; roadmap preview and next-step explanation **MERGE**.

# 3. CTA map

| Label                                        | Location                                   |                      Priority | Intent                  | Rendered/expected destination                                                                      | Conflict                                                                                              |
| -------------------------------------------- | ------------------------------------------ | ----------------------------: | ----------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Tú Tài logo                                  | header/footer                              |                           low | home                    | `/`                                                                                                | none                                                                                                  |
| Product/subject/arena/pricing navigation     | desktop header/mobile menu                 |           medium collectively | explore                 | section anchors                                                                                    | navigation creates many early decisions; keep but quiet                                               |
| Đăng nhập                                    | desktop header/menu                        |                     secondary | authenticate/continue   | login flow                                                                                         | competes mildly with start; correct for returning users                                               |
| Xây lộ trình của em                          | header and hero on desktop; hero on mobile |                       primary | start personalization   | verified `/onboarding/goal`, step 1/4                                                              | exact repetition is useful across separated contexts, redundant when both are in one desktop viewport |
| Xem lộ trình mẫu                             | hero secondary (desktop presentation)      |                     secondary | reduce uncertainty      | observed to scroll toward roadmap/product explanation rather than a clearly labeled sample section | information scent is ambiguous; target should match an actual rendered ID and promise                 |
| Toán/Vật lý/Hóa học/Sinh học — Xem môn học   | subject cards                              |                      tertiary | inspect content         | subject destination                                                                                | four peer choices are acceptable after subject proof, not primary conversion                          |
| Xem Tú Tài chọn bài cho em                   | daily-experience section                   |                     secondary | inspect personalization | product-demo/detail anchor                                                                         | useful contextual continuation; wording implies demonstration                                         |
| Học / Học ngay                               | product demo                               | simulated/high inside preview | understand daily action | demo/product route                                                                                 | can look like a live competing CTA unless clearly marked preview                                      |
| Khám phá Đấu trường                          | arena                                      |                     secondary | inspect competition     | arena route/section                                                                                | separate journey; appropriately later, but should not rival roadmap start                             |
| Bắt đầu miễn phí                             | pricing intro/Free card                    |            primary at pricing | begin free use          | onboarding/start                                                                                   | good lower-page reinforcement; wording usefully adds price expectation                                |
| 6 tháng / 12 tháng · Tiết kiệm 99k           | pricing selector                           |                       control | choose billing term     | changes displayed plan                                                                             | legitimate local decision; default and savings must remain transparent                                |
| Nâng cấp Plus · 349.000đ                     | Plus pricing card                          |                 primary local | purchase/upgrade        | upgrade/auth flow                                                                                  | only appropriate after features and price are understood                                              |
| Footer product/resource/company/social links | footer                                     |                           low | reference/explore       | named routes/external channels                                                                     | no conflict due to placement                                                                          |

Auth-state issue: logged-out start was verified; it opens onboarding rather than login. The interface does not visibly demonstrate a returning partial-onboarding label/destination. For returning users, use “Tiếp tục lộ trình” and route to the saved step or roadmap; for existing-roadmap users, use “Học tiếp hôm nay” and route to today’s next item. Do not show a start-over label.

# 4. 3-second / 5-second test

**3 seconds.** Likely first notice: 9+ goal, aspirational student image, then blue CTA. Likely interpretation: exam preparation for grade 12 with personalization. Likely missed: how personalization works, whether it is free, credibility of content, and what CTA commitment entails. Desktop has competing image, overlays, two same-journey CTAs, and navigation; mobile is more disciplined but the headline consumes much of the viewport.

**5-second questions:**

- **Tú Tài là gì? — CLEAR.** “Lộ trình cá nhân hoá cho học sinh lớp 12” and the supporting paragraph identify the category and audience.
- **Tú Tài giúp mình như thế nào? — PARTIALLY CLEAR.** It promises a capability-based, goal-based roadmap and focused progress, but visible evidence does not yet prove diagnosis or adaptation.
- **Mình nên bấm nút nào? — CLEAR for logged-out users, PARTIALLY CLEAR across states.** The blue roadmap CTA dominates, but its four-step consequence and returning-user behavior are not disclosed.

Trust timing: subjects and product previews arrive early enough after the hero, but teacher credibility and outcomes are not visibly substantiated; “37 học sinh đang học”, content totals, 9+ targets, and decorative progress states should not be treated as proof without methodology/context. Pricing is transparent later, but “free” should be known earlier. Product previews help, yet tiny hero preview text limits credibility.

CTA hypotheses: H1 **applies on desktop first viewport** because header/start/sample/navigation share one decision context; not strongly on mobile closed-menu. H2 **applies**: repetition helps after subject/product context but header + hero duplication is redundant. H3 **does not strongly apply**: the secondary sample action is visually quieter, perhaps too quiet. H4 **applies on desktop**: navigation is a visible decision set before comprehension; closed mobile navigation limits this. H5 **applies**: “build my roadmap” sounds consequential before effort, account, and free status are known.

# 5. Fast-scanning student simulation

| Stage         | Notice                                               | Understand                       | Unsure                                            | Leave risk                                      | Continuation cue                                         |
| ------------- | ---------------------------------------------------- | -------------------------------- | ------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------- |
| 0–3s          | 9+, navy hero, student, blue button                  | “For grade-12 exam prep”         | Is 9+ a promise?                                  | imagery feels generic/mismatched                | explicit audience and goal                               |
| 3–8s          | personalization sentence and roadmap visual          | route depends on ability/goal    | what happens after click; free/account?           | perceived setup effort                          | one obvious CTA                                          |
| 8–15s         | subject cards, four subjects, activity/count figures | content exists beyond marketing  | source/meaning of figures and content depth       | metrics look promotional                        | recognizable subjects                                    |
| First scroll  | short learn–practice–diagnose–review loop            | differentiation becomes concrete | whether diagnosis is real and how often it adapts | dense cards require decoding                    | stepwise loop and product language                       |
| Second scroll | daily recommendation/product UI, then arena          | what a day may look like         | proof of outcomes/teacher authority               | arena becomes a detour before trust is complete | readable next-task example and later transparent pricing |

This is a scenario-based design inference, not a claim about all students.

# 6. P0

1. **Problem:** CTA commitment and state are unclear. **Evidence:** “Xây lộ trình của em” opens step 1/4 at `/onboarding/goal`, while no first-viewport copy says four steps, free, or saved/return behavior. **Mechanism:** uncertain cost and outcome increase perceived effort. **Consequence:** hesitation or abandonment. **Direction:** one state-aware CTA plus one-line expectation (“4 bước · miễn phí · khoảng …”), with saved-progress routing.
2. **Problem:** hero proof is visually rich but weakly legible/credible. **Evidence:** at 390 px the graduate/photo composite and tiny roadmap panel occupy substantial space; product detail is hard to read, and the University of Melbourne document does not directly evidence Vietnamese THPT preparation. **Mechanism:** decoration captures attention without answering “how does this work?”. **Consequence:** promise outruns trust. **Direction:** merge to one readable real product state; retain one supportive human visual, remove unrelated credential cues and decorative metrics.
3. **Problem:** critical trust/free expectations arrive after the first ask. **Evidence:** “Bắt đầu miễn phí” appears at pricing, while first CTA asks to build a roadmap; visible activity/content figures and 9+ claim lack context, and teacher/outcome proof is not evident before commitment. **Mechanism:** weak information scent and delayed risk reduction. **Consequence:** users may leave rather than test onboarding. **Direction:** place a concise honest free/effort statement and one verifiable proof item near the hero CTA; progressively disclose adaptive loop, arena, and pricing.

# 7. P1

- Simplify desktop navigation emphasis while preserving access; group lower-intent links in the menu.
- Rename the sample-roadmap action or retarget it to an actual, clearly labeled sample section; validate anchor IDs.
- Compress mobile headline/body enough to let a readable proof edge enter the first viewport, without shrinking type below comfortable reading.
- Label simulated “Học/Học ngay” controls as product preview if they are not intended as page navigation.
- Add context to activity/content figures (definition, update time, coverage); otherwise remove them as trust claims.
- Bring content quality, reviewer/teacher identity, and realistic outcomes before arena promotion.
- Preserve transparent 6/12-month selection and explain billing total/renewal without urgency.

# 8. P2

- Reduce decorative formulas/particle motion and respect `prefers-reduced-motion`.
- Refine card spacing and section rhythm after hierarchy changes, retaining navy/blue and restrained mint/amber semantics.
- Standardize hover, focus-visible, active, and touch feedback across primary/secondary actions.
- Consider mascot motion only after comprehension and state behavior are validated.

# 9. Recommended mobile story

1. **Hero:** audience/product identity + concrete benefit + one state-aware CTA + effort/free expectation.
2. **Subject/content proof:** show recognizable curriculum coverage and one contextualized quality fact.
3. **Readable product outcome:** a single example of today’s recommended task and why it was selected.
4. **Personalized learning loop:** progressively explain learn → practice → diagnose → review.
5. **Trust:** content review method, credible educators, transparent limits, and evidence-based outcomes (only where substantiated).
6. **Arena:** optional motivation/competition after core journey is understood.
7. **Free/Plus pricing:** transparent comparison and duration control.
8. **Final state-aware CTA:** reinforce the same journey.

The current order is close, but the daily product experience should become the primary early proof, and trust should precede the arena detour.

# 10. CTA strategy

- **Primary:** one saturated blue, state-aware journey: logged out “Tạo lộ trình miễn phí”; partial setup “Tiếp tục thiết lập”; existing roadmap “Học tiếp hôm nay”. Destinations: onboarding step 1, saved onboarding step, and today’s roadmap item respectively.
- **Secondary:** “Xem lộ trình mẫu” as a quiet text/outline action that lands on a genuine readable sample; do not duplicate it with another equally strong action.
- **Navigation:** access-oriented and lower contrast; mobile menu closed by default, trapped focus while open, Escape closes and restores trigger focus.
- **Contextual:** subject, arena, and upgrade actions remain local to their sections. Repeat the primary only after meaningful new context.
- **Interaction:** keyboard-visible focus and adequate touch targets; hover must not be the only signal. Reduced motion must preserve state and destination clarity.

# 11. Welcome mascot assessment

**GOOD WITH CONDITIONS.** It could add warmth and brand recognition, but current comprehension/trust work has higher priority. If tested: 1–1.5 seconds, anchored to a quiet lower corner after the hero has stabilized, first visit only (not every reload), mobile-first but not mobile-only without evidence, and replaced by a static greeting under reduced motion. It must never cover or shift the headline, CTA, navigation/menu, pricing control, form choice, focus indicator, or product evidence. No audio, forced dismissal, looping, or replay during the session.

# 12. What should NOT change

Protect the premium navy/light-surface identity, strong Vietnamese headline hierarchy, grade-12 specificity, controlled blue primary accent, native scrolling, subject recognizability, concrete learn–practice–review explanation, realistic daily-task concept, later arena option, and transparent Free/Plus structure. Do not flatten all richness into an unstyled page, remove useful navigation blindly, turn metrics into fake proof, add urgency, or promise 9+ as a guaranteed outcome.

# 13. Proposed next implementation task

Implement only the three validated P0 changes: (1) introduce a single state-aware roadmap CTA system for logged-out, partial-onboarding, and existing-roadmap users, with explicit free/step expectation and deterministic destinations; (2) simplify the hero to one emotional visual plus one legible real roadmap/product state, removing unrelated credential imagery and decorative metric competition; (3) place one substantiated content/trust fact and free expectation before the first commitment, then defer detailed adaptation, arena, and pricing through the existing story. Preserve current brand tokens, responsive typography, subject proof, and pricing transparency. Verify at 1440×900, 320×568, 360×800, 390×844, and 430×932; test closed/open menu focus trap and Escape, keyboard/touch/focus states, all three auth/onboarding CTA states, 6/12-month pricing, and reduced motion. Success means the 390×844 viewport presents one message, one emotional visual, one dominant action, and a predictable next step without clipping or horizontal overflow.

Evidence artifacts: `.ai/crew/run-artifacts/c174571a9413/implementer/visual/desktop-initial-1440x900.png`, `mobile-320-320x568.png`, `mobile-360-360x800.png`, `mobile-390-390x844.png`, and `mobile-430-430x932.png`. Runtime emitted only development HMR WebSocket handshake errors; no page errors or horizontal overflow were reported.
