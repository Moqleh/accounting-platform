'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Calculator, Languages, Mail, Phone } from 'lucide-react';
import { platformInfo } from '@/lib/platform-info';
import { PlatformLinks } from './platform-links';
import styles from './platform-info.module.css';

export function PlatformInformation({ slug }: { slug: string }) {
  const [ar, setAr] = useState(true);
  const page = platformInfo[slug];
  useEffect(() => { setAr(new URLSearchParams(window.location.search).get('lang') !== 'en'); }, []);
  useEffect(() => { document.documentElement.lang = ar ? 'ar' : 'en'; document.documentElement.dir = ar ? 'rtl' : 'ltr'; }, [ar]);
  return <main className={styles.page} dir={ar ? 'rtl' : 'ltr'} lang={ar ? 'ar' : 'en'}>
    <a className={styles.skip} href="#information-content">{ar ? 'انتقل إلى المحتوى' : 'Skip to content'}</a>
    <header className={styles.header}>
      <Link href="/login/" className={styles.brand}><Calculator aria-hidden="true"/><span>{ar ? 'نظام المحاسبة' : 'Accounting System'}</span></Link>
      <button type="button" onClick={() => setAr(!ar)} aria-label={ar ? 'Switch to English' : 'التبديل إلى العربية'}><Languages size={18} aria-hidden="true"/>{ar ? 'English' : 'العربية'}</button>
    </header>
    <div className={styles.hero}><span>{ar ? 'وضوح في التجربة. شفافية في التفاصيل.' : 'A clear experience. Transparent details.'}</span><h1>{ar ? page.ar : page.en}</h1><p>{ar ? 'تعرّف على المنصة وطريقة استخدامها وبياناتك، بكل وضوح.' : 'Understand the platform, how to use it and how your data is handled.'}</p></div>
    <div className={styles.body}>
      <article id="information-content" className={styles.article}>
        {page.sections.map((section, index) => {
          const [title, text] = ar ? section.ar : section.en;
          return slug === 'faq' ? <details key={index} className={styles.question}><summary>{title}</summary><p>{text}</p></details> : <section key={index}><h2>{title}</h2><p>{text}</p></section>;
        })}
        {slug === 'privacy' && <p className={styles.source}><a href="https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages#data-collection" target="_blank" rel="noopener noreferrer">{ar ? 'تفاصيل جمع البيانات لدى GitHub Pages ↗' : 'GitHub Pages data collection details ↗'}</a></p>}
        {slug === 'contact' && <div className={styles.contact}><a href="mailto:info.moqleh@yahoo.com"><Mail size={20} aria-hidden="true"/><span dir="ltr">info.moqleh@yahoo.com</span></a><a href="tel:+966545506941"><Phone size={20} aria-hidden="true"/><span dir="ltr">+966 545506941</span></a></div>}
        <Link className={styles.back} href="/login/"><ArrowRight size={18} aria-hidden="true"/>{ar ? 'العودة إلى تسجيل الدخول' : 'Back to sign in'}</Link>
      </article>
      <aside className={styles.aside}><h2>{ar ? 'اكتشف المزيد' : 'Explore more'}</h2><PlatformLinks ar={ar} compact/></aside>
    </div>
    <footer className={styles.footer}>{ar ? 'تصميم محمد العقلة' : 'Designed by Mohammed Al-Oqleh'}<a href="mailto:info.moqleh@yahoo.com">info.moqleh@yahoo.com</a></footer>
  </main>;
}
