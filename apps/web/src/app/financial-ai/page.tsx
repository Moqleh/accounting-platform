'use client';
import { useEffect,useState,type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft,ArrowRight,BrainCircuit,Send,ShieldCheck } from 'lucide-react';
import { apiGet,apiPost,getCompanyId,getSession } from '@/lib/api';
import { isPreviewMode } from '@/lib/preview-api';
import { ErpShell,useLocale } from '@/components/erp-shell';

type Answer={answer:string;intent:string;facts:Record<string,unknown>;requestId:string;disclaimer:string};
type Account={id:string;code:string;name:string;nameAr?:string;type:string};
type JournalLine={accountId:string;baseDebit?:string;baseCredit?:string;debit?:string;credit?:string};
type Journal={id:string;transactionDate?:string;lines?:JournalLine[]};
type Aging={outstanding?:string|number};
type Bank={glAccountId?:string;accountId?:string;name?:string;nameAr?:string};

const num=(v:unknown)=>{const x=Number(v);return Number.isFinite(x)?x:0};
const money=(v:number,locale:'ar'|'en',currency='SAR')=>new Intl.NumberFormat(locale==='ar'?'ar-SA':'en-US',{style:'currency',currency,maximumFractionDigits:2}).format(v);

export default function FinancialAiPage(){return <ErpShell><FinancialAiWorkspace/></ErpShell>}

function FinancialAiWorkspace(){
 const router=useRouter();
 const {locale}=useLocale(),ar=locale==='ar';
 const [question,setQuestion]=useState(''),[answer,setAnswer]=useState<Answer|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false),[allowed,setAllowed]=useState(false);
 useEffect(()=>{const s=getSession(),companyId=getCompanyId(),m=s?.memberships.find(x=>x.companyId===companyId);setAllowed(!!m&&['Owner','FinancialManager'].includes(m.role))},[]);
 const examples=ar?['ما صافي الدخل هذا الشهر؟','قارن الربحية بالشهر السابق','كم إجمالي الذمم المدينة على العملاء؟','كم الذمم الدائنة للموردين؟','ما إجمالي أرصدة البنوك؟']:['What is net income this month?','Compare profitability with last month','What are total customer receivables?','What are total supplier payables?','What are total bank balances?'];
 const BackIcon=ar?ArrowRight:ArrowLeft;
 const goBack=()=>{if(window.history.length>1)router.back();else router.push('/')};

 async function previewAnswer(q:string):Promise<Answer>{
   const companyId=getCompanyId();
   const [accounts,journals,receivables,payables,banks]=await Promise.all([
     apiGet<Account[]>(`/erp/accounts/${companyId}`),
     apiGet<Journal[]>(`/erp/journals/${companyId}`),
     apiGet<Aging[]>(`/reports/customer-aging/${companyId}`),
     apiGet<Aging[]>(`/reports/supplier-aging/${companyId}`),
     apiGet<Bank[]>(`/banking/accounts/${companyId}`),
   ]);
   const company=await apiGet<{baseCurrencyCode?:string;baseCurrency?:string}>(`/erp/company/${companyId}`);
   const currency=company.baseCurrencyCode??company.baseCurrency??'SAR';
   const accountById=new Map(accounts.map(a=>[a.id,a]));
   const now=new Date(),thisStart=new Date(now.getFullYear(),now.getMonth(),1),nextStart=new Date(now.getFullYear(),now.getMonth()+1,1),prevStart=new Date(now.getFullYear(),now.getMonth()-1,1);
   const pnl=(start:Date,end:Date)=>{let revenue=0,expenses=0;for(const j of journals){const d=new Date(j.transactionDate??'');if(!Number.isFinite(+d)||d<start||d>=end)continue;for(const l of j.lines??[]){const a=accountById.get(l.accountId),debit=num(l.baseDebit??l.debit),credit=num(l.baseCredit??l.credit);if(a?.type==='Revenue')revenue+=credit-debit;if(a?.type==='Expense')expenses+=debit-credit;}}return {revenue,expenses,netIncome:revenue-expenses}};
   const current=pnl(thisStart,nextStart),previous=pnl(prevStart,thisStart);
   const arTotal=receivables.reduce((s,r)=>s+num(r.outstanding),0),apTotal=payables.reduce((s,r)=>s+num(r.outstanding),0);
   const bankIds=new Set(banks.map(b=>b.glAccountId??b.accountId).filter(Boolean));let bankTotal=0;for(const j of journals)for(const l of j.lines??[])if(bankIds.has(l.accountId))bankTotal+=num(l.baseDebit??l.debit)-num(l.baseCredit??l.credit);
   const normalized=q.toLowerCase();let intent='overview',value='',facts:Record<string,unknown>={currency,currentMonth:current,previousMonth:previous,receivables:arTotal,payables:apTotal,bankBalances:bankTotal};
   if(/receivable|customer|ذمم.*مدينة|العملاء/.test(normalized)){intent='receivables';value=ar?`إجمالي الذمم المدينة على العملاء هو ${money(arTotal,locale,currency)}.`:`Total customer receivables are ${money(arTotal,locale,currency)}.`}
   else if(/payable|supplier|ذمم.*دائنة|الموردين/.test(normalized)){intent='payables';value=ar?`إجمالي الذمم الدائنة للموردين هو ${money(apTotal,locale,currency)}.`:`Total supplier payables are ${money(apTotal,locale,currency)}.`}
   else if(/bank|cash|بنوك|البنوك|نقد/.test(normalized)){intent='banks';value=ar?`إجمالي أرصدة الحسابات البنكية هو ${money(bankTotal,locale,currency)}.`:`Total bank balances are ${money(bankTotal,locale,currency)}.`}
   else if(/compare|previous|last month|قارن|السابق/.test(normalized)){intent='profitability-comparison';const diff=current.netIncome-previous.netIncome;value=ar?`صافي الدخل هذا الشهر ${money(current.netIncome,locale,currency)} مقابل ${money(previous.netIncome,locale,currency)} في الشهر السابق، بفارق ${money(diff,locale,currency)}.`:`Net income this month is ${money(current.netIncome,locale,currency)} versus ${money(previous.netIncome,locale,currency)} last month, a difference of ${money(diff,locale,currency)}.`}
   else if(/net income|profit|income|صافي|ربح|الدخل/.test(normalized)){intent='net-income';value=ar?`صافي الدخل هذا الشهر هو ${money(current.netIncome,locale,currency)} (إيرادات ${money(current.revenue,locale,currency)} ناقص مصروفات ${money(current.expenses,locale,currency)}).`:`Net income this month is ${money(current.netIncome,locale,currency)} (${money(current.revenue,locale,currency)} revenue less ${money(current.expenses,locale,currency)} expenses).`}
   else value=ar?`أستطيع تحليل صافي الدخل، مقارنة الربحية، الذمم المدينة، الذمم الدائنة وأرصدة البنوك من البيانات المحاسبية الحالية.`:`I can analyze net income, profitability comparison, receivables, payables, and bank balances from the current accounting data.`;
   return {answer:value,intent,facts,requestId:`preview-${Date.now()}`,disclaimer:ar?'تحليل للقراءة فقط مبني على البيانات المرحلة المتاحة.':'Read-only analysis based on available posted accounting data.'};
 }

 async function submit(e:FormEvent){e.preventDefault();const q=question.trim();if(!q||loading)return;setLoading(true);setError('');setAnswer(null);try{setAnswer(isPreviewMode()?await previewAnswer(q):await apiPost<Answer>(`/companies/${getCompanyId()}/financial-ai/ask`,{question:q,language:locale}))}catch(err){setError(ar?'تعذر إكمال التحليل المالي. تحقق من البيانات وحاول مرة أخرى.':`Financial analysis could not be completed. Check the data and try again.`);console.error(err)}finally{setLoading(false)}}

 const backButton=<button type="button" className="secondary" onClick={goBack} aria-label={ar?'رجوع':'Back'}><BackIcon size={17}/>{ar?'رجوع':'Back'}</button>;
 if(!allowed)return <section className="page" dir={ar?'rtl':'ltr'}><div className="heading"><div><h1>{ar?'المساعد المالي الذكي':'Financial AI'}</h1><p>{ar?'هذه المساحة متاحة فقط لصاحب الشركة والمدير المالي.':'This workspace is restricted to the company owner and financial manager.'}</p></div>{backButton}</div><div className="card"><ShieldCheck size={28}/><p>{ar?'لا توجد صلاحية لاستخدام المساعد المالي لهذه العضوية.':'This membership does not have access to Financial AI.'}</p></div></section>;
 return <section className="page" dir={ar?'rtl':'ltr'}><div className="heading"><div><h1 style={{display:'flex',gap:10,alignItems:'center'}}><BrainCircuit size={28}/>{ar?'المساعد المالي الذكي':'Financial AI'}</h1><p>{ar?'تحليل مالي إداري مبني على القيود والبيانات المرحلة — للقراءة فقط.':'Read-only management analysis grounded in posted accounting data.'}</p></div>{backButton}</div><div className="card"><div className="cardTitle"><div><h2>{ar?'اسأل عن الوضع المالي للشركة':'Ask about company financials'}</h2><small>{ar?'إجابات مبنية على الحقائق المحاسبية المتاحة للنظام':'Answers grounded in accounting facts available to the system'}</small></div><ShieldCheck size={22}/></div><div style={{display:'flex',gap:8,flexWrap:'wrap',margin:'16px 0'}}>{examples.map(x=><button key={x} type="button" className="secondary" onClick={()=>setQuestion(x)}>{x}</button>)}</div><form onSubmit={submit}><label htmlFor="financial-question"><b>{ar?'السؤال المالي':'Financial question'}</b></label><textarea id="financial-question" value={question} onChange={e=>setQuestion(e.target.value.slice(0,500))} rows={4} maxLength={500} dir={ar?'rtl':'ltr'} placeholder={ar?'مثال: قارن الربحية بالشهر السابق':'Example: Compare profitability with last month'} style={{width:'100%',marginTop:8}}/><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,marginTop:10}}><small>{question.length}/500</small><button type="submit" disabled={loading||!question.trim()}><Send size={16}/>{loading?(ar?'جاري التحليل...':'Analyzing...'):(ar?'تحليل':'Analyze')}</button></div></form>{error&&<div className="formMessage" role="alert" style={{marginTop:16}}>{error}</div>}{answer&&<article className="card" style={{marginTop:20}}><div className="cardTitle"><h2>{ar?'النتيجة':'Result'}</h2><span className="demoBadge">{ar?'للقراءة فقط':'Read only'}</span></div><p dir={ar?'rtl':'ltr'} style={{fontSize:'1.08rem',lineHeight:1.9}}>{answer.answer}</p><details><summary>{ar?'عرض الحقائق المالية المستخدمة':'Show financial facts used'}</summary><pre dir="ltr" style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(answer.facts,null,2)}</pre></details><p><small>{answer.disclaimer} · Request ID: {answer.requestId}</small></p></article>}</div></section>
}
