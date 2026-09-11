#!/bin/sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"

pnpm --filter @accounting/api prisma:generate
pnpm --filter @accounting/api exec prisma validate
pnpm --filter @accounting/api exec prisma db push --skip-generate

PSQL_URL="${DATABASE_URL%%\?*}"
for file in security.sql banking.sql posting-config.sql purchase-returns.sql; do
  psql "$PSQL_URL" -v ON_ERROR_STOP=1 -f "apps/api/prisma/$file"
done
