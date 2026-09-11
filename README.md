# Accounting Platform

Bilingual Arabic / English accounting and ERP platform built as a production-oriented monorepo.

## Stack

- Next.js + React + TypeScript (`apps/web`)
- NestJS + TypeScript (`apps/api`)
- PostgreSQL + Prisma
- Docker Compose
- GitHub Actions CI

## Current scope

The project starts with a bilingual RTL/LTR accounting dashboard matching the approved blue/white design direction, plus the backend and database foundation for multi-company accounting, fiscal periods, chart of accounts, journals, customers, suppliers, tax, inventory/FIFO, sales, purchases, audit log, outbox events and idempotency.

## Local development

```bash
cp .env.example .env
docker compose up -d
pnpm install
pnpm --filter @accounting/api prisma:generate
pnpm --filter @accounting/api prisma:migrate
dev # or run: pnpm dev
```

Use `pnpm dev` from the repository root to run the web and API apps together.

## Quality gates

GitHub Actions runs Prisma client generation, TypeScript checks and production builds on pushes and pull requests to `main`.

## Architecture rule

Posted accounting journals are immutable. Corrections use reversals, monetary calculations use database decimals, tenant data is company-scoped, and production database invariants/RLS are applied through versioned SQL migrations in addition to Prisma migrations.
