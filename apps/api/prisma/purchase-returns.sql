CREATE TABLE IF NOT EXISTS "DebitNote" (
  id uuid PRIMARY KEY,
  "companyId" uuid NOT NULL REFERENCES "Company"(id) ON DELETE RESTRICT,
  "debitNoteNumber" text NOT NULL,
  "supplierId" uuid NOT NULL REFERENCES "Supplier"(id) ON DELETE RESTRICT,
  "purchaseBillId" uuid NOT NULL REFERENCES "PurchaseBill"(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Posted','Cancelled')),
  "debitDate" timestamptz NOT NULL,
  subtotal numeric(18,4) NOT NULL,
  "taxTotal" numeric(18,4) NOT NULL,
  "grandTotal" numeric(18,4) NOT NULL,
  reason text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("companyId","debitNoteNumber")
);
CREATE TABLE IF NOT EXISTS "DebitNoteLine" (
  id uuid PRIMARY KEY,
  "debitNoteId" uuid NOT NULL REFERENCES "DebitNote"(id) ON DELETE RESTRICT,
  "purchaseBillLineId" uuid NOT NULL REFERENCES "PurchaseBillLine"(id) ON DELETE RESTRICT,
  "itemId" uuid NOT NULL REFERENCES "Item"(id) ON DELETE RESTRICT,
  quantity numeric(18,4) NOT NULL CHECK (quantity>0),
  "unitCost" numeric(18,4) NOT NULL,
  "taxRateSnapshot" numeric(9,6) NOT NULL,
  "taxAmount" numeric(18,4) NOT NULL,
  "lineTotal" numeric(18,4) NOT NULL
);
CREATE TABLE IF NOT EXISTS "DebitNoteReturnLot" (
  id uuid PRIMARY KEY,
  "debitNoteLineId" uuid NOT NULL REFERENCES "DebitNoteLine"(id) ON DELETE RESTRICT,
  "inventoryLotId" uuid NOT NULL REFERENCES "InventoryLot"(id) ON DELETE RESTRICT,
  quantity numeric(18,4) NOT NULL CHECK (quantity>0),
  "unitCost" numeric(18,4) NOT NULL,
  "totalCost" numeric(18,4) NOT NULL
);
CREATE INDEX IF NOT EXISTS debit_note_bill_idx ON "DebitNote"("companyId","purchaseBillId","debitDate");
GRANT SELECT,INSERT,UPDATE,DELETE ON "DebitNote","DebitNoteLine","DebitNoteReturnLot" TO accounting_app;
ALTER TABLE "DebitNote" ENABLE ROW LEVEL SECURITY; ALTER TABLE "DebitNote" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "DebitNote";
CREATE POLICY tenant_isolation ON "DebitNote" TO accounting_app USING ("companyId"=app_company_id()) WITH CHECK ("companyId"=app_company_id());
ALTER TABLE "DebitNoteLine" ENABLE ROW LEVEL SECURITY; ALTER TABLE "DebitNoteLine" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS debit_note_line_tenant ON "DebitNoteLine";
CREATE POLICY debit_note_line_tenant ON "DebitNoteLine" TO accounting_app USING (EXISTS(SELECT 1 FROM "DebitNote" d WHERE d.id="debitNoteId" AND d."companyId"=app_company_id())) WITH CHECK (EXISTS(SELECT 1 FROM "DebitNote" d WHERE d.id="debitNoteId" AND d."companyId"=app_company_id()));
ALTER TABLE "DebitNoteReturnLot" ENABLE ROW LEVEL SECURITY; ALTER TABLE "DebitNoteReturnLot" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS debit_note_return_tenant ON "DebitNoteReturnLot";
CREATE POLICY debit_note_return_tenant ON "DebitNoteReturnLot" TO accounting_app USING (EXISTS(SELECT 1 FROM "DebitNoteLine" l JOIN "DebitNote" d ON d.id=l."debitNoteId" WHERE l.id="debitNoteLineId" AND d."companyId"=app_company_id())) WITH CHECK (EXISTS(SELECT 1 FROM "DebitNoteLine" l JOIN "DebitNote" d ON d.id=l."debitNoteId" WHERE l.id="debitNoteLineId" AND d."companyId"=app_company_id()));
