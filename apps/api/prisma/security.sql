-- Database invariants that Prisma schema alone cannot express.
-- Applied after `prisma db push` in CI and can be applied to production after schema deployment.

ALTER TABLE "InventoryLot"
  DROP CONSTRAINT IF EXISTS inventory_lot_remaining_nonnegative,
  ADD CONSTRAINT inventory_lot_remaining_nonnegative CHECK ("remainingQuantity" >= 0 AND "initialQuantity" >= 0);

ALTER TABLE "JournalLine"
  DROP CONSTRAINT IF EXISTS journal_line_debit_credit_xor,
  ADD CONSTRAINT journal_line_debit_credit_xor CHECK (
    ("transactionDebit" > 0 AND "transactionCredit" = 0) OR
    ("transactionCredit" > 0 AND "transactionDebit" = 0)
  );

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
  target_journal := COALESCE(OLD."journalId", NEW."journalId");
  SELECT status INTO target_status FROM "Journal" WHERE id = target_journal;
  IF target_status IN ('Posted', 'Reversed') THEN
    RAISE EXCEPTION 'Lines of posted/reversed journals are immutable';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_guard_posted_journal_line_update ON "JournalLine";
CREATE TRIGGER trg_guard_posted_journal_line_update
BEFORE UPDATE OR DELETE ON "JournalLine"
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

CREATE OR REPLACE FUNCTION guard_audit_log_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Audit log is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_log_no_update ON "AuditLog";
CREATE TRIGGER trg_audit_log_no_update
BEFORE UPDATE OR DELETE ON "AuditLog"
FOR EACH ROW EXECUTE FUNCTION guard_audit_log_append_only();

CREATE OR REPLACE FUNCTION validate_journal_line_tenant_and_leaf() RETURNS trigger AS $$
DECLARE
  journal_company uuid;
  account_company uuid;
  account_leaf boolean;
  account_active boolean;
BEGIN
  SELECT "companyId" INTO journal_company FROM "Journal" WHERE id = NEW."journalId";
  SELECT "companyId", "isLeaf", "isActive" INTO account_company, account_leaf, account_active FROM "Account" WHERE id = NEW."accountId";
  IF journal_company IS NULL OR account_company IS NULL OR journal_company <> account_company THEN
    RAISE EXCEPTION 'Journal line account must belong to same company';
  END IF;
  IF NOT account_leaf OR NOT account_active THEN
    RAISE EXCEPTION 'Journal line account must be an active leaf account';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_journal_line_tenant_and_leaf ON "JournalLine";
CREATE TRIGGER trg_validate_journal_line_tenant_and_leaf
BEFORE INSERT OR UPDATE ON "JournalLine"
FOR EACH ROW EXECUTE FUNCTION validate_journal_line_tenant_and_leaf();
