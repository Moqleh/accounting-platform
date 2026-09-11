'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { CircleDollarSign, TrendingDown, TrendingUp, WalletCards } from 'lucide-react';
import { ErpShell, useLocale } from '@/components/erp-shell';
import { apiGet, DEMO_COMPANY_ID } from '@/lib/api';

const chart=[38,45,52,48,63,58,70,66,77,74,86,82];
type DashboardData={sales:string;purchases:string;customers:number;suppliers:number;items:number;journals:number};
type Invoice={id:string;invoiceNumber:string;invoiceDate:string;grandTotal:string;status:string;customer:{name:string}};

export default function Home(){return <ErpShell><Dashboard/></ErpShell>}
function Dashboard(){
  const {locale}=useLocale(); const ar=locale==='ar';
  const [data,setData]=useState<DashboardData|null>(null); const [invoices,setInvoices]=useState<Invoice[]>([]); const [offline,setOffline]=useState(false);
  useEffect(()=>{Promise.all([apiGet<DashboardData>(`/erp/dashboard/${DEMO_COMPANY_ID}`),apiGet<Invoice[]>(`/erp/sales/${DEMO_COMPANY_ID}`)]).then(([d,i])=>{setData(d);setInvoices(i.slice(0,5));setOffline(false)}).catch(()=>setOffline(true))},[]);
  const sales=data?.sales??'128450'; const purchases=data?.purchases??'42300';
  const profit=useMemo(()=>{const s=Number(sales),p=Number(purchases);return Number.isFinite(s-p)?String(s-p):'86150'},[sales,purchases]);
  return <><div className="heading"><div><h1>{ar?'لوحة التحكم':'Dashboard'}</h1><p>{ar?'شركة المثال للتجارة':'Example Trading Company'} {offline&&<span className="demoBadge">{ar?'وضع العرض':'Demo mode'}</span>}</p></div><Link className="primary" href="/sales/new">+ {ar?'فاتورة جديدة':'New Invoice'}</Link></div>
    <section className="kpis"><Kpi title={ar?'إجمالي المبيعات':'Total Sales'} value={`${format(sales)} SAR`} delta="+12.4%" positive icon={<TrendingUp/>}/><Kpi title={ar?'المشتريات':'Total Purchases'} value={`${format(purchases)} SAR`} delta={ar?'الفترة الحالية':'Current period'} icon={<TrendingDown/>}/><Kpi title={ar?'هامش تشغيلي':'Operating Margin'} value={`${format(profit)} SAR`} delta="+8.7%" positive icon={<CircleDollarSign/>}/><Kpi title={ar?'القيود المرحلة':'Posted Journals'} value={String(data?.journals??124)} delta={ar?`${data?.customers??6} عملاء`:`${data?.customers??6} customers`} icon={<WalletCards/>}/></section>
    <section className="gridTwo"><div className="card chartCard"><div className="cardTitle"><h2>{ar?'المبيعات والمصروفات':'Sales & Expenses'}</h2><span>2026</span></div><div className="chart">{chart.map((v,i)=><div className="barWrap" key={i}><div className="bar" style={{height:`${v}%`}}/><span>{i+1}</span></div>)}</div></div><div className="card alerts"><div className="cardTitle"><h2>{ar?'تنبيهات':'Alerts'}</h2></div><Alert count="6" label={ar?'فواتير متأخرة السداد':'Overdue invoices'}/><Alert count="4" label={ar?'منتجات منخفضة المخزون':'Low stock products'}/><Alert count="2" label={ar?'تسويات بنكية معلقة':'Pending bank reconciliations'}/></div></section>
    <section className="card tableCard"><div className="cardTitle"><h2>{ar?'أحدث الفواتير':'Recent Invoices'}</h2><Link className="ghost" href="/sales">{ar?'عرض الكل':'View all'}</Link></div><div className="tableWrap"><table><thead><tr><th>{ar?'رقم الفاتورة':'Invoice #'}</th><th>{ar?'العميل':'Customer'}</th><th>{ar?'التاريخ':'Date'}</th><th>{ar?'المبلغ':'Amount'}</th><th>{ar?'الحالة':'Status'}</th></tr></thead><tbody>{invoices.length?invoices.map(i=><Row key={i.id} id={i.invoiceNumber} customer={i.customer.name} date={i.invoiceDate.slice(0,10)} amount={format(i.grandTotal)} status={translateStatus(i.status,ar)} cls={i.status==='Posted'?'paid':'partial'}/>):<><Row id="INV-0012" customer={ar?'مؤسسة النور':'Al Noor Company'} date="2026-09-10" amount="12,450" status={ar?'مرحلة':'Posted'} cls="paid"/><Row id="INV-0011" customer={ar?'شركة الأمل':'Al Amal Co.'} date="2026-09-09" amount="7,300" status={ar?'مسودة':'Draft'} cls="partial"/></>}</tbody></table></div></section></>}
function format(value:string){const n=Number(value);return Number.isFinite(n)?new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(n):value}
function translateStatus(status:string,ar:boolean){if(!ar)return status;return status==='Posted'?'مرحلة':status==='Draft'?'مسودة':status==='Cancelled'?'ملغاة':status}
function Kpi({title,value,delta,positive,icon}:{title:string;value:string;delta:string;positive?:boolean;icon:ReactNode}){return <article className="kpi"><div className="kpiIcon">{icon}</div><div><small>{title}</small><strong>{value}</strong><span className={positive?'positive':'muted'}>{delta}</span></div></article>}
function Alert({count,label}:{count:string;label:string}){return <div className="alertRow"><div className="alertIcon">!</div><span>{label}</span><b>{count}</b></div>}
function Row({id,customer,date,amount,status,cls}:{id:string;customer:string;date:string;amount:string;status:string;cls:string}){return <tr><td>{id}</td><td>{customer}</td><td>{date}</td><td>{amount}</td><td><span className={`status ${cls}`}>{status}</span></td></tr>}
