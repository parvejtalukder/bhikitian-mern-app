import type { MetadataRoute } from 'next';
import { mediawikiClient } from '../../server/mediawikiClient';
import { resolvePublicSiteUrl } from '../lib/site';

// ISR: the article list is fetched from MediaWiki (cached upstream) and the
// result is served with `s-maxage=300` so crawls do not hit this origin.
// Kept short because a build-time upstream failure (offline build machines)
// yields a sitemap with only the static entries until the next revalidation.
export const revalidate = 300;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const publicSiteUrl = resolvePublicSiteUrl();
  // Without a correctly configured public origin we cannot emit absolute `loc`
  // values, so serve a valid empty sitemap rather than a broken one.
  if (!publicSiteUrl) return [];

  const now = new Date();
  const entries: MetadataRoute.Sitemap = [
    { url: `${publicSiteUrl}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${publicSiteUrl}/search`, changeFrequency: 'weekly', priority: 0.6 },
  ];

  try {
    const slugs = await mediawikiClient.getSitemapSlugs();
    for (const slug of slugs) {
      entries.push({
        url: `${publicSiteUrl}/wiki/${encodeURIComponent(slug)}`,
        changeFrequency: 'weekly',
        priority: 0.8,
      });
    }
  } catch (error) {
    // A temporary upstream outage must not break the sitemap route.
    console.error('[sitemap] upstream article list unavailable', {
      reason: error instanceof Error ? error.message : 'unknown error',
    });
  }

  return entries;
}
