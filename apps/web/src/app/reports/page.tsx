'use client';
import Link from 'next/link';
import { ErpShell, useLocale } from '@/components/erp-shell';
import { BarChart3, BookOpen, Boxes, FileBarChart2, Scale, TrendingUp } from 'lucide-react';
const reports=[['قائمة الدخل','Income Statement',TrendingUp,'/reports/profit-loss'],['الميزانية العمومية','Balance Sheet',Scale,'/reports/balance-sheet'],['ميزان المراجعة','Trial Balance',BookOpen,'/reports/trial-balance'],['أعمار ذمم العملاء','Customer Aging',BarChart3,'/reports/customer-aging'],['أعمار ذمم الموردين','Supplier Aging',BarChart3,'/reports/supplier-aging'],['تقييم المخزون','Inventory Valuation',Boxes,'/reports/inventory-valuation'],['حركة الحسابات','Account Activity',FileBarChart2,'/reports/account-activity']] as const;
export default function Page(){return <ErpShell><Body/></ErpShell>}
function Body(){const {locale}=useLocale();return <><div className="heading"><div><h1>{locale==='ar'?'التقارير':'Reports'}</h1><p>{locale==='ar'?'تقارير مالية ومحاسبية تفصيلية':'Detailed financial and accounting reports'}</p></div></div><div className="reportGrid">{reports.map(([ar,en,Icon,href])=><article className="reportCard" key={ar}><Icon size={28}/><h3>{locale==='ar'?ar:en}</h3><p>{locale==='ar'?'عرض، تصفية وطباعة التقرير':'View, filter and print the report'}</p><Link className="ghost" href={href}>{locale==='ar'?'فتح التقرير':'Open report'}</Link></article>)}</div></>}
