import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'برنامج محاسبة عربي وإنجليزي | Accounting & ERP Platform',
  description: 'منصة محاسبة وإدارة أعمال للمبيعات والمشتريات والمخزون والقيود والتقارير المالية والتسويات البنكية، بواجهة عربية وإنجليزية.',
  alternates: { canonical: '/about/' },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
  openGraph: {
    type: 'website',
    url: '/about/',
    title: 'برنامج محاسبة وإدارة أعمال | Accounting & ERP Platform',
    description: 'منصة ثنائية اللغة للمحاسبة والمبيعات والمشتريات والمخزون والتقارير والتسويات البنكية.'
  }
};

export default function AboutLayout({children}:{children:React.ReactNode}){return children;}
