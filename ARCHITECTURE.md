# Tú Tài — Architecture

_Last Updated: 2026-10-10_
_Status: Active_

Tú Tài is one Next.js 16 (App Router) application that serves the public site, the
student area and the admin area, and also provides the backend through Route Handlers
and Server Actions. It is deployed to Vercel. There is no separate backend service, and
none is needed for the current product.

## Where code lives

| Folder         | Owns                                                                                                                                                                                                                      | Must not                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `app/`         | Routes, layouts, page composition, Route Handlers (`app/api`), Server Actions next to the page that uses them, metadata, sitemap, robots.                                                                                 | Hold business rules or file/database access beyond calling a service. |
| `features/`    | Domain features built since the student redesign: `lessons`, `progress`, `roadmap`, `student-experience`. UI, hooks and domain logic together.                                                                            | Import another feature's internals.                                   |
| `lib/<domain>` | Older domain modules: `knowledge-tree`, `question-bank`, `exams`, `exam-sets`, `content-import`, `pipeline`, `knowledge-graph`, `student`, `onboarding`, `navigation`, `teachers`, `blog`. Services, validation, storage. | Import React components.                                              |
| `lib/` infra   | Cross-cutting technical code: `auth`, `ai`, `db`, `config`, `utils.ts`, `admin` (workspace layout state).                                                                                                                 | Contain one feature's rules.                                          |
| `components/`  | `ui/` (shadcn primitives), `shared/` and `layout/` (reused across areas), plus area UI: `home` (landing), `admin/*`, `exam-sets`, `competitions`, `blog`, `teachers`, `student`, `learning`, `auth`, `onboarding`.        | Import storage or `server-only` modules.                              |
| `data/`        | Seed and runtime JSON (see Persistence).                                                                                                                                                                                  |                                                                       |
| `scripts/`     | One-off operational scripts run with Node directly.                                                                                                                                                                       |                                                                       |

Direction for new work: put a new domain in `features/<domain>/` (`components/`, `hooks/`,
`lib/`), keep `lib/` for infrastructure, and move an existing `lib/<domain>` folder into
`features/` only in a dedicated rename-only change when that domain is next reworked
(for the curriculum, after PR #1 merges). Moving everything at once would only reshuffle
imports and collide with open work.

## Request flow

```
Client component ──fetch──▶ app/api/**/route.ts ──▶ lib/<domain> service ──▶ storage module ──▶ data/*.json
Server component ───────────────────────────────────▶ lib/<domain> service (direct call, no HTTP)
Form/button      ──Server Action (app/**/actions.ts)─▶ lib/<domain> service
```

- Route Handlers stay thin: check access, parse input, call a service, map errors to a status.
- Server Components call services directly instead of fetching the app's own API
  (for example `/student/lessons` reads the published knowledge tree on the server).
- Storage and provider modules start with `import 'server-only'`, so importing them from a
  client component fails the build.

## Authentication and authorization

- Sessions: `lib/auth/session.ts` sets an httpOnly `tutai_session` cookie; the session
  record lives in the auth store. Password and Google sign-in are supported.
- Students: `app/student/layout.tsx` requires a session and an active student lifecycle;
  student API routes call `requireDemoStudentSession()` and only touch that student's data.
- Admins: `lib/auth/admin.ts`. An admin is a signed-in user whose **verified** email (today:
  Google sign-in) is listed in `ADMIN_EMAILS` (comma-separated). Everyone else is denied,
  in every environment. For local work without Google sign-in, set `ADMIN_DEV_BYPASS=1`;
  it is honoured only under `next dev` (`NODE_ENV=development`) and ignored by
  `next start`, previews and production.
  - Pages: `app/admin/layout.tsx` calls `requireAdminPage()`; admin pages that read data on
    the server call it again.
  - Route Handlers: every handler under `/api/knowledge-tree`, `/api/knowledge-graph`,
    `/api/knowledge-import`, `/api/question-bank`, `/api/exams` and `/api/content-import`
    starts with `adminApiGuard()`, including `/api/question-bank/assets/*`, which serves
    imported question images and source documents (PDF, DOCX) and is only used by the
    admin import editor. If students later see question-bank images, serve them through a
    route that checks the question is approved and published, not by reopening this one.
  - Server Actions: `requireAdmin()` (payments).
- Treat every Route Handler and Server Action as callable directly by anyone; never rely on
  the UI hiding a button.

## AI (Gemini)

- `lib/ai/gemini-client.ts` is server-only and reads `GEMINI_API_KEY`. Import it with
  `await import()` inside the function that needs it, so builds do not require the key.
- Model names live in `lib/config/models.ts`.
- Lesson drafting (`lib/knowledge-tree/ai-lesson-draft-service.ts`) is admin-only and still
  switched off in production builds; the AI tutor (`/api/ai-tutor`) requires a signed-in user.

## Persistence

All mutable data is JSON on the local filesystem:

| Data                         | File                                                    |
| ---------------------------- | ------------------------------------------------------- |
| Accounts, sessions, profiles | `data/runtime/auth-store.json` (`AUTH_STORE_PATH`)      |
| Knowledge tree and lessons   | `data/knowledge-tree/tree.json`, `articles.json`        |
| Question bank and assets     | `data/question-bank/**`                                 |
| Exams                        | `data/exams/exams.json` (`TUTAI_EXAMS_FILE`)            |
| Knowledge graph              | `data/knowledge-graph/graph.json`                       |
| Orders and subscriptions     | `data/mock-orders.json`, `data/mock-subscriptions.json` |
| Student roadmaps             | `data/roadmaps/student-roadmaps.json`                   |
| Import sessions              | `tmp/content-imports/**`                                |

This works on a single long-running server. On Vercel the filesystem is not durable, so
writes are lost between instances and deployments. Moving to a managed Postgres database is
the main open infrastructure decision; the storage modules listed above are the seam where a
database implementation would replace the file reads and writes.

## Environment variables

| Name                                                              | Used for                                      |
| ----------------------------------------------------------------- | --------------------------------------------- |
| `ADMIN_EMAILS`                                                    | Admin allowlist (required in production)      |
| `ADMIN_DEV_BYPASS=1`                                              | Open admin under `next dev` only (opt-in)     |
| `GEMINI_API_KEY`                                                  | Gemini calls (server only)                    |
| `GEMINI_*_MODEL`, `KNOWLEDGE_AI_PROVIDER`                         | Model overrides, mock provider for local work |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | Google sign-in                                |
| `NEXT_PUBLIC_SITE_URL`                                            | Canonical URLs, sitemap, robots               |
| `AUTH_STORE_PATH`, `TUTAI_EXAMS_FILE`                             | Override JSON store locations                 |

## Checks

```bash
pnpm exec tsc --noEmit   # types
pnpm lint                # ESLint + Prettier
pnpm test                # Vitest (lib/** and features/** suites listed in vitest.config.ts)
pnpm build               # production build
```
