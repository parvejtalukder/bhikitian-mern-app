import * as cheerio from 'cheerio';
import type {
  WikiArticleResponse,
  WikiRevision,
  WikiSearchResult,
  WikiSection,
} from './types.ts';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  cachedAt: string;
}

const ARTICLE_TTL_MS = 30 * 60 * 1000; // 30 minutes (purged immediately via /api/revalidate)
const PORTAL_TTL_MS = 10 * 60 * 1000; // 10 minutes
const SITEMAP_TTL_MS = 30 * 60 * 1000; // 30 minutes

export function getMediaWikiConfig() {
  const mediawikiBaseUrl = (process.env.MEDIAWIKI_BASE_URL || 'https://en.bhikitia.org').replace(/\/+$/, '');
  const publicSiteUrl = (process.env.PUBLIC_SITE_URL || 'https://en.bhikitia.org').replace(/\/+$/, '');
  const staffMediawikiUrl = (process.env.STAFF_MEDIAWIKI_URL || 'https://edit.bhikitia.org').replace(/\/+$/, '');
  const scriptPath = (process.env.MEDIAWIKI_SCRIPT_PATH ?? '').replace(/\/+$/, '');
  return {
    mediawikiBaseUrl,
    publicSiteUrl,
    staffMediawikiUrl,
    scriptPath,
    apiUrl: `${mediawikiBaseUrl}${scriptPath}/api.php`,
  };
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
    return `https:${url}`;
  }
  if (url.startsWith('/')) {
    return `${baseUrl}${url}`;
  }
  return `${baseUrl}/${url}`;
}

function rewriteSrcSet(srcset: string, baseUrl: string): string {
  return srcset
    .split(',')
    .map((part) => {
      const trimmed = part.trim();
      if (!trimmed) return '';
      const [urlPart, descriptor] = trimmed.split(/\s+/, 2);
      const abs = absolutizeAssetUrl(urlPart, baseUrl);
      return descriptor ? `${abs} ${descriptor}` : abs;
    })
    .filter(Boolean)
    .join(', ');
}

function sanitizeAndTransformHtml(
  rawHtml: string,
  baseUrl: string
): { bodyHtml: string; infoboxHtml: string | null } {
  const $ = cheerio.load(rawHtml, null, false);

  // Strip dangerous elements & MediaWiki edit chrome
  $('script, iframe, object, embed, noscript, .mw-editsection').remove();
  $('*').each((_, el) => {
    const attribs = (el as unknown as { attribs?: Record<string, string> }).attribs;
    if (!attribs) return;
    for (const attr of Object.keys(attribs)) {
      if (attr.toLowerCase().startsWith('on')) {
        $(el).removeAttr(attr);
      }
    }
  });

  // Convert broken MediaWiki media placeholders into clean non-upload UI pills
  $('figure[typeof*="mw:Error"], span.mw-broken-media').each((_, el) => {
    const $el = $(el);
    if ($el.is('figure')) {
      const label = $el.find('.mw-broken-media').text().trim() || $el.find('figcaption').text().trim() || 'Media unavailable';
      $el.replaceWith(
        `<div class="my-3"><span class="mw-broken-media-pill" title="File missing in MediaWiki repository">${cheerio.load('')('<span>').text(label).html()}</span></div>`
      );
    } else {
      const text = $el.text().trim() || 'Media unavailable';
      const parentAnchor = $el.closest('a');
      if (parentAnchor.length) {
        parentAnchor.replaceWith(`<span class="mw-broken-media-pill">${text}</span>`);
      }
    }
  });

  // Rewrite images & sources to load directly from MEDIAWIKI_BASE_URL
  $('img').each((_, img) => {
    const $img = $(img);
    const src = $img.attr('src');
    if (src) {
      $img.attr('src', absolutizeAssetUrl(src, baseUrl));
    }
    const srcset = $img.attr('srcset');
    if (srcset) {
      $img.attr('srcset', rewriteSrcSet(srcset, baseUrl));
    }
    $img.attr('referrerpolicy', 'no-referrer');
    $img.attr('loading', 'lazy');
  });

  $('source').each((_, source) => {
    const $source = $(source);
    const srcset = $source.attr('srcset');
    if (srcset) {
      $source.attr('srcset', rewriteSrcSet(srcset, baseUrl));
    }
  });

  // Rewrite links to stay inside headless app or route redlinks to /submit
  $('a').each((_, anchor) => {
    const $a = $(anchor);
    const href = $a.attr('href') || '';
    if (!href || href.startsWith('#')) {
      return;
    }

    // Handle MediaWiki redlinks (/index.php?title=...&action=edit&redlink=1)
    if ($a.hasClass('new') || href.includes('redlink=1')) {
      const titleMatch = href.match(/[?&]title=([^&]+)/);
      const missingTitle = titleMatch ? decodeURIComponent(titleMatch[1]).replace(/_/g, ' ') : $a.text().trim();
      $a.attr('href', `/submit?title=${encodeURIComponent(missingTitle)}`);
      $a.attr('data-redlink', 'true');
      $a.attr('title', `Article "${missingTitle}" does not exist yet — click to request it`);
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

class MediaWikiClient {
  private articleCache = new Map<string, CacheEntry<WikiArticleResponse>>();
  private portalCache: CacheEntry<unknown> | null = null;
  private sitemapCache: CacheEntry<string[]> | null = null;
  private revalidatedSlugs = new Set<string>();

  private async fetchApi<T>(params: Record<string, string>): Promise<T> {
    const { apiUrl } = getMediaWikiConfig();
    const url = new URL(apiUrl);
    url.searchParams.set('format', 'json');
    url.searchParams.set('formatversion', '2');
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }

    const res = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(45000),
    });

    if (!res.ok) {
      throw new Error(`MediaWiki API HTTP ${res.status} from ${apiUrl}`);
    }
    return (await res.json()) as T;
  }

  public revalidate(slug?: string): { cleared: string } {
    if (slug && slug !== '*') {
      const normalized = normalizeSlug(slug);
      this.articleCache.delete(normalized);
      this.revalidatedSlugs.add(normalized);
      this.portalCache = null;
      this.sitemapCache = null;
      return { cleared: normalized };
    }
    this.articleCache.clear();
    this.portalCache = null;
    this.sitemapCache = null;
    this.revalidatedSlugs.add('*');
    return { cleared: 'all' };
  }

  public async getArticle(rawSlug: string, bypassCache = false): Promise<WikiArticleResponse> {
    const slug = normalizeSlug(rawSlug);
    const { mediawikiBaseUrl, publicSiteUrl, staffMediawikiUrl } = getMediaWikiConfig();

    const cached = this.articleCache.get(slug);
    if (!bypassCache && cached && cached.expiresAt > Date.now()) {
      return {
        ...cached.value,
        cacheStatus: 'HIT',
      };
    }

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

    const parseData = await this.fetchApi<ParseApiResponse>({
      action: 'parse',
      page: slug.replace(/_/g, ' '),
      prop: 'text|sections|displaytitle|revid|categories|langlinks',
      redirects: '1',
      disableeditsection: '1',
      disabletoc: '1',
    });

    if (parseData.error || !parseData.parse) {
      const displayTitle = slug.replace(/_/g, ' ');
      const suggestions = await this.search(displayTitle, 5).catch(() => []);
      return {
        exists: false,
        slug,
        title: displayTitle,
        displayTitle,
        canonicalUrl: `${publicSiteUrl}/wiki/${encodeURIComponent(slug)}`,
        editUrl: `${staffMediawikiUrl}/index.php?title=${encodeURIComponent(slug)}&action=edit`,
        sections: [],
        categories: [],
        langLinks: [],
        suggestions: suggestions.map((s) => ({
          title: s.title,
          slug: s.slug,
          snippet: s.snippet,
        })),
        cacheStatus: 'MISS',
        fetchedAt: new Date().toISOString(),
      };
    }

    const parsed = parseData.parse;
    const canonicalSlug = titleToSlug(parsed.title);
    const redirectedFrom =
      parsed.redirects && parsed.redirects.length > 0 ? parsed.redirects[0].from : undefined;

    const { bodyHtml, infoboxHtml } = sanitizeAndTransformHtml(
      parsed.text || '',
      mediawikiBaseUrl
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

    const result: WikiArticleResponse = {
      exists: true,
      slug: canonicalSlug,
      title: parsed.title,
      displayTitle: (parsed.displaytitle || parsed.title).replace(/<[^>]+>/g, ''),
      pageId: parsed.pageid,
      revId: parsed.revid,
      canonicalUrl: `${publicSiteUrl}/wiki/${encodeURIComponent(canonicalSlug)}`,
      editUrl: `${staffMediawikiUrl}/index.php?title=${encodeURIComponent(canonicalSlug)}&action=edit`,
      redirectedFrom,
      html: bodyHtml,
      infoboxHtml,
      sections,
      categories,
      langLinks,
      cacheStatus: wasRevalidated ? 'REVALIDATED' : 'MISS',
      fetchedAt: new Date().toISOString(),
    };

    const entry: CacheEntry<WikiArticleResponse> = {
      value: result,
      expiresAt: Date.now() + ARTICLE_TTL_MS,
      cachedAt: result.fetchedAt,
    };
    this.articleCache.set(slug, entry);
    this.articleCache.set(canonicalSlug, entry);

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

  public async search(queryText: string, limit = 15): Promise<WikiSearchResult[]> {
    const q = queryText.trim();
    if (!q) return [];

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

    const data = await this.fetchApi<SearchResp>({
      action: 'query',
      list: 'search',
      srsearch: q,
      srlimit: String(limit),
      srprop: 'snippet|wordcount|timestamp',
    });

    return (data.query?.search || []).map((item) => ({
      pageid: item.pageid,
      title: item.title,
      slug: titleToSlug(item.title),
      snippet: item.snippet.replace(/<[^>]+>/g, ''),
      wordcount: item.wordcount,
      timestamp: item.timestamp,
    }));
  }

  public async getPortalData() {
    if (this.portalCache && this.portalCache.expiresAt > Date.now()) {
      return this.portalCache.value;
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

    const [siteInfo, recent] = await Promise.all([
      this.fetchApi<SiteInfoResp>({
        action: 'query',
        meta: 'siteinfo',
        siprop: 'general|statistics',
      }),
      this.fetchApi<RecentResp>({
        action: 'query',
        list: 'recentchanges',
        rcnamespace: '0',
        rclimit: '8',
        rcprop: 'title|ids|sizes|user|timestamp|comment',
      }),
    ]);

    const featuredEntries = [
      {
        title: 'A. K. Fazlul Huq',
        slug: 'A._K._Fazlul_Huq',
        category: 'Biography · History of Bengal',
        excerpt: 'Renowned Bengali lawyer, writer, and statesman known as Sher-e-Bangla who served as Prime Minister of undivided Bengal and Chief Minister of East Bengal.',
      },
      {
        title: '2024 Interim government of Bangladesh',
        slug: '2024_Interim_government_of_Bangladesh',
        category: 'Governance · Contemporary Politics',
        excerpt: 'Constitutional transition, advisory council composition, and institutional reform commissions formed in Dhaka in August 2024.',
      },
      {
        title: '2018 Bangladesh quota reform protests',
        slug: '2018_Bangladesh_quota_reform_protests',
        category: 'Civic Movements · Public Policy',
        excerpt: 'Nationwide university student mobilization advocating merit-based civil service reform and quota restructuring across Bangladesh.',
      },
      {
        title: '2026 SAFF Championship',
        slug: '2026_SAFF_Championship',
        category: 'Sports · South Asia',
        excerpt: 'Biennial international men’s football championship organized by the South Asian Football Federation.',
      },
    ];

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

    this.portalCache = {
      value: payload,
      expiresAt: Date.now() + PORTAL_TTL_MS,
      cachedAt: payload.fetchedAt,
    };

    return payload;
  }

  public async getSitemapSlugs(): Promise<string[]> {
    if (this.sitemapCache && this.sitemapCache.expiresAt > Date.now()) {
      return this.sitemapCache.value;
    }

    interface AllPagesResp {
      query?: {
        allpages?: Array<{ pageid: number; title: string }>;
      };
    }

    const data = await this.fetchApi<AllPagesResp>({
      action: 'query',
      list: 'allpages',
      apnamespace: '0',
      apfilterredir: 'nonredirects',
      aplimit: '250',
    });

    const slugs = (data.query?.allpages || []).map((p) => titleToSlug(p.title));
    this.sitemapCache = {
      value: slugs,
      expiresAt: Date.now() + SITEMAP_TTL_MS,
      cachedAt: new Date().toISOString(),
    };
    return slugs;
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
      probeHost('https://en.bhikitia.org'),
      probeHost('https://bhikitia.org'),
      probeHost('https://bn.bhikitia.org'),
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
