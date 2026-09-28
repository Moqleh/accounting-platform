import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  const base='https://moqleh.github.io/accounting-platform';
  return {
    rules: [{ userAgent: '*', allow: '/' }],
    sitemap: base + '/sitemap.xml',
  };
}
