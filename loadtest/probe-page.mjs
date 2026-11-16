/**
 * Focused probe: what does the article PAGE render after a delete / during an outage?
 *   node loadtest/probe-page.mjs --app http://localhost:3230 --mock http://127.0.0.1:4599
 */
const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) args.set((process.argv[i] || '').replace(/^--/, ''), process.argv[i + 1]);
const APP = (args.get('app') || 'http://localhost:3230').replace(/\/$/, '');
const MOCK = (args.get('mock') || 'http://127.0.0.1:4599').replace(/\/$/, '');
const SECRET = args.get('secret') || 'test-secret';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const id = Date.now();

async function get(path) {
  const res = await fetch(`${APP}${path}`, { redirect: 'manual' });
  const body = await res.text();
  return {
    status: res.status,
    cache: res.headers.get('x-nextjs-cache'),
    title: /<h1[^>]*>([\s\S]*?)<\/h1>/.test(body) ? /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(body)[1].replace(/<[^>]+>/g, '').trim().slice(0, 40) : null,
    missing: body.includes('Page not found'),
    unavailable: body.includes('Encyclopedia unavailable'),
    stale: body.includes('Showing the last saved copy'),
    len: body.length,
  };
}
const show = (label, r) => console.log(`${label.padEnd(28)} status=${r.status} xnext=${r.cache ?? '-'} h1="${r.title ?? ''}" missing=${r.missing} unavailable=${r.unavailable} stale=${r.stale} bytes=${r.len}`);

const metrics = () => fetch(`${APP}/api/metrics`).then((r) => r.json());

async function main() {
  console.log('--- A. delete flow');
  const slug = `Probe_Delete_${id}`;
  const title = slug.replace(/_/g, ' ');
  show('warm page', await get(`/wiki/${slug}`));
  await fetch(`${MOCK}/_mock/tombstone`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title }) });
  const hook = await fetch(`${APP}/api/revalidate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ secret: SECRET, slug, event: 'delete' }),
  });
  console.log(`webhook status=${hook.status} body=${JSON.stringify(await hook.json().catch(() => ({})))}`);
  show('api after delete', await get(`/api/wiki/article?slug=${slug}`));
  for (let i = 1; i <= 3; i += 1) {
    show(`page after delete #${i}`, await get(`/wiki/${slug}`));
    await sleep(500);
  }
  const m1 = await metrics();
  console.log(`metrics: tombstones=${m1.mediawiki?.caches?.tombstones} cachedArticles=${m1.mediawiki?.caches?.articles} pid=${m1.pid}`);

  console.log('\n--- B. outage flow (page)');
  const slug2 = `Probe_Outage_${id}`;
  show('warm page', await get(`/wiki/${slug2}`));
  await sleep(5500);
  await fetch(`${MOCK}/_mock/mode`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'fail' }) });
  show('api during outage', await get(`/api/wiki/article?slug=${slug2}`));
  for (let i = 1; i <= 3; i += 1) {
    show(`page during outage #${i}`, await get(`/wiki/${slug2}`));
    await sleep(500);
  }
  await fetch(`${MOCK}/_mock/mode`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'ok' }) });

  console.log('\n--- C. upstream deletes the page, no webhook (ISR window only)');
  const slug3 = `Probe_WikiDelete_${id}`;
  const title3 = slug3.replace(/_/g, ' ');
  show('warm page', await get(`/wiki/${slug3}`));
  await fetch(`${MOCK}/_mock/tombstone`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: title3 }) });
  await fetch(`${MOCK}/_mock/reset`, { method: 'POST' }).catch(() => {});
  for (let i = 1; i <= 5; i += 1) {
    await sleep(2000);
    show(`page after ${i * 2}s`, await get(`/wiki/${slug3}`));
  }
  const s3 = await fetch(`${MOCK}/_mock/stats`).then((r) => r.json());
  console.log(`upstream parse calls after the wiki-side delete: ${s3.byAction.parse ?? 0}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
