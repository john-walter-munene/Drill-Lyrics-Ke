import type { MetadataRoute } from 'next';
import { SITE_URL, listSitemapPaths } from '../lib/api';

// Regenerated hourly; every entry comes from published content only.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPaths: MetadataRoute.Sitemap = [
    '', '/songs', '/artists', '/djs', '/podcasts', '/events', '/about', '/support',
  ].map((path) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: 'weekly',
    priority: path === '' ? 1 : 0.8,
  }));

  const dynamicPaths = await listSitemapPaths();
  return [
    ...staticPaths,
    ...dynamicPaths.map((entry) => ({
      url: `${SITE_URL}${entry.path}`,
      lastModified: entry.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ];
}
