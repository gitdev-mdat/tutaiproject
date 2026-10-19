# Textbook reference backend

Last Updated: 2026-10-19
Status: local pilot plus durable PostgreSQL/Storage adapter; isolated integration pending

## Existing curriculum persistence audit

The application has two modes, selected by `DATABASE_URL`:

- In the current local checkout no `DATABASE_URL` is configured, so curriculum reads and writes use the JSON files under `data/`.
- With `DATABASE_URL`, `tutai.content_documents` is the durable source for `knowledge-tree/tree`, `knowledge-tree/articles`, the three Question Bank documents, and `exams/exams`. The Knowledge Tree service reads this same store; the textbook API now does too. A missing database document reads as empty rather than silently restoring a JSON seed.
- Student roadmaps and practice/exam attempts use dedicated PostgreSQL tables when the database is configured.
- PostgreSQL is also the durable auth/student-profile store. The `tutai` schema is server-only, has RLS enabled, and grants no access to browser `anon`/`authenticated` roles.
- Question Bank metadata is in `content_documents`, but imported binary assets and legacy Knowledge Graph data still use filesystem/JSON paths. Those are separate existing persistence gaps; this backend does not migrate or rewrite them.
- This repository has no Supabase Storage client/configuration in the current local environment. The adapter added here uses the configured Supabase Storage HTTP API only when the owner supplies a private bucket and server-only service key. It does not create a bucket or change Supabase/Vercel resources.

The authoritative Knowledge Tree identifier is the existing node `id` read from `readKnowledgeTree()`. Textbook mappings store that ID; they never create curriculum nodes. Knowledge Tree nodes, lesson articles, questions, and exam definitions are not copied into the textbook tables.

## Durable backend

Migration `db/migrations/0004_textbook_reference.sql` adds dedicated tables under `tutai` for document metadata, page anchors, TOC entries and parent relationships, Knowledge Tree mappings, extraction jobs, and reviewable artifacts. PDF bytes never enter PostgreSQL. Artifact payloads stay structured JSON and include source-page provenance.

The original PDF is stored as `documents/<sha256>.pdf` in the configured Supabase Storage bucket. Registration deduplicates by SHA-256 in PostgreSQL and uses the same deterministic object key. The adapter verifies the bucket reports `public: false` before upload, download, or cleanup; it does not issue public or signed URLs. Production APIs fail closed unless PostgreSQL and all private-storage settings are configured.

The current registration entry point is the server-side CLI, which accepts a local PDF path; it does not accept a filesystem path from an HTTP request. The existing 50 MB fixture must not be sent through a Vercel function. A browser-to-private-storage upload handshake is not implemented yet, so a future Admin UI that uploads new PDFs needs a separately reviewed signed-upload protocol. The UI can already list/browse durable documents and use the mapping, extraction, status, and review APIs below.

Required server-only settings:

```text
DATABASE_URL
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
TEXTBOOK_STORAGE_BUCKET
```

The bucket must already exist and be private. Apply the migration only to an isolated test/staging database first. The local integration suite intentionally requires the exact database name `textbook_reference_test`; it never resets or drops a database, including `tutai_e2e`. This checkout cannot verify which settings or migrations are present in the live Production project.

The old `tmp/textbook-reference/` store remains available for local QA when `DATABASE_URL` is absent. It is not used as Production persistence. To copy this verified local pilot into a configured isolated durable backend without another Gemini call:

```powershell
$env:DATABASE_URL = "<isolated-db-connection-ending-in-textbook_reference_test>"
pnpm db:migrate
pnpm textbooks:import-local-pilot -- "C:\Users\ADMIN\Downloads\math_book_3.pdf"
# Or register a different local source PDF:
pnpm textbooks:register -- "C:\path\to\source.pdf" "Optional title"
```

Set the connection string from the database owner in the local shell only; do not commit it or run this migration command with Production credentials.

The import matches the source by SHA-256, uploads the PDF privately, and copies that document's observed TOC, anchors, mappings, extraction history, artifacts, and review statuses. It does not import other local documents or alter authored curriculum.

## Worker lifecycle

An Admin queues a bounded extraction through the API. A worker running on a machine with the repository, DB/storage credentials, Poppler, and Gemini credentials leases one job from PostgreSQL with `FOR UPDATE SKIP LOCKED`. A ten-minute lease allows another worker to resume after interruption. Each job stores status/attempt/error history in PostgreSQL. The worker downloads the private PDF to a short-lived scratch directory, renders only requested page crops, invokes Gemini, and removes the downloaded source and rendered pages afterward. A DB active-job uniqueness index prevents concurrent duplicate extraction keys. Existing artifacts, especially approved ones, are not overwritten by re-extraction.

No hosted background worker is configured by this change. The documented local worker runs only while its computer and network connection are available:

```powershell
pnpm textbooks:worker -- --once
```

Use `pnpm textbooks:worker` for one bounded job per invocation; run it again to continue the queue. Do not claim autonomous Production processing unless an always-on worker is separately deployed and authorized.

## TOC and pilot evidence

The provided PDF is scanned; registration samples text but does not OCR the book. The known first-topic pilot has 17 TOC entries, but the index is explicitly `PARTIAL`: only the monotonicity section and major headings observed on TOC PDF pages 5–7 are indexed. It is not a verified complete book index. Inspected anchors are printed pages 13, 29, 33, and 34 at PDF pages 7, 15, 17, and 18. Only the current matching monotonicity Knowledge Tree node is linkable; absent P1/P2 nodes are not inferred.

The extraction cap remains six printed pages per job. Existing exercise/solution matching, mathematical checks, provenance, `NEEDS_REVIEW` state, and extraction-key cache are retained. Approval is reference-only and cannot publish a lesson or question. There is no full-book OCR or automatic student-content update.

## Admin API contract for the future UI

All routes are server-side and require the existing `adminApiGuard()`. Students receive 401/403 and have no source-PDF endpoint. The service key is only read by server code.

### `GET /api/admin/textbooks?q=<heading>&nodeId=<node-id>&approvedOnly=true`

Returns:

```ts
{
  documents: TextbookDocumentRecord[]; // each document includes tocIndexCompleteness
  jobs: TextbookExtractionJob[];
  artifacts: TextbookArtifact[];
  mappings: (TextbookKnowledgeMapping & { knowledgeNodeTitle: string | null })[];
  candidates: Array<{
    documentId: string;
    entryId: string;
    entryHeading: string;
    candidates: Array<{
      knowledgeNodeId: string; title: string; confidence: number;
      status: 'EXACT_CANDIDATE' | 'CANDIDATE'; confirmationRequired: true;
    }>;
  }>;
}
```

`q` filters TOC headings. `nodeId` filters artifacts through a confirmed mapping. `approvedOnly=true` returns only approved artifacts; this is the retrieval contract for lesson drafting and must remain server-side.

### `POST /api/admin/textbooks`

- `{ action: 'confirm-mapping', documentId, entryId, knowledgeNodeId }` checks the document/entry and resolves the node against the current canonical tree before saving a confirmed mapping.
- `{ action: 'extract', documentId, entryIds, knowledgeNodeId, printedPages }` queues 1–6 printed pages within the selected TOC ranges and confirmed mapping. Returns 202 with a queued job or 200 on cache reuse.
- `{ action: 'review-artifact', artifactId, decision: 'approve' | 'reject' }` records human review. Approval never publishes to student-facing content.

Expected errors: 400 malformed body, 401 unauthenticated, 403 non-admin, 404 unknown document/entry/node/artifact, 422 invalid page range/mapping or uncertain anchor, 503 durable backend not configured, and 500 unexpected persistence/provider failure. Every mutation remains admin-only; there is no direct object URL response.

The server-side registration function is `registerTextbook(sourcePath, title?)`, exposed by `pnpm textbooks:register`. It returns `{ document, duplicate, scanDetection }`; duplicate identity is SHA-256, never filename. There is no HTTP upload endpoint yet, due to the source PDF size and serverless request limits.

## Verification

The opt-in durable integration test migrates and writes only to the exact `textbook_reference_test` database and verifies persistence, artifact approval protection, and exclusive job claiming. It is skipped when that database is not configured. The opt-in Storage integration test requires a bucket named exactly `textbook-reference-test`, uploads/downloads a fixture, and removes it. No tests touch Production or reset `tutai_e2e`.

This checkout currently has no DB or Supabase Storage credentials, and Docker is not running. Therefore migration, private object storage, and durable end-to-end restart/cache/review integration have not yet been executed here. The previous local PDF/Gemini pilot remains available in ignored `tmp/` data; do not present it as proof of durable persistence.
