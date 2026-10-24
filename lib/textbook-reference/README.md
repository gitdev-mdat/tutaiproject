# Textbook reference backend

Last Updated: 2026-10-23

Scanned textbooks are private authoring sources for the Knowledge Tree. The workflow has separate, persisted states:

upload → verify → page setup + table of contents (Gemini) → link a section to a Knowledge Tree node → extract chosen pages (Gemini) → Admin review → approved extracts ground AI lesson drafts.

An indexed book is not extracted, an extract is not approved until an Admin approves it, and an approved extract is only drafting context: it never becomes student content or a Question Bank item on its own.

## Storage

- PostgreSQL (`db/migrations/0006_textbook_reference.sql`, schema `tutai`, RLS on, no `anon`/`authenticated` grants): documents, uploads, page anchors, outline entries, mappings, jobs, artifacts, worker heartbeats. Every write is a targeted statement (`repository.ts`).
- Supabase Storage, one **private** bucket: `documents/<sha256>.pdf`. The server verifies `public: false` before every use and never issues download URLs. The service key is read only on the server.

Required server settings (names only; all four or the feature reports "not configured" with HTTP 503):

```text
DATABASE_URL  SUPABASE_URL  SUPABASE_SERVICE_ROLE_KEY  TEXTBOOK_STORAGE_BUCKET
```

Optional: `SUPABASE_PUBLISHABLE_KEY` (or `SUPABASE_ANON_KEY`) if the Storage gateway requires an `apikey` header on signed uploads. The worker also needs `GEMINI_API_KEY`.

## Browser upload

`POST /api/admin/textbooks {action:'upload-init'}` (Admin only) checks the SHA-256 the browser computed: a known book is returned as a duplicate before any byte is sent. Otherwise the server opens one pending upload per hash and returns a signed token for exactly that object. The browser uploads straight to Storage's resumable (TUS) endpoint in 6 MB chunks (`tus-upload.ts`), so the PDF never passes through a Vercel function. An interrupted upload resumes from Storage's offset; `upload-complete` checks the stored size and queues a `VERIFY` job, which checks the checksum and page count. Limit: 50 MB (the Supabase free-plan file limit; the bucket is created with it).

## Processing jobs

Jobs run in two places that share one queue: the Admin route itself and the optional local worker.

- **On Vercel (default):** after `upload-complete`, `index-toc` or `extract` queues a job, the route drains the queue in `after()` (`inline-runner.ts`, `maxDuration = 300`). Each job is one PDF download, a few page renders and at most one Gemini call (120 s timeout), and new jobs are only started in the first 60 s, so a job finishes inside the function. A job that is still queued, or whose run was cut off (lease expired), is picked up again the next time an Admin opens the library or the book. Set `TEXTBOOK_INLINE_PROCESSING=off` to disable.
- **Locally:** `pnpm textbooks:worker` polls the same queue and reports a heartbeat; `-- --once` runs one job.

Jobs are leased with `FOR UPDATE SKIP LOCKED` for 6 minutes; a job whose worker died is resumed by the next worker, a worker that lost its lease cannot overwrite the result, and a job interrupted 3 times fails with `INTERRUPTED` instead of looping. Repeated requests for the same work return the queued or running job (`job_key`). Rendering uses pdf.js with its wasm decoders (JBIG2/JPEG 2000), so no Poppler install is needed.

The book's status changes when a worker _starts_ (`INDEXING`), not when a job is queued. Failures are classified in `job-errors.ts` (`BILLING` for Gemini HTTP 402, `QUOTA` for 429, `AUTH`, `MODEL`, `UNAVAILABLE`, `TIMEOUT`, `OUTPUT_LIMIT`, `INTERRUPTED`, `FILE`, `UNKNOWN`); the job stores a plain message, the class, a short technical detail and whether retrying can help. A re-read of an existing outline needs `replace: true`, and a failed re-read keeps the old outline.

The Admin UI derives one status per book from the book row and its newest setup job (`processing-state.ts`): waiting, running (with real elapsed time; the single Gemini call has no measurable percentage), interrupted, failed with its reason, or ready. Technical facts are under "Chi tiết kỹ thuật"; earlier attempts under "Lịch sử xử lý".

Extraction is cached by `sha256(file, pages, sections, prompt version, model)`: a repeated request returns the stored artifacts without calling Gemini, and so does a request whose pages already have artifacts from an earlier prompt version (no duplicates of reviewed material).

## Exercise pages and solutions

Exercise-only pages are first-class (`extraction-response.ts`, prompt `textbook-knowledge-v9`): every printed question is its own `EXERCISE` artifact with its number, statement, A–D choices, diagram flag, printed/PDF pages and exercise set (chapter + "Dạng n" from the outline). No solution is required and no answer is ever produced by the model: `answer` is `UNRESOLVED` until a solution printed in the book is matched.

Each returned item is validated on its own; valid items are stored even when others are rejected, cut off (`MAX_TOKENS` answers keep their finished items) or reported unreadable. A finished job records `outcome` (`COMPLETE` | `PARTIAL` | `EMPTY`) and `diagnostics` (images sent, per-page readability, rejected/unreadable items, finish reason, token usage). Failures are `INVALID_RESPONSE` (answered, nothing usable) or `UNREADABLE` (scan not readable), with usage kept. The same pages are not sent again after an `UNREADABLE`/`OUTPUT_LIMIT` failure or after 3 content failures; outages and quota limits never block them.

Solutions (`solution-matching.ts`) are matched across batches: same book, same chapter, same problem type (from the printed heading above the solution), same question number, and a mathematical check (same function restated, or the stated derivative is that function's). Only an unambiguous candidate pairs; a number alone never does. Lifecycle on the artifact: `solutionStatus` `UNRESOLVED` → `MATCHED`; "verified" is matched with both sides approved. Questions are reviewable at once, but AI drafting reads an exercise only with its approved solution, and nothing is published to students or the Question Bank.

## Admin API (`app/api/admin/textbooks/route.ts`)

All routes use `adminApiGuard()` (401 signed out, 403 non-admin) and reject cross-origin POSTs.

- `GET` library + worker status; `?documentId=` book with outline, jobs, artifacts, mappings; `?nodeId=` a lesson's linked sections, artifacts, jobs and suggestions.
- `POST` actions: `upload-init`, `upload-complete`, `upload-cancel`, `page-setup`, `index-toc` (`replace: true` to re-read an existing outline), `confirm-mapping`, `remove-mapping`, `extract` (1–6 printed pages inside a linked section), `cancel-job`, `review-artifact` (`approve` | `reject` | `reopen`), `edit-artifact` (only while awaiting review).

## Lesson drafting

`reference-service.ts` returns approved extracts reachable from a node through confirmed mappings (the section and its subsections), at most 6 items / 6000 characters, theory and method first. The AI draft panel shows them with book and page, the Admin can turn them off, and the draft is still only a proposal applied in the editor.

## Operations

```powershell
# isolated DB first; never point this at Production without the owner's decision
pnpm db:migrate
pnpm textbooks:setup-storage      # creates the private bucket if missing
pnpm textbooks:worker
pnpm textbooks:register -- C:\path\book.pdf "Title"          # optional CLI upload
pnpm textbooks:import-local-pilot -- C:\path\math_book_3.pdf  # copy the pre-database pilot
```

## Tests

`durable-integration.test.ts` runs only against a database named exactly `textbook_reference_test` and a bucket named exactly `textbook-reference-test` (`TEST_DATABASE_URL`, `TEST_SUPABASE_URL`, `TEST_SUPABASE_SERVICE_ROLE_KEY`, `TEST_TEXTBOOK_STORAGE_BUCKET`, `TEST_TEXTBOOK_PDF`). It is skipped, and reported as skipped, without them.
