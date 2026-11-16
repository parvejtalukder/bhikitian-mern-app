import { notFound } from 'next/navigation';
import Link from 'next/link';
import { mediawikiClient, normalizeSlug } from '../../../../server/mediawikiClient';
import ArticlePage from './article-page';
import { WikiRetry } from './wiki-retry';

/**
 * Incremental Static Regeneration.
 *
 * This route deliberately reads NO request-time data (no `searchParams`,
 * cookies or headers) so it stays eligible for the full-route cache and for CDN
 * caching: Next.js sends `Cache-Control: s-maxage=60, stale-while-revalidate=86340`
 * (the SWR window comes from `expireTime` in next.config.ts).
 *
 * 60s is also the deletion/update propagation window for already-cached page
 * HTML: the data layer is invalidated immediately by the publish webhook, but a
 * cached page (here and at the CDN) can keep serving the previous render until
 * it revalidates or the platform purges it. Keep this in step with
 * MEDIAWIKI_ARTICLE_TTL_MS so page cache and data cache expire together.
 */
export const revalidate = 60;

/**
 * Declaring `generateStaticParams` (even as an empty list) is what makes a
 * dynamic route ISR-eligible in this Next.js version: without it the route is
 * treated as fully dynamic and every read renders on demand with
 * `Cache-Control: private, no-cache, no-store` — no route cache, no CDN cache.
 *
 * Returning `[]` means "no paths prerendered at build time": the first read of
 * any article generates it (coalesced upstream), after which it is served from
 * the route cache and CDN. Builds therefore need no MediaWiki availability.
 * To warm popular titles at build time, return their slugs here instead.
 */
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const title = normalizeSlug(slug.join('/')).replace(/_/g, ' ');
  return {
    title,
    description: `Read ${title} in The Bhikitia Encyclopedia.`,
    alternates: { canonical: `/wiki/${slug.join('/')}` },
  };
}

export default async function WikiPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const requestedSlug = slug.join('/');
  const lookup = await mediawikiClient.lookupArticle(requestedSlug);

  // A genuine "page does not exist" is a real 404 (never a fallback page).
  if (lookup.state === 'missing') notFound();

  if (lookup.state === 'unavailable' || !lookup.article) {
    // Upstream failed and there is no cached copy: keep the reader-facing
    // "try again" experience without making the route dynamic.
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-24 sm:px-6">
        <p className="bh-eyebrow">Temporarily unavailable</p>
        <h1 className="mt-3 font-editorial text-3xl font-bold text-ink">Encyclopedia unavailable</h1>
        <p className="mt-3 text-ink-muted">
          The encyclopedia is temporarily unavailable. Please try again later.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <WikiRetry slug={requestedSlug} />
          <Link href="/" className="bh-btn bh-btn-secondary">
            Back to the homepage
          </Link>
        </div>
      </main>
    );
  }

  return <ArticlePage article={lookup.article} stale={lookup.state === 'stale'} staleAgeMs={lookup.ageMs} />;
}
