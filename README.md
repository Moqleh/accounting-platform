# Accounting Platform v1.0.0

Bilingual Arabic / English accounting and ERP platform built as a production-oriented monorepo.

## Stack

- Next.js + React + TypeScript (`apps/web`)
- NestJS + TypeScript (`apps/api`)
- PostgreSQL + Prisma
- Docker / Docker Compose
- GitHub Actions CI
- JWT authentication + multi-company membership RBAC

## Implemented scope

The v1 application includes the approved bilingual RTL/LTR blue/navy interface and the following working modules:

- Authenticated multi-company sessions and role-aware navigation.
- Dashboard, customers, suppliers, products, services and warehouses.
- Sales invoices, purchase bills, operating expenses, customer receipts and supplier payments.
- Linked sales credit notes/returns and supplier debit notes/returns.
- FIFO inventory by warehouse with exact outbound lot allocations and original-cost return restoration.
- Multi-currency document posting and dated exchange-rate setup.
- Configurable tax rates and accounting control-account setup.
- Double-entry journals, manual journals, immutable posting and reversal workflow.
- Fiscal years, fiscal periods, soft/hard closing and year-end closing.
- Trial balance, income statement, balance sheet, inventory valuation, account activity and receivable/payable aging.
- Bank accounts, CSV bank-statement import, matching and reconciliation lifecycle.
- User/password administration, RBAC, audit viewer, append-only audit records, outbox events and idempotent posting.
- PostgreSQL accounting constraints and tenant RLS policies.

## Development

Requirements: Node.js 22+, pnpm and Docker.

```bash
cp .env.example .env
# Set JWT_SECRET and SEED_ADMIN_PASSWORD in .env.
docker compose up -d
pnpm install
sh scripts/apply-schema.sh
pnpm --filter @accounting/api prisma:seed
pnpm dev
```

The web application defaults to `http://localhost:3000`; the API defaults to `http://localhost:4000/api`.

The development administrator email is `admin@example.com`. Its password is never stored in the repository; it is the value of `SEED_ADMIN_PASSWORD` when the seed is run.

## First production tenant

Copy `.env.production.example`, set strong secrets and deployment URLs, then start the stack:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

The production compose file waits for PostgreSQL, runs the repeatable schema/security job, then starts the API and web application. On a new empty installation, create the first Owner/company once:

```bash
set -a
. ./.env.production
set +a
pnpm --filter @accounting/api prisma:bootstrap
```

After the Owner logs in, use **Accounting Setup** to create/configure the chart of accounts, fiscal year, tax rules, warehouses, posting control accounts and exchange rates for the real company.

## Security model

API routes that operate on company data require a JWT, a valid `CompanyMembership`, and a role permission. Admin/Owner receive full permissions; Accountant, Sales, Purchases and Employee roles receive narrower permission sets. Passwords are stored as bcrypt hashes only. The API refuses to start without a sufficiently long `JWT_SECRET`, CORS uses an explicit origin allowlist, and baseline browser security headers are enabled.

`apps/api/prisma/security.sql` adds invariants Prisma alone cannot express: posted-journal immutability, immutable posted journal lines, debit/credit XOR, balanced posted journals, tenant/account validation, nonnegative FIFO lot quantities, append-only audit logs and PostgreSQL RLS policies. Production database credentials should be least-privilege; do not expose the PostgreSQL service publicly.

## Accounting rules

- Posted journals are immutable; corrections use reversal entries.
- API monetary calculations use `Prisma.Decimal`; official financial reports use base-currency debit/credit amounts.
- FIFO consumption is warehouse-scoped and row-locked; allocations retain exact lot-cost lineage.
- Linked customer returns cannot exceed the original sale quantity and restore the original FIFO cost.
- Supplier returns are linked back to purchase lines and inventory movement history.
- Hard-closed periods reject normal posting. Soft-closed periods require an authorized override.
- Financial document posting uses atomic scoped numbering and supports `Idempotency-Key` for safe retries.
- Historical P&L excludes year-end closing entries so period reporting is not zeroed by closing journals.

## Quality gates

Every push to `main` and every pull request runs against PostgreSQL 16 and performs:

1. dependency installation and Prisma client generation;
2. `prisma validate` and clean schema deployment;
3. security/extension SQL application;
4. idempotent development seed;
5. database invariant smoke checks;
6. TypeScript checks;
7. API Jest tests and web route/session smoke tests;
8. production builds for both applications.

A change is not considered release-ready unless this workflow is green.

## Repository layout

- `apps/web` — bilingual Next.js ERP interface.
- `apps/api` — NestJS accounting/ERP API.
- `apps/api/prisma/schema.prisma` — primary relational schema.
- `apps/api/prisma/*.sql` — PostgreSQL-only invariants and extension tables.
- `scripts/apply-schema.sh` — repeatable database deployment command.
- `Dockerfile.api`, `Dockerfile.web`, `docker-compose.prod.yml` — production container setup.

## Deployment responsibilities

The codebase is release-ready when CI passes, but a real public deployment still requires infrastructure choices outside the repository: TLS/domain, managed database backups, secret storage, monitoring, and jurisdiction-specific tax/e-invoicing configuration. Legal/tax rules must be verified for the country where the system is deployed.
