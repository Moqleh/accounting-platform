'use client';
import { ErpShell, useLocale } from '@/components/erp-shell';
import { BarChart3, BookOpen, Boxes, FileBarChart2, Scale, TrendingUp } from 'lucide-react';
const reports=[['قائمة الدخل','Income Statement',TrendingUp],['الميزانية العمومية','Balance Sheet',Scale],['ميزان المراجعة','Trial Balance',BookOpen],['أعمار الديون','Aging Report',BarChart3],['تقييم المخزون','Inventory Valuation',Boxes],['حركة الحسابات','Account Activity',FileBarChart2]] as const;
export default function Page(){return <ErpShell><Body/></ErpShell>}
function Body(){const {locale}=useLocale();return <><div className="heading"><div><h1>{locale==='ar'?'التقارير':'Reports'}</h1><p>{locale==='ar'?'تقارير مالية ومحاسبية تفصيلية':'Detailed financial and accounting reports'}</p></div></div><div className="reportGrid">{reports.map(([ar,en,Icon])=><article className="reportCard" key={ar}><Icon size={28}/><h3>{locale==='ar'?ar:en}</h3><p>{locale==='ar'?'عرض، تصفية، طباعة وتصدير PDF / Excel':'View, filter, print and export PDF / Excel'}</p><button className="ghost">{locale==='ar'?'فتح التقرير':'Open report'}</button></article>)}</div></>}
