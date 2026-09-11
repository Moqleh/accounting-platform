-- Database invariants and tenant isolation that Prisma schema alone cannot express.
-- Run as the migration/owner role after the Prisma schema is deployed.

ALTER TABLE "InventoryLot"
  DROP CONSTRAINT IF EXISTS inventory_lot_remaining_nonnegative,
  ADD CONSTRAINT inventory_lot_remaining_nonnegative CHECK ("remainingQuantity" >= 0 AND "initialQuantity" >= 0);

ALTER TABLE "JournalLine"
  DROP CONSTRAINT IF EXISTS journal_line_debit_credit_xor,
  ADD CONSTRAINT journal_line_debit_credit_xor CHECK (
    ("transactionDebit" > 0 AND "transactionCredit" = 0) OR
    ("transactionCredit" > 0 AND "transactionDebit" = 0)
  );

ALTER TABLE "JournalLine"
  DROP CONSTRAINT IF EXISTS journal_line_party_xor,
  ADD CONSTRAINT journal_line_party_xor CHECK (NOT ("customerId" IS NOT NULL AND "supplierId" IS NOT NULL));

CREATE OR REPLACE FUNCTION guard_posted_journal_mutation() RETURNS trigger AS $$
BEGIN
  IF OLD.status IN ('Posted', 'Reversed') THEN
    IF OLD.status = 'Posted'
       AND NEW.status = 'Reversed'
       AND NEW."reversedJournalId" IS NOT NULL
       AND NEW.id = OLD.id
       AND NEW."companyId" = OLD."companyId"
       AND NEW."fiscalPeriodId" = OLD."fiscalPeriodId"
       AND NEW."journalNumber" = OLD."journalNumber"
       AND NEW."transactionDate" = OLD."transactionDate"
       AND NEW."currencyCode" = OLD."currencyCode"
       AND NEW."exchangeRate" = OLD."exchangeRate"
       AND NEW."sourceType" = OLD."sourceType"
       AND NEW."sourceId" IS NOT DISTINCT FROM OLD."sourceId"
       AND NEW."postedById" IS NOT DISTINCT FROM OLD."postedById"
       AND NEW."postedAt" IS NOT DISTINCT FROM OLD."postedAt"
       AND NEW."createdAt" = OLD."createdAt"
    THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Posted/reversed journals are immutable; create a reversal journal instead';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_guard_posted_journal_mutation ON "Journal";
CREATE TRIGGER trg_guard_posted_journal_mutation
BEFORE UPDATE ON "Journal"
FOR EACH ROW EXECUTE FUNCTION guard_posted_journal_mutation();

CREATE OR REPLACE FUNCTION guard_posted_journal_line_mutation() RETURNS trigger AS $$
DECLARE
  target_journal uuid;
  target_status "JournalStatus";
BEGIN
  target_journal := COALESCE(NEW."journalId", OLD."journalId");
  SELECT status INTO target_status FROM "Journal" WHERE id = target_journal;
  IF target_status IN ('Posted', 'Reversed') THEN
    RAISE EXCEPTION 'Lines of posted/reversed journals are immutable';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_guard_posted_journal_line_mutation ON "JournalLine";
CREATE TRIGGER trg_guard_posted_journal_line_mutation
BEFORE INSERT OR UPDATE OR DELETE ON "JournalLine"
FOR EACH ROW EXECUTE FUNCTION guard_posted_journal_line_mutation();

CREATE OR REPLACE FUNCTION validate_journal_balance() RETURNS trigger AS $$
DECLARE
  journal_id uuid;
  journal_status "JournalStatus";
  total_debit numeric(30,4);
  total_credit numeric(30,4);
  line_count integer;
BEGIN
  journal_id := COALESCE(NEW.id, OLD.id);
  SELECT status INTO journal_status FROM "Journal" WHERE id = journal_id;
  IF journal_status IN ('Posted', 'Reversed') THEN
    SELECT COALESCE(SUM("baseDebit"),0), COALESCE(SUM("baseCredit"),0), COUNT(*)
      INTO total_debit,total_credit,line_count
      FROM "JournalLine" WHERE "journalId" = journal_id;
    IF line_count < 2 OR total_debit <> total_credit THEN
      RAISE EXCEPTION 'Posted journal must contain at least two lines and be balanced';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_journal_balance ON "Journal";
CREATE CONSTRAINT TRIGGER trg_validate_journal_balance
AFTER INSERT OR UPDATE ON "Journal"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_journal_balance();

CREATE OR REPLACE FUNCTION validate_journal_line_tenant_and_leaf() RETURNS trigger AS $$
DECLARE
  journal_company uuid;
  account_company uuid;
  account_leaf boolean;
  account_active boolean;
  customer_company uuid;
  supplier_company uuid;
BEGIN
  SELECT "companyId" INTO journal_company FROM "Journal" WHERE id = NEW."journalId";
  SELECT "companyId", "isLeaf", "isActive" INTO account_company, account_leaf, account_active FROM "Account" WHERE id = NEW."accountId";
  IF journal_company IS NULL OR account_company IS NULL OR journal_company <> account_company THEN
    RAISE EXCEPTION 'Journal line account must belong to same company';
  END IF;
  IF NOT account_leaf OR NOT account_active THEN
    RAISE EXCEPTION 'Journal line account must be an active leaf account';
  END IF;
  IF NEW."customerId" IS NOT NULL THEN
    SELECT "companyId" INTO customer_company FROM "Customer" WHERE id = NEW."customerId";
    IF customer_company IS DISTINCT FROM journal_company THEN RAISE EXCEPTION 'Customer must belong to same company'; END IF;
  END IF;
  IF NEW."supplierId" IS NOT NULL THEN
    SELECT "companyId" INTO supplier_company FROM "Supplier" WHERE id = NEW."supplierId";
    IF supplier_company IS DISTINCT FROM journal_company THEN RAISE EXCEPTION 'Supplier must belong to same company'; END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_journal_line_tenant_and_leaf ON "JournalLine";
CREATE TRIGGER trg_validate_journal_line_tenant_and_leaf
BEFORE INSERT OR UPDATE ON "JournalLine"
FOR EACH ROW EXECUTE FUNCTION validate_journal_line_tenant_and_leaf();

CREATE OR REPLACE FUNCTION guard_audit_log_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Audit log is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_log_no_update ON "AuditLog";
CREATE TRIGGER trg_audit_log_no_update
BEFORE UPDATE OR DELETE ON "AuditLog"
FOR EACH ROW EXECUTE FUNCTION guard_audit_log_append_only();

-- Runtime tenant role. Production login roles should be granted this role, not table ownership.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'accounting_app') THEN
    CREATE ROLE accounting_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
END $$;
GRANT USAGE ON SCHEMA public TO accounting_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO accounting_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO accounting_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO accounting_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO accounting_app;

-- The API sets these transaction-local settings after authenticating a membership:
--   SET LOCAL app.current_company_id = '<uuid>';
--   SET LOCAL app.current_user_id = '<uuid>';
CREATE OR REPLACE FUNCTION app_company_id() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.current_company_id', true), '')::uuid
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION app_user_id() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid
$$ LANGUAGE sql STABLE;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'Account','Customer','Supplier','Journal','Item','Warehouse','InventoryLot','InventoryMovement',
    'SalesInvoice','PurchaseBill','TaxRate','ExchangeRate','DocumentSequence','AuditLog','OutboxEvent','IdempotencyRecord'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I TO accounting_app USING ("companyId" = app_company_id()) WITH CHECK ("companyId" = app_company_id())', t);
  END LOOP;
END $$;

ALTER TABLE "CompanyMembership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CompanyMembership" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS membership_scope ON "CompanyMembership";
CREATE POLICY membership_scope ON "CompanyMembership" TO accounting_app
  USING ("companyId" = app_company_id() AND "userId" = app_user_id())
  WITH CHECK ("companyId" = app_company_id() AND "userId" = app_user_id());

ALTER TABLE "FiscalYear" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FiscalYear" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fiscal_year_tenant ON "FiscalYear";
CREATE POLICY fiscal_year_tenant ON "FiscalYear" TO accounting_app
  USING ("companyId" = app_company_id()) WITH CHECK ("companyId" = app_company_id());

ALTER TABLE "FiscalPeriod" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FiscalPeriod" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fiscal_period_tenant ON "FiscalPeriod";
CREATE POLICY fiscal_period_tenant ON "FiscalPeriod" TO accounting_app
USING (EXISTS (SELECT 1 FROM "FiscalYear" fy WHERE fy.id = "FiscalPeriod"."fiscalYearId" AND fy."companyId" = app_company_id()))
WITH CHECK (EXISTS (SELECT 1 FROM "FiscalYear" fy WHERE fy.id = "FiscalPeriod"."fiscalYearId" AND fy."companyId" = app_company_id()));

ALTER TABLE "JournalLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "JournalLine" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS journal_line_tenant ON "JournalLine";
CREATE POLICY journal_line_tenant ON "JournalLine" TO accounting_app
USING (EXISTS (SELECT 1 FROM "Journal" j WHERE j.id = "JournalLine"."journalId" AND j."companyId" = app_company_id()))
WITH CHECK (EXISTS (SELECT 1 FROM "Journal" j WHERE j.id = "JournalLine"."journalId" AND j."companyId" = app_company_id()));

ALTER TABLE "SalesInvoiceLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SalesInvoiceLine" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sales_line_tenant ON "SalesInvoiceLine";
CREATE POLICY sales_line_tenant ON "SalesInvoiceLine" TO accounting_app
USING (EXISTS (SELECT 1 FROM "SalesInvoice" i WHERE i.id = "SalesInvoiceLine"."invoiceId" AND i."companyId" = app_company_id()))
WITH CHECK (EXISTS (SELECT 1 FROM "SalesInvoice" i WHERE i.id = "SalesInvoiceLine"."invoiceId" AND i."companyId" = app_company_id()));

ALTER TABLE "PurchaseBillLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PurchaseBillLine" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS purchase_line_tenant ON "PurchaseBillLine";
CREATE POLICY purchase_line_tenant ON "PurchaseBillLine" TO accounting_app
USING (EXISTS (SELECT 1 FROM "PurchaseBill" b WHERE b.id = "PurchaseBillLine"."billId" AND b."companyId" = app_company_id()))
WITH CHECK (EXISTS (SELECT 1 FROM "PurchaseBill" b WHERE b.id = "PurchaseBillLine"."billId" AND b."companyId" = app_company_id()));

ALTER TABLE "InventoryAllocation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InventoryAllocation" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allocation_tenant ON "InventoryAllocation";
CREATE POLICY allocation_tenant ON "InventoryAllocation" TO accounting_app
USING (EXISTS (SELECT 1 FROM "InventoryMovement" m WHERE m.id = "InventoryAllocation"."movementId" AND m."companyId" = app_company_id()))
WITH CHECK (EXISTS (SELECT 1 FROM "InventoryMovement" m WHERE m.id = "InventoryAllocation"."movementId" AND m."companyId" = app_company_id()));
