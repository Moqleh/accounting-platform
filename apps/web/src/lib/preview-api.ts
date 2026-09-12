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
function valuation(x:Db){return x.items.filter(i=>i.type==='Inventory').map(i=>{const quantity=(i.lots??[]).reduce((s,l)=>s+n(l.remainingQuantity),0);const value=(i.lots??[]).reduce((s,l)=>s+n(l.remainingQuantity)*n(l.unitCost),0);return {itemCode:i.code,itemName:i.name,quantity:String(quantity),value:String(value),averageCost:String(quantity?value/quantity:0)}})}

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
    if(clean.startsWith('/erp/company/')||clean.startsWith('/admin/company/')) return x.company as T;
    if(clean.startsWith('/erp/dashboard/')){const tb=trialBalance(x);return {baseCurrency:x.company.baseCurrency,customers:x.customers.length,suppliers:x.suppliers.length,postedJournals:x.journals.length,sales:(x.sales as any[]).reduce((s,v)=>s+n(v.total),0),purchases:(x.purchases as any[]).reduce((s,v)=>s+n(v.total),0),trialBalance:tb} as T}
    if(clean.startsWith('/erp/customers/')) return x.customers as T;
    if(clean.startsWith('/erp/suppliers/')) return x.suppliers as T;
    if(clean.startsWith('/erp/items/')) return x.items as T;
    if(clean.startsWith('/erp/warehouses/')||clean.startsWith('/admin/warehouses/')) return x.warehouses as T;
    if(clean.startsWith('/admin/tax-rates/')) return x.taxes.map((t:any)=>({...t,rate:!t.effectiveFrom&&Number(t.rate)>1?String(Number(t.rate)/100):t.rate,effectiveFrom:t.effectiveFrom??''})) as T;
    if(clean.startsWith('/erp/tax-rates/')) return x.taxes as T;
    if(clean.startsWith('/admin/accounts/')) return x.accounts.map((a:any)=>({...a,isLeaf:a.isLeaf??a.isPosting??false})) as T;
    if(clean.startsWith('/erp/accounts/')) return x.accounts as T;
    if(clean.startsWith('/erp/sales/')) return x.sales as T;
    if(clean.startsWith('/erp/purchases/')) return x.purchases as T;
    if(clean.startsWith('/erp/journals/')) return x.journals as T;
    if(clean.startsWith('/erp/trial-balance/')) return trialBalance(x) as T;
    if(clean.startsWith('/erp/inventory-valuation/')) return valuation(x) as T;
    if(clean.startsWith('/erp/profit-loss/')){const tb=trialBalance(x);const revenue=tb.filter(r=>x.accounts.find(a=>a.code===r.accountCode)?.type==='Revenue').reduce((s,r)=>s+n(r.credit)-n(r.debit),0);const expenses=tb.filter(r=>x.accounts.find(a=>a.code===r.accountCode)?.type==='Expense').reduce((s,r)=>s+n(r.debit)-n(r.credit),0);return {revenue:String(revenue),expenses:String(expenses),netProfit:String(revenue-expenses)} as T}
    if(clean.startsWith('/erp/balance-sheet/')) return trialBalance(x).filter(r=>['Asset','Liability','Equity'].includes(x.accounts.find(a=>a.code===r.accountCode)?.type??'')).map(r=>({...r,amount:String(n(r.debit)-n(r.credit))})) as T;
    if(clean.startsWith('/erp/account-activity/')) return (x.journals as any[]).flatMap(j=>(j.lines??[]).map((l:any)=>({journalNumber:j.journalNumber,transactionDate:j.transactionDate,description:j.description,accountCode:l.account?.code,accountName:l.account?.name,debit:l.baseDebit,credit:l.baseCredit}))) as T;
    if(clean.startsWith('/reports/customer-aging/')) return x.customers.map(c=>({customerId:c.id,customerName:c.name,current:'0',days30:'0',days60:'0',days90:'0',older:'0',total:'0'})) as T;
    if(clean.startsWith('/reports/supplier-aging/')) return x.suppliers.map(c=>({supplierId:c.id,supplierName:c.name,current:'0',days30:'0',days60:'0',days90:'0',older:'0',total:'0'})) as T;
    if(clean.startsWith('/reports/credit-notes/')) return x.creditNotes as T;
    if(clean.startsWith('/admin/fiscal-years/')) return x.fiscalYears.map(adminYear) as T;
    if(clean.startsWith('/admin/users/')) return x.users.map(adminUser) as T;
    if(clean.startsWith('/admin/audit/')) return x.audit as T;
    if(clean.startsWith('/admin/posting-config/')) return adminConfig(x) as T;
    if(clean.startsWith('/admin/exchange-rates/')) return x.exchangeRates.map((r:any)=>({...r,rateDate:r.rateDate??r.effectiveDate??''})) as T;
    if(clean.startsWith('/erp/exchange-rate/')){const code=clean.split('/').pop();return (x.exchangeRates.find(r=>r.currencyCode===code)||{currencyCode:code,rate:'1'}) as T}
    if(clean.startsWith('/debit-notes/')) return x.debitNotes as T;
    if(clean.startsWith('/banking/accounts/')) return x.bankAccounts as T;
    if(clean.startsWith('/banking/statement-lines/')) return x.statementLines as T;
    if(clean.startsWith('/banking/candidates/')) return (x.journals as any[]).map(j=>({id:j.id,journalNumber:j.journalNumber,transactionDate:j.transactionDate,amount:String((j.lines??[]).reduce((s:number,l:any)=>s+n(l.baseDebit)-n(l.baseCredit),0)),description:j.description})) as T;
    if(clean.startsWith('/banking/reconciliations/')) return x.reconciliations as T;
    return [] as T;
  }

  if(clean==='/auth/change-password'){
    const expected=localStorage.getItem(PASSWORD_KEY)||INITIAL_PASSWORD_SHA256;
    if(await sha256(body?.currentPassword??'')!==expected) throw new Error('Current password is incorrect');
    if(!body?.newPassword||String(body.newPassword).length<10) throw new Error('New password must contain at least 10 characters');
    localStorage.setItem(PASSWORD_KEY,await sha256(body.newPassword));return {changed:true} as T;
  }
  if(clean.startsWith('/admin/company/')){x.company={...x.company,...body};audit(x,'UPDATE','Company',COMPANY_ID);save(x);return x.company as T}
  if(clean.startsWith('/admin/customers/')||clean.startsWith('/erp/customers/')){const v={id:id('cus'),...body};x.customers.unshift(v as never);audit(x,'CREATE','Customer',v.id);save(x);return v as T}
  if(clean.startsWith('/admin/suppliers/')||clean.startsWith('/erp/suppliers/')){const v={id:id('sup'),...body};x.suppliers.unshift(v as never);audit(x,'CREATE','Supplier',v.id);save(x);return v as T}
  if(clean.startsWith('/admin/items/')){const v={id:id('item'),lots:[],...body};x.items.unshift(v as never);audit(x,'CREATE','Item',v.id);save(x);return v as T}
  if(clean.startsWith('/admin/warehouses/')){const v={id:id('wh'),isActive:true,...body};x.warehouses.unshift(v as never);audit(x,'CREATE','Warehouse',v.id);save(x);return v as T}
  if(clean.startsWith('/admin/accounts/')){const v={id:id('acc'),isActive:true,isPosting:true,...body};x.accounts.unshift(v as never);audit(x,'CREATE','Account',v.id);save(x);return v as T}
  if(clean.startsWith('/admin/tax-rates/')){const v={id:id('tax'),isActive:true,...body};x.taxes.unshift(v as never);audit(x,'CREATE','TaxRate',v.id);save(x);return v as T}
  if(clean.startsWith('/admin/fiscal-years/')){const v={id:id('fy'),status:'Open',periods:[],...body};x.fiscalYears.unshift(v as never);audit(x,'CREATE','FiscalYear',v.id);save(x);return v as T}
  if(clean.startsWith('/admin/posting-config/')){x.postingConfig={...x.postingConfig,...body};audit(x,'UPDATE','AccountingConfig',COMPANY_ID);save(x);return x.postingConfig as T}
  if(clean.startsWith('/admin/exchange-rates/')){const v={id:id('fx'),...body};x.exchangeRates.unshift(v as never);audit(x,'CREATE','ExchangeRate',v.id);save(x);return v as T}
  if(clean.startsWith('/admin/users/')){const v={id:id('user'),isActive:true,...body};x.users.unshift(v as never);audit(x,'CREATE','User',v.id);save(x);return v as T}
  if(clean.includes('/fiscal-periods/')&&method==='PATCH'){for(const fy of x.fiscalYears){const p=(fy.periods as any[]).find(q=>clean.includes(q.id));if(p)p.status=body.status}save(x);return {updated:true} as T}

if (clean === '/purchases/bill') {
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
  const tax = subtotal * 0.15;
  const total = subtotal + tax;

  // ---- 3) Journal lines + validate ----
  const journalLines: JournalLineInput[] = [
    ...rawLines.filter(l => Number(l.unitCost) > 0).map(l => ({
      accountId: x.items.find(i => i.id === l.itemId)!.purchaseAccountId,
      debit: Number(l.quantity) * Number(l.unitCost),
    })),
    ...(tax !== 0 ? [{ accountId: x.postingConfig.inputTaxAccountId, debit: tax }] : []),
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
  journal(x, 'PurchaseBill', billId, journalLines);

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

  const tax = subtotal * 0.15;
  const total = subtotal + tax;

  // ---- 3) Build journal lines, validate BEFORE mutating ----
  const journalLines: JournalLineInput[] = [
    { accountId: x.postingConfig.arAccountId, debit: total },
    { accountId: x.postingConfig.salesAccountId, credit: subtotal },
    ...(tax !== 0 ? [{ accountId: x.postingConfig.outputTaxAccountId, credit: tax }] : []),
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
  journal(x, 'SalesInvoice', invoiceId, journalLines);

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

  const v = journal(x, 'Manual', id('manual'), lines); // throws on invalid
  audit(x, 'POST', 'Journal', (v as { id: string }).id);
  save(x);
  return v as T;
}
  if(clean==='/payments/customer-receipt'||clean==='/payments/supplier-payment') {
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
    const sourceType = receipt ? 'CustomerReceipt' : 'SupplierPayment';
    const v = journal(x, sourceType, id('pay'), lines);
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
  return {ok:true,preview:true,echoHash:hashText(JSON.stringify(body??{}))} as T;
}
