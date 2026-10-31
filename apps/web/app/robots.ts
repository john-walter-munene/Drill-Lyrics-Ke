import type { MetadataRoute } from 'next';
import { SITE_URL } from '../api';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Drafts, account and admin surfaces must never be indexed. Reset and
        // confirmation links are single-use credentials; a crawler must never
        // fetch one, because fetching it would spend it.
        disallow: [
          '/admin', '/account', '/api', '/submit',
          '/reset-password', '/forgot-password', '/confirm-email',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
