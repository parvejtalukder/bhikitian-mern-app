# Load & resilience test kit

Never point high-volume tests at the live MediaWiki origin. Use the bundled mock
or an explicitly designated staging environment.

| File | Purpose |
|---|---|
| `mock-mediawiki.mjs` | Local MediaWiki API mock: healthy, slow, failing and flapping modes, runtime tombstone control, request counters |
| `k6-bhikitia.js` | Reusable k6 suite: steady mixed, burst, cold long-tail, search/autocomplete, degraded upstream, with thresholds and a summary that reports cache-hit and upstream rates |
| `smoke-load.mjs` | Dependency-free Node harness for local smoke runs and CI thresholds (same workload shapes) |
| `verify-behavior.mjs` | Behaviour/resilience assertions (cache headers, coalescing, stale-if-error, timeouts, breaker, webhook invalidation, metrics) |
| `start-verify-env.ps1` | Starts the mock plus a production build wired to it on port 3230 with short TTLs (build first; the script leaves both servers running) |
| `probe-page.mjs`, `probe-cache.mjs` | Focused diagnostics for page rendering and cache invalidation |

## Quick start (local)

```bash
npm run build
powershell -File loadtest/start-verify-env.ps1          # mock :4599 + app :3230
node loadtest/verify-behavior.mjs --app http://localhost:3230 --mock http://127.0.0.1:4599 --secret test-secret
node loadtest/smoke-load.mjs --base http://localhost:3230 --mock http://127.0.0.1:4599 \
  --rate 200 --duration 20 --concurrency 128 --mix home:0.2,article:0.5,search:0.2,autocomplete:0.1
```

Mock controls:

```bash
curl -X POST -H 'content-type: application/json' -d '{"mode":"fail"}'            http://127.0.0.1:4599/_mock/mode
curl -X POST -H 'content-type: application/json' -d '{"mode":"slow","latencyMs":5000}' http://127.0.0.1:4599/_mock/mode
curl -X POST -H 'content-type: application/json' -d '{"title":"Some Title"}'      http://127.0.0.1:4599/_mock/tombstone
curl http://127.0.0.1:4599/_mock/stats      # ground truth: requests that reached upstream
```

## k6 suite (staging / CI)

```bash
k6 run -e BASE_URL=$STAGING -e RATE=500 -e DURATION=5m loadtest/k6-bhikitia.js   # steady mixed
k6 run -e BASE_URL=$STAGING -e SCENARIO=burst_home loadtest/k6-bhikitia.js        # burst to home + popular
k6 run -e BASE_URL=$STAGING -e SCENARIO=cold_long_tail loadtest/k6-bhikitia.js    # cold / long tail
k6 run -e BASE_URL=$STAGING -e SCENARIO=search_mixed loadtest/k6-bhikitia.js      # search + autocomplete
k6 run -e BASE_URL=$STAGING -e SCENARIO=upstream_degraded -e MOCK_STATS_URL=http://127.0.0.1:4599/_mock/stats \
  loadtest/k6-bhikitia.js                                                         # slow/unavailable origin
```

Env: `BASE_URL`, `SCENARIO`, `RATE` (page req/s, default 500), `DURATION` (default
5m), `MIX` (`home:0.2,article:0.5,search:0.2,autocomplete:0.1`), `P95_MS`,
`MAX_ERROR_RATE`, `MOCK_STATS_URL`, `PREALLOCATED_VUS`, `MAX_VUS`.

Thresholds fail the run (non-zero exit) on p95 per route, error rate, dropped
iterations and lookup error rate, so it can gate a deployment. `handleSummary`
prints p50/p95/p99 per route plus the app's cache-hit rate, upstream request rate
and MediaWiki request rate, and writes `loadtest/k6-summary.json`.

Start from the workload assumption used in the report: 10,000 active readers
opening one page every 20 s ≈ **500 page requests/s** before search, autocomplete
and assets. Test those separately, as the scenarios do.
