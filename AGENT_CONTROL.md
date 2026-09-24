# AGENT_CONTROL — Tú Tài

This file provides operational constraints and guidance for all AI agents (human or automated) working in this repository.

---

## Phase Enforcement

The repository is in the **Product Documentation and Business Analysis** phase. The following are strictly prohibited until explicitly approved in a later phase:

| Prohibited Action                                         | Rationale                                                     |
| --------------------------------------------------------- | ------------------------------------------------------------- |
| Implement application features                            | Phase gate — features require documented specifications first |
| Create database migrations                                | Schema requires approved data model                           |
| Install dependencies (`npm install`, `pip install`, etc.) | No application yet                                            |
| Initialize Next.js or any framework scaffold              | Structure must be approved in ARCHITECTURE.md                 |
| Configure Supabase, Auth, or Storage                      | Requires separate infrastructure decision                     |
| Integrate AI providers (OpenAI, Anthropic, etc.)          | Requires AI_BOUNDARIES.md and provider decision               |
| Implement payments, billing, or subscription logic        | Business model not yet finalized                              |
| Write application source code                             | Not yet authorized                                            |
| Upload or process user-generated files                    | Storage layer not yet defined                                 |
| Assume business rules not in BUSINESS_RULES.md            | Must not invent product logic                                 |

---

## Documentation Authority Order

When two documents conflict, follow the higher-authority document and report the conflict via the decision log in `docs/DECISIONS.md`.

| Priority | Document                    |
| -------- | --------------------------- |
| 1        | `docs/PRODUCT_VISION.md`    |
| 2        | `docs/BUSINESS_RULES.md`    |
| 3        | `docs/MVP_SCOPE.md`         |
| 4        | `docs/ARCHITECTURE.md`      |
| 5        | `docs/DATABASE.md`          |
| 6        | `docs/DEVELOPMENT_RULES.md` |
| 7        | `docs/DECISIONS.md`         |
| 8        | `docs/PROJECT_STATUS.md`    |

---

## Scope Creep Prevention

When receiving task requests, agents must:

1. **Verify phase.** Check `docs/PROJECT_STATUS.md` to confirm the current phase before proceeding.
2. **Check authority.** If the request involves a topic not yet decided, escalate to the Open Decisions log in `docs/DECISIONS.md`.
3. **Decline invented decisions.** Do not assume pricing, AI providers, specific subject coverage, subscription limits, teacher revenue models, or curriculum data unless explicitly provided in product documentation.
4. **Keep docs in sync.** If a new decision is made, update `docs/DECISIONS.md` and relevant documents immediately.

---

## Naming Conventions

| Entity                 | Convention                                            | Example                       |
| ---------------------- | ----------------------------------------------------- | ----------------------------- |
| Repository / code name | `tutai` (lowercase, no spaces)                        | `tutai`                       |
| Display name           | Tú Tài (title case, with accent)                      | Tú Tài                        |
| Branch names           | `feature/short-description`, `docs/short-description` | `feature/onboarding-flow`     |
| Commit messages        | Imperative mood, short                                | `Add product vision document` |
| Business rules         | `BR-XX` prefix                                        | `BR-01`, `BR-02`              |

---

## File Naming

- All documentation files use `SCREAMING_SNAKE_CASE.md`
- Application source files use `camelCase` or `kebab-case` per TypeScript conventions
- Configuration files use the framework default (`next.config.js`, `tsconfig.json`, etc.)

---

## Open Decisions Protocol

All unresolved product or technical decisions must be recorded in `docs/DECISIONS.md` with:

- **Decision ID** (auto-incremented)
- **Topic** — what needs to be decided
- **Options considered** — at least two options with trade-offs
- **Status** — `OPEN`, `DECIDED`, `DEPRECATED`
- **Owner** — who is responsible for resolving this
- **Deadline** — when a decision is needed by
- **Resolution** — filled in when status changes to `DECIDED`

---

## AI Usage Guidelines

- AI explanations must be grounded in approved content sources where available (see `docs/AI_BOUNDARIES.md` and `docs/COPYRIGHT_AND_MODERATION.md`).
- AI-generated draft content must not be published automatically without human review.
- AI must not invent prerequisite relationships or restructure the curriculum.

---

## Communication Norms

- Do not use emojis in documentation or code comments.
- Use precise, unambiguous language.
- Every document must include a `Last Updated` header and a `Status` field.
- Open decisions must never be silently resolved — they must be explicitly documented.

---

_Last Updated: 2026-07-15_
_Status: Active_
