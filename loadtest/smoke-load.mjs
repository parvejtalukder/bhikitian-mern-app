/**
 * Dependency-free load harness (Node >= 20, uses global fetch).
 *
 * Used for LOCAL smoke/behaviour checks and CI thresholds. For full-scale
 * capacity testing use loadtest/k6-bhikitia.js instead — this harness runs in a
 * single Node process and is bounded by that process's CPU/socket limits.
 *
 *   node loadtest/smoke-load.mjs --base http://localhost:3230 --rate 50 \
 *     --duration 15 --concurrency 64 \
 *     --mix home:0.2,article:0.5,search:0.2,autocomplete:0.1 \
 *     --mock http://127.0.0.1:4599 --p95-ms 800 --max-error-rate 0.01
 *
 * Reports p50/p95/p99 per route, error rate, dropped iterations, cache-hit rate
 * and the MediaWiki request rate (upstream requests / duration).
 */
const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  const key = (process.argv[i] || '').replace(/^--/, '');
  if (key) args.set(key, process.argv[i + 1]);
}

const BASE = (args.get('base') || 'http://localhost:3230').replace(/\/$/, '');
const MOCK = args.get('mock') ? args.get('mock').replace(/\/$/, '') : '';
const RATE = Number(args.get('rate') || 50);
const DURATION_S = Number(args.get('duration') || 15);
const CONCURRENCY = Number(args.get('concurrency') || 64);
const P95_LIMIT = Number(args.get('p95-ms') || 0);
const MAX_ERROR_RATE = Number(args.get('max-error-rate') || 0);
const COLD = args.get('cold') === '1' || args.get('cold') === 'true';

const POPULAR = ['Nelson_Mandela', 'Bangladesh', 'United_Kingdom', 'Japan', 'History_of_Bengal'];
let coldCounter = 0;

const DEFAULT_MIX = 'home:0.2,article:0.5,search:0.2,autocomplete:0.1';
const mix = (args.get('mix') || DEFAULT_MIX)
  .split(',')
  .map((entry) => entry.split(':'))
  .filter(([name]) => name)
  .map(([name, weight]) => ({ name, weight: Number(weight) || 0 }));

const SEARCH_TERMS = ['history', 'bengal', 'dhaka', 'science', 'united nations', 'rabindranath', 'culture'];
const PREFIXES = ['sc', 'ba', 'hi', 'un', 'dh', 'ta', 'cu'];

const stats = new Map();
let dropped = 0;
let inFlight = 0;
let issued = 0;

function pickRoute() {
  const total = mix.reduce((sum, entry) => sum + entry.weight, 0) || 1;
  let roll = Math.random() * total;
  for (const entry of mix) {
    roll -= entry.weight;
    if (roll <= 0) return entry.name;
  }
  return 'article';
}

function target(label) {
  if (label === 'home') return { url: `${BASE}/`, label: 'GET /' };
  if (label === 'search') {
    const q = SEARCH_TERMS[Math.floor(Math.random() * SEARCH_TERMS.length)];
    return { url: `${BASE}/api/wiki/search?q=${encodeURIComponent(q)}&limit=25`, label: 'GET /api/wiki/search (25)' };
  }
  if (label === 'autocomplete') {
    const q = PREFIXES[Math.floor(Math.random() * PREFIXES.length)];
    return { url: `${BASE}/api/wiki/search?q=${q}&limit=6`, label: 'GET /api/wiki/search (6)' };
  }
  if (label === 'sitemap') return { url: `${BASE}/sitemap.xml`, label: 'GET /sitemap.xml' };
  if (COLD) {
    coldCounter += 1;
    return { url: `${BASE}/wiki/Load_Test_Article_${coldCounter}`, label: 'GET /wiki/* (cold)' };
  }
  const slug = POPULAR[Math.floor(Math.random() * POPULAR.length)];
  return { url: `${BASE}/wiki/${slug}`, label: `GET /wiki/* (popular)` };
}

function record(label, ms, ok) {
  let stat = stats.get(label);
  if (!stat) {
    stat = { count: 0, errors: 0, latencies: [] };
    stats.set(label, stat);
  }
  stat.count += 1;
  stat.latencies.push(ms);
  if (!ok) stat.errors += 1;
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index];
}

async function hit(label) {
  const { url } = target(label);
  const started = Date.now();
  try {
    const res = await fetch(url, { redirect: 'manual' });
    await res.arrayBuffer();
    record(label, Date.now() - started, res.status < 400);
  } catch {
    record(label, Date.now() - started, false);
  }
}

async function main() {
  console.log(
    `smoke-load: base=${BASE} rate=${RATE}/s duration=${DURATION_S}s concurrency=${CONCURRENCY} ` +
      `mix=${mix.map((m) => `${m.name}:${m.weight}`).join(',')}${MOCK ? ` mock=${MOCK}` : ''}${COLD ? ' cold=1' : ''}`
  );
  if (MOCK) await fetch(`${MOCK}/_mock/reset`, { method: 'POST' }).catch(() => {});

  const intervalMs = 1000 / RATE;
  const endAt = Date.now() + DURATION_S * 1000;
  let nextTick = Date.now();

  while (Date.now() < endAt) {
    const now = Date.now();
    if (now < nextTick) {
      await new Promise((resolve) => setTimeout(resolve, Math.min(5, nextTick - now)));
      continue;
    }
    nextTick += intervalMs;
    issued += 1;
    if (inFlight >= CONCURRENCY) {
      // Backpressure: the requested rate exceeds what this harness/app absorbs.
      dropped += 1;
      continue;
    }
    inFlight += 1;
    hit(pickRoute()).finally(() => {
      inFlight -= 1;
    });
  }

  const drainDeadline = Date.now() + 20_000;
  while (inFlight > 0 && Date.now() < drainDeadline) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  let totalCount = 0;
  let totalErrors = 0;
  let worstP95 = 0;
  console.log('\nroute                                    count   p50    p95    p99    err%');
  for (const [label, stat] of [...stats.entries()].sort((a, b) => b[1].count - a[1].count)) {
    const sorted = [...stat.latencies].sort((a, b) => a - b);
    const p95 = percentile(sorted, 95);
    worstP95 = Math.max(worstP95, p95);
    totalCount += stat.count;
    totalErrors += stat.errors;
    console.log(
      `${label.padEnd(38)} ${String(stat.count).padStart(6)} ` +
        `${String(percentile(sorted, 50)).padStart(5)}ms ${String(p95).padStart(5)}ms ` +
        `${String(percentile(sorted, 99)).padStart(6)}ms ${((stat.errors / stat.count) * 100).toFixed(2).padStart(6)}%`
    );
  }

  const errorRate = totalCount ? totalErrors / totalCount : 0;
  console.log(
    `\ntotal=${totalCount} dropped=${dropped} (${((dropped / Math.max(1, issued)) * 100).toFixed(2)}%) ` +
      `errorRate=${(errorRate * 100).toFixed(2)}% worstRouteP95=${worstP95}ms`
  );

  try {
    const metrics = await fetch(`${BASE}/api/metrics`).then((res) => res.json());
    const counters = metrics.counters || {};
    const sum = (predicate) =>
      Object.entries(counters)
        .filter(([key]) => predicate(key))
        .reduce((acc, [, value]) => acc + value, 0);
    const hits = sum((k) => k.startsWith('mediawiki.article') && k.includes('result=hit'));
    const misses = sum((k) => k.startsWith('mediawiki.article') && k.includes('result=miss'));
    const staleServed = sum((k) => k.startsWith('mediawiki.article') && k.includes('stale_fallback'));
    const upstreamOk = sum((k) => k.startsWith('mediawiki.upstream.requests') && k.includes('result=ok'));
    const upstreamFail = sum((k) => k.startsWith('mediawiki.upstream.requests') && !k.includes('result=ok'));
    const searchHits = sum((k) => k.startsWith('mediawiki.search') && k.includes('result=hit'));
    const searchMiss = sum((k) => k.startsWith('mediawiki.search') && k.includes('result=miss'));
    const lookupTotal = hits + misses + staleServed;
    console.log(
      `cache: articleHitRate=${lookupTotal ? ((hits / lookupTotal) * 100).toFixed(1) : 'n/a'}% ` +
        `(hits=${hits} misses=${misses} staleServed=${staleServed}) ` +
        `searchHitRate=${searchHits + searchMiss ? ((searchHits / (searchHits + searchMiss)) * 100).toFixed(1) : 'n/a'}%`
    );
    console.log(
      `upstream: ok=${upstreamOk} failed=${upstreamFail} rate=${((upstreamOk + upstreamFail) / DURATION_S).toFixed(1)}/s ` +
        `breaker=${metrics.mediawiki?.breaker?.state} articleBudget=${metrics.mediawiki?.articleBudget?.limit}`
    );
  } catch (error) {
    console.log(`metrics unavailable: ${error instanceof Error ? error.message : 'error'}`);
  }

  if (MOCK) {
    try {
      const mockStats = await fetch(`${MOCK}/_mock/stats`).then((res) => res.json());
      console.log(
        `mediawiki(mock): total=${mockStats.apiRequests} rate=${(mockStats.apiRequests / DURATION_S).toFixed(1)}/s ` +
          `byAction=${JSON.stringify(mockStats.byAction)}`
      );
    } catch {
      console.log('mock stats unavailable');
    }
  }

  const failures = [];
  if (P95_LIMIT > 0 && worstP95 > P95_LIMIT) failures.push(`worst route p95 ${worstP95}ms > ${P95_LIMIT}ms`);
  if (MAX_ERROR_RATE > 0 && errorRate > MAX_ERROR_RATE) {
    failures.push(`error rate ${(errorRate * 100).toFixed(2)}% > ${(MAX_ERROR_RATE * 100).toFixed(2)}%`);
  }
  if (failures.length > 0) {
    console.error(`\nTHRESHOLD FAILURES: ${failures.join('; ')}`);
    process.exit(1);
  }
  console.log('\nthresholds OK');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
