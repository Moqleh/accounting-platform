import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://moqleh.github.io/accounting-platform';
  return [
    { url: base + '/about/', lastModified: new Date('2026-09-30') },
  ];
}
