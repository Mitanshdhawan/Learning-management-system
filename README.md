# TOP LMS

Internal company Learning Management System (Udemy-style, employees only). Admins and
approved creators author courses with real video/PDF content; employees enrol, watch, and
track their progress to completion.

## Stack

- **Monorepo:** pnpm workspaces + Turborepo
- **Frontend:** Next.js 15 (App Router) + Tailwind CSS + Framer Motion — `apps/web`
- **Backend:** Express 5 + TypeScript, custom JWT auth (access + refresh) — `apps/api`
- **Database:** PostgreSQL + Prisma — `packages/db`
- **Validation:** Zod (shared) — `packages/validation`
- **Assets & video:** Cloudinary (local disk fallback)

## Features

- **Auth** — custom JWT: short-lived access token (Bearer) + httpOnly refresh-token cookie,
  bcrypt password hashing, role-based access (`admin` / `manager` / `employee`), invite flow.
- **Course authoring** — multi-section curriculum builder with a deferred draft-commit model
  (nothing persists until Publish / Save changes), inline validation, and a category picker
  with inline "add new category".
- **Real media** — upload actual videos (duration auto-computed) and inline-viewable PDFs;
  in-app media viewer modal; free-preview rule (one video per course); orphaned Cloudinary
  uploads are cleaned up when a draft is discarded or an asset is replaced.
- **Enrolment & progress** — one-click enrol, per-lesson progress, auto-completion
  (video at 80% actually-watched — skips don't count; PDF on open), computed course %.
- **Learner experience** — "My Learning" with progress cards, and an immersive full-screen
  course player (no dashboard chrome; distraction-free PDF view with no print/download bar).
- **Safety** — type-to-confirm delete modals for courses and users.

## Structure

```
TOP LMS/
├─ apps/
│  ├─ web/          Next.js frontend (dashboard, course builder, player)
│  └─ api/          Express API (auth, courses, lessons, enrolments, media)
└─ packages/
   ├─ db/           Prisma schema + client
   └─ validation/   Shared Zod schemas
```

## Getting started

Requires Node 18+, pnpm, and a PostgreSQL database. For a free Postgres without a credit
card, **[Neon](https://neon.tech)** works well.

```bash
pnpm install

# 1. Configure env — copy each .example and fill in real values (see "Environment" below)
cp packages/db/.env.example packages/db/.env
cp apps/api/.env.example    apps/api/.env
cp apps/web/.env.example    apps/web/.env.local

# 2. Database
pnpm db:generate          # generate the Prisma client
pnpm db:migrate           # create tables
pnpm db:seed              # seed an admin user

# 3. Run everything (web on :3000, api on :4000)
pnpm dev
```

## Environment

Real `.env` files are gitignored — never commit them. Copy the `.example` files and fill in:

| File | Keys |
| --- | --- |
| `packages/db/.env` | `DATABASE_URL` (pooled), `DIRECT_URL` (direct, for migrations) |
| `apps/api/.env` | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, token TTLs, `CLOUDINARY_*` |
| `apps/web/.env.local` | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` |

Generate strong JWT secrets with `openssl rand -hex 32`. Cloudinary is optional — leave the
`CLOUDINARY_*` keys blank to store uploaded media on local disk instead.

> **Cloudinary + PDFs:** to serve PDFs inline, enable *"Allow delivery of PDF and ZIP files"*
> in your Cloudinary account's Security settings.

## Database

The schema lives in [`packages/db/prisma/schema.prisma`](packages/db/prisma/schema.prisma) —
18 models. Files are never stored in Postgres; `media_assets` holds only a Cloudinary key +
metadata (kind, duration, etc.).
