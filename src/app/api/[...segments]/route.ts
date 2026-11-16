import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import {
  getMediaWikiConfig,
  mediawikiClient,
  normalizeSlug,
} from '../../../../server/mediawikiClient';
import { increment, log, observe, renderPrometheus, snapshot } from '../../../../server/metrics';

/**
 * Shared-cache TTLs for the public read APIs. `s-maxage` lets a CDN serve
 * repeated reads without touching this origin at all; the long
 * `stale-while-revalidate` window keeps readers served while the origin
 * revalidates or while MediaWiki is degraded. Nothing here varies per user
 * (no cookies, no auth), so the responses are safe to cache publicly.
 */
const SWR_SECONDS = 86_400;
const PORTAL_S_MAXAGE = 60;
const SEARCH_S_MAXAGE = 60;
const ARTICLE_S_MAXAGE = 300;
/** Upper bound on an autocomplete/search query so a scraper cannot abuse it. */
const MAX_QUERY_LENGTH = 200;

function shared(seconds: number, browserSeconds = 0): string {
  const browser = browserSeconds > 0 ? `, max-age=${browserSeconds}` : '';
  return `public${browser}, s-maxage=${seconds}, stale-while-revalidate=${SWR_SECONDS}`;
}

function json(data: unknown, status = 200, cacheControl = 'no-store') {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': cacheControl } });
}

function statusOf(error: unknown): number {
  return error instanceof Error && error.name === 'MediaWikiUnavailableError' ? 503 : 502;
}

export async function GET(request: NextRequest, context: { params: Promise<{ segments: string[] }> }) {
  const segments = (await context.params).segments;
  const path = segments.join('/');
  const searchParams = request.nextUrl.searchParams;
  const startedAt = Date.now();
  try {
    if (path === 'media') {
      const source = searchParams.get('url');
      if (!source) return json({ error: 'Missing media URL.' }, 400);
      const configured = new URL(getMediaWikiConfig().mediawikiBaseUrl);
      const target = new URL(source);
      if (target.origin !== configured.origin) return json({ error: 'Media origin is not allowed.' }, 403);
      const response = await fetch(target, {
        headers: { Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8' },
        signal: AbortSignal.timeout(20000),
        next: { revalidate: 604_800, tags: ['mw:media'] },
      });
      if (!response.ok) return new NextResponse(null, { status: response.status });
      return new NextResponse(response.body, {
        headers: {
          'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
          'Content-Type': response.headers.get('content-type') || 'application/octet-stream',
        },
      });
    }

    // Cache-hit/miss/upstream metrics for scraping by any collector.
    if (path === 'metrics') {
      if (searchParams.get('format') === 'prometheus') {
        return new NextResponse(renderPrometheus(), {
          headers: {
            'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
            'Cache-Control': 'no-store',
          },
        });
      }
      return json(
        {
          ...snapshot(),
          // `pid` makes it obvious when more than one server worker is serving
          // requests (per-process caches are then multiplied by worker count).
          pid: process.pid,
          mediawiki: mediawikiClient.stats(),
        },
        200
      );
    }

    if (path === 'wiki/portal') {
      const payload = (await mediawikiClient.getPortalData()) as Record<string, unknown>;
      // Server-only configuration must not leak into a shared, public cache.
      const { config: _config, ...publicPayload } = payload;
      increment('api.request', { route: 'portal', result: 'ok' });
      return json(publicPayload, 200, shared(PORTAL_S_MAXAGE));
    }

    if (path === 'wiki/search') {
      const q = (searchParams.get('q') || '').slice(0, MAX_QUERY_LENGTH);
      const limit = Math.min(30, Math.max(1, Number(searchParams.get('limit') || 15)));
      const results = await mediawikiClient.search(q, limit);
      increment('api.request', { route: 'search', result: 'ok' });
      // `max-age` (browser) + `s-maxage` (CDN) so repeat typing of the same
      // query is served locally; the server-side LRU bounds total memory.
      return json({ query: q, results }, 200, shared(SEARCH_S_MAXAGE, 30));
    }

    if (path === 'wiki/article') {
      const slug = searchParams.get('slug') || 'Main_Page';
      const lookup = await mediawikiClient.lookupArticle(slug, { fresh: searchParams.get('fresh') === '1' });
      increment('api.request', { route: 'article', result: lookup.state });

      // A genuine missing page must be a 404; an upstream outage must NOT be
      // (a 404 tells readers and crawlers the article is gone for good).
      if (lookup.state === 'missing') {
        return json(lookup.article ?? { error: 'Article not found.', slug }, 404);
      }
      if (lookup.state === 'unavailable' || !lookup.article) {
        return json(
          { error: 'This article is temporarily unavailable. Please try again shortly.', slug },
          503
        );
      }
      // A stale response must never be re-cached as if it were fresh.
      return json(
        lookup.article,
        200,
        lookup.state === 'stale' ? 'no-store' : shared(ARTICLE_S_MAXAGE)
      );
    }

    if (path === 'wiki/verify') {
      const article = await mediawikiClient.getArticle(searchParams.get('slug') || '', true);
      return json({
        exists: article.exists,
        slug: article.slug,
        title: article.title,
        canonicalUrl: article.canonicalUrl,
        revId: article.revId,
      });
    }

    return json({ error: 'Not found.' }, 404);
  } catch (error) {
    // Keep upstream/MediaWiki detail server-side; readers get a stable, neutral message.
    log.error('api.request_failed', {
      path,
      reason: error instanceof Error ? error.message : 'unknown error',
    });
    increment('api.request', { route: path.split('/')[0] || 'root', result: 'error' });
    return json({ error: 'This content is temporarily unavailable. Please try again.' }, statusOf(error));
  } finally {
    observe('api.handler.latency', Date.now() - startedAt, { path: path.split('/')[0] || 'root' });
  }
}

/**
 * POST endpoints (both are cache mutations, so they must not be cached):
 *
 *  - `wiki/refresh`  reader-triggered retry: purge the cached copy, re-read
 *                    MediaWiki once, and let the caller refresh the page.
 *  - `revalidate`    MediaWiki save/delete/unpublish webhook (same contract the
 *                    README documents: `POST /api/revalidate` with the shared
 *                    secret in the body, `X-Revalidate-Secret`, or a bearer
 *                    token). Purges the Data Cache tags AND the page cache.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ segments: string[] }> }) {
  const segments = (await context.params).segments;
  const path = segments.join('/');

  try {
    if (path === 'wiki/refresh') {
      const rawSlug = request.nextUrl.searchParams.get('slug') || '';
      if (!rawSlug.trim()) return json({ error: 'Missing slug.' }, 400);
      const slug = normalizeSlug(rawSlug);

      const purged = mediawikiClient.revalidate(slug);
      purged.tags.forEach((tag) => revalidateTag(tag, { expire: 0 }));
      revalidatePath(`/wiki/${slug}`);

      const lookup = await mediawikiClient.lookupArticle(slug, { fresh: true });
      increment('api.refresh', { state: lookup.state });
      log.info('wiki.refresh', { slug, state: lookup.state, cacheStatus: lookup.cacheStatus });

      return json({ slug, state: lookup.state, cacheStatus: lookup.cacheStatus });
    }

    if (path === 'revalidate') {
      const expected = process.env.REVALIDATION_SECRET || '';
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const headerSecret = request.headers.get('x-revalidate-secret') || '';
      const bearer = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
      const provided = String(body?.secret || headerSecret || bearer || '');

      if (!expected || provided !== expected) {
        increment('api.revalidate', { result: 'unauthorized' });
        return json({ error: 'Unauthorized.' }, 401);
      }

      const event = String(body?.event || 'save').toLowerCase();
      const rawSlug = String(body?.slug || body?.title || '').trim();

      if (!rawSlug) {
        // Edition-wide purge (e.g. taxonomy/configuration change).
        const cleared = mediawikiClient.revalidate('*');
        cleared.tags.forEach((tag) => revalidateTag(tag, { expire: 0 }));
        revalidatePath('/', 'layout');
        increment('api.revalidate', { result: 'all', event });
        return json({ revalidated: true, event, cleared: 'all', timestamp: new Date().toISOString() });
      }

      const slug = normalizeSlug(rawSlug);
      const isRemoval = event === 'delete' || event === 'unpublish';

      // Deletions also tombstone the title so stale-if-error cannot resurrect it.
      const cleared = isRemoval ? mediawikiClient.markUnavailable(slug, event) : mediawikiClient.revalidate(slug);
      cleared.tags.forEach((tag) => revalidateTag(tag, { expire: 0 }));
      // Literal path only: purging the whole `/wiki/[...slug]` pattern as well
      // would drop the *specific* path marker for this article (see the
      // deletion notes in docs/performance-report.md).
      revalidatePath(`/wiki/${slug}`);
      if (isRemoval) {
        // Deletion must also beat any cached RSC/segment copy of the path.
        revalidatePath('/wiki', 'layout');
      }

      increment('api.revalidate', { result: isRemoval ? 'removed' : 'purged', event });
      log.info('api.revalidate', { slug, event, tags: cleared.tags });

      return json({
        revalidated: true,
        event,
        cleared: cleared.cleared,
        tags: cleared.tags,
        timestamp: new Date().toISOString(),
      });
    }

    return json({ error: 'Not found.' }, 404);
  } catch (error) {
    log.error('api.mutation_failed', {
      path,
      reason: error instanceof Error ? error.message : 'unknown error',
    });
    increment('api.mutation', { route: path, result: 'error' });
    return json({ error: 'This action could not be completed. Please try again.' }, statusOf(error));
  }
}
