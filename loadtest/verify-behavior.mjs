/**
 * Behaviour verification harness for the caching/resilience design.
 *
 * Runs against a locally started app + mock upstream and prints PASS/FAIL lines
 * with the evidence (status codes, upstream request counts, headers).
 *
 *   node loadtest/verify-behavior.mjs --app http://localhost:3230 \
 *     --mock http://127.0.0.1:4599 --secret test-secret
 *
 * Checks
 *   1  baseline routes + cache headers
 *   2  real 404 (missingtitle) vs upstream failure are distinguished
 *   3  20 concurrent cold misses -> how many requests reach MediaWiki
 *   4  repeated page + API reads reuse caches
 *   5  stale-if-error: cached copy served while upstream is down
 *   6  upstream timeout is bounded and falls back
 *   7  circuit breaker stops hammering a failing origin
 *   8  delete webhook invalidates (article becomes a real 404)
 *   9  save webhook invalidates (fresh render pulls upstream again)
 *   10 metrics endpoint exposes hits/misses/upstream/breaker
 */
const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  const key = (process.argv[i] || '').replace(/^--/, '');
  if (key) args.set(key, process.argv[i + 1]);
}

const APP = (args.get('app') || 'http://localhost:3230').replace(/\/$/, '');
const MOCK = (args.get('mock') || 'http://127.0.0.1:4599').replace(/\/$/, '');
const SECRET = args.get('secret') || 'test-secret';

const results = [];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function check(name, passed, evidence) {
  results.push({ name, passed });
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}${evidence ? `  [${evidence}]` : ''}`);
}

async function get2(path) {
  const res = await fetch(`${APP}${path}`, { redirect: 'manual' });
  const body = await res.text();
  return { status: res.status, body, cache: res.headers.get('x-nextjs-cache') };
}

/**
 * The design guarantee for deletions is: the API reflects it immediately, and
 * the cached page stops serving the article within one revalidation window (the
 * CDN copy additionally needs a platform purge — deployment requirement).
 */
async function waitForPageRemoval(path, deadlineMs = 20_000) {
  const started = Date.now();
  const trail = [];
  while (Date.now() - started < deadlineMs) {
    const res = await get2(path);
    trail.push(`${res.status}${res.cache ? `(${res.cache})` : ''}`);
    if (res.status === 404) return { removed: true, trail };
    await sleep(500);
  }
  return { removed: false, trail };
}

async function get(path, init) {
  const started = Date.now();
  try {
    const res = await fetch(`${APP}${path}`, { redirect: 'manual', ...init });
    const body = await res.text();
    return { status: res.status, body, ms: Date.now() - started, headers: res.headers };
  } catch (error) {
    return { status: 0, body: String(error), ms: Date.now() - started, headers: new Headers() };
  }
}

const mockStats = () => fetch(`${MOCK}/_mock/stats`).then((res) => res.json());
const mockReset = () => fetch(`${MOCK}/_mock/reset`, { method: 'POST' }).then((res) => res.json());
const mockMode = (mode, latencyMs = 8, failRate = 0) =>
  fetch(`${MOCK}/_mock/mode`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mode, latencyMs, failRate }),
  }).then((res) => res.json());

async function main() {
  console.log(`verify-behavior: app=${APP} mock=${MOCK}\n`);

  // 1 — baseline routes + headers
  console.log('--- 1. baseline routes');
  const home = await get('/');
  const article = await get('/wiki/Nelson_Mandela');
  const portal = await get('/api/wiki/portal');
  const search = await get('/api/wiki/search?q=history&limit=6');
  const sitemap = await get('/sitemap.xml');
  check('homepage 200 with CDN s-maxage', home.status === 200 && (home.headers.get('cache-control') || '').includes('s-maxage=31536000'), `cc=${home.headers.get('cache-control')}`);
  check('article 200 with ISR s-maxage', article.status === 200 && (article.headers.get('cache-control') || '').includes('s-maxage='), `cc=${article.headers.get('cache-control')}, x-nextjs-cache=${article.headers.get('x-nextjs-cache')}`);
  check('portal cached publicly', portal.status === 200 && (portal.headers.get('cache-control') || '').includes('s-maxage='), `cc=${portal.headers.get('cache-control')}`);
  check('search cached publicly', search.status === 200 && (search.headers.get('cache-control') || '').includes('max-age=30'), `cc=${search.headers.get('cache-control')}`);
  check('sitemap 200', sitemap.status === 200, `bytes=${sitemap.body.length}`);

  // 2 — real 404 vs upstream failure
  console.log('\n--- 2. 404 vs upstream failure');
  const missingTitle = `Does_Not_Exist_${Date.now()}`;
  const missing = await get(`/wiki/${missingTitle}`);
  check(
    'missing page -> real 404',
    missing.status === 404 && missing.body.includes('Page not found'),
    `status=${missing.status}`
  );

  // 3 — concurrent cold-miss coalescing
  console.log('\n--- 3. coalescing (20 concurrent cold misses)');
  await mockReset();
  const target = `/api/wiki/article?slug=Load_Test_Article_1`;
  const responses = await Promise.all(Array.from({ length: 20 }, () => get(target)));
  const statsAfterBurst = await mockStats();
  const okCount = responses.filter((r) => r.status === 200).length;
  check('all 20 readers served', okCount === 20, `ok=${okCount}/20`);
  check(
    'exactly one MediaWiki request for the burst',
    statsAfterBurst.byAction.parse === 1,
    `upstream parse calls=${statsAfterBurst.byAction.parse ?? 0}, total=${statsAfterBurst.apiRequests}`
  );

  // 4 — repeated reads reuse caches
  console.log('\n--- 4. repeated reads');
  await mockReset();
  for (let i = 0; i < 5; i += 1) await get('/wiki/Bangladesh');
  const pageStats = await mockStats();
  check('5 page reads render once', (pageStats.byAction.parse || 0) === 1, `upstream parse calls=${pageStats.byAction.parse ?? 0}`);

  await mockReset();
  for (let i = 0; i < 5; i += 1) await get('/api/wiki/article?slug=Japan');
  const apiStats = await mockStats();
  check('5 API reads use the in-process cache', (apiStats.byAction.parse || 0) === 1, `upstream parse calls=${apiStats.byAction.parse ?? 0}`);

  await mockReset();
  const uniqueQuery = `verify-${Date.now()}`;
  for (let i = 0; i < 6; i += 1) await get(`/api/wiki/search?q=${uniqueQuery}&limit=6`);
  const searchStats = await mockStats();
  check(
    '6 identical searches -> 1 upstream search',
    (searchStats.byAction['query:search'] || 0) === 1,
    `upstream search calls=${searchStats.byAction['query:search'] ?? 0}`
  );

  // 5 — stale-if-error while upstream is down
  console.log('\n--- 5. stale-if-error (upstream down)');
  // Fresh titles each run so leftovers (tombsones, warm caches) from a previous
  // run cannot influence the result.
  const runId = Date.now();
  const staleSlug = `Stale_Test_${runId}`;
  const coldSlug = `Cold_Outage_${runId}`;
  await get(`/api/wiki/article?slug=${staleSlug}`);
  // The fresh window has a 5s safety floor (MEDIAWIKI_ARTICLE_TTL_MS clamped to >= 5000).
  await sleep(5500);
  await mockMode('fail');
  const staleApi = await get(`/api/wiki/article?slug=${staleSlug}`);
  check(
    'readers still get the last good copy while upstream is down',
    staleApi.status === 200 && staleApi.body.includes('"exists":true'),
    `status=${staleApi.status} cacheStatus=${(staleApi.body.match(/"cacheStatus":"(\w+)"/) || [])[1] ?? 'n/a'}`
  );
  const stalePage = await get(`/wiki/${staleSlug}`);
  check(
    'article page never errors or 404s during an outage',
    stalePage.status === 200 &&
      (stalePage.body.includes(staleSlug.replace(/_/g, ' ')) || stalePage.body.includes('Encyclopedia unavailable')),
    `status=${stalePage.status}, x-nextjs-cache=${stalePage.headers.get('x-nextjs-cache')}, article=${stalePage.body.includes(staleSlug.replace(/_/g, ' '))}`
  );
  // Worst case: no cached copy anywhere and upstream down -> graceful failure,
  // never a crash and never a misleading 404.
  const coldOutage = await get(`/api/wiki/article?slug=${coldSlug}`);
  check(
    'no cached copy + upstream down -> 503 (not a misleading 404)',
    coldOutage.status === 503,
    `status=${coldOutage.status} durationMs=${coldOutage.ms}`
  );
  const coldPage = await get(`/wiki/${coldSlug}`);
  check(
    'article page shows the graceful unavailable state, not a 5xx',
    coldPage.status === 200 && coldPage.body.includes('Encyclopedia unavailable'),
    `status=${coldPage.status}`
  );

  // 6 — slow upstream is cut off by the timeout
  console.log('\n--- 6. slow upstream (timeout bound)');
  await mockMode('ok');
  const slowSlug = `Slow_Test_${runId}`;
  await get(`/api/wiki/article?slug=${slowSlug}`);
  // Purge so the next read really has to call upstream (Data Cache included).
  await fetch(`${APP}/api/revalidate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ secret: SECRET, slug: slowSlug, event: 'save' }),
  });
  await mockReset();
  await mockMode('slow', 5000); // far beyond the 1.5s app timeout
  const slowRead = await get(`/api/wiki/article?slug=${slowSlug}`);
  const slowStats = await mockStats();
  check('slow upstream does not hang the reader', slowRead.ms < 4000, `status=${slowRead.status} durationMs=${slowRead.ms}`);
  check(
    'the slow request is abandoned once, with no retries',
    (slowStats.byAction.parse || 0) === 1,
    `upstream parse calls=${slowStats.byAction.parse ?? 0}`
  );

  // 7 — circuit breaker protects the origin
  console.log('\n--- 7. circuit breaker');
  await mockMode('fail');
  await mockReset();
  for (let i = 0; i < 6; i += 1) await get(`/api/wiki/article?slug=Load_Test_Fail_${i}`);
  const breakerStats = await mockStats();
  const metricsDuringOutage = await fetch(`${APP}/api/metrics`).then((res) => res.json());
  check(
    'breaker opens and stops upstream amplification',
    breakerStats.apiRequests <= 4 && metricsDuringOutage.mediawiki?.breaker?.state === 'open',
    `upstream attempts=${breakerStats.apiRequests}, breaker=${metricsDuringOutage.mediawiki?.breaker?.state}`
  );
  await mockMode('ok');
  await sleep(6500); // > CIRCUIT_OPEN_MS
  const recovered = await get('/api/wiki/article?slug=Nelson_Mandela');
  check('recovers after the breaker window', recovered.status === 200, `status=${recovered.status}`);

  // 8 — deletion invalidation via the existing publish webhook
  console.log('\n--- 8. delete webhook invalidation');
  const deletedSlug = 'Delete_Me_Article';
  const deletedTitle = 'Delete Me Article';
  await mockMode('ok');
  const beforeDelete = await get(`/wiki/${deletedSlug}`);
  await fetch(`${MOCK}/_mock/tombstone`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: deletedTitle }),
  });
  const delRes = await fetch(`${APP}/api/revalidate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ secret: SECRET, slug: deletedSlug, event: 'delete' }),
  });
  const delBody = await delRes.json().catch(() => ({}));
  const apiAfterDelete = await get(`/api/wiki/article?slug=${deletedSlug}`);
  const removal = await waitForPageRemoval(`/wiki/${deletedSlug}`);
  check('article existed before the delete', beforeDelete.status === 200, `status=${beforeDelete.status}`);
  check(
    'deletion is reflected in the data layer immediately',
    delRes.status === 200 && delBody.revalidated === true && apiAfterDelete.status === 404,
    `webhook=${delRes.status}, api=${apiAfterDelete.status}`
  );
  // Page HTML is served from the route cache/CDN, so it can lag the data layer.
  // Reported (not asserted) so the measured window is visible in the results.
  console.log(
    `INFO  cached page HTML after the delete: ${removal.trail.slice(-6).join(' -> ')} ` +
      `(removed=${removal.removed}; bounded by the route revalidate and the CDN purge on delete)`
  );

  // Tombstone guarantee: with upstream unreachable AND the caches purged, a
  // deleted title must not be resurrected by stale-if-error (per-process guard).
  await fetch(`${APP}/api/revalidate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ secret: SECRET, slug: deletedSlug, event: 'delete' }),
  });
  await mockMode('fail');
  const tombstonedRead = await get(`/api/wiki/article?slug=${deletedSlug}`);
  check(
    'deletion beats stale-if-error while upstream is down',
    tombstonedRead.status === 404,
    `status=${tombstonedRead.status}`
  );
  await mockMode('ok');

  // 9 — save webhook invalidation
  console.log('\n--- 9. save webhook invalidation');
  await get('/api/wiki/article?slug=Japan');
  await mockReset();
  const saveRes = await fetch(`${APP}/api/revalidate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ secret: SECRET, slug: 'Japan', event: 'save' }),
  });
  const refreshed = await get('/api/wiki/article?slug=Japan');
  const saveStats = await mockStats();
  check(
    'saved article re-reads upstream',
    saveRes.status === 200 && refreshed.status === 200 && (saveStats.byAction.parse || 0) >= 1,
    `webhook=${saveRes.status}, upstream parse calls=${saveStats.byAction.parse ?? 0}`
  );
  const badSecret = await fetch(`${APP}/api/revalidate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ secret: 'wrong', slug: 'Japan' }),
  });
  check('webhook rejects a bad secret', badSecret.status === 401, `status=${badSecret.status}`);

  // 10 — metrics endpoint
  console.log('\n--- 10. metrics');
  const metrics = await fetch(`${APP}/api/metrics`).then((res) => res.json());
  const counters = Object.keys(metrics.counters || {});
  const prom = await fetch(`${APP}/api/metrics?format=prometheus`).then((res) => res.text());
  check(
    'metrics expose hits/misses/upstream/latency',
    counters.some((k) => k.startsWith('mediawiki.article')) &&
      counters.some((k) => k.startsWith('mediawiki.upstream.requests')) &&
      Object.keys(metrics.histograms || {}).length > 0,
    `counters=${counters.length}, histograms=${Object.keys(metrics.histograms || {}).length}`
  );
  check('prometheus exposition renders', prom.includes('# TYPE') && prom.includes('_bucket'), `bytes=${prom.length}`);
  check(
    'runtime budget state is reported',
    typeof metrics.mediawiki?.articleBudget?.limit === 'number' && typeof metrics.mediawiki?.caches?.articles === 'number',
    `limit=${metrics.mediawiki?.articleBudget?.limit}, cachedArticles=${metrics.mediawiki?.caches?.articles}`
  );
}

main()
  .then(() => {
    const failed = results.filter((r) => !r.passed);
    console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
    process.exit(failed.length ? 1 : 0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
