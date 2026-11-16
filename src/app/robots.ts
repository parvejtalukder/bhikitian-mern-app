import type { MetadataRoute } from 'next';
import { resolvePublicSiteUrl } from '../lib/site';

// Cached: robots.txt has no upstream dependency and never varies per reader.
export const revalidate = 3600;

export default function robots(): MetadataRoute.Robots {
  const publicSiteUrl = resolvePublicSiteUrl();
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/wiki/'],
      disallow: ['/api/', '/submit/'],
    },
    ...(publicSiteUrl ? { sitemap: `${publicSiteUrl}/sitemap.xml` } : {}),
  };
}
