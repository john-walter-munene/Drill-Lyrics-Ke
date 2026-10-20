import type { MetadataRoute } from 'next';
import { SITE_URL } from '../lib/api';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Drafts, account and admin surfaces must never be indexed.
        disallow: ['/admin', '/account', '/api', '/submit'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
