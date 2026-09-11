import './globals.css';

export const metadata = {
  title: 'Accounting Platform',
  description: 'Bilingual Accounting & ERP Platform',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
