'use client';

import { useMemo, useState } from 'react';
import {
  Bell, Boxes, Building2, ChevronDown, CircleDollarSign, FileText, Gauge,
  Languages, PackageSearch, ReceiptText, Search, Settings, ShoppingCart,
  TrendingDown, TrendingUp, Users, WalletCards
} from 'lucide-react';

const copy = {
  ar: {
    dir: 'rtl', language: 'EN', app: 'نظام المحاسبة', company: 'شركة المثال للتجارة', hello: 'أهلاً، محمد',
    search: 'ابحث في النظام...', dashboard: 'لوحة التحكم', sales: 'المبيعات', purchases: 'المشتريات',
    customers: 'العملاء', suppliers: 'الموردون', inventory: 'المنتجات والمخزون', expenses: 'المصروفات',
    payments: 'الصندوق والبنوك', journals: 'القيود اليومية', reports: 'التقارير', users: 'المستخدمون', settings: 'الإعدادات',
    totalSales: 'إجمالي المبيعات', totalExpenses: 'المصروفات', netProfit: 'صافي الربح', receivables: 'المستحقات',
    salesExpenses: 'المبيعات والمصروفات', alerts: 'تنبيهات', recentInvoices: 'أحدث الفواتير', newInvoice: 'فاتورة جديدة',
    overdue: 'فواتير متأخرة السداد', lowStock: 'منتجات منخفضة المخزون', unreviewed: 'مصروفات غير مصنفة',
    invoice: 'رقم الفاتورة', customer: 'العميل', date: 'التاريخ', amount: 'المبلغ', status: 'الحالة', paid: 'مدفوعة', partial: 'جزئية', overdueStatus: 'متأخرة'
  },
  en: {
    dir: 'ltr', language: 'AR', app: 'Accounting System', company: 'Example Trading Company', hello: 'Welcome, Mohammed',
    search: 'Search in the system...', dashboard: 'Dashboard', sales: 'Sales', purchases: 'Purchases',
    customers: 'Customers', suppliers: 'Suppliers', inventory: 'Products & Inventory', expenses: 'Expenses',
    payments: 'Payments & Banks', journals: 'Journal Entries', reports: 'Reports', users: 'Users', settings: 'Settings',
    totalSales: 'Total Sales', totalExpenses: 'Total Expenses', netProfit: 'Net Profit', receivables: 'Receivables',
    salesExpenses: 'Sales & Expenses', alerts: 'Alerts', recentInvoices: 'Recent Invoices', newInvoice: 'New Invoice',
    overdue: 'Overdue invoices', lowStock: 'Low stock products', unreviewed: 'Uncategorized expenses',
    invoice: 'Invoice #', customer: 'Customer', date: 'Date', amount: 'Amount', status: 'Status', paid: 'Paid', partial: 'Partial', overdueStatus: 'Overdue'
  }
} as const;

const chart = [38, 45, 52, 48, 63, 58, 70, 66, 77, 74, 86, 82];

export default function Home() {
  const [locale, setLocale] = useState<'ar' | 'en'>('ar');
  const t = copy[locale];
  const nav = useMemo(() => [
    [Gauge, t.dashboard], [ShoppingCart, t.sales], [ReceiptText, t.purchases], [Users, t.customers],
    [Building2, t.suppliers], [Boxes, t.inventory], [CircleDollarSign, t.expenses], [WalletCards, t.payments],
    [FileText, t.journals], [TrendingUp, t.reports], [Users, t.users], [Settings, t.settings]
  ], [t]);

  return (
    <main className="shell" dir={t.dir}>
      <aside className="sidebar">
        <div className="brand"><span className="brandMark">▥</span><strong>{t.app}</strong></div>
        <nav>{nav.map(([Icon, label], i) => <button className={i === 0 ? 'navItem active' : 'navItem'} key={String(label)}><Icon size={18}/><span>{label as string}</span>{i === 1 && <ChevronDown size={14}/>}</button>)}</nav>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="company"><div className="avatar">M</div><div><b>{t.hello}</b><small>{t.company}</small></div></div>
          <div className="search"><Search size={18}/><input placeholder={t.search}/></div>
          <div className="topActions"><button aria-label="notifications"><Bell size={19}/></button><button onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')}><Languages size={18}/>{t.language}</button></div>
        </header>

        <div className="content">
          <div className="heading"><div><h1>{t.dashboard}</h1><p>{t.company}</p></div><button className="primary">+ {t.newInvoice}</button></div>
          <section className="kpis">
            <Kpi title={t.totalSales} value="128,450 ر.س" delta="+12.4%" positive icon={<TrendingUp/>}/>
            <Kpi title={t.totalExpenses} value="42,300 ر.س" delta="-3.2%" icon={<TrendingDown/>}/>
            <Kpi title={t.netProfit} value="86,150 ر.س" delta="+8.7%" positive icon={<CircleDollarSign/>}/>
            <Kpi title={t.receivables} value="17,800 ر.س" delta="6 invoices" icon={<WalletCards/>}/>
          </section>

          <section className="gridTwo">
            <div className="card chartCard">
              <div className="cardTitle"><h2>{t.salesExpenses}</h2><span>2026</span></div>
              <div className="chart">{chart.map((v, i) => <div className="barWrap" key={i}><div className="bar" style={{height: `${v}%`}}/><span>{i + 1}</span></div>)}</div>
            </div>
            <div className="card alerts">
              <div className="cardTitle"><h2>{t.alerts}</h2></div>
              <Alert count="6" label={t.overdue}/><Alert count="4" label={t.lowStock}/><Alert count="2" label={t.unreviewed}/>
            </div>
          </section>

          <section className="card tableCard">
            <div className="cardTitle"><h2>{t.recentInvoices}</h2><button className="ghost">{t.newInvoice}</button></div>
            <div className="tableWrap"><table><thead><tr><th>{t.invoice}</th><th>{t.customer}</th><th>{t.date}</th><th>{t.amount}</th><th>{t.status}</th></tr></thead><tbody>
              <Row id="INV-0012" customer={locale === 'ar' ? 'مؤسسة النور' : 'Al Noor Company'} date="2026-09-10" amount="12,450" status={t.paid} cls="paid"/>
              <Row id="INV-0011" customer={locale === 'ar' ? 'شركة الأمل' : 'Al Amal Co.'} date="2026-09-09" amount="7,300" status={t.partial} cls="partial"/>
              <Row id="INV-0010" customer={locale === 'ar' ? 'شركة النخبة' : 'Elite Company'} date="2026-09-08" amount="8,900" status={t.overdueStatus} cls="overdue"/>
            </tbody></table></div>
          </section>
        </div>
      </section>
    </main>
  );
}

function Kpi({title, value, delta, positive, icon}: {title:string; value:string; delta:string; positive?:boolean; icon:React.ReactNode}) {
  return <article className="kpi"><div className="kpiIcon">{icon}</div><div><small>{title}</small><strong>{value}</strong><span className={positive ? 'positive' : 'muted'}>{delta}</span></div></article>;
}
function Alert({count,label}:{count:string;label:string}) { return <div className="alertRow"><div className="alertIcon">!</div><span>{label}</span><b>{count}</b></div>; }
function Row({id,customer,date,amount,status,cls}:{id:string;customer:string;date:string;amount:string;status:string;cls:string}) { return <tr><td>{id}</td><td>{customer}</td><td>{date}</td><td>{amount}</td><td><span className={`status ${cls}`}>{status}</span></td></tr>; }
