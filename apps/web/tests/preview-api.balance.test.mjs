import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { validateJournalLines, previewRequest } from '../.test-build/lib/preview-api.js';
const KEY = 'accounting.preview.db.v2';
let store, writes, descriptors;
beforeEach(() => {
  descriptors = Object.fromEntries(['window','localStorage'].map(k => [k,Object.getOwnPropertyDescriptor(globalThis,k)]));
  store = new Map(); writes = 0;
  const storage = {getItem:k=>store.get(k)??null,setItem:(k,v)=>{writes++;store.set(k,String(v));},removeItem:k=>{writes++;store.delete(k);},clear:()=>{writes++;store.clear();}};
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:storage});
  Object.defineProperty(globalThis,'window',{configurable:true,value:{localStorage:storage}});
});
afterEach(() => {for(const [k,d] of Object.entries(descriptors)){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}});
const accounts = [{id:'a',isActive:true},{id:'b',isActive:true}];
const pair=(d=1,c=1)=>[{accountId:'a',debit:d},{accountId:'b',credit:c}];
const validate=lines=>validateJournalLines({accounts},lines);
async function initialise(change=()=>{}) {
  // A real successful route creates the real seed, then each test may tailor its fixture.
  await previewRequest('/accounting/journals/manual','POST',{lines:[{accountId:'acc-cash',debit:1},{accountId:'acc-equity',credit:1}]});
  const x=JSON.parse(store.get(KEY));x.journals=[];x.audit=[];change(x);store.set(KEY,JSON.stringify(x));writes=0;return x;
}
const state=()=>JSON.parse(store.get(KEY));
async function rejectsWithoutWrite(route,body,pattern) {
  const before=[...store];const count=writes;
  await assert.rejects(previewRequest(route,'POST',body),pattern);
  assert.deepEqual([...store],before);assert.equal(writes,count);
}
const sale=(lines=[{itemId:'item-1',quantity:1,unitPrice:10}],extra={})=>({customerId:'cus-1',warehouseId:'wh-1',invoiceDate:'2026-01-15',currencyCode:'SAR',lines,...extra});
const bill=(lines=[{itemId:'item-1',quantity:1,unitCost:10}],extra={})=>({supplierId:'sup-1',warehouseId:'wh-1',billDate:'2026-01-15',currencyCode:'SAR',lines,...extra});
test('validation is pure on success and failure',()=>{
  for(const lines of [pair('1','1'),pair(1,2)]){const x={accounts:structuredClone(accounts)};const before=structuredClone({x,lines});try{validateJournalLines(x,lines);}catch{}assert.deepEqual({x,lines},before);}
});
test('balanced decimal strings and 0.1 + 0.2 pass',()=>{assert.equal(validate(pair('1','1'))[0].debit,1);validate(pair(0.1+0.2,0.3));});
for(const value of [NaN,Infinity,-Infinity,true,false,[],[1],{},1n,Symbol('x'),'', ' ', '0x10']){
  test(`invalid amount ${String(value)} rejected`,()=>assert.throws(()=>validate(pair(value,1)),/invalid numeric/));
}
for(const [name,lines,pattern] of [
 ['unbalanced',pair(1,2),/not balanced/],['negative',pair(-1,-1),/negative/],
 ['both sides',[{accountId:'a',debit:1,credit:1},{accountId:'b',credit:1}],/both/],
 ['zero',pair(0,0),/required/],['unknown',[{accountId:'missing',debit:1},{accountId:'b',credit:1}],/unknown/],
 ['short',[],/two lines/],['object',{},/two lines/],['null line',[null,{accountId:'b',credit:1}],/invalid line/],
 ['overflow',[{accountId:'a',debit:Number.MAX_VALUE},{accountId:'a',debit:Number.MAX_VALUE},{accountId:'b',credit:1}],/not finite/],
])test(name,()=>assert.throws(()=>validate(lines),pattern));
test('inactive account rejected',()=>assert.throws(()=>validateJournalLines({accounts:[accounts[0],{id:'b',isActive:false}]},pair()),/inactive/));
test('both signs at epsilon rejected; smaller difference accepted',()=>{assert.equal(2e-6-1e-6,1e-6);assert.throws(()=>validate(pair(2e-6,1e-6)),/not balanced/);assert.throws(()=>validate(pair(1e-6,2e-6)),/not balanced/);validate(pair(1.0000001,1));});
test('rejected requests never initialise storage',async()=>{await rejectsWithoutWrite('/accounting/journals/manual',{lines:[]},/two lines/);await rejectsWithoutWrite('/year-end/close',{},/not available/);});
test('manual success persists balanced journal and audit',async()=>{await initialise();const j=await previewRequest('/accounting/journals/manual','POST',{lines:[{accountId:'acc-cash',debit:0.1+0.2},{accountId:'acc-equity',credit:0.3}]});assert.equal(state().journals[0].id,j.id);assert.equal(state().audit.length,1);assert.equal(writes,1);});
for(const lines of [{},[],[{accountId:'acc-cash',debit:100},{accountId:'acc-equity',credit:99}],[{accountId:'acc-cash',debit:NaN},{accountId:'acc-equity',credit:1}]])test('manual invalid payload keeps storage unchanged '+JSON.stringify(lines),async()=>{await initialise();await rejectsWithoutWrite('/accounting/journals/manual',{lines},/two lines|not balanced|invalid numeric/);});
test('year end never posts or writes',async()=>{await initialise();await rejectsWithoutWrite('/year-end/close',{},/not available/);});
for(const [route,make,field] of [['/sales/invoice',sale,'unitPrice'],['/purchases/bill',bill,'unitCost']]){
 for(const value of [true,[10],{},NaN,Infinity,'']) for(const key of ['quantity',field])test(`${route} rejects ${key} ${String(value)}`,async()=>{await initialise();await rejectsWithoutWrite(route,make([{itemId:'item-1',quantity:1,[field]:10,[key]:value}]),/invalid numeric/);});
 test(`${route} rejects duplicate lines`,async()=>{await initialise();const line={itemId:'item-1',quantity:1,[field]:10};await rejectsWithoutWrite(route,make([line,line]),/duplicate/);});
 for(const warehouseId of ['missing','inactive'])test(`${route} rejects warehouse ${warehouseId}`,async()=>{await initialise(x=>x.warehouses.push({id:'inactive',isActive:false}));await rejectsWithoutWrite(route,make(undefined,{warehouseId}),/warehouse/);});
 test(`${route} invalid posting account leaves state intact`,async()=>{await initialise();
 const x=state();x.accounts.find(a=>a.id===(route.includes('sales')?'acc-ar':'acc-ap')).isActive=false;store.set(KEY,JSON.stringify(x));
 await rejectsWithoutWrite(route,make(),/inactive/);});
}
test('services sell without consuming lots and sourceId matches',async()=>{await initialise();const before=state().items;const inv=await previewRequest('/sales/invoice','POST',sale([{itemId:'item-2',quantity:1,unitPrice:50}]));assert.equal(inv.status,'Posted');assert.equal(state().journals[0].sourceId,inv.id);assert.deepEqual(state().items,before);});
test('FIFO is warehouse scoped and ordered by receipt date',async()=>{await initialise(x=>{x.items[0].lots=[{id:'new',warehouseId:'wh-1',remainingQuantity:'2',unitCost:'20',receivedAt:'2026-01-10'},{id:'other',warehouseId:'wh-2',remainingQuantity:'100',unitCost:'1',receivedAt:'2025-01-01'},{id:'old',warehouseId:'wh-1',remainingQuantity:'1',unitCost:'10',receivedAt:'2026-01-01'}];});const inv=await previewRequest('/sales/invoice','POST',sale([{itemId:'item-1',quantity:2,unitPrice:100}]));const x=state();assert.deepEqual(x.items[0].lots.map(l=>l.remainingQuantity),['1','100','0']);assert.equal(x.journals[0].sourceId,inv.id);assert.equal(x.journals[0].lines.find(l=>l.accountId==='acc-cogs').debit,'30');});
test('stock in another warehouse cannot cover a shortage',async()=>{await initialise(x=>x.items[0].lots[0].warehouseId='wh-2');await rejectsWithoutWrite('/sales/invoice',sale(),/Insufficient stock/);});
test('negative and nonfinite lot costs rejected without writing',async()=>{for(const cost of ['-1','NaN']){await initialise(x=>x.items[0].lots[0].unitCost=cost);await rejectsWithoutWrite('/sales/invoice',sale(),/negative|invalid numeric/);}});
test('purchase posts matching bill id and creates inventory lot',async()=>{await initialise();const v=await previewRequest('/purchases/bill','POST',bill());const x=state();assert.equal(x.journals[0].sourceId,v.id);assert.equal(x.purchases[0].id,v.id);assert.equal(x.items[0].lots.length,2);assert.equal(x.items[0].lots[1].warehouseId,'wh-1');assert.equal(writes,1);});
test('service purchase debits its expense account without creating a lot',async()=>{await initialise();await previewRequest('/purchases/bill','POST',bill([{itemId:'item-2',quantity:1,unitCost:50}]));const x=state();assert.equal(x.items[1].lots.length,0);assert.equal(x.journals[0].lines.find(l=>l.accountId==='acc-expense').debit,'50');});
for(const route of ['/payments/customer-receipt','/payments/supplier-payment']){
 for(const amount of [true,[10],{},NaN,Infinity,'',0,-1])test(`${route} rejects ${String(amount)}`,async()=>{await initialise();await rejectsWithoutWrite(route,{amount},/invalid numeric|positive/);});
 test(`${route} saves valid payment and audit`,async()=>{await initialise();const v=await previewRequest(route,'POST',{amount:'10'});assert.equal(state().journals[0].id,v.id);assert.equal(state().audit.length,1);assert.equal(writes,1);});
 test(`${route} rejects inactive cash account`,async()=>{await initialise(x=>x.accounts.find(a=>a.id==='acc-cash').isActive=false);await rejectsWithoutWrite(route,{amount:1},/inactive/);});
}

test('sparse journal arrays are rejected',()=>assert.throws(()=>validate(new Array(2)),/invalid line/));
test('corrupt stored data is not silently overwritten',async()=>{store.set(KEY,'invalid');await rejectsWithoutWrite('/accounting/journals/manual',{lines:[]},/Preview data is invalid/);});
