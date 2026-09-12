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
  'src/app/sales/credit-notes/new/page.tsx',
  'src/app/purchases/page.tsx',
  'src/app/purchases/new/page.tsx',
  'src/app/purchases/debit-notes/page.tsx',
  'src/app/purchases/debit-notes/new/page.tsx',
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
  'src/app/settings/page.tsx',
];

test('all production v1 routes exist', () => {
  for (const route of requiredRoutes) {
    assert.equal(existsSync(resolve(root, route)), true, `Missing route: ${route}`);
  }
});

test('runtime company selection is session based and auth redirect is pages safe', () => {
  const api = readFileSync(resolve(root, 'src/lib/api.ts'), 'utf8');
  assert.equal(api.includes('DEMO_COMPANY_ID'), false);
  assert.equal(api.includes('accounting.companyId'), true);
  assert.match(api, /accounting-platform/);
  assert.match(api, /loginPath/);
});

test('shell supports bilingual direction, authenticated session and functional search', () => {
  const shell = readFileSync(resolve(root, 'src/components/erp-shell.tsx'), 'utf8');
  assert.match(shell, /accounting-locale/);
  assert.match(shell, /router\.replace\('\/login'\)/);
  assert.match(shell, /document\.documentElement\.dir/);
  assert.match(shell, /submitSearch/);
  assert.match(shell, /router\.push\(target\[0\]\)/);
  assert.equal(shell.includes('aria-label="notifications"'), false);
});

test('settings exposes real password change and does not present fixed accounting rules as editable', () => {
  const settings = readFileSync(resolve(root, 'src/app/settings/page.tsx'), 'utf8');
  assert.match(settings, /\/auth\/change-password/);
  assert.match(settings, /currentPassword/);
  assert.match(settings, /newPassword/);
  assert.equal(settings.includes('<select defaultValue="FIFO">'), false);
  assert.equal(settings.includes('<select defaultValue="4">'), false);
});
