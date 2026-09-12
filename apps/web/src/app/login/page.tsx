'use client';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, BarChart3, Calculator, FileText, Languages, LockKeyhole, Mail, Phone, Wallet } from 'lucide-react';
import { login } from '@/lib/api';
import styles from './login.module.css';
import { PlatformLinks } from '@/components/platform-links';

export default function Login() {
  const [ar,setAr]=useState(true), [email,setEmail]=useState(''), [password,setPassword]=useState(''), [busy,setBusy]=useState(false), [error,setError]=useState('');
  const router=useRouter();
  const submit=async(event:FormEvent)=>{event.preventDefault();setBusy(true);setError('');try{await login(email,password);router.replace('/');router.refresh()}catch(err){setError(err instanceof Error?err.message:String(err))}finally{setBusy(false)}};
  const Arrow=ar?ArrowLeft:ArrowRight;
  return <main className={styles.page} dir={ar?'rtl':'ltr'} lang={ar?'ar':'en'}>
    <div className={styles.backdrop} aria-hidden="true"><i/><i/><i/></div>
    <header className={styles.header}>
      <div className={styles.brand}><span className={styles.brandIcon}><Calculator size={24} aria-hidden="true"/></span><div><strong>{ar?'نظام المحاسبة':'Accounting System'}</strong><span>ACCOUNTING & ERP</span></div></div>
      <button className={styles.language} type="button" onClick={()=>setAr(!ar)} aria-label={ar?'Switch to English':'التبديل إلى العربية'}><Languages size={18} aria-hidden="true"/>{ar?'English':'العربية'}</button>
    </header>
    <div className={styles.content}>
      <section className={styles.hero} aria-labelledby="welcome-title">
        <span className={styles.eyebrow}>{ar?'وضوح في الأرقام. ثقة في الخطوة القادمة.':'Clear numbers. A confident next step.'}</span>
        <h1 id="welcome-title">{ar?<>كل حساباتك،<br/><em>في مكان واحد.</em></>:<>Your accounts.<br/><em>All in one place.</em></>}</h1>
        <p className={styles.intro}>{ar?'مساحة منظّمة لإدارة أعمالك، من الفواتير والمخزون إلى التقارير المالية. ابدأ يومك برؤية أوضح.':'An organised workspace for your business, from invoices and inventory to financial reports. Start your day with a clearer view.'}</p>
        <div className={styles.features}><span><FileText size={18} aria-hidden="true"/>{ar?'الفواتير':'Invoices'}</span><span><Wallet size={18} aria-hidden="true"/>{ar?'الحسابات':'Accounts'}</span><span><BarChart3 size={18} aria-hidden="true"/>{ar?'التقارير':'Reports'}</span></div>
        <div className={styles.art} aria-hidden="true"><div className={styles.orbit}/><div className={styles.artCard}><span/><span/><div className={styles.bars}><i/><i/><i/><i/><i/><i/></div></div><div className={styles.artBadge}><BarChart3 size={24}/><span>{ar?'رؤية أوضح لأعمالك':'Clarity for your business'}</span></div></div>
      </section>
      <section className={styles.panel} aria-labelledby="signin-title">
        <span className={styles.panelIcon}><LockKeyhole size={24} aria-hidden="true"/></span>
        <p className={styles.kicker}>{ar?'أهلاً بعودتك':'WELCOME BACK'}</p><h2 id="signin-title">{ar?'تسجيل الدخول':'Sign in'}</h2>
        <p className={styles.panelIntro}>{ar?'أدخل بيانات حسابك للمتابعة إلى البرنامج.':'Enter your account details to continue.'}</p>
        <form onSubmit={submit} className={styles.form}>
          <label htmlFor="login-email">{ar?'البريد الإلكتروني':'Email address'}</label>
          <div className={styles.field}><Mail size={19} aria-hidden="true"/><input id="login-email" required autoComplete="username" type="email" dir="ltr" value={email} onChange={event=>setEmail(event.target.value)} placeholder="name@company.com"/></div>
          <label htmlFor="login-password">{ar?'كلمة المرور':'Password'}</label>
          <div className={styles.field}><LockKeyhole size={19} aria-hidden="true"/><input id="login-password" required autoComplete="current-password" type="password" value={password} onChange={event=>setPassword(event.target.value)} placeholder={ar?'أدخل كلمة المرور':'Enter your password'}/></div>
          {error&&<p className={styles.error} role="alert">{ar?'تعذر تسجيل الدخول. تحقق من بياناتك وحاول مجدداً.':error}</p>}
          <button className={styles.submit} type="submit" disabled={busy} aria-busy={busy}>{busy?(ar?'جاري تسجيل الدخول…':'Signing in…'):(ar?'الدخول إلى البرنامج':'Continue to workspace')}<Arrow size={19} aria-hidden="true"/></button>
        </form>
        <p className={styles.help}>{ar?'تحتاج مساعدة؟ بيانات التواصل متاحة أدناه.':'Need a hand? Contact details are below.'}</p>
      </section>
    </div>
    <PlatformLinks ar={ar}/>
    <footer className={styles.footer}>
      <p>{ar?'تصميم':'Designed by'} <strong>{ar?'محمد العقلة':'Mohammed Al-Oqleh'}</strong></p>
      <nav className={styles.contacts} aria-label={ar?'بيانات التواصل':'Contact details'}>
        <a href="tel:+966545506941" aria-label={ar?'الاتصال بمحمد العقلة':'Call Mohammed Al-Oqleh'}><Phone size={16} aria-hidden="true"/><span dir="ltr">+966 545506941</span></a>
        <a href="mailto:info.moqleh@yahoo.com" aria-label={ar?'مراسلة محمد العقلة بالبريد الإلكتروني':'Email Mohammed Al-Oqleh'}><Mail size={17} aria-hidden="true"/><span dir="ltr">info.moqleh@yahoo.com</span></a>
      </nav>
    </footer>
  </main>;
}
