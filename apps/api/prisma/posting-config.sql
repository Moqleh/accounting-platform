-- Company-level control account configuration for posting engines.
CREATE TABLE IF NOT EXISTS "AccountingConfig" (
  "companyId" uuid PRIMARY KEY REFERENCES "Company"(id) ON DELETE RESTRICT,
  "receivableAccountId" uuid REFERENCES "Account"(id) ON DELETE RESTRICT,
  "payableAccountId" uuid REFERENCES "Account"(id) ON DELETE RESTRICT,
  "cashAccountId" uuid REFERENCES "Account"(id) ON DELETE RESTRICT,
  "retainedEarningsAccountId" uuid REFERENCES "Account"(id) ON DELETE RESTRICT,
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON "AccountingConfig" TO accounting_app;
ALTER TABLE "AccountingConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AccountingConfig" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "AccountingConfig";
CREATE POLICY tenant_isolation ON "AccountingConfig" TO accounting_app
USING ("companyId"=app_company_id()) WITH CHECK ("companyId"=app_company_id());
