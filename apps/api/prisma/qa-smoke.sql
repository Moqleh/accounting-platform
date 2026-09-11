-- Read-only CI smoke checks for production invariants and extension tables.
DO $$
DECLARE
  missing text;
BEGIN
  SELECT string_agg(name, ', ')
  INTO missing
  FROM (VALUES
    ('Company'),('CompanyMembership'),('Account'),('FiscalYear'),('FiscalPeriod'),('Journal'),('JournalLine'),
    ('Customer'),('Supplier'),('Item'),('Warehouse'),('InventoryLot'),('InventoryMovement'),('InventoryAllocation'),
    ('SalesInvoice'),('SalesInvoiceLine'),('PurchaseBill'),('PurchaseBillLine'),('TaxRate'),('ExchangeRate'),
    ('DocumentSequence'),('AuditLog'),('OutboxEvent'),('IdempotencyRecord'),('CreditNote'),('CreditNoteLine'),
    ('PaymentAllocation'),('AccountingConfig'),('BankAccount'),('BankReconciliation'),('BankStatementLine'),
    ('DebitNote'),('DebitNoteLine'),('DebitNoteReturnAllocation')
  ) AS required(name)
  WHERE to_regclass(format('public.%I', name)) IS NULL;
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Missing required database objects: %', missing;
  END IF;
END $$;

DO $$
DECLARE
  missing text;
BEGIN
  SELECT string_agg(name, ', ')
  INTO missing
  FROM (VALUES
    ('inventory_lot_remaining_nonnegative'),
    ('journal_line_debit_credit_xor'),
    ('journal_line_party_xor')
  ) AS required(name)
  WHERE NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = required.name);
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Missing accounting constraints: %', missing;
  END IF;
END $$;

DO $$
DECLARE
  missing text;
BEGIN
  SELECT string_agg(name, ', ')
  INTO missing
  FROM (VALUES
    ('trg_guard_posted_journal_mutation'),
    ('trg_guard_posted_journal_line_mutation'),
    ('trg_validate_journal_balance'),
    ('trg_validate_journal_line_tenant_and_leaf'),
    ('trg_audit_log_no_update')
  ) AS required(name)
  WHERE NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = required.name AND NOT tgisinternal);
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Missing accounting triggers: %', missing;
  END IF;
END $$;

DO $$
DECLARE
  unprotected text;
BEGIN
  SELECT string_agg(c.relname, ', ')
  INTO unprotected
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = ANY (ARRAY[
      'Account','Customer','Supplier','Journal','Item','Warehouse','InventoryLot','InventoryMovement',
      'SalesInvoice','PurchaseBill','TaxRate','ExchangeRate','DocumentSequence','AuditLog','OutboxEvent',
      'IdempotencyRecord','CreditNote','PaymentAllocation','BankAccount','BankReconciliation','BankStatementLine'
    ])
    AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity);
  IF unprotected IS NOT NULL THEN
    RAISE EXCEPTION 'RLS/FORCE RLS missing on: %', unprotected;
  END IF;
END $$;

DO $$
DECLARE
  bad_count bigint;
BEGIN
  SELECT count(*) INTO bad_count FROM "Account" WHERE "isLeaf" = false AND id IN (SELECT DISTINCT "accountId" FROM "JournalLine");
  IF bad_count <> 0 THEN RAISE EXCEPTION 'Parent accounts contain journal postings'; END IF;

  SELECT count(*) INTO bad_count FROM "InventoryLot" WHERE "remainingQuantity" < 0 OR "initialQuantity" < 0;
  IF bad_count <> 0 THEN RAISE EXCEPTION 'Negative FIFO lot quantity detected'; END IF;

  SELECT count(*) INTO bad_count
  FROM "Journal" j
  WHERE j.status IN ('Posted','Reversed')
    AND (
      (SELECT count(*) FROM "JournalLine" l WHERE l."journalId" = j.id) < 2 OR
      COALESCE((SELECT sum(l."baseDebit") FROM "JournalLine" l WHERE l."journalId" = j.id),0) <>
      COALESCE((SELECT sum(l."baseCredit") FROM "JournalLine" l WHERE l."journalId" = j.id),0)
    );
  IF bad_count <> 0 THEN RAISE EXCEPTION 'Unbalanced posted/reversed journal detected'; END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'accounting_app') THEN
    RAISE EXCEPTION 'accounting_app database role is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "Company") THEN RAISE EXCEPTION 'Seed did not create a company'; END IF;
  IF NOT EXISTS (SELECT 1 FROM "FiscalPeriod") THEN RAISE EXCEPTION 'Seed did not create fiscal periods'; END IF;
  IF NOT EXISTS (SELECT 1 FROM "Account" WHERE "isLeaf" = true) THEN RAISE EXCEPTION 'Seed did not create posting accounts'; END IF;
END $$;
