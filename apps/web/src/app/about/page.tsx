'use client';
import Link from 'next/link';
import { ChartNoAxesCombined, Mail, Phone, ShieldCheck, CircleHelp } from 'lucide-react';
import { ErpShell, useLocale } from '@/components/erp-shell';
import styles from './about.module.css';

export default function Page() { return <ErpShell><About /></ErpShell>; }
function About() {
  const { locale } = useLocale();
  const ar = locale === 'ar';
  return <div className={styles.page}>
    <div className="heading"><div><h1>{ar ? 'عن البرنامج' : 'About'}</h1><p>{ar ? 'تعرّف على البرنامج وتواصل معنا' : 'Learn about the application and get in touch'}</p></div></div>
    <section className={styles.hero}>
      <ChartNoAxesCombined size={42} aria-hidden="true" />
      <h2>{ar ? 'نظام المحاسبة' : 'Accounting System'}</h2>
      <p>{ar ? 'مساحة منظّمة لإدارة المبيعات والمشتريات والمخزون، ومتابعة القيود والتقارير المحاسبية.' : 'An organized workspace for sales, purchases, inventory, journals and accounting reports.'}</p>
    </section>
    <section className={styles.card} aria-labelledby="designer-heading">
      <span className={styles.eyebrow}>{ar ? 'التصميم والتواصل' : 'Design & contact'}</span>
      <h2 id="designer-heading">{ar ? 'تصميم محمد العقلة' : 'Designed by Mohammed Al-Oqleh'}</h2>
      <p>{ar ? 'للاستفسارات والملاحظات واقتراحات تطوير البرنامج، يسعدنا تواصلك.' : 'Contact us with questions, feedback or suggestions for the application.'}</p>
      <div className={styles.contacts}>
        <a href="mailto:info.moqleh@yahoo.com"><Mail size={22} aria-hidden="true" /><span><small>{ar ? 'البريد الإلكتروني' : 'Email'}</small><b dir="ltr">info.moqleh@yahoo.com</b></span></a>
        <a href="tel:+966545506941"><Phone size={22} aria-hidden="true" /><span><small>{ar ? 'الهاتف' : 'Phone'}</small><b dir="ltr">+966 54 550 6941</b></span></a>
      </div>
    </section>
    <div className={styles.links}>
      <Link href="/information/privacy"><ShieldCheck size={21} aria-hidden="true" />{ar ? 'الخصوصية والبيانات' : 'Privacy & data'}</Link>
      <Link href="/information/faq"><CircleHelp size={21} aria-hidden="true" />{ar ? 'الأسئلة الشائعة' : 'Frequently asked questions'}</Link>
    </div>
  </div>;
}
