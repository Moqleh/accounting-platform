import assert from 'node:assert/strict';

const base = process.env.ACCEPTANCE_API_URL ?? 'http://localhost:4000/api';
const email = process.env.ACCEPTANCE_ADMIN_EMAIL ?? 'admin@example.com';
const password = process.env.ACCEPTANCE_ADMIN_PASSWORD ?? process.env.SEED_ADMIN_PASSWORD;
assert.ok(password, 'Acceptance admin password is required');

async function request(path, { method = 'GET', token, body, key } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(key ? { 'idempotency-key': key } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
  if (!response.ok) throw new Error(`${method} ${path} -> ${response.status}: ${text}`);
  return payload;
}

const login = await request('/auth/login', { method: 'POST', body: { email, password } });
assert.ok(login?.token, 'Login did not return a token');
const token = login.token;
const me = await request('/auth/me', { token });
assert.equal(me.email, email);
const companyId = me.defaultCompanyId ?? me.memberships?.[0]?.companyId;
assert.ok(companyId, 'Authenticated user has no company');

const [customers, suppliers, warehouses, items, taxes] = await Promise.all([
  request(`/erp/customers/${companyId}`, { token }),
  request(`/erp/suppliers/${companyId}`, { token }),
  request(`/erp/warehouses/${companyId}`, { token }),
  request(`/erp/items/${companyId}`, { token }),
  request(`/erp/tax-rates/${companyId}`, { token }),
]);
assert.ok(customers.length && suppliers.length && warehouses.length && items.length, 'Seed master data is incomplete');
const inventoryItem = items.find((x) => x.type === 'Inventory') ?? items[0];
const taxRateId = taxes[0]?.id;

const stamp = Date.now();
const purchaseBody = {
  companyId,
  supplierId: suppliers[0].id,
  warehouseId: warehouses[0].id,
  billDate: '2026-06-15T12:00:00.000Z',
  currencyCode: 'SAR',
  exchangeRate: '1',
  lines: [{ itemId: inventoryItem.id, quantity: '2', unitCost: '100', ...(taxRateId ? { taxRateId } : {}) }],
};
const purchaseKey = `acceptance-purchase-${stamp}`;
const purchase1 = await request('/purchases/bill', { method: 'POST', token, body: purchaseBody, key: purchaseKey });
const purchase2 = await request('/purchases/bill', { method: 'POST', token, body: purchaseBody, key: purchaseKey });
const purchase1Id = purchase1?.bill?.id ?? purchase1?.id;
const purchase2Id = purchase2?.bill?.id ?? purchase2?.id;
assert.ok(purchase1Id, 'Purchase bill was not created');
assert.equal(purchase2Id, purchase1Id, 'Purchase idempotency replay created a different document');

const salesBody = {
  companyId,
  customerId: customers[0].id,
  warehouseId: warehouses[0].id,
  invoiceDate: '2026-06-16T12:00:00.000Z',
  currencyCode: 'SAR',
  exchangeRate: '1',
  lines: [{ itemId: inventoryItem.id, quantity: '1', unitPrice: '150', ...(taxRateId ? { taxRateId } : {}) }],
};
const salesKey = `acceptance-sale-${stamp}`;
const sale1 = await request('/sales/invoice', { method: 'POST', token, body: salesBody, key: salesKey });
const sale2 = await request('/sales/invoice', { method: 'POST', token, body: salesBody, key: salesKey });
const sale1Id = sale1?.invoice?.id ?? sale1?.id;
const sale2Id = sale2?.invoice?.id ?? sale2?.id;
assert.ok(sale1Id, 'Sales invoice was not created');
assert.equal(sale2Id, sale1Id, 'Sales idempotency replay created a different document');

const journals = await request(`/erp/journals/${companyId}?take=500`, { token });
assert.ok(journals.length >= 2, 'Expected posted journals after purchase and sale');
for (const journal of journals.filter((j) => ['Posted', 'Reversed'].includes(j.status))) {
  const debit = journal.lines.reduce((sum, line) => sum + Number(line.baseDebit), 0);
  const credit = journal.lines.reduce((sum, line) => sum + Number(line.baseCredit), 0);
  assert.ok(Math.abs(debit - credit) < 0.0001, `Journal ${journal.journalNumber} is not balanced: ${debit} != ${credit}`);
}

const trial = await request(`/erp/trial-balance/${companyId}`, { token });
const trialDebit = trial.reduce((sum, row) => sum + Number(row.debit ?? 0), 0);
const trialCredit = trial.reduce((sum, row) => sum + Number(row.credit ?? 0), 0);
assert.ok(Math.abs(trialDebit - trialCredit) < 0.0001, `Trial balance is not balanced: ${trialDebit} != ${trialCredit}`);

const dashboard = await request(`/erp/dashboard/${companyId}`, { token });
assert.ok(Number(dashboard.sales) > 0, 'Dashboard sales did not reflect the posted invoice');
assert.ok(Number(dashboard.purchases) > 0, 'Dashboard purchases did not reflect the posted bill');

const valuation = await request(`/erp/inventory-valuation/${companyId}`, { token });
assert.ok(valuation.some((row) => row.itemCode === inventoryItem.code && Number(row.quantity) > 0), 'Inventory valuation did not retain remaining FIFO stock');

const profitLoss = await request(`/erp/profit-loss/${companyId}?from=2026-01-01&to=2026-12-31`, { token });
assert.ok(Number.isFinite(Number(profitLoss.netProfit)), 'Profit and loss did not return a numeric net profit');
const balanceSheet = await request(`/erp/balance-sheet/${companyId}?asOf=2026-12-31`, { token });
assert.ok(Array.isArray(balanceSheet) && balanceSheet.length > 0, 'Balance sheet returned no balances');

console.log(JSON.stringify({ companyId, purchaseBillId: purchase1Id, salesInvoiceId: sale1Id, journals: journals.length, trialDebit, trialCredit }));
