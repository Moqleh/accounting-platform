import test, {beforeEach, afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {previewRequest} from '../.test-build/lib/preview-api.js';
const KEY='accounting.preview.db.v2';
let store,writes,descriptors;
beforeEach(()=>{
  descriptors=Object.fromEntries(['window','localStorage'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
  store=new Map();writes=0;
  const storage={getItem:k=>store.get(k)??null,setItem:(k,v)=>{writes++;store.set(k,String(v));}};
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:storage});
  Object.defineProperty(globalThis,'window',{configurable:true,value:{localStorage:storage}});
});
afterEach(()=>{for(const [k,d] of Object.entries(descriptors)){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}});
const get=kind=>previewRequest(`/admin/${kind}/company`,'GET');
async function seedStored(){await previewRequest('/admin/warehouses/company','POST',{code:'TEST',name:'Test'});return JSON.parse(store.get(KEY));}

test('fresh users response supports nested membership rendering',async()=>{
 const rows=await get('users');
 assert.equal(rows[0].user.fullName,'Super Admin');assert.equal(rows[0].user.email,'admin@example.com');
 assert.equal(rows[0].role,'Owner');assert.equal(writes,0);
});
test('fresh setup responses support all render-time date and account fields',async()=>{
 const [accounts,taxes,years,rates,config]=await Promise.all(['accounts','tax-rates','fiscal-years','exchange-rates','posting-config'].map(get));
 assert.ok(accounts.filter(a=>a.isLeaf&&a.isActive).length);
 assert.equal(taxes[0].rate,'0.15');assert.equal(typeof taxes[0].effectiveFrom.slice(0,10),'string');
 assert.equal(rates[0].rateDate.slice(0,10),'2026-01-01');
 assert.equal(years[0].periods.length,12);
 assert.equal(years[0].periods[1].startDate.slice(0,10),'2026-02-01');
 assert.equal(years[0].periods[1].endDate.slice(0,10),'2026-02-28');
 assert.equal(years[0].periods[11].number,12);
 for(const p of years[0].periods){assert.ok(p.startDate.slice(0,10));assert.ok(p.endDate.slice(0,10));}
 assert.equal(config.receivableAccountId,'acc-ar');assert.equal(config.payableAccountId,'acc-ap');assert.equal(config.retainedEarningsAccountId,'acc-equity');
 assert.equal(writes,0);
});
test('legacy saved data renders without changing stored records or audit',async()=>{
 const x=await seedStored();
 x.users.push({id:'member',role:'Accountant',user:{id:'nested',fullName:'Nested User',email:'nested@example.com'}});
 x.exchangeRates.push({id:'new-rate',currencyCode:'EUR',rate:'4',rateDate:'2026-07-01'});
 x.taxes.push({id:'new-tax',rate:'0.05',effectiveFrom:'2026-03-01'});
 x.accounts[0].isLeaf=false;
 store.set(KEY,JSON.stringify(x));const before=store.get(KEY);const count=writes;
 const users=await get('users');assert.equal(users[1].user.fullName,'Nested User');
 assert.equal((await get('accounts'))[0].isLeaf,false);
 assert.equal((await get('exchange-rates'))[1].rateDate,'2026-07-01');
 assert.equal((await get('tax-rates'))[1].rate,'0.05');
 await get('fiscal-years');await get('posting-config');
 assert.equal(store.get(KEY),before);assert.equal(writes,count);
});
test('users and setup remain renderable after creating records',async()=>{
 await previewRequest('/admin/users/company','POST',{fullName:'Sample',email:'sample@example.com',role:'Employee'});
 assert.equal((await get('users'))[0].user.fullName,'Sample');
 await previewRequest('/admin/exchange-rates/company','POST',{currencyCode:'EUR',rateDate:'2026-09-01',rate:'4'});
 assert.equal((await get('exchange-rates'))[0].rateDate.slice(0,10),'2026-09-01');
 await previewRequest('/admin/fiscal-years/company','POST',{name:'2027',startDate:'2027-01-01',endDate:'2027-12-31'});
 assert.equal((await get('fiscal-years'))[0].periods.length,12);
});
