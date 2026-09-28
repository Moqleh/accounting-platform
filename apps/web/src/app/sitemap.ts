import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const base='https://moqleh.github.io/accounting-platform';
  return [
    {
      url: base + '/login/',
      lastModified: new Date('2026-09-29'),
      changeFrequency: 'weekly',
      priority: 1,
    },
  ];
}
