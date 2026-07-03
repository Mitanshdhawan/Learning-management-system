# TOP LMS

Internal company Learning Management System (Udemy-style, employees only).

## Stack

- **Monorepo:** pnpm workspaces + Turborepo
- **Frontend:** Next.js 15 (App Router) + Tailwind — `apps/web` _(coming next)_
- **Backend:** Express + TypeScript, custom JWT auth — `apps/api` _(coming next)_
- **Database:** PostgreSQL + Prisma — `packages/db`
- **Validation:** Zod (shared) — `packages/validation`
- **Assets & video:** Cloudinary

## Structure

```
TOP LMS/
├─ apps/
│  ├─ web/          Next.js frontend        (coming next)
│  └─ api/          Express API             (coming next)
└─ packages/
   ├─ db/           Prisma schema + client
   └─ validation/   Shared Zod schemas
```

## Getting started

```bash
pnpm install
pnpm db:generate          # generate the Prisma client
# set DATABASE_URL in packages/db/.env, then:
pnpm db:migrate           # create tables
pnpm db:seed              # seed an admin user
pnpm dev                  # run all apps via Turborepo
```

## Database

The schema lives in [`packages/db/prisma/schema.prisma`](packages/db/prisma/schema.prisma).
It mirrors the dbdiagram.io design — 18 models. Files are never stored in Postgres;
`media_assets` holds only a Cloudinary key + metadata.

You need a PostgreSQL instance. For a free one without a credit card, **Neon** works well.
