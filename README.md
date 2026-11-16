# Bhikitia

Bhikitia is a Next.js App Router public encyclopedia backed by MediaWiki. The
public site is read-only; editing, accounts, uploads, templates, and revisions
remain in MediaWiki.

## Required environment

Copy `.env.example` to `.env.local` and provide:

- `MEDIAWIKI_BASE_URL`: server-only MediaWiki origin, without a trailing slash.
- `PUBLIC_SITE_URL`: canonical public origin (production is `https://en.bhikitia.org`).
- `STAFF_MEDIAWIKI_URL`: authenticated editor origin, kept out of indexing.
- `ADMIN_PASSCODE`: a long random staff-console secret.
- `REVALIDATION_SECRET`: secret for a trusted MediaWiki save webhook.
- `WHATSAPP_DESK_NUMBER` and `EDITORIAL_EMAIL`: editorial desk contacts.

Production must not use the example values or a demo MediaWiki endpoint.

## Development and deployment

```bash
npm install
npm run lint
npm run build
npm run start
```

Deploy the generated Next.js application with the same environment variables.
Configure the MediaWiki save/delete hook to call `POST /api/revalidate` with the
revalidation secret (see "Caching, invalidation and load behaviour" below).

## Caching, invalidation and load behaviour

The public app is designed to sit behind a CDN; see
[docs/performance-report.md](docs/performance-report.md) for the full audit,
measurements and deployment requirements. Summary:

- Homepage and `/search` shells are prerendered (`s-maxage=31536000`); article
  pages are ISR (`revalidate = 60`, `s-maxage=60, stale-while-revalidate=86340`);
  `/api/wiki/portal` and `/api/wiki/search` are publicly cacheable for 60 s;
  `/sitemap.xml` and `/robots.txt` are ISR.
- Article content and its revision metadata are cached together, keyed by
  `edition:lang:canonical title`, with coalesced upstream reads, per-kind
  concurrency budgets, bounded queues, timeouts, no retries and a circuit
  breaker. During an upstream failure readers get the last successful copy
  (stale-if-error) or a graceful unavailable page — an outage is never reported
  as a 404.
- Invalidate on publish/delete:

  ```bash
  curl -X POST https://en.bhikitia.org/api/revalidate \
    -H 'content-type: application/json' \
    -d '{"secret":"REVALIDATION_SECRET_VALUE","slug":"Nelson_Mandela","event":"save"}'
  # event: save | delete | unpublish   (delete/unpublish also tombstones the title)
  ```

  A CDN purge must accompany delete/unpublish: `revalidateTag`/`revalidatePath`
  clear the Next.js caches but not edge copies.
- Readers can retry a stale or unavailable article without a cache-busting query
  parameter: the page calls `POST /api/wiki/refresh?slug=…`, which purges that
  article and re-reads MediaWiki once.
- Metrics: `GET /api/metrics` (JSON, includes per-budget and cache state) and
  `GET /api/metrics?format=prometheus`. Structured JSON logs go to stdout.

Load and resilience tooling lives in [loadtest/](loadtest/): a local MediaWiki
mock (never load-test the live wiki), a k6 suite for staging, a dependency-free
smoke harness and behaviour assertions.


The public app permanently redirects `/wiki/Main_Page` to `/`. Other article
paths remain `/wiki/<title>`. MediaWiki's editor origin should independently
restrict access to staff and return `X-Robots-Tag: noindex, nofollow`; DNS and
server configuration are intentionally not changed by this repository.

Live article, search, webhook, and editor-origin checks require the production
values above and were not claimed when those values were unavailable.
