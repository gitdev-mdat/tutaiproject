# Textbook reference backend

Last Updated: 2026-10-20

Scanned textbooks are private authoring sources for the Knowledge Tree. The workflow has separate, persisted states:

upload → verify (worker) → page setup + table of contents (worker, Gemini) → link a section to a Knowledge Tree node → extract chosen pages (worker, Gemini) → Admin review → approved extracts ground AI lesson drafts.

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

## Worker

`pnpm textbooks:worker` polls the queue and reports a heartbeat; `-- --once` runs one job. Jobs are leased with `FOR UPDATE SKIP LOCKED` for 10 minutes; a job whose worker died is resumed by the next worker, and a worker that lost its lease cannot overwrite the result. Rendering uses pdf.js with its wasm decoders (JBIG2/JPEG 2000), so no Poppler install is needed. No hosted worker exists: when none is running, jobs stay queued and the Admin UI says so.

Extraction is cached by `sha256(file, pages, sections, prompt version, model)`: a repeated request returns the stored artifacts without calling Gemini.

## Admin API (`app/api/admin/textbooks/route.ts`)

All routes use `adminApiGuard()` (401 signed out, 403 non-admin) and reject cross-origin POSTs.

- `GET` library + worker status; `?documentId=` book with outline, jobs, artifacts, mappings; `?nodeId=` a lesson's linked sections, artifacts, jobs and suggestions.
- `POST` actions: `upload-init`, `upload-complete`, `upload-cancel`, `page-setup`, `index-toc`, `confirm-mapping`, `remove-mapping`, `extract` (1–6 printed pages inside a linked section), `cancel-job`, `review-artifact` (`approve` | `reject` | `reopen`), `edit-artifact` (only while awaiting review).

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
