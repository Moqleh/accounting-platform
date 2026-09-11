'use client';

import { Plus, Search } from 'lucide-react';
import { ErpShell, useLocale } from './erp-shell';

type Column = { ar:string; en:string; key:string };
type Row = Record<string,string|number>;

export function ModulePage({titleAr,titleEn,subtitleAr,subtitleEn,columns,rows,actionAr='إضافة جديد',actionEn='Add New'}:{titleAr:string;titleEn:string;subtitleAr:string;subtitleEn:string;columns:Column[];rows:Row[];actionAr?:string;actionEn?:string}){
  return <ErpShell><ModuleBody {...{titleAr,titleEn,subtitleAr,subtitleEn,columns,rows,actionAr,actionEn}}/></ErpShell>;
}

function ModuleBody({titleAr,titleEn,subtitleAr,subtitleEn,columns,rows,actionAr,actionEn}:{titleAr:string;titleEn:string;subtitleAr:string;subtitleEn:string;columns:Column[];rows:Row[];actionAr:string;actionEn:string}){
  const {locale}=useLocale();
  return <>
    <div className="heading"><div><h1>{locale==='ar'?titleAr:titleEn}</h1><p>{locale==='ar'?subtitleAr:subtitleEn}</p></div><button className="primary"><Plus size={17}/> {locale==='ar'?actionAr:actionEn}</button></div>
    <section className="card"><div className="moduleToolbar"><div className="inlineSearch"><Search size={16}/><input placeholder={locale==='ar'?'بحث...':'Search...'}/></div><select defaultValue="all"><option value="all">{locale==='ar'?'كل الحالات':'All statuses'}</option></select></div>
      <div className="tableWrap"><table><thead><tr>{columns.map(c=><th key={c.key}>{locale==='ar'?c.ar:c.en}</th>)}</tr></thead><tbody>{rows.map((row,i)=><tr key={i}>{columns.map(c=><td key={c.key}>{renderCell(c.key,row[c.key])}</td>)}</tr>)}</tbody></table></div>
      <div className="pager"><button className="ghost">‹</button><button className="primary">1</button><button className="ghost">2</button><button className="ghost">3</button><button className="ghost">›</button></div>
    </section>
  </>;
}
function renderCell(key:string,value:string|number){ if(key==='status'){const v=String(value); const cls=/paid|active|posted|available|مدفوعة|نشط|مرحّل|متوفر/i.test(v)?'paid':/partial|draft|جزئية|مسودة/i.test(v)?'partial':'overdue'; return <span className={`status ${cls}`}>{v}</span>} return String(value); }
