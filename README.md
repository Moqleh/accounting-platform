# Accounting Platform

Bilingual Arabic / English accounting and ERP platform built as a production-oriented monorepo.

## Stack

- Next.js + React + TypeScript (`apps/web`)
- NestJS + TypeScript (`apps/api`)
- PostgreSQL + Prisma
- Docker Compose
- GitHub Actions CI
- JWT authentication + company membership RBAC

## Implemented scope

The platform includes the approved bilingual RTL/LTR blue/navy interface, authenticated multi-company sessions, dashboard, customers, suppliers, items and warehouses, FIFO inventory, sales invoices, purchase bills, customer receipts, supplier payments, payment-to-document allocations, linked credit notes/returns with original FIFO cost restoration, double-entry journals and reversals, taxes, fiscal years/periods, year-end closing, trial balance, P&L, balance sheet, inventory valuation, account activity, receivable/payable aging, audit/outbox infrastructure, idempotent financial posting, PostgreSQL database invariants and RLS policies.

## Local development

Requirements: Node.js 22+, pnpm, Docker.

```bash
cp .env.example .env
# Set JWT_SECRET and SEED_ADMIN_PASSWORD in .env before seeding.
docker compose up -d
pnpm install
pnpm --filter @accounting/api prisma:generate
pnpm --filter @accounting/api exec prisma db push --skip-generate
PSQL_URL="${DATABASE_URL%%\?*}"
psql "$PSQL_URL" -v ON_ERROR_STOP=1 -f apps/api/prisma/security.sql
pnpm --filter @accounting/api prisma:seed
pnpm dev
```

The web app runs on `http://localhost:3000` and the API defaults to `http://localhost:4000/api`.

The development administrator email is `admin@example.com`. Its password is **not stored in the repository**; it is whatever value you set in `SEED_ADMIN_PASSWORD` before running the seed.

## Security model

API routes that operate on company data require a JWT, a valid `CompanyMembership`, and a role permission. Admin/Owner receive full permissions; Accountant, Sales, Purchases and Employee roles receive narrower permission sets. Passwords are stored as bcrypt hashes only.

`apps/api/prisma/security.sql` adds database invariants that Prisma alone cannot express: posted-journal immutability, immutable posted journal lines, debit/credit XOR, balanced posted journals, tenant/account validation, nonnegative FIFO lot quantities, append-only audit logs, and PostgreSQL RLS policies. Production deployments should use a non-owner runtime login granted the `accounting_app` role and set `app.current_company_id` / `app.current_user_id` transaction-locally.

## Accounting rules

- Posted journals are immutable; corrections use a reversal journal.
- Monetary calculations in the API use `Prisma.Decimal`, and official reports use base-currency debit/credit amounts.
- FIFO consumption is warehouse-scoped and row-locked; outbound allocations preserve exact lot-cost lineage.
- Linked sales returns cannot exceed original invoice quantities and restore the original FIFO lot cost.
- Hard-closed periods reject posting. Soft-closed periods require Admin/Owner override.
- Sales/purchase/payment posting uses scoped atomic document numbering and supports `Idempotency-Key` for safe retries.
- Historical P&L excludes year-end closing entries.

## Quality gates

GitHub Actions starts PostgreSQL 16 and runs dependency installation, Prisma generation, schema deployment, database security invariants, seed, TypeScript checks, Jest tests, and production builds for all workspace apps. CI uses concurrency cancellation so only the newest `main` run remains active.

## Production checklist

Before a public deployment, set strong deployment secrets, use separate migration-owner and non-owner runtime database credentials, enable branch protection/required CI checks in GitHub, use managed PostgreSQL backups, configure TLS/domain/email as needed, and review country-specific tax/e-invoicing requirements for the deployment jurisdiction.
