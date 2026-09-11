'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { ErpShell, useLocale } from './erp-shell';
import { apiGet, apiPost, getCompanyId } from '@/lib/api';

type Party={id:string;code:string;name:string;email?:string|null;phone?:string|null;taxNumber?:string|null;isActive:boolean};
type Kind='customers'|'suppliers';

export function MasterDataPage({kind}:{kind:Kind}){return <ErpShell><Body kind={kind}/></ErpShell>}
function Body({kind}:{kind:Kind}){
  const {locale}=useLocale();const ar=locale==='ar';const customer=kind==='customers';
  const [rows,setRows]=useState<Party[]>([]),[q,setQ]=useState(''),[show,setShow]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const [form,setForm]=useState({code:'',name:'',email:'',phone:'',taxNumber:''});
  const companyId=getCompanyId();
  const load=()=>apiGet<Party[]>(`/erp/${kind}/${companyId}`).then(setRows).catch(e=>setError(e instanceof Error?e.message:String(e)));
  useEffect(()=>{load()},[kind,companyId]);
  const filtered=useMemo(()=>rows.filter(r=>`${r.code} ${r.name} ${r.email??''} ${r.phone??''}`.toLowerCase().includes(q.toLowerCase())),[rows,q]);
  const submit=async(e:FormEvent)=>{e.preventDefault();setBusy(true);setError('');try{await apiPost(`/erp/${kind}/${companyId}`,form);setForm({code:'',name:'',email:'',phone:'',taxNumber:''});setShow(false);await load()}catch(err){setError(err instanceof Error?err.message:String(err))}finally{setBusy(false)}};
  return <><div className="heading"><div><h1>{customer?(ar?'العملاء':'Customers'):(ar?'الموردون':'Suppliers')}</h1><p>{customer?(ar?'ملفات العملاء والأرصدة والحركة':'Customer profiles, balances and activity'):(ar?'ملفات الموردين والأرصدة والمشتريات':'Supplier profiles, balances and purchases')}</p></div><button className="primary" onClick={()=>setShow(true)}><Plus size={17}/>{customer?(ar?'عميل جديد':'New Customer'):(ar?'مورد جديد':'New Supplier')}</button></div>
    {show&&<section className="card quickForm"><div className="cardTitle"><h2>{customer?(ar?'إضافة عميل':'Add Customer'):(ar?'إضافة مورد':'Add Supplier')}</h2><button className="ghost" onClick={()=>setShow(false)}><X size={16}/></button></div><form onSubmit={submit} className="formGrid"><label>{ar?'الرمز':'Code'}<input required value={form.code} onChange={e=>setForm({...form,code:e.target.value})}/></label><label>{ar?'الاسم':'Name'}<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label>{ar?'البريد':'Email'}<input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label><label>{ar?'الجوال':'Phone'}<input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label><label>{ar?'الرقم الضريبي':'Tax Number'}<input value={form.taxNumber} onChange={e=>setForm({...form,taxNumber:e.target.value})}/></label><div className="formActions"><button type="submit" className="primary" disabled={busy}>{busy?(ar?'جاري الحفظ...':'Saving...'):(ar?'حفظ':'Save')}</button></div></form></section>}
    <section className="card"><div className="moduleToolbar"><div className="inlineSearch"><Search size={16}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder={ar?'بحث...':'Search...'}/></div></div>{error&&<div className="formMessage">{error}</div>}<div className="tableWrap"><table><thead><tr><th>{ar?'الرمز':'Code'}</th><th>{ar?'الاسم':'Name'}</th><th>{ar?'الجوال':'Phone'}</th><th>{ar?'البريد الإلكتروني':'Email'}</th><th>{ar?'الرقم الضريبي':'Tax Number'}</th><th>{ar?'الحالة':'Status'}</th></tr></thead><tbody>{filtered.map(r=><tr key={r.id}><td>{r.code}</td><td>{r.name}</td><td>{r.phone??'—'}</td><td>{r.email??'—'}</td><td>{r.taxNumber??'—'}</td><td><span className={`status ${r.isActive?'paid':'overdue'}`}>{r.isActive?(ar?'نشط':'Active'):(ar?'موقوف':'Disabled')}</span></td></tr>)}</tbody></table></div></section></>;
}
