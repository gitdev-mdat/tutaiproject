# Tú Tài

> Personalized learning platform for Grade 12 Vietnamese students.

## Tech Stack

- **Framework:** Next.js 15 (App Router, TypeScript)
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

### Route Groups

```
app/
├── (public)/          # Public website pages (SEO-optimized)
├── (auth)/            # Authentication pages
├── (student)/         # Authenticated student area
├── (teacher)/         # Teacher portal
├── (admin)/           # Admin panel
└── api/               # API routes (future)
```

### Project Structure

```
├── app/                      # Next.js App Router
│   ├── (public)/             # Public website
│   │   ├── subjects/         # Subject listing + [subject] detail
│   │   ├── topics/[topic]/   # Topic pages
│   │   ├── lessons/[slug]/   # Lesson pages
│   │   ├── practice/[slug]/  # Practice pages
│   │   ├── mock-exams/[slug]/# Mock exam pages
│   │   ├── teachers/[slug]/  # Teacher profile pages
│   │   ├── pricing/          # Pricing page
│   │   ├── blog/             # Blog
│   │   ├── about/            # About page
│   │   └── contact/          # Contact page
│   ├── (student)/            # Student portal
│   │   ├── dashboard/        # Main dashboard
│   │   ├── roadmap/          # Personalized roadmap
│   │   ├── flashcard/        # Flashcard sessions
│   │   ├── review/           # Spaced review sessions
│   │   └── profile/          # Student profile
│   ├── (teacher)/            # Teacher portal
│   │   ├── content/          # Content management
│   │   ├── uploads/          # Document uploads
│   │   ├── analytics/        # Performance analytics
│   │   ├── revenue/          # Revenue tracking
│   │   └── profile/          # Teacher profile
│   ├── (admin)/              # Admin panel
│   │   ├── users/            # User management
│   │   ├── moderation/       # Content moderation
│   │   ├── curriculum/       # Curriculum management
│   │   ├── reports/          # Platform reports
│   │   └── settings/         # Admin settings
│   ├── api/                  # API routes (placeholder)
│   ├── layout.tsx            # Root layout with SEO metadata
│   ├── sitemap.ts            # Dynamic sitemap
│   └── robots.ts             # robots.txt
├── components/
│   ├── ui/                   # shadcn/ui base components
│   ├── layout/               # Layout components (Header, Footer, etc.)
│   └── seo/                  # SEO components
├── config/
│   ├── site.ts               # Site-wide configuration
│   └── navigation.ts          # Navigation structure
├── constants/
│   └── index.ts              # Application constants
├── design-system/
│   └── README.md             # Design system documentation
├── features/                 # Feature-scoped modules
│   ├── auth/
│   ├── content/
│   ├── quiz/
│   ├── roadmap/
│   ├── teacher/
│   └── admin/
├── hooks/                    # Custom React hooks
├── lib/
│   ├── utils.ts              # Utility functions (cn, etc.)
│   ├── seo/                  # SEO helpers
│   ├── auth/                 # Auth utilities (future)
│   ├── db/                   # Database utilities (future)
│   └── analytics/            # Analytics utilities (future)
├── providers/                # React context providers
├── public/                   # Static assets
└── types/
    ├── auth/                 # Auth types
    ├── content/              # Content model types
    ├── curriculum/           # Curriculum model types
    └── roadmap/              # Roadmap model types
```

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
