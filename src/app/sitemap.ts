import type { MetadataRoute } from 'next';
import { mediawikiClient } from '../../server/mediawikiClient';
import { resolvePublicSiteUrl } from '../lib/site';

/**
 * Rendered on request instead of at build time.
 *
 * Prerendering this route makes the build depend on the live wiki: one slow
 * upstream response (this wiki regularly needs several seconds per cold
 * request) was enough to publish a 2-URL sitemap and keep serving it for the
 * whole revalidate window. Rendering on demand keeps the build independent of
 * MediaWiki, and the request stays cheap because getSitemapSlugs() holds the
 * list in-process for 30 minutes and in the Next Data Cache with a matching
 * revalidate, so a crawl burst costs at most one upstream walk per window.
 */
export const dynamic = 'force-dynamic';

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
