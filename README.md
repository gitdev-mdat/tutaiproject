# Tú Tài

> Personalized learning platform for Grade 12 Vietnamese students.

## Tech Stack

- **Framework:** Next.js 16 (App Router, TypeScript), used for both the UI and the backend (Route Handlers, Server Actions)
- **Styling:** Tailwind CSS v4 + shadcn/ui
- **Package Manager:** pnpm
- **Linting:** ESLint + Prettier + lint-staged + Husky

## Getting Started

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Lint
pnpm lint

# Format
pnpm format
```

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for where code lives, the request flow,
authentication and admin access, persistence and environment variables.

In short: `app/` holds routes, layouts and API entry points; domain code lives in
`features/<domain>` (newer features) or `lib/<domain>` (older ones); `lib/auth`, `lib/ai`,
`lib/db` and `lib/config` are infrastructure; `components/ui` holds shadcn primitives.

## SEO Architecture

SEO is configured at the root layout level with:

- **metadataBase** — set to `NEXT_PUBLIC_SITE_URL`
- **Dynamic `<title>`** — using Next.js metadata API with title templates
- **OpenGraph** — configured for all pages
- **Twitter Cards** — configured for social sharing
- **Canonical URLs** — set via `alternates`
- **robots.txt** — generated at `/robots.txt`
- **Sitemap** — generated at `/sitemap.xml`
- **Breadcrumb-ready** — route structure supports breadcrumb schema

## Design System

The design system is in `design-system/README.md`. Design tokens, color palettes, typography scales, and component conventions will be documented there.

## Sprint 0 Scope

- [x] Project initialization
- [x] ESLint + Prettier + Husky + lint-staged
- [x] shadcn/ui foundation
- [x] Route architecture (public, auth, student, teacher, admin)
- [x] SEO infrastructure (sitemap, robots, metadata API)
- [x] Type definitions (auth, content, curriculum, roadmap)
- [x] Design system folder structure

## Postponed

- Authentication (NextAuth)
- Database schema (Supabase)
- AI features (LLM integration)
- Payment integration
- PDF parsing / OCR
- Content features
- Teacher portal
- Admin portal
