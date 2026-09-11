import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const requiredRoutes = [
  'src/app/page.tsx',
  'src/app/login/page.tsx',
  'src/app/sales/page.tsx',
  'src/app/sales/new/page.tsx',
  'src/app/sales/credit-notes/page.tsx',
  'src/app/purchases/page.tsx',
  'src/app/purchases/new/page.tsx',
  'src/app/purchases/debit-notes/page.tsx',
  'src/app/customers/page.tsx',
  'src/app/suppliers/page.tsx',
  'src/app/inventory/page.tsx',
  'src/app/payments/page.tsx',
  'src/app/banking/page.tsx',
  'src/app/expenses/page.tsx',
  'src/app/journals/page.tsx',
  'src/app/journals/new/page.tsx',
  'src/app/reports/page.tsx',
  'src/app/reports/trial-balance/page.tsx',
  'src/app/reports/profit-loss/page.tsx',
  'src/app/reports/balance-sheet/page.tsx',
  'src/app/reports/customer-aging/page.tsx',
  'src/app/reports/supplier-aging/page.tsx',
  'src/app/reports/inventory-valuation/page.tsx',
  'src/app/reports/account-activity/page.tsx',
  'src/app/setup/page.tsx',
  'src/app/users/page.tsx',
  'src/app/audit/page.tsx',
  'src/app/year-end/page.tsx',
];

test('all production v1 routes exist', () => {
  for (const route of requiredRoutes) {
    assert.equal(existsSync(resolve(root, route)), true, `Missing route: ${route}`);
  }
});

test('runtime company selection is session based', () => {
  const api = readFileSync(resolve(root, 'src/lib/api.ts'), 'utf8');
  assert.equal(api.includes('DEMO_COMPANY_ID'), false);
  assert.equal(api.includes('accounting.companyId'), true);
});

test('shell supports bilingual direction and authenticated session', () => {
  const shell = readFileSync(resolve(root, 'src/components/erp-shell.tsx'), 'utf8');
  assert.match(shell, /accounting-locale/);
  assert.match(shell, /router\.replace\('\/login'\)/);
  assert.match(shell, /document\.documentElement\.dir/);
});
