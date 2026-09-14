import type { Metadata } from 'next';
import './globals.css';
import './extras.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://moqleh.github.io/accounting-platform/'),
  title: {
    default: 'نظام المحاسبة | Accounting & ERP Platform',
    template: '%s | Accounting Platform',
  },
  description: 'منصة محاسبة وإدارة أعمال ثنائية اللغة للمبيعات والمشتريات والمخزون والقيود والتقارير والتسويات البنكية مع صلاحيات متعددة الشركات.',
  keywords: ['نظام محاسبة','Accounting System','ERP','المبيعات','المشتريات','المخزون','التقارير المالية','Bank Reconciliation'],
  authors: [{ name: 'Mohammed Al-Oqleh' }],
  creator: 'Mohammed Al-Oqleh',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'ar_SA',
    alternateLocale: ['en_US'],
    url: '/',
    siteName: 'Accounting Platform',
    title: 'نظام المحاسبة | Accounting & ERP Platform',
    description: 'منصة ثنائية اللغة لإدارة المبيعات والمشتريات والمخزون والقيود والتقارير والتسويات البنكية.',
  },
  twitter: {
    card: 'summary',
    title: 'Accounting & ERP Platform',
    description: 'Bilingual accounting and ERP workspace for core financial operations and reporting.',
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
