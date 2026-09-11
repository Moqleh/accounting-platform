'use client';

import { useEffect, useState } from 'react';
import { ErpShell, useLocale } from './erp-shell';
import { apiGet, getCompanyId } from '@/lib/api';

type Column={key:string;ar:string;en:string};

export function ReportTable({titleAr,titleEn,subtitleAr,subtitleEn,path,columns}:{titleAr:string;titleEn:string;subtitleAr:string;subtitleEn:string;path:string;columns:Column[]}){
  return <ErpShell><ReportBody {...{titleAr,titleEn,subtitleAr,subtitleEn,path,columns}}/></ErpShell>;
}
function ReportBody({titleAr,titleEn,subtitleAr,subtitleEn,path,columns}:{titleAr:string;titleEn:string;subtitleAr:string;subtitleEn:string;path:string;columns:Column[]}){
  const {locale}=useLocale();const ar=locale==='ar';const [rows,setRows]=useState<Record<string,unknown>[]>([]);const [error,setError]=useState('');const companyId=getCompanyId();
  useEffect(()=>{apiGet<Record<string,unknown>[]|Record<string,unknown>>(`${path}/${companyId}`).then(data=>setRows(Array.isArray(data)?data:[data])).catch(e=>setError(e instanceof Error?e.message:String(e)))},[path,companyId]);
  return <><div className="heading"><div><h1>{ar?titleAr:titleEn}</h1><p>{ar?subtitleAr:subtitleEn}</p></div><div className="formActions"><button className="ghost" onClick={()=>window.print()}>{ar?'طباعة':'Print'}</button></div></div>{error&&<div className="card formMessage">{error}</div>}<section className="card"><div className="tableWrap"><table><thead><tr>{columns.map(c=><th key={c.key}>{ar?c.ar:c.en}</th>)}</tr></thead><tbody>{rows.map((row,i)=><tr key={i}>{columns.map(c=><td key={c.key}>{String(row[c.key]??'')}</td>)}</tr>)}</tbody></table></div>{!rows.length&&!error&&<p className="emptyState">{ar?'لا توجد بيانات للفترة الحالية':'No data for the current period'}</p>}</section></>;
}
