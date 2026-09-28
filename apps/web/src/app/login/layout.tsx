import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'نظام المحاسبة | Accounting & ERP Platform',
  description: 'منصة محاسبة وإدارة أعمال ثنائية اللغة للمبيعات والمشتريات والمخزون والقيود والتقارير والتسويات البنكية.',
  alternates: { canonical: '/login/' },
  robots: { index: true, follow: true },
  verification: { google: 'CRdlJ0OiNKtF_xcIB8OYPGbWqHaVqvCc9GBpf1drvZY' },
  openGraph: {
    type: 'website',
    url: '/login/',
    title: 'نظام المحاسبة | Accounting & ERP Platform',
    description: 'منصة ثنائية اللغة لإدارة العمليات المالية والمبيعات والمشتريات والمخزون والتقارير.',
    siteName: 'Accounting Platform',
  },
};

export default function LoginLayout({children}:{children:React.ReactNode}) {
  return children;
}
