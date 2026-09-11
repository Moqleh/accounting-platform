-- Bank accounts and statement reconciliation extension.
-- Applied after Prisma schema and security.sql.

CREATE TABLE IF NOT EXISTS "BankAccount" (
  id uuid PRIMARY KEY,
  "companyId" uuid NOT NULL REFERENCES "Company"(id) ON DELETE RESTRICT,
  code text NOT NULL,
  name text NOT NULL,
  "accountId" uuid NOT NULL REFERENCES "Account"(id) ON DELETE RESTRICT,
  currency text NOT NULL REFERENCES "Currency"(code) ON DELETE RESTRICT,
  iban text,
  "bankName" text,
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("companyId", code)
);

CREATE TABLE IF NOT EXISTS "BankReconciliation" (
  id uuid PRIMARY KEY,
  "companyId" uuid NOT NULL REFERENCES "Company"(id) ON DELETE RESTRICT,
  "bankAccountId" uuid NOT NULL REFERENCES "BankAccount"(id) ON DELETE RESTRICT,
  "statementStart" date NOT NULL,
  "statementEnd" date NOT NULL,
  "openingBalance" numeric(18,4) NOT NULL,
  "closingBalance" numeric(18,4) NOT NULL,
  status text NOT NULL DEFAULT 'Open' CHECK (status IN ('Open','Completed')),
  "completedAt" timestamptz,
  "completedById" uuid REFERENCES "User"(id) ON DELETE RESTRICT,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CHECK ("statementStart" <= "statementEnd")
);

CREATE TABLE IF NOT EXISTS "BankStatementLine" (
  id uuid PRIMARY KEY,
  "companyId" uuid NOT NULL REFERENCES "Company"(id) ON DELETE RESTRICT,
  "bankAccountId" uuid NOT NULL REFERENCES "BankAccount"(id) ON DELETE RESTRICT,
  "reconciliationId" uuid REFERENCES "BankReconciliation"(id) ON DELETE RESTRICT,
  "transactionDate" date NOT NULL,
  description text NOT NULL,
  reference text,
  amount numeric(18,4) NOT NULL,
  "matchedJournalLineId" uuid REFERENCES "JournalLine"(id) ON DELETE RESTRICT,
  "matchedAt" timestamptz,
  "matchedById" uuid REFERENCES "User"(id) ON DELETE RESTRICT,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CHECK (("matchedJournalLineId" IS NULL AND "matchedAt" IS NULL) OR ("matchedJournalLineId" IS NOT NULL AND "matchedAt" IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS bank_statement_line_lookup_idx ON "BankStatementLine"("companyId","bankAccountId","transactionDate");
CREATE INDEX IF NOT EXISTS bank_statement_line_unmatched_idx ON "BankStatementLine"("companyId","bankAccountId") WHERE "matchedJournalLineId" IS NULL;
CREATE INDEX IF NOT EXISTS bank_reconciliation_lookup_idx ON "BankReconciliation"("companyId","bankAccountId","statementEnd");

GRANT SELECT, INSERT, UPDATE, DELETE ON "BankAccount", "BankReconciliation", "BankStatementLine" TO accounting_app;

ALTER TABLE "BankAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BankAccount" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "BankAccount";
CREATE POLICY tenant_isolation ON "BankAccount" TO accounting_app USING ("companyId"=app_company_id()) WITH CHECK ("companyId"=app_company_id());

ALTER TABLE "BankReconciliation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BankReconciliation" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "BankReconciliation";
CREATE POLICY tenant_isolation ON "BankReconciliation" TO accounting_app USING ("companyId"=app_company_id()) WITH CHECK ("companyId"=app_company_id());

ALTER TABLE "BankStatementLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BankStatementLine" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "BankStatementLine";
CREATE POLICY tenant_isolation ON "BankStatementLine" TO accounting_app USING ("companyId"=app_company_id()) WITH CHECK ("companyId"=app_company_id());
