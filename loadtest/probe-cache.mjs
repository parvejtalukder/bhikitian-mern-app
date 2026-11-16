/**
 * Probe: does `revalidateTag(..., {expire: 0})` actually drop the Data Cache entry
 * for an article, and does a fresh read see the upstream deletion?
 *   node loadtest/probe-cache.mjs --app http://localhost:3230 --mock http://127.0.0.1:4599
 */
const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) args.set((process.argv[i] || '').replace(/^--/, ''), process.argv[i + 1]);
const APP = (args.get('app') || 'http://localhost:3230').replace(/\/$/, '');
const MOCK = (args.get('mock') || 'http://127.0.0.1:4599').replace(/\/$/, '');
const SECRET = args.get('secret') || 'test-secret';
const slug = `Probe_Cache_${Date.now()}`;
const title = slug.replace(/_/g, ' ');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function read(path) {
  const res = await fetch(`${APP}${path}`);
  const body = await res.text();
  return { status: res.status, cacheStatus: (body.match(/"cacheStatus":"(\w+)"/) || [])[1] ?? '-', exists: body.includes('"exists":true') };
}
const show = (label, r) => console.log(`${label.padEnd(34)} status=${r.status} cacheStatus=${r.cacheStatus} exists=${r.exists}`);

async function hook(event) {
  const res = await fetch(`${APP}/api/revalidate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ secret: SECRET, slug, event }),
  });
  return res.status;
}

async function main() {
  show('1. warm (cached read)', await read(`/api/wiki/article?slug=${slug}`));
  show('2. warm again (should be HIT)', await read(`/api/wiki/article?slug=${slug}`));

  // MediaWiki "deletes" the page.
  await fetch(`${MOCK}/_mock/tombstone`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title }) });
  await fetch(`${MOCK}/_mock/reset`, { method: 'POST' }).catch(() => {});

  show('3. before purge (in-process cache)', await read(`/api/wiki/article?slug=${slug}`));
  const hookStatus = await hook('delete');
  console.log(`   webhook(delete) status=${hookStatus}`);
  show('4. after purge (in-process cache)', await read(`/api/wiki/article?slug=${slug}`));
  show('5. after purge, fresh=1 (bypasses in-process)', await read(`/api/wiki/article?slug=${slug}&fresh=1`));

  const stats = await fetch(`${MOCK}/_mock/stats`).then((r) => r.json());
  console.log(`   upstream parse calls so far: ${stats.byAction.parse ?? 0}`);

  // Fresh slug, no in-process cache at all: is the Data Cache masking a delete?
  const slug2 = `Probe_DataCache_${Date.now()}`;
  const title2 = slug2.replace(/_/g, ' ');
  const r1 = await fetch(`${APP}/api/wiki/article?slug=${slug2}`).then((r) => r.text());
  console.log(`6. cold read exists=${r1.includes('"exists":true')}`);
  await fetch(`${MOCK}/_mock/tombstone`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: title2 }) });
  await fetch(`${MOCK}/_mock/reset`, { method: 'POST' }).catch(() => {});
  await hook('delete');
  await fetch(`${APP}/api/revalidate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ secret: SECRET, slug: slug2, event: 'delete' }),
  });
  const after = await fetch(`${APP}/api/wiki/article?slug=${slug2}&fresh=1`);
  const body = await after.text();
  console.log(`7. after delete + purge, fresh=1 -> status=${after.status} exists=${body.includes('"exists":true')} cacheStatus=${(body.match(/"cacheStatus":"(\w+)"/) || [])[1] ?? '-'}`);
  await sleep(200);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
