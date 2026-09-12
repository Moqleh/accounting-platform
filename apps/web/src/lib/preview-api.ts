'use client';

const COMPANY_ID='11111111-1111-1111-1111-111111111111';
const ADMIN_EMAIL='admin@example.com';
const INITIAL_PASSWORD_SHA256='ee62871beaf2fc7c2b038d32767785df3b1c89e31bab5050cf47441f7e7a543f';
const DB_KEY='accounting.preview.db.v2';
const PASSWORD_KEY='accounting.preview.password.sha256';

type Db=ReturnType<typeof seed>;

function id(prefix='id'){return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,9)}`}
function now(){return new Date().toISOString()}
function n(v:unknown){const x=Number(v);return Number.isFinite(x)?x:0}
function hashText(text:string){return Array.from(new Uint8Array(new TextEncoder().encode(text))).map(x=>x.toString(16).padStart(2,'0')).join('')}
async function sha256(text:string){const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return Array.from(new Uint8Array(buf)).map(x=>x.toString(16).padStart(2,'0')).join('')}

function seed(){
  const cash='acc-cash',ar='acc-ar',ap='acc-ap',sales='acc-sales',inventory='acc-inventory',cogs='acc-cogs',vatOut='acc-vatout',vatIn='acc-vatin',expense='acc-expense',equity='acc-equity';
  const accounts=[
    {id:cash,code:'1101',name:'Cash & Bank',nameAr:'النقد والبنوك',type:'Asset',isPosting:true,isActive:true},
    {id:ar,code:'1201',name:'Accounts Receivable',nameAr:'الذمم المدينة',type:'Asset',isPosting:true,isActive:true},
    {id:inventory,code:'1301',name:'Inventory',nameAr:'المخزون',type:'Asset',isPosting:true,isActive:true},
    {id:vatIn,code:'1401',name:'Input VAT',nameAr:'ضريبة مدخلات',type:'Asset',isPosting:true,isActive:true},
    {id:ap,code:'2101',name:'Accounts Payable',nameAr:'الذمم الدائنة',type:'Liability',isPosting:true,isActive:true},
    {id:vatOut,code:'2201',name:'Output VAT',nameAr:'ضريبة مخرجات',type:'Liability',isPosting:true,isActive:true},
    {id:equity,code:'3101',name:'Retained Earnings',nameAr:'الأرباح المبقاة',type:'Equity',isPosting:true,isActive:true},
    {id:sales,code:'4101',name:'Sales Revenue',nameAr:'إيرادات المبيعات',type:'Revenue',isPosting:true,isActive:true},
    {id:cogs,code:'5101',name:'Cost of Goods Sold',nameAr:'تكلفة المبيعات',type:'Expense',isPosting:true,isActive:true},
    {id:expense,code:'5201',name:'General Expenses',nameAr:'مصروفات عامة',type:'Expense',isPosting:true,isActive:true},
  ];
  return {
    company:{id:COMPANY_ID,name:'Example Trading Company',nameAr:'شركة المثال التجارية',baseCurrency:'SAR',taxNumber:'310000000000003',country:'SA',email:'finance@example.com'},
    accounts,
    customers:[{id:'cus-1',code:'CUST-001',name:'Al Riyadh Customer',nameAr:'عميل الرياض',email:'customer@example.com',phone:'0500000000',taxNumber:'310000000000011'}],
    suppliers:[{id:'sup-1',code:'SUP-001',name:'Gulf Supplier',nameAr:'مورد الخليج',email:'supplier@example.com',phone:'0500000001',taxNumber:'310000000000022'}],
    warehouses:[{id:'wh-1',code:'MAIN',name:'Main Warehouse',nameAr:'المستودع الرئيسي',isActive:true}],
    taxes:[{id:'tax-15',code:'VAT15',name:'VAT 15%',nameAr:'ضريبة القيمة المضافة 15%',rate:'15',isActive:true}],
    items:[
      {id:'item-1',code:'LAPTOP',name:'Business Laptop',nameAr:'حاسوب أعمال',type:'Inventory',salesAccountId:sales,purchaseAccountId:inventory,inventoryAccountId:inventory,cogsAccountId:cogs,lots:[{id:'lot-1',warehouseId:'wh-1',remainingQuantity:'25',unitCost:'2500',receivedAt:'2026-01-15T00:00:00.000Z'}]},
      {id:'item-2',code:'CONSULT',name:'Consulting Service',nameAr:'خدمة استشارية',type:'Service',salesAccountId:sales,purchaseAccountId:expense,lots:[]},
    ],
    sales:[], purchases:[], creditNotes:[], debitNotes:[], journals:[], audit:[],
    fiscalYears:[{id:'fy-2026',name:'FY 2026',startDate:'2026-01-01T00:00:00.000Z',endDate:'2026-12-31T23:59:59.999Z',status:'Open',periods:Array.from({length:12},(_,i)=>({id:`p-${i+1}`,name:`2026-${String(i+1).padStart(2,'0')}`,status:'Open'}))}],
    users:[{id:'user-admin',email:ADMIN_EMAIL,fullName:'Super Admin',role:'Owner',dataScope:'all',isActive:true}],
    exchangeRates:[{id:'fx-usd',currencyCode:'USD',rate:'3.75',effectiveDate:'2026-01-01T00:00:00.000Z'}],
    postingConfig:{arAccountId:ar,apAccountId:ap,salesAccountId:sales,inventoryAccountId:inventory,cogsAccountId:cogs,inputTaxAccountId:vatIn,outputTaxAccountId:vatOut,cashAccountId:cash},
    bankAccounts:[{id:'bank-1',name:'Main Bank',nameAr:'البنك الرئيسي',accountNumber:'SA00 0000 0000 0000',currencyCode:'SAR',glAccountId:cash,isActive:true}],
    statementLines:[], reconciliations:[],
  };
}

function db():Db{
  if(typeof window==='undefined') return seed();
  const raw=localStorage.getItem(DB_KEY); if(!raw) return seed();
  try{return JSON.parse(raw) as Db}catch{throw new Error('Preview data is invalid; restore or reset it before continuing')}
}
// Adapt older local preview records to the admin API contract without rewriting storage.
function adminUser(row:any){
  const user=row.user??row;
  return {id:row.id,role:row.role,dataScope:row.dataScope,isActive:row.isActive!==false,user:{id:user.id,email:user.email??'',fullName:user.fullName??''}};
}
function adminYear(year:any){
  const first=Date.parse(year.startDate);
  const last=Date.parse(year.endDate);
  return {...year,periods:(Array.isArray(year.periods)?year.periods:[]).map((period:any,index:number)=>{
    const number=period.number??index+1;
    const start=new Date(first);
    start.setUTCMonth(start.getUTCMonth()+number-1,1);
    const end=new Date(start);end.setUTCMonth(end.getUTCMonth()+1,0);
    const valid=Number.isFinite(first)&&Number.isFinite(last)&&Number.isFinite(start.getTime())&&start.getTime()<=last;
    return {...period,number,startDate:period.startDate??(valid?new Date(Math.max(first,start.getTime())).toISOString():''),endDate:period.endDate??(valid?new Date(Math.min(last,end.getTime())).toISOString():'')};
  })};
}
function adminConfig(x:Db){
  const config=x.postingConfig as typeof x.postingConfig & {receivableAccountId?:string;payableAccountId?:string;retainedEarningsAccountId?:string};
  return {...config,companyId:x.company.id,receivableAccountId:config.receivableAccountId??config.arAccountId,payableAccountId:config.payableAccountId??config.apAccountId,retainedEarningsAccountId:config.retainedEarningsAccountId??x.accounts.find(a=>a.type==='Equity')?.id??null};
}
function companyView(x:Db){return {...x.company,baseCurrencyCode:(x.company as any).baseCurrencyCode??x.company.baseCurrency};}
function accountView(a:any){return {...a,isLeaf:a.isLeaf??a.isPosting??false,isActive:a.isActive!==false};}
function taxView(x:Db,t:any){return {...t,rate:!t.effectiveFrom&&Number(t.rate)>1?String(Number(t.rate)/100):t.rate,effectiveFrom:t.effectiveFrom??'',salesTaxAccountId:t.salesTaxAccountId??x.postingConfig.outputTaxAccountId,purchaseTaxAccountId:t.purchaseTaxAccountId??x.postingConfig.inputTaxAccountId};}
function documentView(x:Db,v:any,sale:boolean){return {...v,invoiceDate:v.invoiceDate??v.transactionDate??'',billDate:v.billDate??v.transactionDate??'',grandTotal:v.grandTotal??v.total??'0',currencyCode:v.currencyCode??companyView(x).baseCurrencyCode,customer:v.customer??x.customers.find(c=>c.id===v.customerId)??{name:'—'},supplier:v.supplier??x.suppliers.find(c=>c.id===v.supplierId)??{name:'—'},lines:(v.lines??[]).map((l:any)=>({...l,item:l.item??x.items.find(i=>i.id===l.itemId)??{code:'',name:'—'}}))};}
function baseOnly(x:Db,body:any){if(body?.currencyCode&&body.currencyCode!==companyView(x).baseCurrencyCode)throw new Error('Foreign currency posting is not available in preview mode');if(body?.exchangeRate!==undefined&&toDecimalStrict(body.exchangeRate,'Exchange rate')!==1)throw new Error('Base currency exchange rate must be 1');}
function lineTax(x:Db,line:any,price:string){const chosen=line.taxRateId===undefined?x.taxes[0]?.id:line.taxRateId;if(!chosen)return 0;const t=x.taxes.find(t=>t.id===chosen);if(!t||t.isActive===false)throw new Error('Unknown or inactive tax');const rate=toDecimalStrict(taxView(x,t).rate,'Tax rate');if(rate<0)throw new Error('Tax rate cannot be negative');return Number(line.quantity)*Number(line[price])*rate;}
function agingView(x:Db,sale:boolean){return (sale?x.sales:x.purchases).map((v:any)=>{const d=documentView(x,v,sale),days=Math.max(0,Math.floor((Date.now()-Date.parse(sale?d.invoiceDate:d.billDate))/86400000))||0;return {invoiceId:sale?d.id:undefined,billId:sale?undefined:d.id,invoiceNumber:d.invoiceNumber,billNumber:d.billNumber,customerId:d.customerId??d.customer?.id,supplierId:d.supplierId??d.supplier?.id,customer:d.customer?.name,supplier:d.supplier?.name,outstanding:d.grandTotal,currencyCode:d.currencyCode,days,bucket:days<=30?'0–30':days<=60?'31–60':days<=90?'61–90':'90+'};});}
function save(x:Db){localStorage.setItem(DB_KEY,JSON.stringify(x))}
function audit(x:Db,action:string,entityType:string,entityId:string){x.audit.unshift({id:id('audit'),action,entityType,entityId,createdAt:now(),user:{email:ADMIN_EMAIL,fullName:'Super Admin'}} as never)}
function nextNo(prefix:string,count:number){return `${prefix}-${String(count+1).padStart(5,'0')}`}
// ============================================================
// Journal balance validation (centralised, pure)
// ============================================================
// - Never mutates its arguments.
// - Reads accounts only; never writes state or storage.
// - Called by previewRequest paths BEFORE any Db mutation.
// - Called again inside journal() on every invocation.
// ============================================================

export type JournalLineInput = {
  accountId: string;
  debit?: number | string;
  credit?: number | string;
  baseDebit?: number | string;
  baseCredit?: number | string;
};

export type NormalisedJournalLine = {
  accountId: string;
  debit: number;
  credit: number;
};

const BALANCE_EPSILON = 1e-6;

// Only omitted journal sides default to zero. Required values remain strict.
function toDecimalStrict(value: unknown, tag: string): number {
  if (typeof value !== 'number' && typeof value !== 'string') {
    throw new Error(`${tag}: invalid numeric value`);
  }
  if (typeof value === 'string' && !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())) {
    throw new Error(`${tag}: invalid numeric value`);
  }
  const amount = Number(value);
  if (!Number.isFinite(amount)) throw new Error(`${tag}: invalid numeric value`);
  return amount;
}

export function validateJournalLines(
  x: Db,
  lines: JournalLineInput[],
): NormalisedJournalLine[] {
  if (!Array.isArray(lines) || lines.length < 2) {
    throw new Error('Journal requires at least two lines');
  }

  const accountIndex = new Map(
    (x.accounts as Array<{ id: string; isActive?: boolean }>).map(
      (a) => [a.id, a] as const,
    ),
  );

  const normalised: NormalisedJournalLine[] = Array.from(lines).map((line, index) => {
    const tag = `Line ${index + 1}`;

    if (!line || typeof line !== 'object' || Array.isArray(line)) {
      throw new Error(`${tag}: invalid line payload`);
    }
    if (typeof line.accountId !== 'string' || line.accountId.length === 0) {
      throw new Error(`${tag}: accountId is required`);
    }

    const account = accountIndex.get(line.accountId);
    if (!account) {
      throw new Error(`${tag}: unknown account`);
    }
    if (account.isActive === false) {
      throw new Error(`${tag}: account is inactive`);
    }

    const debit = toDecimalStrict(line.debit ?? line.baseDebit ?? 0, tag);
    const credit = toDecimalStrict(line.credit ?? line.baseCredit ?? 0, tag);

    if (debit < 0 || credit < 0) {
      throw new Error(`${tag}: negative amounts are not allowed`);
    }
    if (debit > 0 && credit > 0) {
      throw new Error(`${tag}: debit and credit cannot both be set`);
    }
    if (debit === 0 && credit === 0) {
      throw new Error(`${tag}: debit or credit is required`);
    }

    return { accountId: line.accountId, debit, credit };
  });

  const totalDebit = normalised.reduce((s, l) => s + l.debit, 0);
  const totalCredit = normalised.reduce((s, l) => s + l.credit, 0);

  if (!Number.isFinite(totalDebit) || !Number.isFinite(totalCredit)) {
    throw new Error('Journal totals are not finite');
  }

  const diff = Math.abs(totalDebit - totalCredit);
  if (!(diff < BALANCE_EPSILON)) {
    throw new Error(
      `Journal is not balanced: debit ${totalDebit} ≠ credit ${totalCredit}`,
    );
  }

  return normalised;
}
function journal(
  x: Db,
  sourceType: string,
  sourceId: string,
  lines: JournalLineInput[],
) {
  // Validate every preview journal, including production builds of the preview.
  const normalised = validateJournalLines(x, lines);

  const j = {
    id: id('jrnl'),
    journalNumber: nextNo('JRN', x.journals.length),
    transactionDate: now(),
    status: 'Posted',
    sourceType,
    sourceId,
    description: sourceType,
    lines: normalised.map((l) => ({
      id: id('jl'),
      accountId: l.accountId,
      baseDebit: String(l.debit),
      baseCredit: String(l.credit),
      debit: String(l.debit),
      credit: String(l.credit),
      account: x.accounts.find((a) => a.id === l.accountId),
    })),
  };

  x.journals.unshift(j as never);
  return j;
}
function trialBalance(x:Db){return x.accounts.map(a=>{let d=0,c=0;for(const j of x.journals as any[])for(const l of j.lines??[])if(l.accountId===a.id){d+=n(l.baseDebit);c+=n(l.baseCredit)}return {accountCode:a.code,accountName:a.name,accountNameAr:a.nameAr,debit:String(d),credit:String(c),balance:String(d-c)}}).filter(r=>n(r.debit)||n(r.credit))}
function valuation(x:Db){return x.items.filter(i=>i.type==='Inventory').flatMap(i=>(i.lots??[]).map(l=>({itemCode:i.code,itemName:i.name,warehouse:x.warehouses.find(w=>w.id===l.warehouseId)?.name??'—',receivedDate:String(l.receivedAt??'').slice(0,10),quantity:l.remainingQuantity,unitCost:l.unitCost,value:String(n(l.remainingQuantity)*n(l.unitCost))})));}

export function isPreviewMode(){return typeof window!=='undefined' && !process.env.NEXT_PUBLIC_API_URL}
export async function previewLogin(email:string,password:string){
  if(email.trim().toLowerCase()!==ADMIN_EMAIL) throw new Error('Invalid email or password');
  const expected=localStorage.getItem(PASSWORD_KEY)||INITIAL_PASSWORD_SHA256;
  if(await sha256(password)!==expected) throw new Error('Invalid email or password');
  return {token:'preview-super-admin',user:{id:'user-admin',email:ADMIN_EMAIL,fullName:'Super Admin'},memberships:[{companyId:COMPANY_ID,companyName:'Example Trading Company',role:'Owner',dataScope:'all'}],defaultCompanyId:COMPANY_ID};
}

export async function previewRequest<T>(path:string,method:'GET'|'POST'|'PATCH',body?:any):Promise<T>{
  const clean=path.split('?')[0];
  if (method !== 'GET' && clean === '/year-end/close') throw new Error('Year-end closing is not available in preview mode');
  const x=db();
  if(method==='GET'){
    if(clean==='/auth/me') return {user:{id:'user-admin',email:ADMIN_EMAIL,fullName:'Super Admin'},email:ADMIN_EMAIL,memberships:[{companyId:COMPANY_ID,companyName:x.company.name,role:'Owner',dataScope:'all'}],defaultCompanyId:COMPANY_ID} as T;
    if(clean.startsWith('/erp/company/')||clean.startsWith('/admin/company/')) return companyView(x) as T;
    if(clean.startsWith('/erp/dashboard/')){const tb=trialBalance(x);return {baseCurrency:x.company.baseCurrency,baseCurrencyCode:companyView(x).baseCurrencyCode,items:x.items.length,journals:x.journals.length,customers:x.customers.length,suppliers:x.suppliers.length,postedJournals:x.journals.length,sales:(x.sales as any[]).reduce((s,v)=>s+n(v.total),0),purchases:(x.purchases as any[]).reduce((s,v)=>s+n(v.total),0),trialBalance:tb} as T}
    if(clean.startsWith('/erp/customers/')) return x.customers.map((v:any)=>({...v,isActive:v.isActive!==false})) as T;
    if(clean.startsWith('/erp/suppliers/')) return x.suppliers.map((v:any)=>({...v,isActive:v.isActive!==false})) as T;
    if(clean.startsWith('/erp/items/')) return x.items.map((v:any)=>({...v,isActive:v.isActive!==false,lots:v.lots??[]})) as T;
    if(clean.startsWith('/erp/warehouses/')||clean.startsWith('/admin/warehouses/')) return x.warehouses as T;
    if(clean.startsWith('/admin/tax-rates/')) return x.taxes.map(t=>taxView(x,t)) as T;
    if(clean.startsWith('/erp/tax-rates/')) return x.taxes.map(t=>taxView(x,t)) as T;
    if(clean.startsWith('/admin/accounts/')) return x.accounts.map(accountView) as T;
    if(clean.startsWith('/erp/accounts/')) return x.accounts.map(accountView) as T;
    if(clean.startsWith('/erp/sales/')) return x.sales.map(v=>documentView(x,v,true)) as T;
    if(clean.startsWith('/erp/purchases/')) return x.purchases.map(v=>documentView(x,v,false)) as T;
    if(clean.startsWith('/erp/journals/')) return x.journals as T;
    if(clean.startsWith('/erp/trial-balance/')) return trialBalance(x) as T;
    if(clean.startsWith('/erp/inventory-valuation/')) return valuation(x) as T;
    if(clean.startsWith('/erp/profit-loss/')){const tb=trialBalance(x);const revenue=tb.filter(r=>x.accounts.find(a=>a.code===r.accountCode)?.type==='Revenue').reduce((s,r)=>s+n(r.credit)-n(r.debit),0);const expenses=tb.filter(r=>x.accounts.find(a=>a.code===r.accountCode)?.type==='Expense').reduce((s,r)=>s+n(r.debit)-n(r.credit),0);return {revenue:String(revenue),expense:String(expenses),expenses:String(expenses),netProfit:String(revenue-expenses)} as T}
    if(clean.startsWith('/erp/balance-sheet/')) return trialBalance(x).filter(r=>['Asset','Liability','Equity'].includes(x.accounts.find(a=>a.code===r.accountCode)?.type??'')).map(r=>({...r,code:r.accountCode,name:r.accountName,type:x.accounts.find(a=>a.code===r.accountCode)?.type,amount:String(n(r.debit)-n(r.credit))})) as T;
    if(clean.startsWith('/erp/account-activity/')){const accountId=new URLSearchParams(path.split('?')[1]).get('accountId');return (x.journals as any[]).flatMap(j=>(j.lines??[]).filter((l:any)=>!accountId||l.accountId===accountId).map((l:any)=>({...l,account:l.account??x.accounts.find(a=>a.id===l.accountId)??{code:'',name:'—'},journal:{id:j.id,journalNumber:j.journalNumber,transactionDate:j.transactionDate??'',sourceType:j.sourceType}}))) as T;}
    if(clean.startsWith('/reports/customer-aging/')) return agingView(x,true) as T;
    if(clean.startsWith('/reports/supplier-aging/')) return agingView(x,false) as T;
    if(clean.startsWith('/reports/credit-notes/')) return (x.creditNotes as any[]).map(v=>({...v,creditDate:v.creditDate??v.transactionDate??'',grandTotal:v.grandTotal??v.total??'0',customer:typeof v.customer==='string'?v.customer:v.customer?.name??'—'})) as T;
    if(clean.startsWith('/admin/fiscal-years/')) return x.fiscalYears.map(adminYear) as T;
    if(clean.startsWith('/admin/users/')) return x.users.map(adminUser) as T;
    if(clean.startsWith('/admin/audit/')) return x.audit as T;
    if(clean.startsWith('/admin/posting-config/')) return adminConfig(x) as T;
    if(clean.startsWith('/admin/exchange-rates/')) return x.exchangeRates.map((r:any)=>({...r,rateDate:r.rateDate??r.effectiveDate??''})) as T;
    if(clean.startsWith('/erp/exchange-rate/')){const code=clean.split('/').pop();return (x.exchangeRates.find(r=>r.currencyCode===code)||{currencyCode:code,rate:'1'}) as T}
    if(clean.startsWith('/debit-notes/')) return (x.debitNotes as any[]).map(v=>({...v,debitDate:v.debitDate??v.transactionDate??'',grandTotal:v.grandTotal??v.total??'0',supplier:typeof v.supplier==='string'?v.supplier:v.supplier?.name??'—'})) as T;
    if(clean.startsWith('/banking/accounts/')) return x.bankAccounts.map((b:any)=>({...b,code:b.code??b.id,currency:b.currency??b.currencyCode,glCode:x.accounts.find(a=>a.id===(b.accountId??b.glAccountId))?.code??'',glName:x.accounts.find(a=>a.id===(b.accountId??b.glAccountId))?.name??''})) as T;
    if(clean.startsWith('/banking/statement-lines/')) return x.statementLines as T;
    if(clean.startsWith('/banking/candidates/')) return (x.journals as any[]).map(j=>({id:j.id,journalNumber:j.journalNumber,transactionDate:j.transactionDate,amount:String((j.lines??[]).reduce((s:number,l:any)=>s+n(l.baseDebit)-n(l.baseCredit),0)),description:j.description})) as T;
    if(clean.startsWith('/banking/reconciliations/')) return x.reconciliations as T;
    throw new Error('This page data is not available in preview mode');
  }

  if(clean.startsWith('/banking/')||clean==='/credit-notes'||clean==='/debit-notes')throw new Error('This operation requires the full server edition; it is not available in preview mode');
  if(clean==='/auth/change-password'){
    const expected=localStorage.getItem(PASSWORD_KEY)||INITIAL_PASSWORD_SHA256;
    if(await sha256(body?.currentPassword??'')!==expected) throw new Error('Current password is incorrect');
    if(!body?.newPassword||String(body.newPassword).length<10) throw new Error('New password must contain at least 10 characters');
    localStorage.setItem(PASSWORD_KEY,await sha256(body.newPassword));return {changed:true} as T;
  }
  if(clean.startsWith('/admin/company/')){if(body.baseCurrencyCode&&body.baseCurrencyCode!==companyView(x).baseCurrencyCode)throw new Error('Changing base currency requires the server edition');x.company={...x.company,...body};audit(x,'UPDATE','Company',COMPANY_ID);save(x);return companyView(x) as T;}
  if(clean.startsWith('/admin/customers/')||clean.startsWith('/erp/customers/')){const v={id:id('cus'),...body};x.customers.unshift(v as never);audit(x,'CREATE','Customer',v.id);save(x);return v as T}
  if(clean.startsWith('/admin/suppliers/')||clean.startsWith('/erp/suppliers/')){const v={id:id('sup'),...body};x.suppliers.unshift(v as never);audit(x,'CREATE','Supplier',v.id);save(x);return v as T}
  if(clean.startsWith('/admin/items/')){const v={id:id('item'),lots:[],isActive:true,...body,salesAccountId:body.revenueAccountId??body.salesAccountId,purchaseAccountId:body.type==='Service'?body.cogsAccountId:body.inventoryAccountId};x.items.unshift(v as never);audit(x,'CREATE','Item',v.id);save(x);return v as T}
  if(clean.startsWith('/admin/warehouses/')){const v={id:id('wh'),isActive:true,...body};x.warehouses.unshift(v as never);audit(x,'CREATE','Warehouse',v.id);save(x);return v as T}
  if(clean.startsWith('/admin/accounts/')){const v={id:id('acc'),isActive:true,isPosting:true,...body};x.accounts.unshift(v as never);audit(x,'CREATE','Account',v.id);save(x);return v as T}
  if(clean.startsWith('/admin/tax-rates/')){const v={id:id('tax'),isActive:true,...body};x.taxes.unshift(v as never);audit(x,'CREATE','TaxRate',v.id);save(x);return v as T}
  if(clean.startsWith('/admin/fiscal-years/')){
    const start=new Date(body.startDate),end=new Date(body.endDate);
    if(!body.name?.trim()||!Number.isFinite(+start)||!Number.isFinite(+end)||start>end)throw new Error('Invalid fiscal year dates or name');
    const count=(end.getUTCFullYear()-start.getUTCFullYear())*12+end.getUTCMonth()-start.getUTCMonth()+1;
    if(count>24)throw new Error('Fiscal year is too long');
    if(x.fiscalYears.some(y=>Date.parse(y.startDate)<=+end&&Date.parse(y.endDate)>=+start))throw new Error('Fiscal year overlaps an existing year');
    const yearId=id('fy');const v=adminYear({id:yearId,name:body.name,startDate:start.toISOString(),endDate:end.toISOString(),status:'Open',periods:Array.from({length:count},(_,i)=>({id:`${yearId}-p-${i+1}`,number:i+1,status:'Open'}))});x.fiscalYears.unshift(v as never);audit(x,'CREATE','FiscalYear',v.id);save(x);return v as T;
  }
  if(clean.startsWith('/admin/posting-config/')){x.postingConfig={...x.postingConfig,...body,arAccountId:body.receivableAccountId??x.postingConfig.arAccountId,apAccountId:body.payableAccountId??x.postingConfig.apAccountId};audit(x,'UPDATE','AccountingConfig',COMPANY_ID);save(x);return x.postingConfig as T}
  if(clean.startsWith('/admin/exchange-rates/')){const v={id:id('fx'),...body};x.exchangeRates.unshift(v as never);audit(x,'CREATE','ExchangeRate',v.id);save(x);return v as T}
  if(clean.startsWith('/admin/users/')){const v={id:id('user'),isActive:true,email:body.email,fullName:body.fullName,role:body.role,dataScope:body.dataScope};x.users.unshift(v as never);audit(x,'CREATE','User',v.id);save(x);return v as T}
  if(clean.includes('/fiscal-periods/')&&method==='PATCH'){
    const periodId=clean.split('/').at(-2);const year=x.fiscalYears.find(y=>y.periods.some(p=>p.id===periodId));const period=year?.periods.find(p=>p.id===periodId);
    if(!year||!period)throw new Error('Unknown fiscal period');
    if(year.status==='Closed'||period.status==='Hard_Closed')throw new Error('Fiscal period is permanently closed');
    if(!['Open','Soft_Closed','Hard_Closed'].includes(body.status))throw new Error('Invalid period status');
    period.status=body.status;audit(x,'UPDATE','FiscalPeriod',period.id);save(x);return {updated:true} as T;
  }
  if(clean==='/accounting/journals/reverse'){
    const original=(x.journals as any[]).find(j=>j.id===body.journalId);
    if(!original||original.status!=='Posted')throw new Error('Journal is not available for reversal');
    if(original.sourceType!=='Manual')throw new Error('Document reversal requires the server edition');
    if(!Number.isFinite(Date.parse(body.reversalDate)))throw new Error('Invalid reversal date');
    const inverse=original.lines.map((l:any)=>({accountId:l.accountId,debit:l.baseCredit,credit:l.baseDebit}));
    validateJournalLines(x,inverse);const reversal=journal(x,'Reversal',original.id,inverse);reversal.transactionDate=body.reversalDate;original.status='Reversed';audit(x,'REVERSE','Journal',original.id);save(x);return reversal as T;
  }


if (clean === '/purchases/bill') {
  baseOnly(x,body);
  if(!Number.isFinite(Date.parse(body?.billDate)))throw new Error('Invalid bill date');
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid document payload');
  if (!x.suppliers.some(p => p.id === body.supplierId)) throw new Error('Invalid supplier');
  if (!x.warehouses.some(w => w.id === body.warehouseId && w.isActive !== false)) throw new Error('Invalid or inactive warehouse');

  // ---- 1) Validate input shape ----
  const rawLines = body?.lines;
  if (!Array.isArray(rawLines) || rawLines.length === 0) {
    throw new Error('Purchase bill requires at least one line');
  }

  const seenItems = new Set<string>();
  for (let i = 0; i < rawLines.length; i++) {
    const l = rawLines[i];
    const tag = `Line ${i + 1}`;
    if (!l || typeof l !== 'object' || Array.isArray(l)) {
      throw new Error(`${tag}: invalid line payload`);
    }
    if (typeof l.itemId !== 'string' || !l.itemId) {
      throw new Error(`${tag}: itemId is required`);
    }
    if (seenItems.has(l.itemId)) {
      throw new Error(`${tag}: duplicate item in bill is not allowed`);
    }
    seenItems.add(l.itemId);

    const qty = toDecimalStrict(l.quantity, `${tag}: quantity`);
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new Error(`${tag}: quantity must be a positive number`);
    }
    const unitCost = toDecimalStrict(l.unitCost, `${tag}: unitCost`);
    if (!Number.isFinite(unitCost) || unitCost < 0) {
      throw new Error(`${tag}: unitCost must be a non-negative number`);
    }
    const item = x.items.find((it) => it.id === l.itemId);
    if (!item || (item as { isActive?: boolean }).isActive === false) {
      throw new Error(`${tag}: unknown or inactive item`);
    }
    if (!['Inventory', 'Service'].includes(item.type)) throw new Error(`${tag}: unsupported item type`);
  }

  // ---- 2) Totals ----
  let subtotal = 0;
  for (const l of rawLines) {
    subtotal += Number(l.quantity) * Number(l.unitCost);
  }
  const tax = rawLines.reduce((sum:number,l:any)=>sum+lineTax(x,l,'unitCost'),0);
  const total = subtotal + tax;

  // ---- 3) Journal lines + validate ----
  const journalLines: JournalLineInput[] = [
    ...rawLines.filter(l => Number(l.unitCost) > 0).map(l => ({
      accountId: x.items.find(i => i.id === l.itemId)!.purchaseAccountId??(x.items.find(i=>i.id===l.itemId)!.type==='Service'?x.items.find(i=>i.id===l.itemId)!.cogsAccountId:x.items.find(i=>i.id===l.itemId)!.inventoryAccountId),
      debit: Number(l.quantity) * Number(l.unitCost),
    })),
    ...rawLines.map((l:any)=>({accountId:taxView(x,x.taxes.find(t=>t.id===(l.taxRateId===undefined?x.taxes[0]?.id:l.taxRateId))??{}).purchaseTaxAccountId,debit:lineTax(x,l,'unitCost')})).filter((l:any)=>l.debit>0),
    { accountId: x.postingConfig.apAccountId, credit: total },
  ];
  validateJournalLines(x, journalLines);

  const billId = id('bill');

  // ---- 4) Apply lot updates (inventory items only) ----
  if (rawLines.some(l => x.items.find(i => i.id === l.itemId)!.type === 'Inventory') && !Number.isFinite(Date.parse(body.billDate))) throw new Error('Invalid bill date');
  for (const l of rawLines) {
    const item = x.items.find((it) => it.id === l.itemId)!;
    if (item.type === 'Inventory') {
      item.lots.push({
        id: id('lot'),
        warehouseId: body.warehouseId,
        remainingQuantity: String(Number(l.quantity)),
        unitCost: String(Number(l.unitCost)),
        receivedAt: body.billDate,
      } as never);
    }
  }

  // ---- 5) Journal + persist ----
  journal(x, 'PurchaseBill', billId, journalLines).transactionDate=body.billDate;

  const bill = {
    id: billId,
    billNumber: nextNo('PUR', x.purchases.length),
    transactionDate: body.billDate,
    total: String(total),
    status: 'Posted',
    currencyCode: body.currencyCode,
    supplier: x.suppliers.find((s) => s.id === body.supplierId),
    lines: rawLines.map((l: any) => ({
      ...l,
      id: id('pl'),
      item: x.items.find((i) => i.id === l.itemId),
    })),
  };
  x.purchases.unshift(bill as never);

  audit(x, 'POST', 'PurchaseBill', billId);
  save(x);
  return bill as T;
}
if (clean === '/sales/invoice') {
  baseOnly(x,body);
  if(!Number.isFinite(Date.parse(body?.invoiceDate)))throw new Error('Invalid invoice date');
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid document payload');
  if (!x.customers.some(p => p.id === body.customerId)) throw new Error('Invalid customer');
  if (!x.warehouses.some(w => w.id === body.warehouseId && w.isActive !== false)) throw new Error('Invalid or inactive warehouse');

  // ---- 1) Validate input shape before any calculation ----
  const rawLines = body?.lines;
  if (!Array.isArray(rawLines) || rawLines.length === 0) {
    throw new Error('Invoice requires at least one line');
  }

  const seenItems = new Set<string>();
  for (let i = 0; i < rawLines.length; i++) {
    const l = rawLines[i];
    const tag = `Line ${i + 1}`;
    if (!l || typeof l !== 'object' || Array.isArray(l)) {
      throw new Error(`${tag}: invalid line payload`);
    }
    if (typeof l.itemId !== 'string' || !l.itemId) {
      throw new Error(`${tag}: itemId is required`);
    }
    if (seenItems.has(l.itemId)) {
      throw new Error(`${tag}: duplicate item in invoice is not allowed`);
    }
    seenItems.add(l.itemId);

    const qty = toDecimalStrict(l.quantity, `${tag}: quantity`);
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new Error(`${tag}: quantity must be a positive number`);
    }
    const price = toDecimalStrict(l.unitPrice, `${tag}: unitPrice`);
    if (!Number.isFinite(price) || price < 0) {
      throw new Error(`${tag}: unitPrice must be a non-negative number`);
    }
    const item = x.items.find((it) => it.id === l.itemId);
    if (!item || (item as { isActive?: boolean }).isActive === false) {
      throw new Error(`${tag}: unknown or inactive item`);
    }
    if (!['Inventory', 'Service'].includes(item.type)) throw new Error(`${tag}: unsupported item type`);
  }

  // ---- 2) Build totals and plan FIFO allocations (no Db mutation) ----
  let subtotal = 0;
  let cost = 0;
  const allocations: Array<{ itemId: string; lotId: string; take: number }> = [];

  for (const l of rawLines) {
    const qty = toDecimalStrict(l.quantity, 'quantity');
    const price = toDecimalStrict(l.unitPrice, 'unitPrice');
    subtotal += qty * price;

    const item = x.items.find((it) => it.id === l.itemId)!;

    if (item.type === 'Inventory') {
      let remaining = qty;
      const lots = [...(item.lots ?? [])].filter(l => l.warehouseId === body.warehouseId);
      for (const lot of lots) {
        if (!Number.isFinite(Date.parse(lot.receivedAt))) throw new Error('Invalid inventory receipt date');
      }
      lots.sort((a, b) => Date.parse(a.receivedAt) - Date.parse(b.receivedAt) || a.id.localeCompare(b.id));
      for (const lot of lots) {
        if (remaining <= 0) break;
        const available = toDecimalStrict(lot.remainingQuantity, 'Inventory quantity');
        const unitCost = toDecimalStrict(lot.unitCost, 'Inventory cost');
        if (available < 0 || unitCost < 0) throw new Error('Invalid negative inventory quantity or cost');
        const take = Math.min(remaining, available);
        if (take <= 0) continue;
        allocations.push({ itemId: item.id, lotId: lot.id, take });
        cost += take * unitCost;
        if (!Number.isFinite(cost)) throw new Error('Inventory cost is not finite');
        remaining -= take;
      }
      if (remaining > 0) {
        throw new Error(
          `Insufficient stock for item ${item.code ?? item.id}`,
        );
      }
    }
  }

  const tax = rawLines.reduce((sum:number,l:any)=>sum+lineTax(x,l,'unitPrice'),0);
  const total = subtotal + tax;

  // ---- 3) Build journal lines, validate BEFORE mutating ----
  const journalLines: JournalLineInput[] = [
    { accountId: x.postingConfig.arAccountId, debit: total },
    { accountId: x.postingConfig.salesAccountId, credit: subtotal },
    ...rawLines.map((l:any)=>({accountId:taxView(x,x.taxes.find(t=>t.id===(l.taxRateId===undefined?x.taxes[0]?.id:l.taxRateId))??{}).salesTaxAccountId,credit:lineTax(x,l,'unitPrice')})).filter((l:any)=>l.credit>0),
  ];
  if (cost > 0) {
    journalLines.push(
      { accountId: x.postingConfig.cogsAccountId, debit: cost },
      { accountId: x.postingConfig.inventoryAccountId, credit: cost },
    );
  }

  validateJournalLines(x, journalLines); // throws → nothing mutated

  // ---- 4) Single invoice id used by both invoice and journal ----
  const invoiceId = id('inv');

  // ---- 5) Apply FIFO consumption now that validation passed ----
  for (const a of allocations) {
    const lot = x.items
      .find((i) => i.id === a.itemId)!
      .lots.find((lo) => lo.id === a.lotId)!;
    lot.remainingQuantity = String(Number(lot.remainingQuantity) - a.take);
  }

  // ---- 6) Create journal with matching sourceId ----
  journal(x, 'SalesInvoice', invoiceId, journalLines).transactionDate=body.invoiceDate;

  // ---- 7) Persist invoice row ----
  const invoice = {
    id: invoiceId,
    invoiceNumber: nextNo('INV', x.sales.length),
    transactionDate: body.invoiceDate,
    total: String(total),
    status: 'Posted',
    currencyCode: body.currencyCode,
    customer: x.customers.find((c) => c.id === body.customerId),
    lines: rawLines.map((l: any) => ({
      ...l,
      id: id('sl'),
      item: x.items.find((i) => i.id === l.itemId),
    })),
  };
  x.sales.unshift(invoice as never);

  audit(x, 'POST', 'SalesInvoice', invoiceId);
  save(x);
  return invoice as T;
}
if (clean === '/accounting/journals/manual') {
  const lines = validateJournalLines(x, body?.lines);

  if(body?.transactionDate&&!Number.isFinite(Date.parse(body.transactionDate)))throw new Error('Invalid journal date');
  const v = journal(x, 'Manual', body?.reference||id('manual'), lines);
  if(body?.transactionDate)v.transactionDate=body.transactionDate;
  v.lines.forEach((line:any,index:number)=>{line.description=body.lines[index]?.description??'';}); // throws on invalid
  audit(x, 'POST', 'Journal', (v as { id: string }).id);
  save(x);
  return v as T;
}
  if(clean==='/payments/customer-receipt'||clean==='/payments/supplier-payment') {
    baseOnly(x,body);
    if(body?.allocations?.length)throw new Error('Payment allocation is not available in preview mode');
    if(body?.date&&!Number.isFinite(Date.parse(body.date)))throw new Error('Invalid payment date');
    const amount = toDecimalStrict(body?.amount, 'Payment amount');
    if (amount <= 0) throw new Error('Payment amount must be positive');
    const receipt = clean === '/payments/customer-receipt';
    const lines = validateJournalLines(x, receipt ? [
      {accountId: body.accountId ?? x.postingConfig.cashAccountId, debit: amount},
      {accountId: x.postingConfig.arAccountId, credit: amount},
    ] : [
      {accountId: x.postingConfig.apAccountId, debit: amount},
      {accountId: body.accountId ?? x.postingConfig.cashAccountId, credit: amount},
    ]);
    const sourceType = receipt ? 'CustomerPayment' : 'SupplierPayment';
    const v = journal(x, sourceType, id('pay'), lines);
    if(body?.date)v.transactionDate=body.date;
    audit(x, 'POST', sourceType, v.id);
    save(x);
    return v as T;
  }
  if(clean==='/credit-notes'){const v={id:id('cn'),creditNoteNumber:nextNo('CN',x.creditNotes.length),transactionDate:body.creditNoteDate??now(),total:String(n(body.total)),status:'Posted',...body};x.creditNotes.unshift(v as never);audit(x,'POST','CreditNote',v.id);save(x);return v as T}
  if(clean==='/debit-notes'){const v={id:id('dn'),debitNoteNumber:nextNo('DN',x.debitNotes.length),transactionDate:body.debitNoteDate??now(),total:String(n(body.total)),status:'Posted',...body};x.debitNotes.unshift(v as never);audit(x,'POST','DebitNote',v.id);save(x);return v as T}
  if(clean.startsWith('/banking/accounts/')){const v={id:id('bank'),isActive:true,...body};x.bankAccounts.unshift(v as never);save(x);return v as T}
  if(clean.startsWith('/banking/statement-lines/')){const v={id:id('stmt'),matchedJournalId:null,...body};x.statementLines.unshift(v as never);save(x);return v as T}
  if(clean.startsWith('/banking/match/')){const line=x.statementLines.find((s:any)=>clean.includes(s.id)) as any;if(line)line.matchedJournalId=body.journalId;save(x);return line as T}
  if(clean.startsWith('/banking/reconciliations/')&&clean.endsWith('/complete')){const r=x.reconciliations.find((q:any)=>clean.includes(q.id)) as any;if(r)r.status='Completed';save(x);return r as T}
  if(clean.startsWith('/banking/reconciliations/')){const v={id:id('rec'),status:'Draft',...body};x.reconciliations.unshift(v as never);save(x);return v as T}
  throw new Error('This operation is not available in preview mode');
}
