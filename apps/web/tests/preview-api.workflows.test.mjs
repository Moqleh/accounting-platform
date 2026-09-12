import test, {beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {previewRequest} from '../.test-build/lib/preview-api.js';
const KEY='accounting.preview.db.v2';let storage,descriptors;
beforeEach(()=>{storage=new Map();descriptors=Object.fromEntries(['window','localStorage'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));const local={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v))};Object.defineProperty(globalThis,'localStorage',{configurable:true,value:local});Object.defineProperty(globalThis,'window',{configurable:true,value:{localStorage:local}});});
afterEach(()=>{for(const[k,d]of Object.entries(descriptors)){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}});
const get=p=>previewRequest(p+'/company','GET');const post=(p,v)=>previewRequest(p,'POST',v);
const invoice=(taxRateId='tax-15')=>({customerId:'cus-1',warehouseId:'wh-1',invoiceDate:'2026-09-12T12:00:00Z',currencyCode:'SAR',exchangeRate:'1',lines:[{itemId:'item-2',quantity:'2',unitPrice:'100',taxRateId}]});
const bill=()=>({supplierId:'sup-1',warehouseId:'wh-1',billDate:'2026-09-12T12:00:00Z',currencyCode:'SAR',lines:[{itemId:'item-1',quantity:'2',unitCost:'10',taxRateId:''}]});
const manual=()=>({transactionDate:'2026-09-10T12:00:00Z',reference:'EXP-test',lines:[{accountId:'acc-expense',debit:'10',description:'Expense: test'},{accountId:'acc-cash',credit:'10'}]});
test('invoice and bill forms, lists, dashboard and report consumers agree after posting',async()=>{
 await post('/purchases/bill',bill());await post('/sales/invoice',invoice());
 const sales=await get('/erp/sales'),purchases=await get('/erp/purchases');
 assert.equal(sales[0].invoiceDate.slice(0,10),'2026-09-12');assert.equal(sales[0].grandTotal,'230');assert.ok(sales[0].customer.name);assert.ok(sales[0].lines[0].item.name);
 assert.equal(purchases[0].billDate.slice(0,10),'2026-09-12');assert.equal(purchases[0].grandTotal,'20');assert.ok(purchases[0].supplier.name);
 const dashboard=await get('/erp/dashboard');assert.equal(dashboard.journals,2);assert.equal(dashboard.baseCurrencyCode,'SAR');assert.equal(dashboard.sales,230);
 const activity=await previewRequest('/erp/account-activity/company?accountId=acc-ar','GET');assert.equal(activity.length,1);assert.ok(activity[0].journal.transactionDate.slice(0,10));assert.equal(activity[0].account.code,'1201');assert.equal(activity[0].baseDebit,'230');
 const income=await get('/erp/profit-loss');assert.equal(income.revenue,'200');assert.equal(income.expense,'0');
 for(const row of await get('/erp/balance-sheet'))for(const key of ['code','name','type','balance'])assert.notEqual(row[key],undefined);
 for(const row of await get('/erp/inventory-valuation'))for(const key of ['itemCode','itemName','warehouse','receivedDate','quantity','unitCost','value'])assert.notEqual(row[key],undefined);
 const aging=await get('/reports/customer-aging');assert.equal(aging[0].outstanding,'230');assert.ok(aging[0].invoiceNumber);assert.ok(aging[0].customer);
 const tb=await get('/erp/trial-balance');assert.ok(Math.abs(tb.reduce((s,r)=>s+Number(r.debit)-Number(r.credit),0))<1e-6);
});
test('all initial read endpoints return view-compatible data',async()=>{
 const arrays=['/erp/customers','/erp/suppliers','/erp/items','/erp/warehouses','/erp/tax-rates','/erp/accounts','/erp/sales','/erp/purchases','/erp/journals','/erp/trial-balance','/erp/inventory-valuation','/erp/balance-sheet','/erp/account-activity','/reports/customer-aging','/reports/supplier-aging','/reports/credit-notes','/debit-notes','/admin/fiscal-years','/admin/users','/admin/audit','/admin/exchange-rates','/banking/accounts'];
 for(const path of arrays)assert.ok(Array.isArray(await get(path)),path);
 assert.equal((await get('/erp/company')).baseCurrencyCode,'SAR');assert.equal((await get('/erp/tax-rates'))[0].rate,'0.15');assert.ok((await get('/erp/tax-rates'))[0].purchaseTaxAccountId);assert.ok((await get('/erp/accounts')).some(a=>a.isLeaf));assert.equal((await get('/erp/items'))[0].isActive,true);
 assert.equal(storage.size,0);
});
test('tax selector honors zero and custom rates in saved totals and ledger',async()=>{
 await post('/sales/invoice',invoice(''));assert.equal((await get('/erp/sales'))[0].grandTotal,'200');
 const tax=await post('/admin/tax-rates/company',{code:'VAT5',name:'5%',rate:'0.05',effectiveFrom:'2026-01-01',salesTaxAccountId:'acc-vatout',purchaseTaxAccountId:'acc-vatin'});
 await post('/sales/invoice',invoice(tax.id));assert.equal((await get('/erp/sales'))[0].grandTotal,'210');
 const before=storage.get(KEY);await assert.rejects(post('/sales/invoice',invoice('missing')),/tax/);assert.equal(storage.get(KEY),before);
});
test('new parties and items remain usable by purchasing and sales forms',async()=>{
 const c=await post('/erp/customers/company',{code:'C2',name:'Customer Two'}),s=await post('/erp/suppliers/company',{code:'S2',name:'Supplier Two'});
 assert.equal((await get('/erp/customers'))[0].isActive,true);assert.equal((await get('/erp/suppliers'))[0].isActive,true);
 const item=await post('/admin/items/company',{code:'SVC',name:'New Service',type:'Service',revenueAccountId:'acc-sales',cogsAccountId:'acc-expense'});
 await post('/purchases/bill',{...bill(),supplierId:s.id,lines:[{itemId:item.id,quantity:1,unitCost:10,taxRateId:''}]});
 await post('/sales/invoice',{...invoice(),customerId:c.id,lines:[{itemId:item.id,quantity:1,unitPrice:20,taxRateId:''}]});assert.equal((await get('/erp/sales'))[0].customer.id,c.id);
});
test('expense metadata is visible, manual reversal works once and balances',async()=>{
 const j=await post('/accounting/journals/manual',manual());assert.equal(j.sourceId,'EXP-test');assert.equal(j.lines[0].description,'Expense: test');assert.equal(j.transactionDate,'2026-09-10T12:00:00Z');
 await post('/accounting/journals/reverse',{journalId:j.id,reversalDate:'2026-09-12T12:00:00Z'});
 for(const r of await get('/erp/trial-balance'))assert.equal(r.balance,'0');
 const before=storage.get(KEY);await assert.rejects(post('/accounting/journals/reverse',{journalId:j.id,reversalDate:'2026-09-12'}),/reversal/);assert.equal(storage.get(KEY),before);
});
test('receipt is listed in payment history and unsupported allocation cannot save',async()=>{
 await post('/payments/customer-receipt',{amount:10,customerId:'cus-1',currencyCode:'SAR',exchangeRate:'1'});assert.equal((await get('/erp/journals'))[0].sourceType,'CustomerPayment');
 const before=storage.get(KEY);await assert.rejects(post('/payments/customer-receipt',{amount:10,allocations:[{invoiceId:'missing',amount:10}]}),/allocation/);assert.equal(storage.get(KEY),before);
});
test('unsupported actions and FX fail without modifying data or pretending success',async()=>{
 for(const path of ['/banking/match/company/line','/banking/reconciliations/company/rec/complete','/credit-notes','/debit-notes','/year-end/close','/unknown'])await assert.rejects(post(path,{}),/not available|requires/);
 await assert.rejects(post('/sales/invoice',{...invoice(),currencyCode:'USD',exchangeRate:'3.75'}),/Foreign currency/);
 assert.equal(storage.size,0);
});
test('period update targets exact ID, prevents reopening hard-closed periods',async()=>{
 await previewRequest('/admin/fiscal-periods/company/p-10/status','PATCH',{status:'Soft_Closed'});
 const year=(await get('/admin/fiscal-years'))[0];assert.equal(year.periods[9].status,'Soft_Closed');assert.equal(year.periods[0].status,'Open');
 await previewRequest('/admin/fiscal-periods/company/p-10/status','PATCH',{status:'Hard_Closed'});
 await assert.rejects(previewRequest('/admin/fiscal-periods/company/p-10/status','PATCH',{status:'Open'}),/permanently closed/);
});
