import * as cheerio from 'cheerio';
import { HOMEPAGE_FEATURED_ENTRIES } from '../src/lib/homepage';
import { increment, log, observe, setGauge, time } from './metrics';
import {
  CircuitBreaker,
  Semaphore,
  SingleFlight,
  ThrottledError,
  TtlLru,
  readIntEnv,
} from './resilience';
import type {
  WikiArticleResponse,
  WikiRevision,
  WikiSearchResult,
  WikiSection,
} from './types.ts';

/**
 * Tunables. Every value is env-overridable and clamped, so a bad value cannot
 * cause unbounded queues, unbounded caches, or infinite upstream waits.
 *
 * Fresh TTLs bound staleness during normal operation; the STALE windows bound
 * how long the last successful payload may still be served while MediaWiki is
 * degraded (stale-if-error), and match the CDN stale-while-revalidate window
 * configured in next.config.ts (`expireTime`).
 */
const ARTICLE_TTL_MS = readIntEnv('MEDIAWIKI_ARTICLE_TTL_MS', 60 * 1000, 5_000, 24 * 60 * 60 * 1000);
const ARTICLE_STALE_MS = readIntEnv('MEDIAWIKI_ARTICLE_STALE_MS', 24 * 60 * 60 * 1000, 0, 7 * 24 * 60 * 60 * 1000);
const PORTAL_TTL_MS = readIntEnv('MEDIAWIKI_PORTAL_TTL_MS', 60 * 1000, 5_000, 60 * 60 * 1000);
const PORTAL_STALE_MS = readIntEnv('MEDIAWIKI_PORTAL_STALE_MS', 24 * 60 * 60 * 1000, 0, 7 * 24 * 60 * 60 * 1000);
const SITEMAP_TTL_MS = readIntEnv('MEDIAWIKI_SITEMAP_TTL_MS', 30 * 60 * 1000, 10_000, 24 * 60 * 60 * 1000);
const SITEMAP_STALE_MS = readIntEnv('MEDIAWIKI_SITEMAP_STALE_MS', 24 * 60 * 60 * 1000, 0, 7 * 24 * 60 * 60 * 1000);
/** MediaWiki caps `allpages` at 500 rows per request; bound how far we page. */
const SITEMAP_MAX_REQUESTS = readIntEnv('MEDIAWIKI_SITEMAP_MAX_REQUESTS', 24, 1, 200);
const SEARCH_TTL_MS = readIntEnv('MEDIAWIKI_SEARCH_TTL_MS', 60 * 1000, 1_000, 10 * 60 * 1000);
const SEARCH_STALE_MS = readIntEnv('MEDIAWIKI_SEARCH_STALE_MS', 5 * 60 * 1000, 0, 60 * 60 * 1000);
const TOMBSTONE_TTL_MS = readIntEnv('MEDIAWIKI_TOMBSTONE_TTL_MS', 10 * 60 * 1000, 5_000, 24 * 60 * 60 * 1000);
/** Real 404s are cached briefly so crawlers cannot hammer MediaWiki for them. */
const MISSING_TTL_MS = readIntEnv('MEDIAWIKI_MISSING_TTL_MS', 60 * 1000, 1_000, 30 * 60 * 1000);

/** Upstream timeouts: readers get a bounded wait, never an unbounded hang. */
const MEDIAWIKI_TIMEOUT_MS = readIntEnv('MEDIAWIKI_TIMEOUT_MS', 8_000, 500, 60_000);
const SEARCH_TIMEOUT_MS = readIntEnv('MEDIAWIKI_SEARCH_TIMEOUT_MS', 3_500, 300, 20_000);

/**
 * Concurrency budgets. Article/meta traffic and search traffic have SEPARATE
 * budgets so an autocomplete storm cannot consume the capacity needed by
 * article reads (the opposite direction is also true).
 */
const ARTICLE_CONCURRENCY = readIntEnv('MEDIAWIKI_MAX_CONCURRENCY', 8, 1, 64);
const SEARCH_CONCURRENCY = readIntEnv('MEDIAWIKI_SEARCH_CONCURRENCY', 4, 1, 32);
const QUEUE_LIMIT = readIntEnv('MEDIAWIKI_QUEUE_LIMIT', 200, 1, 10_000);
const QUEUE_WAIT_MS = readIntEnv('MEDIAWIKI_QUEUE_WAIT_MS', 2_000, 100, 30_000);

/** Circuit breaker: stop hammering a failing origin. */
const CIRCUIT_FAILURES = readIntEnv('MEDIAWIKI_CIRCUIT_FAILURES', 5, 1, 100);
const CIRCUIT_OPEN_MS = readIntEnv('MEDIAWIKI_CIRCUIT_OPEN_MS', 10_000, 1_000, 300_000);

/** Cache sizes: bounded so a long-tail crawl cannot grow memory without limit. */
const ARTICLE_CACHE_MAX = readIntEnv('MEDIAWIKI_ARTICLE_CACHE_MAX', 1_000, 10, 50_000);
const SEARCH_CACHE_MAX = readIntEnv('MEDIAWIKI_SEARCH_CACHE_MAX', 300, 10, 20_000);
const TOMBSTONE_CACHE_MAX = readIntEnv('MEDIAWIKI_TOMBSTONE_CACHE_MAX', 2_000, 10, 50_000);

export type MediaWikiWorkKind = 'article' | 'search' | 'meta';

export interface ArticleLookupResult {
  /** `ok` = fresh read, `stale` = last good copy while upstream is degraded. */
  state: 'ok' | 'stale' | 'missing' | 'unavailable';
  article?: WikiArticleResponse;
  reason?: string;
  cacheStatus?: 'HIT' | 'MISS' | 'REVALIDATED' | 'STALE';
  ageMs?: number;
}


export type UpstreamFailureKind = 'timeout' | 'http' | 'network' | 'throttled' | 'circuit_open';

export class MediaWikiUnavailableError extends Error {
  constructor(
    message: string,
    public readonly kind: UpstreamFailureKind = 'network',
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'MediaWikiUnavailableError';
  }
}

/** Derive the edition from the MediaWiki hostname (en.bhikitia.org -> en). */
function deriveEdition(baseUrl: string): string {
  try {
    const host = new URL(baseUrl).hostname;
    const label = host.split('.')[0] || '';
    return /^[a-z]{2,3}(-[a-z0-9]+)?$/i.test(label) ? label.toLowerCase() : 'en';
  } catch {
    return 'en';
  }
}

export function getMediaWikiConfig() {
  const mediawikiBaseUrl = (process.env.MEDIAWIKI_BASE_URL || '').replace(/\/+$/, '');
  const publicSiteUrl = (process.env.PUBLIC_SITE_URL || '').replace(/\/+$/, '');
  const staffMediawikiUrl = (process.env.STAFF_MEDIAWIKI_URL || '').replace(/\/+$/, '');
  const scriptPath = (process.env.MEDIAWIKI_SCRIPT_PATH ?? '').replace(/\/+$/, '');
  if (!mediawikiBaseUrl || !publicSiteUrl) {
    throw new Error('MEDIAWIKI_BASE_URL and PUBLIC_SITE_URL must be configured.');
  }
  // Edition/language namespace every cache key so a future bn. edition (or a
  // shared Redis) can never serve the wrong language variant.
  const edition = (process.env.MEDIAWIKI_EDITION || deriveEdition(mediawikiBaseUrl)).toLowerCase();
  const lang = (process.env.MEDIAWIKI_LANG || edition).toLowerCase();
  return {
    mediawikiBaseUrl,
    publicSiteUrl,
    staffMediawikiUrl,
    scriptPath,
    edition,
    lang,
    apiUrl: `${mediawikiBaseUrl}${scriptPath}/api.php`,
  };
}

/** In-process + Next Data Cache key for one canonical article title. */
export function articleCacheKey(canonicalSlug: string): string {
  const { edition, lang } = getMediaWikiConfig();
  return `article:${edition}:${lang}:${canonicalSlug}`;
}

/** Next Data Cache tag for one article; used by the publish/delete webhook. */
export function articleCacheTag(canonicalSlug: string): string {
  const { edition, lang } = getMediaWikiConfig();
  return `mw:article:${edition}:${lang}:${canonicalSlug}`;
}

/** Next Data Cache tag for the whole edition (used to purge everything). */
export function editionCacheTag(): string {
  const { edition, lang } = getMediaWikiConfig();
  return `mw:edition:${edition}:${lang}`;
}

export function normalizeSlug(rawSlug: string): string {
  const decoded = decodeURIComponent(rawSlug || 'Main_Page').trim();
  const clean = decoded.replace(/^\/+/, '').replace(/\s+/g, '_');
  return clean || 'Main_Page';
}

export function titleToSlug(title: string): string {
  return title.trim().replace(/\s+/g, '_');
}

function absolutizeAssetUrl(url: string, baseUrl: string): string {
  if (!url) return url;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  if (url.startsWith('//')) {
    return `${new URL(baseUrl).protocol}${url}`;
  }
  if (url.startsWith('/')) {
    return `${baseUrl}${url}`;
  }
  return `${baseUrl}/${url}`;
}

function rewriteSrcSet(srcset: string, baseUrl: string, publicSiteUrl: string): string {
  return srcset
    .split(',')
    .map((part) => {
      const trimmed = part.trim();
      if (!trimmed) return '';
      const [urlPart, descriptor] = trimmed.split(/\s+/, 2);
      const abs = absolutizeAssetUrl(urlPart, baseUrl);
      const proxied = `${publicSiteUrl}/api/media?url=${encodeURIComponent(abs)}`;
      return descriptor ? `${proxied} ${descriptor}` : proxied;
    })
    .filter(Boolean)
    .join(', ');
}

function cleanSearchSnippet(snippet: string): string {
  const withoutReferences = snippet
    .replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi, '')
    .replace(/&lt;ref[\s\S]*?&lt;\/ref&gt;/gi, '');
  const decoded = cheerio.load(`<div>${withoutReferences}</div>`, null, false)('div').text();
  const plain = decoded
    .replace(/\[\[[^|\]]+\|([^\]]+)\]\]/g, '$1')
    .replace(/\[\[[^\]]+\]\]/g, '')
    .replace(/\bthumb\|/gi, '')
    .replace(/\b(?:right|left|center|none)\|/gi, '')
    .replace(/<\/?ref\b[^>]*>/gi, '')
    .replace(/index\.php\/\S+/gi, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const fields = [...plain.matchAll(/(?:^|\|)\s*([^=|]+?)\s*=\s*([^|]*)/g)]
    .map((match) => ({
      name: match[1].trim().toLowerCase(),
      value: match[2].trim(),
    }))
    .filter((field) => field.value);

  if (fields.length >= 2 || /^\s*\|/.test(plain)) {
    const preferred = ['caption', 'description', 'summary', 'intro', 'text'];
    const summary = preferred
      .map((name) => fields.find((field) => field.name === name)?.value)
      .find(Boolean);
    return (summary || '').replace(/\s+/g, ' ').trim();
  }

  return plain;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeAndTransformHtml(
  rawHtml: string,
  baseUrl: string,
  publicSiteUrl: string
): { bodyHtml: string; infoboxHtml: string | null } {
  const $ = cheerio.load(rawHtml, null, false);

  // Strip dangerous elements & MediaWiki edit chrome
  $('script, iframe, object, embed, noscript, .mw-editsection').remove();
  $('a').each((_, anchor) => {
    const $a = $(anchor);
    if (!/^Template:/i.test($a.text().trim())) return;
    const parent = $a.parent();
    if (parent.is('p') && parent.children().length === 1) parent.remove();
    else $a.remove();
  });
  $('*').contents().each((_, node) => {
    if (node.type !== 'text' || !node.data || !/\*\*[^*\n]+\*\*/.test(node.data)) return;
    const formatted = node.data.replace(/\*\*([^*\n]+)\*\*/g, (_match, text: string) => (
      `<strong>${escapeHtml(text)}</strong>`
    ));
    $(node).replaceWith(formatted);
  });
  $('*').each((_, el) => {
    const attribs = (el as unknown as { attribs?: Record<string, string> }).attribs;
    if (!attribs) return;
    for (const attr of Object.keys(attribs)) {
      if (attr.toLowerCase().startsWith('on')) {
        $(el).removeAttr(attr);
      }
    }
  });

  // Do not expose raw missing File: references to public readers.
  $('figure[typeof*="mw:Error"], span.mw-broken-media').each((_, el) => {
    const $el = $(el);
    const parentAnchor = $el.closest('a');
    if (parentAnchor.length) parentAnchor.remove();
    else $el.remove();
  });

  // Rewrite images & sources to load directly from MEDIAWIKI_BASE_URL
  $('img').each((_, img) => {
    const $img = $(img);
    const src = $img.attr('src');
    if (src) {
      const absoluteSrc = absolutizeAssetUrl(src, baseUrl);
      $img.attr('src', `${publicSiteUrl}/api/media?url=${encodeURIComponent(absoluteSrc)}`);
    }
    const srcset = $img.attr('srcset');
    if (srcset) {
      $img.attr('srcset', rewriteSrcSet(srcset, baseUrl, publicSiteUrl));
    }
    $img.attr('referrerpolicy', 'no-referrer');
    $img.attr('loading', 'lazy');
  });

  $('source').each((_, source) => {
    const $source = $(source);
    const srcset = $source.attr('srcset');
    if (srcset) {
      $source.attr('srcset', rewriteSrcSet(srcset, baseUrl, publicSiteUrl));
    }
  });

  // Rewrite links to stay inside headless app or route redlinks to /submit
  $('a').each((_, anchor) => {
    const $a = $(anchor);
    const href = $a.attr('href') || '';
    if (!href || href.startsWith('#')) {
      return;
    }

    // Keep redlinks inside the public reader; missing pages receive the normal 404 state.
    if ($a.hasClass('new') || href.includes('redlink=1')) {
      const titleMatch = href.match(/[?&]title=([^&]+)/);
      const missingTitle = titleMatch ? decodeURIComponent(titleMatch[1]).replace(/_/g, ' ') : $a.text().trim();
      $a.attr('href', `/wiki/${encodeURIComponent(titleToSlug(missingTitle))}`);
      $a.attr('data-redlink', 'true');
      $a.attr('title', `Article "${missingTitle}" is not published yet`);
      return;
    }

    // Handle Special: or File: links safely
    if (href.startsWith('/wiki/Special:') || href.startsWith('/index.php')) {
      $a.attr('href', absolutizeAssetUrl(href, baseUrl));
      $a.attr('target', '_blank');
      $a.attr('rel', 'noopener noreferrer');
      return;
    }

    // Internal /wiki/... links stay inside headless router
    if (href.startsWith('/wiki/')) {
      return;
    }

    // Same-host absolute links from en.bhikitia.org/wiki/... -> internal /wiki/...
    if (href.startsWith(`${baseUrl}/wiki/`)) {
      $a.attr('href', href.replace(baseUrl, ''));
      return;
    }

    // External links open safely in new tab
    if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('//')) {
      $a.attr('href', absolutizeAssetUrl(href, baseUrl));
      $a.attr('target', '_blank');
      $a.attr('rel', 'noopener noreferrer');
    }
  });

  // Extract the primary infobox table for Right Rail rendering
  let infoboxHtml: string | null = null;
  const firstInfobox = $('table.infobox').first();
  if (firstInfobox.length > 0) {
    infoboxHtml = $.html(firstInfobox);
    firstInfobox.remove();
  }

  return {
    bodyHtml: $.html(),
    infoboxHtml,
  };
}

interface CachedFetchInit extends RequestInit {
  next?: { revalidate?: number | false; tags?: string[] };
}

/**
 * Fetch with a hard timeout that never passes a `signal` to `fetch`.
 *
 * Why: in this Next.js version a request-scoped signal on the fetch options
 * makes the enclosing route render dynamically, which would cost us ISR and CDN
 * caching on every article page. Instead we race the request against a timer and
 * let the caller treat a timeout as an upstream failure
 * (`UpstreamFailureKind = 'timeout'`) so the stale-if-error path kicks in.
 * The abandoned request is bounded by our semaphore (at most N in flight) plus
 * undici's own socket timeouts, and its response is discarded.
 */
async function fetchWithTimeout(url: string, init: CachedFetchInit, timeoutMs: number): Promise<Response> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      const error = new Error(`MediaWiki request exceeded ${timeoutMs}ms`);
      error.name = 'TimeoutError';
      reject(error);
    }, timeoutMs);
  });
  try {
    return await Promise.race([fetch(url, init), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

class MediaWikiClient {
  /**
   * Reader-facing caches. Each entry has a fresh window plus a longer stale
   * window: on upstream failure the stale copy is served instead of an error
   * (stale-if-error), which is what keeps readers online during a MediaWiki
   * incident. All caches are size-bounded (LRU).
   */
  private articleCache = new TtlLru<WikiArticleResponse>(ARTICLE_CACHE_MAX);
  private searchCache = new TtlLru<WikiSearchResult[]>(SEARCH_CACHE_MAX);
  private portalCache = new TtlLru<unknown>(8);
  private sitemapCache = new TtlLru<string[]>(4);

  /** Coalesces concurrent identical misses into a single upstream call. */
  private articleInFlight = new SingleFlight();
  private searchInFlight = new SingleFlight();
  private portalInFlight = new SingleFlight();
  private sitemapInFlight = new SingleFlight();

  /** Deleted/unpublished titles must never be served from a stale copy. */
  private tombstones = new TtlLru<{ reason: string }>(TOMBSTONE_CACHE_MAX);

  private revalidatedSlugs = new Set<string>();

  /** Separate upstream budgets so search cannot crowd out article reads. */
  private articleLimiter = new Semaphore('article', ARTICLE_CONCURRENCY, QUEUE_LIMIT, QUEUE_WAIT_MS);
  private searchLimiter = new Semaphore('search', SEARCH_CONCURRENCY, QUEUE_LIMIT, QUEUE_WAIT_MS);

  /** Stops amplifying an outage: after N consecutive failures we fail fast. */
  private breaker = new CircuitBreaker('mediawiki', CIRCUIT_FAILURES, CIRCUIT_OPEN_MS);

  public stats() {
    return {
      breaker: {
        state: this.breaker.state,
        trips: this.breaker.tripCount,
        consecutiveFailures: this.breaker.failureCount,
      },
      articleBudget: {
        limit: this.articleLimiter.limitValue,
        active: this.articleLimiter.activeCount,
        queued: this.articleLimiter.queuedCount,
      },
      searchBudget: {
        limit: this.searchLimiter.limitValue,
        active: this.searchLimiter.activeCount,
        queued: this.searchLimiter.queuedCount,
      },
      caches: {
        articles: this.articleCache.size,
        searches: this.searchCache.size,
        tombstones: this.tombstones.size,
      },
      inFlight: {
        articles: this.articleInFlight.size,
        searches: this.searchInFlight.size,
        portal: this.portalInFlight.size,
        sitemap: this.sitemapInFlight.size,
      },
    };
  }

  /**
   * Single upstream entry point.
   *
   * - bounded by a per-kind semaphore (article/meta vs search),
   * - short-circuited by a circuit breaker while the origin is failing,
   * - hard timeout via AbortSignal (no unbounded waits),
   * - stored in the Next Data Cache (`force-cache` + revalidate + tags) so
   *   repeat reads and `revalidateTag` work without a second upstream call,
   * - **never retried**: a retry storm against a degraded origin is worse than
   *   serving a stale page, so the failure propagates and the caller falls back
   *   to cache/stale.
   */
  private async fetchApi<T>(
    params: Record<string, string>,
    options: {
      kind?: MediaWikiWorkKind;
      tags?: string[];
      revalidate?: number;
      timeoutMs?: number;
    } = {}
  ): Promise<T> {
    const kind: MediaWikiWorkKind = options.kind ?? 'meta';
    const config = getMediaWikiConfig();
    const url = new URL(config.apiUrl);
    url.searchParams.set('format', 'json');
    url.searchParams.set('formatversion', '2');
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }

    const action = params.action || 'unknown';
    const labels = { action, kind, edition: config.edition };

    if (!this.breaker.allow()) {
      increment('mediawiki.upstream.requests', { ...labels, result: 'circuit_open' });
      throw new MediaWikiUnavailableError(
        'MediaWiki is temporarily unavailable (circuit breaker open).',
        'circuit_open'
      );
    }

    const limiter = kind === 'search' ? this.searchLimiter : this.articleLimiter;
    const timeoutMs = options.timeoutMs ?? (kind === 'search' ? SEARCH_TIMEOUT_MS : MEDIAWIKI_TIMEOUT_MS);
    const startedAt = Date.now();

    if (limiter.queuedCount > 0) increment('mediawiki.upstream.queue_wait', labels);
    setGauge('mediawiki.inflight', limiter.activeCount, { kind });
    setGauge('mediawiki.queued', limiter.queuedCount, { kind });

    try {
      const data = await limiter.run(async () => {
        const init: CachedFetchInit = {
          headers: { Accept: 'application/json' },
          // Reader cookies/authorization are never forwarded: article and search
          // reads must be user-independent so shared caches stay shareable.
          //
          // `force-cache` is REQUIRED for ISR: a `no-store` fetch inside the
          // article route makes the whole route dynamic, which costs the route
          // cache and the CDN `s-maxage` — the two layers that actually absorb
          // 10k readers. Staleness is therefore bounded, not eliminated:
          //   - the webhook purges by tag + path on save/delete/unpublish,
          //   - anything it misses is refreshed within one `revalidate` window,
          //   - CDN copies need a platform purge on delete (documented in
          //     docs/performance-report.md).
          cache: 'force-cache',
          next: {
            revalidate: options.revalidate ?? Math.floor(ARTICLE_TTL_MS / 1000),
            tags: options.tags,
          },
          // NOTE: a request-scoped AbortSignal here makes the whole route
          // dynamic (no ISR/CDN cache), so the timeout is enforced by racing the
          // fetch against a timer instead. See `fetchWithTimeout` below.
        };
        const res = await time('mediawiki.upstream.latency', labels, () =>
          fetchWithTimeout(url.toString(), init, timeoutMs)
        );
        if (!res.ok) {
          throw new MediaWikiUnavailableError(`MediaWiki API returned HTTP ${res.status}.`, 'http');
        }
        return (await res.json()) as T;
      });

      this.breaker.onSuccess();
      setGauge('mediawiki.breaker_state', 0);
      increment('mediawiki.upstream.requests', { ...labels, result: 'ok' });
      observe('mediawiki.upstream.total', Date.now() - startedAt, labels);
      return data;
    } catch (error) {
      const throttled = error instanceof ThrottledError;
      const failureKind: UpstreamFailureKind = throttled
        ? 'throttled'
        : error instanceof MediaWikiUnavailableError
          ? error.kind
          : error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
            ? 'timeout'
            : 'network';

      const failure =
        error instanceof MediaWikiUnavailableError
          ? error
          : new MediaWikiUnavailableError(
              throttled
                ? 'MediaWiki request was shed to protect the origin.'
                : 'The MediaWiki service did not respond in time.',
              failureKind,
              error
            );

      increment('mediawiki.upstream.requests', { ...labels, result: failureKind });
      observe('mediawiki.upstream.total', Date.now() - startedAt, labels);

      if (!throttled) {
        const { opened } = this.breaker.onFailure();
        if (opened) {
          setGauge('mediawiki.breaker_state', 1);
          increment('mediawiki.breaker.trips');
          log.warn('mediawiki.circuit_open', { action, openMs: CIRCUIT_OPEN_MS, threshold: CIRCUIT_FAILURES });
        }
      }

      log.warn('mediawiki.upstream_failed', {
        action,
        kind,
        edition: config.edition,
        failure: failureKind,
        durationMs: Date.now() - startedAt,
        queued: limiter.queuedCount,
      });
      throw failure;
    }
  }

  /**
   * Purge in-process caches for one title (or everything) and return the Next
   * Data Cache tags the caller should pass to `revalidateTag` so shared caches
   * are dropped as well.
   */
  public revalidate(slug?: string): { cleared: string; tags: string[] } {
    const editionTags = [editionCacheTag()];
    if (slug && slug !== '*') {
      const normalized = normalizeSlug(slug);
      this.articleCache.delete(articleCacheKey(normalized));
      this.searchCache.clear();
      this.revalidatedSlugs.add(normalized);
      this.portalCache.clear();
      this.sitemapCache.clear();
      return { cleared: normalized, tags: [articleCacheTag(normalized), ...editionTags] };
    }
    this.articleCache.clear();
    this.searchCache.clear();
    this.portalCache.clear();
    this.sitemapCache.clear();
    this.revalidatedSlugs.add('*');
    return { cleared: 'all', tags: editionTags };
  }

  /**
   * Deletion/unpublish invalidation. Drops every cached copy and records a
   * tombstone so stale-if-error can never resurrect an article editors have
   * removed. The tombstone expires (default 10 min); after that a genuinely
   * missing title is re-confirmed upstream on the next read.
   */
  public markUnavailable(slug: string, reason = 'deleted'): { cleared: string; tags: string[] } {
    const normalized = normalizeSlug(slug);
    this.tombstones.set(articleCacheKey(normalized), { reason }, { ttlMs: TOMBSTONE_TTL_MS, staleMs: 0 });
    increment('mediawiki.tombstone', { reason });
    log.info('mediawiki.tombstone', { slug: normalized, reason, ttlMs: TOMBSTONE_TTL_MS });
    return this.revalidate(normalized);
  }

  public isTombstoned(slug: string): boolean {
    return Boolean(this.tombstones.peek(articleCacheKey(normalizeSlug(slug))));
  }

  /**
   * Reader-facing article lookup with explicit outcome states so pages can tell
   * a genuine 404 from an upstream failure:
   *
   *   ok          — fresh payload (in-process HIT or upstream MISS)
   *   stale       — last successful payload served while upstream is degraded
   *   missing     — MediaWiki says the page does not exist (real 404)
   *   unavailable — upstream failed and no cached copy exists
   *
   * Concurrent misses for the same title are coalesced into one upstream call.
   */
  public async lookupArticle(rawSlug: string, options: { fresh?: boolean } = {}): Promise<ArticleLookupResult> {
    const slug = normalizeSlug(rawSlug);

    // Deletion wins over stale-if-error.
    if (this.isTombstoned(slug)) {
      increment('mediawiki.article', { result: 'tombstoned' });
      return { state: 'missing', reason: 'unpublished' };
    }

    const cacheKey = articleCacheKey(slug);
    const cached = this.articleCache.get(cacheKey);

    if (cached && cached.freshUntil > Date.now() && !options.fresh) {
      increment('mediawiki.article', { result: 'hit' });
      return {
        state: 'ok',
        article: { ...cached.value, cacheStatus: 'HIT' },
        cacheStatus: 'HIT',
        ageMs: Date.now() - cached.storedAt,
      };
    }

    try {
      const article = await this.articleInFlight.run(cacheKey, () => this.loadArticleFromUpstream(slug));
      if (!article.exists) return { state: 'missing', article, cacheStatus: article.cacheStatus };
      increment('mediawiki.article', { result: 'miss' });
      return { state: 'ok', article, cacheStatus: article.cacheStatus, ageMs: 0 };
    } catch (error) {
      const failure = error as MediaWikiUnavailableError;
      increment('mediawiki.article', { result: 'upstream_error', failure: failure.kind });

      // Serve the last successful copy while the origin is degraded.
      const fallback = this.articleCache.peek(cacheKey);
      if (fallback && fallback.value.exists) {
        increment('mediawiki.article', { result: 'stale_fallback' });
        log.warn('mediawiki.article_stale_fallback', {
          slug,
          ageMs: Date.now() - fallback.storedAt,
          failure: failure.kind,
        });
        return {
          state: 'stale',
          article: { ...fallback.value, cacheStatus: 'STALE' },
          cacheStatus: 'STALE',
          ageMs: Date.now() - fallback.storedAt,
          reason: failure.kind,
        };
      }

      increment('mediawiki.article', { result: 'unavailable' });
      return { state: 'unavailable', reason: failure.kind };
    }
  }

  /**
   * Read path used by the API route and the legacy Express server: returns the
   * payload, throws while upstream is unavailable, and reports `exists: false`
   * for a real 404.
   */
  public async getArticle(rawSlug: string, bypassCache = false): Promise<WikiArticleResponse> {
    const result = await this.lookupArticle(rawSlug, { fresh: bypassCache });
    if (result.article) return result.article;
    if (result.state === 'missing') {
      const slug = normalizeSlug(rawSlug);
      const config = getMediaWikiConfig();
      const displayTitle = slug.replace(/_/g, ' ');
      return {
        exists: false,
        slug,
        title: displayTitle,
        displayTitle,
        canonicalUrl: `${config.publicSiteUrl}/wiki/${encodeURIComponent(slug)}`,
        editUrl: `${config.staffMediawikiUrl}/index.php?title=${encodeURIComponent(slug)}&action=edit`,
        sourceUrl: `${config.mediawikiBaseUrl}/wiki/${encodeURIComponent(slug)}`,
        sections: [],
        categories: [],
        langLinks: [],
        suggestions: [],
        cacheStatus: 'MISS',
        fetchedAt: new Date().toISOString(),
      };
    }
    throw new MediaWikiUnavailableError(
      'The MediaWiki service did not respond in time.',
      (result.reason as UpstreamFailureKind) || 'network'
    );
  }

  /** Fetch + transform one article. Always invoked through the single-flight map. */
  private async loadArticleFromUpstream(slug: string): Promise<WikiArticleResponse> {
    const { mediawikiBaseUrl, publicSiteUrl, staffMediawikiUrl } = getMediaWikiConfig();

    const wasRevalidated = this.revalidatedSlugs.has(slug) || this.revalidatedSlugs.has('*');
    if (wasRevalidated) {
      this.revalidatedSlugs.delete(slug);
    }

    interface ParseApiResponse {
      error?: { code: string; info: string };
      parse?: {
        title: string;
        pageid: number;
        revid: number;
        displaytitle?: string;
        text?: string;
        sections?: Array<{
          index: string;
          level: string;
          line: string;
          number: string;
          anchor: string;
        }>;
        categories?: Array<{ category: string; hidden?: boolean }>;
        langlinks?: Array<{ lang: string; autonym?: string; title: string; url?: string }>;
        redirects?: Array<{ from: string; to: string }>;
      };
    }

    interface RevisionsApiResponse {
      query?: {
        pages?: Array<{
          pageid?: number;
          title: string;
          missing?: boolean;
          revisions?: Array<{
            revid: number;
            user: string;
            timestamp: string;
          }>;
        }>;
      };
    }

    const parseData = await this.fetchApi<ParseApiResponse>(
      {
        action: 'parse',
        page: slug.replace(/_/g, ' '),
        prop: 'text|sections|displaytitle|revid|categories|langlinks',
        redirects: '1',
        disableeditsection: '1',
        disabletoc: '1',
      },
      {
        kind: 'article',
        revalidate: Math.floor(ARTICLE_TTL_MS / 1000),
        // Tag with the requested title (plus the edition tag) so the save/delete
        // webhook can purge the shared caches for exactly this article.
        tags: [articleCacheTag(slug), editionCacheTag()],
      }
    );

    if (parseData.error && !['missingtitle', 'invalidtitle'].includes(parseData.error.code)) {
      throw new MediaWikiUnavailableError('MediaWiki could not parse this article.', 'http');
    }
    if (!parseData.parse) {
      const displayTitle = slug.replace(/_/g, ' ');
      const missing: WikiArticleResponse = {
        exists: false,
        slug,
        title: displayTitle,
        displayTitle,
        canonicalUrl: `${publicSiteUrl}/wiki/${encodeURIComponent(slug)}`,
        editUrl: `${staffMediawikiUrl}/index.php?title=${encodeURIComponent(slug)}&action=edit`,
        sourceUrl: `${mediawikiBaseUrl}/wiki/${encodeURIComponent(slug)}`,
        sections: [],
        categories: [],
        langLinks: [],
        suggestions: [],
        cacheStatus: wasRevalidated ? 'REVALIDATED' : 'MISS',
        fetchedAt: new Date().toISOString(),
      };
      // Cache real 404s briefly: a long-tail crawl of missing titles must not
      // hammer MediaWiki, but a brand-new article must surface quickly (and the
      // publish webhook purges this entry immediately anyway).
      this.articleCache.set(articleCacheKey(slug), missing, {
        ttlMs: MISSING_TTL_MS,
        staleMs: 0,
      });
      increment('mediawiki.article', { result: 'missing' });
      return missing;
    }

    const parsed = parseData.parse;
    const canonicalSlug = titleToSlug(parsed.title);
    const redirectedFrom =
      parsed.redirects && parsed.redirects.length > 0 ? parsed.redirects[0].from : undefined;

    const { bodyHtml, infoboxHtml } = sanitizeAndTransformHtml(
      parsed.text || '',
      mediawikiBaseUrl,
      publicSiteUrl
    );

    const sections: WikiSection[] = (parsed.sections || []).map((s) => ({
      index: s.index,
      level: s.level,
      line: s.line.replace(/<[^>]+>/g, ''),
      number: s.number,
      anchor: s.anchor,
    }));

    const categories = (parsed.categories || [])
      .filter((c) => !c.hidden)
      .map((c) => c.category.replace(/_/g, ' '));

    const langLinks = (parsed.langlinks || []).map((l) => ({
      lang: l.lang,
      autonym: l.autonym || l.lang.toUpperCase(),
      title: l.title,
      url: l.url || `https://${l.lang}.bhikitia.org/wiki/${encodeURIComponent(titleToSlug(l.title))}`,
    }));

    // Public link back to the original article on the MediaWiki source wiki.
    const sourceUrl = `${mediawikiBaseUrl}/wiki/${encodeURIComponent(canonicalSlug)}`;
    // Only expose a revision link when MediaWiki returned a real revision id.
    const revisionUrl = parsed.revid
      ? `${mediawikiBaseUrl}/index.php?title=${encodeURIComponent(canonicalSlug)}&oldid=${parsed.revid}`
      : undefined;

    const result: WikiArticleResponse = {
      exists: true,
      slug: canonicalSlug,
      title: parsed.title,
      displayTitle: (parsed.displaytitle || parsed.title).replace(/<[^>]+>/g, ''),
      pageId: parsed.pageid,
      revId: parsed.revid,
      canonicalUrl: `${publicSiteUrl}/wiki/${encodeURIComponent(canonicalSlug)}`,
      editUrl: `${staffMediawikiUrl}/index.php?title=${encodeURIComponent(canonicalSlug)}&action=edit`,
      sourceUrl,
      revisionUrl,
      redirectedFrom,
      html: bodyHtml,
      infoboxHtml,
      sections,
      categories,
      langLinks,
      cacheStatus: wasRevalidated ? 'REVALIDATED' : 'MISS',
      fetchedAt: new Date().toISOString(),
    };

    // One entry holds the article HTML *and* its revision metadata (revId,
    // revisionUrl, lastModified, redirect target) because they come from the
    // same parse response: they can never diverge, and a revision can never be
    // shown alongside a different revision's body.
    const cacheOptions = { ttlMs: ARTICLE_TTL_MS, staleMs: ARTICLE_STALE_MS };
    this.articleCache.set(articleCacheKey(slug), result, cacheOptions);
    // Also store under the resolved canonical title so /wiki/REDIRECT and
    // /wiki/Canonical_Title share one entry.
    this.articleCache.set(articleCacheKey(canonicalSlug), result, cacheOptions);

    return result;
  }

  public async getArticleHistory(rawSlug: string): Promise<{
    title: string;
    slug: string;
    revisions: WikiRevision[];
  }> {
    const slug = normalizeSlug(rawSlug);
    interface HistoryResp {
      query?: {
        pages?: Array<{
          title: string;
          missing?: boolean;
          revisions?: WikiRevision[];
        }>;
      };
    }

    const data = await this.fetchApi<HistoryResp>({
      action: 'query',
      titles: slug.replace(/_/g, ' '),
      redirects: '1',
      prop: 'revisions',
      rvprop: 'ids|timestamp|user|comment|size',
      rvlimit: '20',
    });

    const page = data.query?.pages?.[0];
    return {
      title: page?.title || slug.replace(/_/g, ' '),
      slug: titleToSlug(page?.title || slug),
      revisions: page?.revisions || [],
    };
  }

  public async getArticleSource(rawSlug: string): Promise<{
    title: string;
    slug: string;
    wikitext: string;
    revid?: number;
  }> {
    const slug = normalizeSlug(rawSlug);
    interface SourceResp {
      query?: {
        pages?: Array<{
          title: string;
          missing?: boolean;
          revisions?: Array<{
            revid: number;
            slots?: { main?: { content?: string } };
          }>;
        }>;
      };
    }

    const data = await this.fetchApi<SourceResp>({
      action: 'query',
      titles: slug.replace(/_/g, ' '),
      redirects: '1',
      prop: 'revisions',
      rvprop: 'ids|content',
      rvslots: 'main',
      rvlimit: '1',
    });

    const page = data.query?.pages?.[0];
    const rev = page?.revisions?.[0];
    return {
      title: page?.title || slug.replace(/_/g, ' '),
      slug: titleToSlug(page?.title || slug),
      wikitext: rev?.slots?.main?.content || '',
      revid: rev?.revid,
    };
  }

  /**
   * Bounded, short-lived search cache with its own upstream budget.
   *
   * Keys are normalised (case + whitespace + limit + edition) and the cache is
   * size-bounded so a search-scraping crawler cannot exhaust memory. Repeated
   * queries are served from cache; on upstream failure the last result set is
   * served (short stale window) so autocomplete degrades quietly.
   */
  public async search(queryText: string, limit = 15): Promise<WikiSearchResult[]> {
    const q = queryText.trim().replace(/\s+/g, ' ');
    if (!q) return [];
    const { edition, lang } = getMediaWikiConfig();
    const cacheKey = `search:${edition}:${lang}:${limit}:${q.toLocaleLowerCase()}`;

    const cached = this.searchCache.get(cacheKey);
    if (cached && cached.freshUntil > Date.now()) {
      increment('mediawiki.search', { result: 'hit' });
      return cached.value;
    }

    interface SearchResp {
      query?: {
        search?: Array<{
          pageid: number;
          title: string;
          snippet: string;
          wordcount: number;
          timestamp: string;
        }>;
      };
    }

    try {
      return await this.searchInFlight.run(cacheKey, async () => {
        const data = await this.fetchApi<SearchResp>(
          {
            action: 'query',
            list: 'search',
            srsearch: q,
            srlimit: String(limit),
            srprop: 'snippet|wordcount|timestamp',
          },
          {
            kind: 'search',
            revalidate: Math.floor(SEARCH_TTL_MS / 1000),
            tags: [editionCacheTag()],
          }
        );

        const results = (data.query?.search || []).map((item) => ({
          pageid: item.pageid,
          title: item.title,
          slug: titleToSlug(item.title),
          snippet: cleanSearchSnippet(item.snippet),
          wordcount: item.wordcount,
          timestamp: item.timestamp,
        }));

        this.searchCache.set(cacheKey, results, { ttlMs: SEARCH_TTL_MS, staleMs: SEARCH_STALE_MS });
        increment('mediawiki.search', { result: 'miss', results: results.length });
        return results;
      });
    } catch (error) {
      const failure = error as MediaWikiUnavailableError;
      increment('mediawiki.search', { result: 'error', failure: failure.kind });
      const fallback = this.searchCache.peek(cacheKey);
      if (fallback) {
        increment('mediawiki.search', { result: 'stale_fallback' });
        return fallback.value;
      }
      throw failure;
    }
  }

  /**
   * Homepage portal payload. Cached for a short fresh window with a long stale
   * window (the homepage must never show an error page), coalesced so a traffic
   * spike produces one upstream pair, and served stale while upstream recovers.
   */
  public async getPortalData(): Promise<unknown> {
    const cacheKey = `portal:${editionCacheTag()}`;
    const cached = this.portalCache.get(cacheKey);
    if (cached && cached.freshUntil > Date.now()) {
      increment('mediawiki.portal', { result: 'hit' });
      return cached.value;
    }

    interface SiteInfoResp {
      query?: {
        general?: {
          sitename: string;
          generator: string;
          logo: string;
          lang: string;
          timezone: string;
          server: string;
          articlepath: string;
          scriptpath: string;
        };
        statistics?: {
          pages: number;
          articles: number;
          edits: number;
          images: number;
          users: number;
          activeusers: number;
          admins: number;
        };
      };
    }

    interface RecentResp {
      query?: {
        recentchanges?: Array<{
          rcid: number;
          title: string;
          user: string;
          timestamp: string;
          comment: string;
          type: string;
          newlen: number;
          oldlen: number;
        }>;
      };
    }

    const load = this.portalInFlight.run(cacheKey, async () => {
      const portalFetchOptions = {
        kind: 'meta' as MediaWikiWorkKind,
        revalidate: Math.floor(PORTAL_TTL_MS / 1000),
        tags: [editionCacheTag()],
      };
      const [siteInfo, recent] = await Promise.all([
        this.fetchApi<SiteInfoResp>(
          {
            action: 'query',
            meta: 'siteinfo',
            siprop: 'general|statistics',
          },
          portalFetchOptions
        ),
        this.fetchApi<RecentResp>(
          {
            action: 'query',
            list: 'recentchanges',
            rcnamespace: '0',
            rclimit: '8',
            rcprop: 'title|ids|sizes|user|timestamp|comment',
          },
          portalFetchOptions
        ),
      ]);

      // Curated homepage allowlist, shared with the homepage fallback UI so the
      // portal response and the fallback never diverge.
      const featuredEntries = HOMEPAGE_FEATURED_ENTRIES.map((entry) => ({ ...entry }));

      const payload = {
        siteInfo: siteInfo.query?.general || null,
        statistics: siteInfo.query?.statistics || null,
        recentChanges: (recent.query?.recentchanges || []).map((rc) => ({
          ...rc,
          slug: titleToSlug(rc.title),
        })),
        featuredEntries,
        config: getMediaWikiConfig(),
        fetchedAt: new Date().toISOString(),
      };

      this.portalCache.set(cacheKey, payload, { ttlMs: PORTAL_TTL_MS, staleMs: PORTAL_STALE_MS });
      increment('mediawiki.portal', { result: 'miss' });
      return payload;
    });

    try {
      return await load;
    } catch (error) {
      const failure = error as MediaWikiUnavailableError;
      increment('mediawiki.portal', { result: 'error', failure: failure.kind });
      const fallback = this.portalCache.peek(cacheKey);
      if (fallback) {
        increment('mediawiki.portal', { result: 'stale_fallback' });
        log.warn('mediawiki.portal_stale_fallback', { failure: failure.kind });
        return fallback.value;
      }
      throw failure;
    }
  }

  /**
   * Article list for the sitemap: long fresh window, long stale window, single
   * flight, and never an error (an outage returns the previous list or an empty
   * list, which the route already treats as "static entries only").
   */
  public async getSitemapSlugs(): Promise<string[]> {
    const cacheKey = `sitemap:${editionCacheTag()}`;
    const cached = this.sitemapCache.get(cacheKey);
    if (cached && cached.freshUntil > Date.now()) {
      increment('mediawiki.sitemap', { result: 'hit' });
      return cached.value;
    }

    interface AllPagesResp {
      continue?: { apcontinue?: string };
      query?: {
        allpages?: Array<{ pageid: number; title: string }>;
      };
    }

    const load = this.sitemapInFlight.run(cacheKey, async () => {
      // MediaWiki returns at most 500 rows per `allpages` request, so page
      // through `apcontinue` until the public namespace-0 corpus is covered:
      // the first 250 titles alone are not a usable sitemap for this wiki.
      const slugs: string[] = [];
      const seen = new Set<string>();
      let apcontinue: string | undefined;

      for (let request = 0; request < SITEMAP_MAX_REQUESTS; request += 1) {
        let data: AllPagesResp | undefined;
        try {
          data = await this.fetchApi<AllPagesResp>(
            {
              action: 'query',
              list: 'allpages',
              apnamespace: '0',
              apfilterredir: 'nonredirects',
              aplimit: '500',
              ...(apcontinue ? { apcontinue } : {}),
            },
            {
              kind: 'meta',
              revalidate: Math.floor(SITEMAP_TTL_MS / 1000),
              tags: [editionCacheTag()],
            }
          );
        } catch (error) {
          // Keep whatever has already been collected: a slow wiki that times out
          // mid-pagination must still produce a usable sitemap. Only a failed
          // *first* request is escalated, so the caller can fall back to the
          // previously cached list instead of publishing an almost-empty one.
          if (slugs.length === 0) throw error;
          increment('mediawiki.sitemap', { result: 'partial', pages: slugs.length, request });
          break;
        }
        if (!data) break;

        for (const page of data.query?.allpages || []) {
          const slug = titleToSlug(page.title);
          if (seen.has(slug)) continue;
          seen.add(slug);
          slugs.push(slug);
        }

        apcontinue = data.continue?.apcontinue;
        if (!apcontinue) break;
      }
      this.sitemapCache.set(cacheKey, slugs, { ttlMs: SITEMAP_TTL_MS, staleMs: SITEMAP_STALE_MS });
      increment('mediawiki.sitemap', { result: 'miss', pages: slugs.length });
      return slugs;
    });

    try {
      return await load;
    } catch (error) {
      const failure = error as MediaWikiUnavailableError;
      increment('mediawiki.sitemap', { result: 'error', failure: failure.kind });
      const fallback = this.sitemapCache.peek(cacheKey);
      if (fallback) {
        increment('mediawiki.sitemap', { result: 'stale_fallback' });
        return fallback.value;
      }
      throw failure;
    }
  }

  public async runHostingAudit() {
    const config = getMediaWikiConfig();

    const probeHost = async (url: string) => {
      try {
        const res = await fetch(url, {
          method: 'HEAD',
          redirect: 'manual',
          signal: AbortSignal.timeout(4500),
        });
        return {
          reachable: true,
          status: res.status,
          server: res.headers.get('server'),
          location: res.headers.get('location'),
        };
      } catch (err) {
        return {
          reachable: false,
          status: null,
          server: null,
          error: err instanceof Error ? err.message : 'Host unreachable / DNS not configured',
        };
      }
    };

    const [siteInfoRes, enProbe, rootProbe, bnProbe, editProbe] = await Promise.all([
      this.fetchApi<{
        query?: {
          general?: Record<string, unknown>;
          statistics?: Record<string, number>;
        };
      }>({
        action: 'query',
        meta: 'siteinfo',
        siprop: 'general|statistics',
      }).catch((err) => ({ error: err instanceof Error ? err.message : 'API check failed' })),
      probeHost(config.publicSiteUrl),
      probeHost(config.publicSiteUrl),
      probeHost(config.publicSiteUrl),
      probeHost(config.staffMediawikiUrl),
    ]);

    return {
      checkedAt: new Date().toISOString(),
      config: {
        mediawikiBaseUrl: config.mediawikiBaseUrl,
        apiUrl: config.apiUrl,
        publicSiteUrl: config.publicSiteUrl,
        staffMediawikiUrl: config.staffMediawikiUrl,
        scriptPath: config.scriptPath === '' ? '"" (root)' : config.scriptPath,
      },
      mediawikiSiteInfo: 'query' in siteInfoRes ? siteInfoRes.query : null,
      hostProbes: {
        en: enProbe,
        root: rootProbe,
        bn: bnProbe,
        edit: editProbe,
      },
      cacheStats: {
        cachedArticles: this.articleCache.size,
        ttlSeconds: ARTICLE_TTL_MS / 1000,
      },
    };
  }
}

export const mediawikiClient = new MediaWikiClient();
