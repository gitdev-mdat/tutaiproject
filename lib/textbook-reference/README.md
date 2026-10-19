# Textbook reference backend

Last Updated: 2026-10-19
Status: MVP, local single-instance worker

## Storage and lifecycle

The original PDF and index are stored under ignored local `tmp/textbook-reference/`:

- `private/<document-id>/<original-filename>` stores source PDFs.
- `index/store.json` stores documents, TOC entries, page anchors, mappings, jobs, and structured artifacts.

Registration is local CLI work because the supplied PDF is about 50 MB and should not pass through a Vercel request. Identical SHA-256 files reuse the same document record. The store uses atomic JSON replacement and is suitable only for a persistent, single-instance filesystem. It is not a durable Vercel production store; production requires a private object store and transactional database adapter. No migration is added because this repository uses JSON for non-account domains. The worker requires Poppler (`pdftoppm`) for scanned-page rendering; this was selected because the supplied document uses JBIG2 images that the installed PDF.js worker could not decode.

```powershell
pnpm textbooks:register -- "C:\path\to\book.pdf" [title]
pnpm textbooks:index-pilot -- "C:\Users\ADMIN\Downloads\math_book_3.pdf"
pnpm textbooks:worker -- --once
```

`index-pilot` reads PDF metadata and visually verified pilot anchors, writes the observed TOC hierarchy, and does not OCR the complete book. The worker handles one bounded job at a time, renders no more than six selected printed-page crops, then calls the existing Gemini client. A failed job stays visible with its error and can be queued again. AI artifacts stay `NEEDS_REVIEW` until an Admin reviews them.

## Admin API

Every route is protected by `adminApiGuard()`.

### `GET /api/admin/textbooks?q=<heading>&nodeId=<node-id>&approvedOnly=true`

Returns `documents`, `jobs`, `artifacts`, `mappings`, and TOC-to-Knowledge-Tree `candidates`. `q` filters indexed headings. `nodeId` filters artifacts through confirmed mappings. `approvedOnly=true` returns only reviewed artifacts for the lesson-authoring backend.

### `POST /api/admin/textbooks`

`{ "action": "confirm-mapping", "documentId": "...", "entryId": "...", "knowledgeNodeId": "..." }` explicitly persists an Admin-confirmed many-to-many mapping.

`{ "action": "extract", "documentId": "...", "knowledgeNodeId": "...", "entryIds": ["..."], "printedPages": [13, 14] }` validates the mapping and locations, then returns a persisted `QUEUED` job with HTTP 202. The local worker executes it. A cache hit returns existing artifacts and a completed job without calling Gemini.

`{ "action": "review-artifact", "artifactId": "...", "decision": "approve" }` or `"reject"` changes the Admin review state. Approval does not publish a lesson or question.

## States

- Document: `REGISTERED` → `INDEXED` → `EXTRACTING` → `EXTRACTED`; failed extraction sets `FAILED` and records the error.
- Mapping: `CANDIDATE` → `CONFIRMED` or `REJECTED`.
- Job: `QUEUED` → `RUNNING` → `COMPLETED` or `FAILED`; `PARTIAL` is reserved for a future checkpointed multi-batch worker.
- Artifact: `NEEDS_REVIEW` → `APPROVED` or `REJECTED`.

`INDEXED` means the heading and source location are recorded, not that the source content was understood or validated. Printed page numbers are kept separate from one-based PDF page numbers; uncertain locations block extraction.

## Current scope and limits

The pilot TOC records the first-topic monotonicity section and the major headings visible on TOC PDF pages 5–7. The inspected anchors are printed pages 13, 29, 33, and 34 at PDF pages 7, 15, 17, and 18. Other chapters have printed page headings only, so their PDF locations remain uncertain pending inspection. There is one matching canonical Knowledge Tree node for monotonicity; P1/P2 nodes are not present in the current tree. Extraction is deliberately capped at six printed pages per worker request. No OCR, Gemini call, or deep extraction is performed at registration.

The current filesystem store and worker are local MVP infrastructure. Do not point them at Production or claim a Vercel worker is available. No student endpoint exposes source PDFs or unapproved artifacts.
