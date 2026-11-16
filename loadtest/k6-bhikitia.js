/**
 * Bhikitia Encyclopedia — reusable k6 load test.
 *
 * Never point this at the live MediaWiki origin. Use a local mock
 * (loadtest/mock-mediawiki.mjs) or an explicitly designated STAGING environment.
 *
 *   # steady mixed traffic (default), 500 page requests/s for 5 minutes
 *   k6 run -e BASE_URL=https://staging.example.org -e RATE=500 -e DURATION=5m \
 *          loadtest/k6-bhikitia.js
 *
 *   # burst to the homepage + popular articles
 *   k6 run -e BASE_URL=... -e SCENARIO=burst_home loadtest/k6-bhikitia.js
 *
 *   # cold / long-tail article reads (unique slugs, no cache reuse)
 *   k6 run -e BASE_URL=... -e SCENARIO=cold_long_tail loadtest/k6-bhikitia.js
 *
 *   # search + autocomplete only
 *   k6 run -e BASE_URL=... -e SCENARIO=search_mixed loadtest/k6-bhikitia.js
 *
 *   # degraded upstream: switch the mock to fail/slow first, then run
 *   curl -X POST -H 'content-type: application/json' \
 *        -d '{"mode":"fail"}' http://127.0.0.1:4599/_mock/mode
 *   k6 run -e BASE_URL=... -e SCENARIO=upstream_degraded loadtest/k6-bhikitia.js
 *
 * Env knobs
 *   BASE_URL        target origin                       (default http://localhost:3230)
 *   SCENARIO        mixed|burst_home|cold_long_tail|search_mixed|upstream_degraded
 *   RATE            page requests/second                (default 500)
 *   DURATION        scenario duration                    (default 5m)
 *   MIX             weights: home:0.2,article:0.5,search:0.2,autocomplete:0.1
 *   P95_MS          p95 latency threshold per route      (default 800)
 *   MAX_ERROR_RATE  allowed http_req_failed rate         (default 0.01)
 *   MOCK_STATS_URL  optional mock stats endpoint for the MediaWiki request rate
 *   PREALLOCATED_VUS / MAX_VUS for arrival-rate executors
 *
 * Thresholds fail the run (non-zero exit) so it can gate a deployment.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import exec from 'k6/execution';

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:3230').replace(/\/$/, '');
const SCENARIO = __ENV.SCENARIO || 'mixed';
const RATE = Number(__ENV.RATE || 500);
const DURATION = __ENV.DURATION || '5m';
const P95_MS = Number(__ENV.P95_MS || 800);
const MAX_ERROR_RATE = Number(__ENV.MAX_ERROR_RATE || 0.01);
const MOCK_STATS_URL = __ENV.MOCK_STATS_URL || '';
const PREALLOCATED_VUS = Number(__ENV.PREALLOCATED_VUS || 200);
const MAX_VUS = Number(__ENV.MAX_VUS || 1000);

const MIX = (__ENV.MIX || 'home:0.2,article:0.5,search:0.2,autocomplete:0.1')
  .split(',')
  .map((entry) => entry.split(':'))
  .filter(([name]) => name)
  .map(([name, weight]) => ({ name, weight: Number(weight) || 0 }));

const POPULAR_SLUGS = (__ENV.POPULAR_SLUGS || 'Nelson_Mandela,Bangladesh,United_Kingdom,Japan,History_of_Bengal').split(',');
const SEARCH_TERMS = ['history', 'bengal', 'dhaka', 'science', 'united nations', 'rabindranath', 'culture'];
const SEARCH_PREFIXES = ['sc', 'ba', 'hi', 'un', 'dh', 'ta', 'cu'];

// ---- custom metrics (per route p95 + cache/upstream visibility) ----
const homeLatency = new Trend('home_latency', true);
const articleLatency = new Trend('article_latency', true);
const coldArticleLatency = new Trend('cold_article_latency', true);
const searchLatency = new Trend('search_latency', true);
const autocompleteLatency = new Trend('autocomplete_latency', true);
const staleServed = new Counter('stale_article_served');
const unavailability = new Counter('article_unavailable_page');
const lookupErrors = new Rate('lookup_error_rate');

function pickWeighted(list) {
  const total = list.reduce((sum, entry) => sum + entry.weight, 0) || 1;
  let roll = Math.random() * total;
  for (const entry of list) {
    roll -= entry.weight;
    if (roll <= 0) return entry.name;
  }
  return list[0]?.name || 'article';
}

function randomFrom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// ---- scenario definitions ----
const arrivalRate = (rate, duration, exec_) => ({
  executor: 'constant-arrival-rate',
  exec: exec_,
  rate,
  timeUnit: '1s',
  duration,
  preAllocatedVUs: PREALLOCATED_VUS,
  maxVUs: MAX_VUS,
  gracefulStop: '30s',
});

function scenariosFor(name) {
  if (name === 'burst_home') {
    return {
      burst: {
        executor: 'ramping-arrival-rate',
        exec: 'burstIteration',
        startRate: Math.max(1, Math.round(RATE * 0.1)),
        timeUnit: '1s',
        preAllocatedVUs: PREALLOCATED_VUS,
        maxVUs: MAX_VUS,
        stages: [
          { target: RATE * 4, duration: '30s' },
          { target: RATE * 4, duration: '60s' },
          { target: Math.round(RATE * 0.1), duration: '30s' },
        ],
      },
    };
  }
  if (name === 'cold_long_tail') {
    return { cold: arrivalRate(RATE, DURATION, 'coldIteration') };
  }
  if (name === 'search_mixed') {
    return { search: arrivalRate(RATE, DURATION, 'searchIteration') };
  }
  if (name === 'upstream_degraded') {
    return { degraded: arrivalRate(RATE, DURATION, 'degradedIteration') };
  }
  return { mixed: arrivalRate(RATE, DURATION, 'mixedIteration') };
}

const errorThreshold = `rate<${SCENARIO === 'upstream_degraded' ? Math.max(0.05, MAX_ERROR_RATE * 10) : MAX_ERROR_RATE}`;

export const options = {
  discardResponseBodies: false,
  scenarios: scenariosFor(SCENARIO),
  thresholds: {
    http_req_failed: [errorThreshold],
    dropped_iterations: ['rate<0.01'],
    [`http_req_duration{scenario:${Object.keys(scenariosFor(SCENARIO))[0]}}`]: [`p(95)<${P95_MS * 3}`],
    home_latency: [`p(95)<${Math.round(P95_MS * 0.6)}`],
    article_latency: [`p(95)<${P95_MS}`],
    cold_article_latency: [`p(95)<${P95_MS * 2}`],
    search_latency: [`p(95)<${P95_MS}`],
    autocomplete_latency: [`p(95)<${P95_MS * 0.6}`],
    lookup_error_rate: [`rate<${SCENARIO === 'upstream_degraded' ? 0.05 : MAX_ERROR_RATE}`],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

// ---- request helpers ----
function get(path, tags) {
  const res = http.get(`${BASE_URL}${path}`, {
    tags,
    redirects: 0,
    headers: { Accept: 'text/html,application/json' },
  });
  return res;
}

function recordArticle(res, trend) {
  trend.add(res.timings.duration);
  const ok = check(res, { 'article page ok': (r) => r.status === 200 || r.status === 404 });
  lookupErrors.add(!ok);
  if (res.status === 200 && res.body && res.body.indexOf('Showing the last saved copy') !== -1) {
    staleServed.add(1);
  }
  if (res.status === 200 && res.body && res.body.indexOf('Encyclopedia unavailable') !== -1) {
    unavailability.add(1);
  }
}

export function mixedIteration() {
  const kind = pickWeighted(MIX);
  if (kind === 'home') {
    const res = get('/', { route: 'home' });
    homeLatency.add(res.timings.duration);
    check(res, { 'home ok': (r) => r.status === 200 });
    return;
  }
  if (kind === 'search') {
    const q = randomFrom(SEARCH_TERMS);
    const res = get(`/api/wiki/search?q=${encodeURIComponent(q)}&limit=25`, { route: 'search' });
    searchLatency.add(res.timings.duration);
    check(res, { 'search ok': (r) => r.status === 200 });
    return;
  }
  if (kind === 'autocomplete') {
    const q = randomFrom(SEARCH_PREFIXES);
    const res = get(`/api/wiki/search?q=${encodeURIComponent(q)}&limit=6`, { route: 'autocomplete' });
    autocompleteLatency.add(res.timings.duration);
    check(res, { 'autocomplete ok': (r) => r.status === 200 });
    return;
  }
  const slug = randomFrom(POPULAR_SLUGS);
  recordArticle(get(`/wiki/${slug}`, { route: 'article' }), articleLatency);
}

export function burstIteration() {
  if (Math.random() < 0.4) {
    const res = get('/', { route: 'home' });
    homeLatency.add(res.timings.duration);
    check(res, { 'home ok': (r) => r.status === 200 });
    return;
  }
  const slug = randomFrom(POPULAR_SLUGS);
  recordArticle(get(`/wiki/${slug}`, { route: 'article' }), articleLatency);
}

export function coldIteration() {
  // Unique titles: every request is a cache miss (long-tail crawl behaviour).
  const slug = `Load_Test_Cold_${exec.vu.idInTest}_${exec.scenario.iterationInTest}`;
  recordArticle(get(`/wiki/${slug}`, { route: 'article_cold' }), coldArticleLatency);
}

export function searchIteration() {
  if (Math.random() < 0.5) {
    const q = randomFrom(SEARCH_TERMS);
    const res = get(`/api/wiki/search?q=${encodeURIComponent(q)}&limit=25`, { route: 'search' });
    searchLatency.add(res.timings.duration);
    check(res, { 'search ok': (r) => r.status === 200 });
    return;
  }
  // Realistic typing: an incremental prefix per iteration.
  const base = randomFrom(SEARCH_TERMS);
  const prefix = base.slice(0, 2 + Math.floor(Math.random() * Math.max(1, base.length - 2)));
  const res = get(`/api/wiki/search?q=${encodeURIComponent(prefix)}&limit=6`, { route: 'autocomplete' });
  autocompleteLatency.add(res.timings.duration);
  check(res, { 'autocomplete ok': (r) => r.status === 200 });
}

export function degradedIteration() {
  // Readers must keep getting cached/stale articles while upstream is down.
  const slug = randomFrom(POPULAR_SLUGS);
  recordArticle(get(`/wiki/${slug}`, { route: 'article' }), articleLatency);
  if (Math.random() < 0.3) {
    const res = get('/', { route: 'home' });
    homeLatency.add(res.timings.duration);
    check(res, { 'home still served': (r) => r.status === 200 });
  }
  sleep(0.01);
}

export function handleSummary(data) {
  const lines = [];
  const metrics = data.metrics;
  const durationS = Math.max(1, Math.round((data.state?.testRunDurationMs || 0) / 1000));

  const fmt = (name) => {
    const m = metrics[name];
    if (!m) return null;
    return `${name.padEnd(24)} med=${Math.round(m.values.med ?? 0)}ms p95=${Math.round(m.values['p(95)'] ?? 0)}ms`;
  };

  lines.push(`\n===== Bhikitia k6 summary (scenario=${SCENARIO}, rate=${RATE}/s, duration=${DURATION}) =====`);
  lines.push(`iterations         : ${metrics.iterations?.values.count ?? 0}`);
  lines.push(`dropped iterations : ${metrics.dropped_iterations?.values.count ?? 0}`);
  lines.push(`http_req_failed    : ${((metrics.http_req_failed?.values.rate ?? 0) * 100).toFixed(2)}%`);
  lines.push(`http_req_duration  : p95=${Math.round(metrics.http_req_duration?.values['p(95)'] ?? 0)}ms`);
  for (const name of ['home_latency', 'article_latency', 'cold_article_latency', 'search_latency', 'autocomplete_latency']) {
    const line = fmt(name);
    if (line) lines.push(line);
  }
  lines.push(`stale articles served : ${metrics.stale_article_served?.values.count ?? 0}`);
  lines.push(`unavailable pages     : ${metrics.article_unavailable_page?.values.count ?? 0}`);

  // Cache effectiveness + upstream volume from the app's own metrics endpoint.
  try {
    const app = http.get(`${BASE_URL}/api/metrics`).json();
    const counters = app.counters || {};
    const sum = (predicate) =>
      Object.entries(counters)
        .filter(([key]) => predicate(key))
        .reduce((acc, [, value]) => acc + value, 0);
    const hits = sum((k) => k.startsWith('mediawiki.article') && k.includes('result=hit'));
    const misses = sum((k) => k.startsWith('mediawiki.article') && k.includes('result=miss'));
    const stale = sum((k) => k.startsWith('mediawiki.article') && k.includes('stale_fallback'));
    const upstream = sum((k) => k.startsWith('mediawiki.upstream.requests'));
    const upstreamOk = sum((k) => k.startsWith('mediawiki.upstream.requests') && k.includes('result=ok'));
    const denominator = hits + misses + stale;
    lines.push(
      `app cache          : articleHitRate=${denominator ? ((hits / denominator) * 100).toFixed(1) : 'n/a'}% ` +
        `hits=${hits} misses=${misses} staleServed=${stale}`
    );
    lines.push(
      `app upstream       : requests=${upstream} ok=${upstreamOk} ` +
        `rate=${(upstream / durationS).toFixed(2)}/s breaker=${app.mediawiki?.breaker?.state ?? 'n/a'}`
    );
  } catch (error) {
    lines.push(`app metrics unavailable: ${error}`);
  }

  if (MOCK_STATS_URL) {
    try {
      const mock = http.get(MOCK_STATS_URL).json();
      lines.push(
        `mediawiki (mock)   : requests=${mock.apiRequests} rate=${(mock.apiRequests / durationS).toFixed(2)}/s ` +
          `mode=${mock.mode} byAction=${JSON.stringify(mock.byAction)}`
      );
    } catch (error) {
      lines.push(`mock stats unavailable: ${error}`);
    }
  }

  const thresholdLines = Object.entries(metrics)
    .filter(([, metric]) => metric.thresholds)
    .flatMap(([name, metric]) =>
      Object.entries(metric.thresholds).map(([expr, value]) => {
        const passed = value === true || value?.ok === true;
        return `${passed ? 'PASS' : 'FAIL'}  ${name}: ${expr}`;
      })
    );
  if (thresholdLines.length > 0) {
    lines.push('--- thresholds ---');
    lines.push(...thresholdLines);
  }

  return {
    stdout: `${lines.join('\n')}\n`,
    'loadtest/k6-summary.json': JSON.stringify(
      { scenario: SCENARIO, rate: RATE, duration: DURATION, data },
      null,
      2
    ),
  };
}
