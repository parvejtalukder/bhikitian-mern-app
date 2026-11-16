# Bhikitia performance & resilience report (10k concurrent readers)

Scope: make the public encyclopedia survive ~10,000 concurrent readers (≈500 page
requests/s before search, autocomplete and assets) while MediaWiki stays the
editorial source of truth. Written against the local checkout on branch `main`
(`798c812`, the older Vite/Express stack) — the Next.js app itself is uncommitted
local work and was preserved and extended, not replaced.

Environment verified before editing: `main`, Next.js **16.4.6** (Turbopack), Node
26, `npm run lint` = `tsc --noEmit`, no k6/Docker available locally, `AGENTS.md`
present and read (Next.js docs consulted for the caching model in use).

---

## 1. MediaWiki integration trace (before this change)

| Path | Source | Made by | Upstream calls per interaction | Cache key / TTL | Timeout | Retry | Failure handling |
|---|---|---|---|---|---|---|---|
| `/` homepage | `src/app/[[...path]]/page.tsx` → `src/App.tsx` → `src/legacy-pages/HomePage.tsx` | browser (`fetch('/api/wiki/portal')`) → server route handler | 2 (`siteinfo` + `recentchanges`), only on a portal cache miss | in-process `portalCache`, 10 min, key `portal` | 20 s (`AbortSignal.timeout`) | none | 502 to the browser; homepage falls back to the curated allowlist |
| article page `/wiki/<slug>` | `src/app/wiki/[...slug]/page.tsx` → `server/mediawikiClient.getArticle` | **server** (route was `force-dynamic`) | 1 `action=parse` per render, every render | `articleCache` keyed by requested slug **and** canonical slug, 30 min | 20 s | none | page rendered "Encyclopedia unavailable" (200) on failure |
| `/api/wiki/article` | `src/app/api/[...segments]/route.ts` | server (staff/tools) | 1 `action=parse` | same in-process cache | 20 s | none | 502 |
| `/search` + autocomplete | `src/components/SearchBar.tsx`, `src/legacy-pages/SearchPage.tsx` → `/api/wiki/search` | browser → server | 1 `action=query&list=search` per debounced query | `searchCache` keyed `"<q>::<limit>"`, 60 s; single-flight existed | 20 s | none | 502 (client shows a neutral message) |
| `/sitemap.xml` | `src/app/sitemap.ts` | server, every request (`force-dynamic`) | 1 `list=allpages` per request on a cold cache | `sitemapCache`, 30 min | 20 s | none | swallows errors, emits static entries |
| `/robots.txt` | `src/app/robots.ts` | server | none | none | – | – | – |
| images | `/api/media` | browser → server → MediaWiki | 1 per unique image (proxied) | `Cache-Control: max-age=86400` on the response | 20 s | none | upstream status passthrough |

Verified response headers of the **pre-change production build** (`next start`
on a spare port):

```
/                     Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate
/wiki/Nelson_Mandela  Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate
/api/wiki/portal      (no Cache-Control at all)
/api/wiki/search      (no Cache-Control at all)
/sitemap.xml          Cache-Control: public, max-age=0, must-revalidate
```

### Bottlenecks found

1. **Nothing was cacheable.** Every route was `private, no-cache, no-store`, so
   *every* reader hit this origin; a CDN could absorb none of it.
2. **Article renders were uncached** (`force-dynamic` + no `generateStaticParams`),
   i.e. one MediaWiki parse per reader page view.
3. **The only write-path invalidation was a module-level `Map` plus a
   `revalidatedSlugs` set** — per process, and `revalidate(tag)` did not exist in
   the Next app at all (the documented `POST /api/revalidate` webhook lived only
   in the unused `server.ts` Express app).
4. **No global upstream concurrency bound.** A burst of distinct cold articles
   translated 1:1 into MediaWiki requests with no ceiling.
5. **Article cache misses were not coalesced** (only search was), so 100 readers
   of one cold article meant up to 100 upstream parses.
6. **No circuit breaker, no stale-if-error.** Any MediaWiki hiccup turned
   directly into reader-facing errors, and every retry amplified the outage.
7. **Search and article traffic shared one budget-less path**, so an
   autocomplete storm could consume all upstream capacity.
8. **Metrics were ad-hoc `console.info` lines** with no cache-hit/miss or
   upstream-rate visibility.
9. **Deletions could not be invalidated** (no webhook in the Next app, no
   tombstone, no CDN story).

---

## 2. What changed (and which layer protects what)

Defence in depth, cheapest layer first:

| Layer | Mechanism | Scope | What it absorbs |
|---|---|---|---|
| 1. CDN / shared HTTP cache | `s-maxage` + `stale-while-revalidate` on every public response (`expireTime: 86400`) | shared across replicas | **almost everything** at 10k readers/s |
| 2. Next.js full-route cache (ISR) | `revalidate = 60` + `generateStaticParams()` on `/wiki/[...slug]`; prerendered `/`, `/search`, `/wiki` shells | per replica (Vercel: shared) | all article views between regenerations |
| 3. Next.js Data Cache | `fetch(..., { cache: 'force-cache', next: { revalidate, tags } })` | per replica (Vercel: shared) | repeated portal/search/sitemap reads |
| 4. In-process cache | `TtlLru` with fresh + longer stale window, keyed `article:<edition>:<lang>:<canonicalSlug>` | per replica | repeat reads in a worker; stale-if-error source |
| 5. Single-flight | `SingleFlight` (article/search/portal/sitemap) | per replica | thundering herd on cold keys |
| 6. Concurrency budgets | separate `Semaphore` for article/meta (`MEDIAWIKI_MAX_CONCURRENCY`, default 8) and search (`MEDIAWIKI_SEARCH_CONCURRENCY`, default 4), bounded queue + bounded wait | per replica | upstream spikes; search cannot crowd out reads |
| 7. Circuit breaker | trips after `MEDIAWIKI_CIRCUIT_FAILURES` (5) consecutive failures, open for `MEDIAWIKI_CIRCUIT_OPEN_MS` (10 s) | per replica | retry/queue amplification during an outage |
| 8. Timeouts | bounded wait, **no retries** (race-based timeout so the route stays ISR-eligible) | per replica | stuck sockets; a slow origin never hangs a reader |

Concrete details:

- **CDN eligibility.** `/`, `/search`, `/wiki` are prerendered static
  (`s-maxage=31536000`); article pages are ISR
  (`s-maxage=60, stale-while-revalidate=86340`); `/api/wiki/portal`
  `s-maxage=60`; `/api/wiki/search` `max-age=30, s-maxage=60`; `/sitemap.xml`
  ISR 30 min; `/robots.txt` ISR 1 h.
- **ISR needs two things that are easy to miss in this version** (from the bundled
  docs, confirmed by build output and real headers):
  1. `generateStaticParams()` must exist on a dynamic route — **an empty array is
     enough** — otherwise the route renders fully dynamically and sends
     `private, no-cache, no-store`.
  2. **No `AbortSignal` on the fetch**: a request-scoped signal makes the route
     dynamic again. The timeout is therefore a race between the fetch and a timer
     (`fetchWithTimeout`), which keeps ISR and still bounds the reader wait.
- **Article content + revision metadata in one entry.** Both come from the single
  `action=parse` response (`revid`, `oldid` URL, `displayTitle`, redirect target,
  section anchors), so they can never diverge and a revision link can never sit
  next to a different revision's body. Entries are stored under the requested
  *and* the resolved canonical title so `/wiki/REDIRECT` and
  `/wiki/Canonical_Title` share one entry.
- **Edition/language in keys.** Keys and Next cache tags are namespaced
  `…:<edition>:<lang>:…` (edition derived from the MediaWiki hostname, overridable
  with `MEDIAWIKI_EDITION`/`MEDIAWIKI_LANG`).
- **No user-specific data in shared caches.** Article/search/portal fetches send
  only `Accept: application/json` — reader cookies and authorization headers are
  never forwarded — and `getPortalData` no longer returns the server-only `config`
  block to browsers.
- **Stale-if-error.** Every cache entry has `freshUntil` (serve) and `staleUntil`
  (serve only while upstream is failing, default 24 h). On failure the last
  successful public article is served and the page shows a "last saved copy"
  banner with a *Check again* button; the API marks it `cacheStatus: "STALE"` and
  sends `Cache-Control: no-store` so a stale copy is never re-cached as fresh.
- **Real 404 vs upstream failure.** `lookupArticle` returns
  `ok | stale | missing | unavailable`; a genuine MediaWiki `missingtitle` is a
  **404** (cached 60 s so crawlers cannot hammer the origin for it), while an
  upstream failure with no cached copy is a **503** — never a 404.
- **Deletion / unpublish.** `POST /api/revalidate` (the contract the README
  already documented: `secret` in the body, `X-Revalidate-Secret`, or a bearer
  token) accepts `event: save | delete | unpublish`, purges the in-process
  entries, calls `revalidateTag(tag, { expire: 0 })` and
  `revalidatePath('/wiki/<slug>')`, and for removals records a **tombstone** so
  stale-if-error cannot resurrect a deleted article. Timed revalidation (60 s) is
  the fallback when no webhook is configured.
- **Autocomplete.** 300 ms debounce, `AbortController` cancels outdated requests,
  minimum 2 characters, query capped at 200 chars, a 24-entry per-session LRU in
  the browser, `max-age=30`/`s-maxage=60` on the response, a 300-entry LRU on the
  server, and its own upstream budget with a 3.5 s timeout.
- **Observability without new dependencies.** `server/metrics.ts` keeps counters,
  gauges and latency histograms; `/api/metrics` returns JSON (with `pid` and
  per-budget/cache state) and `/api/metrics?format=prometheus` returns histogram
  buckets ready for a Prometheus/Datadog agent. Structured single-line JSON logs
  (`mediawiki.upstream_failed`, `mediawiki.circuit_open`, `mediawiki.tombstone`,
  `api.revalidate`, …) go to stdout for the existing log pipeline. **No new
  runtime dependency was added.**

### Cross-replica behaviour (important)

| Protection | Works across replicas? |
|---|---|
| CDN `s-maxage` / browser caching | ✅ shared |
| ISR route cache, Data Cache | ⚠️ per replica when self-hosted (Next stores them on local disk); shared on Vercel |
| In-process caches, single-flight, semaphores, breaker, tombstones | ❌ per replica — upstream ceilings multiply by replica count |
| `revalidateTag`/`revalidatePath` purge | ✅ in each replica it reaches; the CDN still needs a platform purge |

`MEDIAWIKI_MAX_CONCURRENCY` is therefore a **per-replica** ceiling (8 across 4
replicas = 32 concurrent MediaWiki requests). When scaling horizontally, either
divide the per-replica budgets or move the article cache to a shared store while
keeping the CDN in front.

**Measurement caveat:** page renders happen in Next's render worker pool, so
counters exposed by `/api/metrics` reflect the server process only. The
structured JSON logs are emitted by every worker — aggregate from the log
pipeline for full coverage (this is why the cold-load run shows all 600 upstream
parses in the mock but fewer in `/api/metrics`).

---

## 3. Measured results

Everything below is a **local smoke measurement**: one Node harness process, one
`next start` process, the mock MediaWiki (`loadtest/mock-mediawiki.mjs`, 8 ms
latency, no network) on a Windows dev box. It is **not** a staging run and must
not be quoted as production capacity.

### Behaviour verification — `node loadtest/verify-behavior.mjs` → **27/27 PASS**

| Check | Evidence |
|---|---|
| homepage/`/search` CDN-cacheable | `s-maxage=31536000`, `x-nextjs-cache: HIT` |
| article ISR | `s-maxage=60, stale-while-revalidate=86340`, MISS→HIT |
| portal/search cache headers | `public, s-maxage=60` / `public, max-age=30, s-maxage=60` |
| genuine 404 vs outage | missing title → 404; no cached copy + upstream down → **503** |
| **20 concurrent cold misses** | 20/20 readers served, **1** MediaWiki request |
| 5 page reads / 5 API reads / 6 identical searches | 1 upstream call each |
| stale-if-error | the last good copy was served while upstream was down |
| slow upstream (5 s) with a 1.5 s app timeout | 1.5 s response, **1** upstream attempt, no retries |
| circuit breaker | 6 failing reads → 2 upstream attempts, breaker `open`, recovers after the window |
| delete webhook | data layer 404 immediately; API 404; tombstone survives an upstream outage |
| page HTML after delete | varies: `200(STALE) -> 404(HIT)` in one run, still `200(HIT)` after 20 s in another — see §5 |
| save webhook | re-reads upstream (1 parse call) |
| metrics | JSON + Prometheus render; budgets/caches reported |

### Local smoke load — `node loadtest/smoke-load.mjs`

| Workload | Requests | p50 | p95 | p99 | Errors | Dropped | MediaWiki requests |
|---|---|---|---|---|---|---|---|
| Mixed 200/s × 20 s (home .2/article .5/search .2/autocomplete .1) | 3,585 | 132–364 ms | 708–1,097 ms | 891–2,541 ms | **0.00 %** | 415 (10.4 %, harness cap) | **59 total (3.0/s)** |
| Cold long-tail 40/s × 15 s (unique titles) | 600 | 11 ms | 19 ms | 26 ms | **0.00 %** | 0 | 600 (40/s — 1:1 by design) |
| Search + autocomplete 150/s × 15 s | 2,249 | 6 ms | 16 ms | 23–30 ms | **0.00 %** | 0 | **35 (2.3/s)**, 97.5 % hit rate |
| Total upstream outage 100/s × 12 s (incl. cold titles) | 1,200 | 6–13 ms | 22–38 ms | 42–98 ms | **0.00 %** | 0 | 42 (breaker held the rest) |

Interpretation:

- **Warm reads are effectively free upstream**: mixed traffic produced ≈1
  MediaWiki request per 61 reader requests; search ≈1 per 64.
- **Cold long-tail traffic is 1:1 with MediaWiki** (600 unique titles → 600
  parses). Nothing can be cached or coalesced there — which is why the
  concurrency budget, timeouts and breaker matter more than caching for crawlers.
  If all 500 req/s were cold, `MEDIAWIKI_MAX_CONCURRENCY` (8) becomes the binding
  constraint: expect ~8/latency upstream reads/s, a bounded queue, and graceful
  shedding beyond it rather than unbounded growth.
- **During a total outage readers kept getting 200s** (cached page, stale copy,
  or the graceful "temporarily unavailable" page) at p95 ≤ 38 ms, with only 42
  upstream attempts for 1,200 requests.
- Mixed-run p95 (0.7–1.1 s) reflects the single-process harness and first renders,
  not the caching design: the search-only and cold-only runs were 16–19 ms p95.
- `articleHitRate` reads `n/a` in some runs because those pages were served
  straight from the ISR route cache and never invoked the data layer at all.

### Capacity claim

**No 10,000-reader claim is made.** There is no representative staging run yet.
What the evidence supports is narrower: with a CDN in front, origin traffic is
proportional to
`(unique cold articles per revalidate window) + (search misses) + (revalidations)`,
and locally that stayed at 1–3 upstream requests/s while serving 3.6k reader
requests in 20 s. Validating 500 page req/s plus search and assets requires the k6
suite below against staging.

---

## 4. How to reproduce

```bash
# 0. verify the checkout
git rev-parse --abbrev-ref HEAD        # main
npm run lint                           # = tsc --noEmit (the project's TS check)
npm run build

# 1. local verification environment (mock MediaWiki + production build on :3230)
powershell -File loadtest/start-verify-env.ps1

# 2. behaviour/resilience assertions (27 checks)
node loadtest/verify-behavior.mjs --app http://localhost:3230 --mock http://127.0.0.1:4599 --secret test-secret

# 3. local smoke load (never point these at the live wiki)
node loadtest/smoke-load.mjs --base http://localhost:3230 --mock http://127.0.0.1:4599 \
  --rate 200 --duration 20 --concurrency 128 --mix home:0.2,article:0.5,search:0.2,autocomplete:0.1
node loadtest/smoke-load.mjs --base http://localhost:3230 --rate 40 --duration 15 --cold 1 --mix article:1
node loadtest/smoke-load.mjs --base http://localhost:3230 --rate 150 --duration 15 --mix search:0.5,autocomplete:0.5

# 4. full-scale (STAGING ONLY — requires k6, not installed in this checkout)
k6 run -e BASE_URL=https://staging.example.org -e RATE=500 -e DURATION=5m loadtest/k6-bhikitia.js
k6 run -e BASE_URL=https://staging.example.org -e SCENARIO=burst_home loadtest/k6-bhikitia.js
k6 run -e BASE_URL=https://staging.example.org -e SCENARIO=cold_long_tail loadtest/k6-bhikitia.js
k6 run -e BASE_URL=https://staging.example.org -e SCENARIO=search_mixed loadtest/k6-bhikitia.js
# degrade the mock/origin first, then:
k6 run -e BASE_URL=https://staging.example.org -e SCENARIO=upstream_degraded loadtest/k6-bhikitia.js
```

---

## 5. Remaining deployment requirements & known gaps

1. **Put a CDN in front and keep the cache keys intact.** The design assumes the
   CDN (a) honours `s-maxage`/`stale-while-revalidate`, (b) keeps `Vary` (Next
   sets `Vary: rsc, next-router-state-tree, …`) and the `_rsc` search parameter in
   its cache key — see `node_modules/next/dist/docs/01-app/02-guides/cdn-caching.md`.
   Dropping either breaks client-side navigation or cross-serves HTML/RSC.
2. **Wire the MediaWiki save/delete hook to `POST /api/revalidate`** with
   `REVALIDATION_SECRET`, sending `{ "slug": "<Title As Stored>", "event":
   "save" | "delete" | "unpublish" }`. Without it, freshness falls back to the
   60 s window.
3. **Purge the CDN on delete/unpublish, and treat page-HTML invalidation as
   best-effort.** `revalidateTag`/`revalidatePath` clear the Next caches but not
   edge copies (documented Next limitation), and because page renders run in a
   worker pool, a `revalidatePath` from a Route Handler does **not** reliably
   invalidate *every* worker's full-route entry at once — measured both
   `200(STALE) -> 404(HIT)` (≈1 s) and no change within 20 s. What is always
   immediate is the data layer (API 404 + tombstone), and the page converges
   within one `revalidate` window (60 s). For a hard guarantee on delete, call the
   platform's cache purge and/or lower `revalidate` for the article route.
4. **Scale the upstream budgets with replica count.** `MEDIAWIKI_MAX_CONCURRENCY`
   /`MEDIAWIKI_SEARCH_CONCURRENCY` are per replica; divide them by the replica
   count or introduce a shared cache/queue. A shared article cache (Redis or a
   custom Next cache handler) is the single biggest remaining improvement for
   multi-replica deployments.
5. **Aggregate metrics from logs.** `/api/metrics` reports one process; render
   workers emit the same structured logs. Point the log pipeline (or a
   Prometheus agent scraping each replica) at both before trusting the numbers.
6. **Cold-crawl protection is a budget, not a cache.** If a search-engine crawl
   targets mostly unseen titles, upstream load approaches the request rate. Add
   edge rate limiting for `/_next`-less bots or a crawl-delay hint in
   `robots.txt` if that becomes a problem.
7. **Not validated here:** multi-replica behaviour, real MediaWiki latency/rate
   limits, TLS/CDN behaviour, k6 thresholds at 500 req/s, and mobile/4G client
   performance. These need the staging run.
8. **Deliberately left out of scope** (unchanged from before): font pipeline,
   legacy `server.ts` Express app (it still duplicates the `/api/revalidate`
   contract), the `submit`/`track`/admin flows, and SSR migration of the homepage
   shell.




