'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Bell, Boxes, Building2, FileText, Gauge, Languages, ReceiptText, Search, Settings, ShoppingCart, TrendingUp, Users, WalletCards } from 'lucide-react';

type Locale = 'ar' | 'en';
const LocaleContext = createContext<{locale: Locale; setLocale:(v:Locale)=>void}>({locale:'ar', setLocale:()=>{}});

export const labels = {
  ar: {app:'نظام المحاسبة', company:'شركة المثال للتجارة', hello:'أهلاً، محمد', search:'ابحث في النظام...', dashboard:'الرئيسية', sales:'المبيعات', purchases:'المشتريات', customers:'العملاء', suppliers:'الموردون', inventory:'المنتجات والمخزون', payments:'الصندوق والبنوك', journals:'القيود اليومية', reports:'التقارير', users:'المستخدمون', settings:'الإعدادات', lang:'EN'},
  en: {app:'Accounting System', company:'Example Trading Company', hello:'Welcome, Mohammed', search:'Search in the system...', dashboard:'Dashboard', sales:'Sales', purchases:'Purchases', customers:'Customers', suppliers:'Suppliers', inventory:'Products & Inventory', payments:'Payments & Banks', journals:'Journal Entries', reports:'Reports', users:'Users', settings:'Settings', lang:'AR'}
} as const;

const nav = [
  ['/', Gauge, 'dashboard'], ['/sales', ShoppingCart, 'sales'], ['/purchases', ReceiptText, 'purchases'], ['/customers', Users, 'customers'], ['/suppliers', Building2, 'suppliers'], ['/inventory', Boxes, 'inventory'], ['/payments', WalletCards, 'payments'], ['/journals', FileText, 'journals'], ['/reports', TrendingUp, 'reports'], ['/users', Users, 'users'], ['/settings', Settings, 'settings'],
] as const;

export function ErpShell({children}:{children:ReactNode}) {
  const path = usePathname();
  const [locale, setLocale] = useState<Locale>('ar');
  useEffect(()=>{ const saved = localStorage.getItem('accounting-locale') as Locale | null; if(saved==='ar'||saved==='en') setLocale(saved); },[]);
  useEffect(()=>{ localStorage.setItem('accounting-locale', locale); document.documentElement.lang=locale; document.documentElement.dir=locale==='ar'?'rtl':'ltr'; },[locale]);
  const t = labels[locale];
  const ctx = useMemo(()=>({locale,setLocale}),[locale]);
  return <LocaleContext.Provider value={ctx}><main className="shell" dir={locale==='ar'?'rtl':'ltr'}>
    <aside className="sidebar"><div className="brand"><span className="brandMark">▥</span><strong>{t.app}</strong></div><nav>
      {nav.map(([href,Icon,key])=><Link key={href} href={href} className={`navItem ${path===href || (href!=='/' && path.startsWith(href))?'active':''}`}><Icon size={18}/><span>{t[key]}</span></Link>)}
    </nav></aside>
    <section className="workspace"><header className="topbar"><div className="company"><div className="avatar">M</div><div><b>{t.hello}</b><small>{t.company}</small></div></div><div className="search"><Search size={18}/><input placeholder={t.search}/></div><div className="topActions"><button aria-label="notifications"><Bell size={19}/></button><button onClick={()=>setLocale(locale==='ar'?'en':'ar')}><Languages size={18}/>{t.lang}</button></div></header><div className="content">{children}</div></section>
  </main></LocaleContext.Provider>;
}

export function useLocale(){ const {locale}=useContext(LocaleContext); return {locale, t:labels[locale]}; }
