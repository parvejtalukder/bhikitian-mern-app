import { useEffect, useState } from 'react';
import { RefreshCw, Server, ShieldAlert } from 'lucide-react';

interface AuditReport {
  checkedAt: string;
  config: {
    mediawikiBaseUrl: string;
    apiUrl: string;
    publicSiteUrl: string;
    staffMediawikiUrl: string;
    scriptPath: string;
  };
  mediawikiSiteInfo: {
    general?: {
      sitename: string;
      generator: string;
      phpversion: string;
      phpsapi: string;
      dbtype: string;
      dbversion: string;
      timezone: string;
      articlepath: string;
      scriptpath: string;
      server: string;
    };
    statistics?: {
      pages: number;
      articles: number;
      edits: number;
      images: number;
      users: number;
      admins: number;
    };
  } | null;
  hostProbes: Record<
    string,
    {
      reachable: boolean;
      status: number | null;
      server: string | null;
      location?: string | null;
      error?: string;
    }
  >;
  cacheStats: {
    cachedArticles: number;
    ttlSeconds: number;
  };
}

export function ArchitecturePage() {
  const [audit, setAudit] = useState<AuditReport | null>(null);
  const [loading, setLoading] = useState(true);

  const runProbe = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/architecture/audit');
      if (res.ok) {
        setAudit(await res.json());
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = 'MediaWiki Verification & DNS Architecture — Bhikitia';
    runProbe();
  }, []);

  const general = audit?.mediawikiSiteInfo?.general;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 pb-16 space-y-8">
      <div className="pb-5 border-b border-[#e2e8f0] dark:border-[#1e293b] flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[#1d4ed8] dark:text-sky-400">
            Verified Hosting &amp; Headless Cutover Blueprint
          </p>
          <h1 className="mt-1 font-editorial text-2xl sm:text-3xl font-bold text-[#0f1f38] dark:text-[#f8fafc]">
            MediaWiki 1.44.0 Verification &amp; DNS Architecture
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Live verification against <span className="font-mono-tabular">MEDIAWIKI_BASE_URL</span> before
            executing DNS cutover from <span className="font-mono-tabular">en.bhikitia.org</span> to{' '}
            <span className="font-mono-tabular">edit.bhikitia.org</span>.
          </p>
        </div>
        <button
          type="button"
          onClick={runProbe}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded bg-[#0f1f38] hover:bg-[#1d4ed8] text-white transition-colors cursor-pointer disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Probing live hosts...' : 'Re-run Live Probe'}</span>
        </button>
      </div>

      {/* Live Verified Runtime Specs */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-xl border border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#111827] p-6">
          <div className="flex items-center gap-2 font-editorial text-lg font-bold text-[#0f1f38] dark:text-[#f8fafc]">
            <Server className="h-4 w-4 text-[#1d4ed8]" />
            <span>Verified MediaWiki Environment</span>
          </div>
          {loading ? (
            <div className="mt-4 h-40 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
          ) : general ? (
            <dl className="mt-4 divide-y divide-[#e2e8f0] dark:divide-[#1e293b] text-xs">
              {[
                ['MediaWiki Version', general.generator],
                ['PHP Runtime & SAPI', `${general.phpversion} (${general.phpsapi})`],
                ['Database Engine', `${general.dbtype} (${general.dbversion})`],
                ['Script Path', general.scriptpath === '' ? '"" (Root: /api.php & /rest.php)' : general.scriptpath],
                ['Article Path', general.articlepath],
                ['Configured Timezone', general.timezone],
                ['Server Origin', audit?.config.mediawikiBaseUrl],
              ].map(([k, v]) => (
                <div key={String(k)} className="py-2.5 flex justify-between gap-4">
                  <dt className="text-slate-500 dark:text-slate-400">{k}</dt>
                  <dd className="font-mono-tabular font-semibold text-right text-[#0f1f38] dark:text-[#f8fafc]">
                    {v}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-4 text-xs text-rose-600">Unable to retrieve live MediaWiki siteinfo.</p>
          )}
        </div>

        {/* Live Subdomain Probes */}
        <div className="rounded-xl border border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#111827] p-6">
          <h2 className="font-editorial text-lg font-bold text-[#0f1f38] dark:text-[#f8fafc]">
            Live Host &amp; DNS Reachability
          </h2>
          <div className="mt-4 divide-y divide-[#e2e8f0] dark:divide-[#1e293b] text-xs">
            {[
              { key: 'en', host: 'en.bhikitia.org', role: 'Current Live MediaWiki -> Target Public Headless Frontend' },
              { key: 'edit', host: 'edit.bhikitia.org', role: 'Proposed Staff MediaWiki Origin (Behind Auth)' },
              { key: 'bn', host: 'bn.bhikitia.org', role: 'Bengali MediaWiki Edition' },
              { key: 'root', host: 'bhikitia.org', role: 'Root Domain (WordPress wp-json detected)' },
            ].map((item) => {
              const probe = audit?.hostProbes?.[item.key];
              return (
                <div key={item.key} className="py-3 flex items-start justify-between gap-3">
                  <div>
                    <div className="font-mono-tabular font-semibold text-[#0f1f38] dark:text-[#f8fafc]">
                      {item.host}
                    </div>
                    <div className="text-slate-500 dark:text-slate-400 mt-0.5">{item.role}</div>
                  </div>
                  <div className="text-right font-mono-tabular shrink-0">
                    {probe?.reachable ? (
                      <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                        HTTP {probe.status} ({probe.server || 'OK'})
                      </span>
                    ) : (
                      <span className="text-amber-700 dark:text-amber-400 font-semibold">
                        Not provisioned
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Verified DNS & Security Cutover Instructions */}
      <section className="rounded-xl border border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#111827] p-6 space-y-5">
        <div className="flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-[#1d4ed8] shrink-0 mt-0.5" />
          <div>
            <h2 className="font-editorial text-xl font-bold text-[#0f1f38] dark:text-[#f8fafc]">
              Verified Cutover, Auth Lockdown &amp; Cache Refresh Playbook
            </h2>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
              Because <span className="font-mono-tabular">en.bhikitia.org</span> currently runs MediaWiki 1.44.0 on
              LiteSpeed with root script path (<span className="font-mono-tabular">/api.php</span>, not{' '}
              <span className="font-mono-tabular">/w/api.php</span>), follow this exact sequence to prevent downtime.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs leading-relaxed">
          <div className="p-4 rounded-lg bg-[#f8fafc] dark:bg-[#0a0f1d] border border-[#e2e8f0] dark:border-[#1e293b]">
            <h3 className="font-semibold text-[#0f1f38] dark:text-[#f8fafc] mb-2">
              1. Provision Staff Origin (edit.bhikitia.org)
            </h3>
            <ul className="space-y-1.5 text-slate-600 dark:text-slate-300 list-disc pl-4">
              <li>
                Add DNS <span className="font-mono-tabular">A</span> / <span className="font-mono-tabular">CNAME</span> for{' '}
                <span className="font-mono-tabular">edit.bhikitia.org</span> pointing to the existing LiteSpeed server.
              </li>
              <li>
                Bind the existing MediaWiki 1.44.0 document root and MariaDB 10.6.28 database to{' '}
                <span className="font-mono-tabular">edit.bhikitia.org</span> (keeping{' '}
                <span className="font-mono-tabular">$wgScriptPath = &quot;&quot;</span> and{' '}
                <span className="font-mono-tabular">$wgArticlePath = &quot;/wiki/$1&quot;</span>).
              </li>
              <li>
                Update <span className="font-mono-tabular">$wgServer = &quot;https://edit.bhikitia.org&quot;</span> in{' '}
                <span className="font-mono-tabular">LocalSettings.php</span>.
              </li>
              <li>
                Flip server-only <span className="font-mono-tabular">MEDIAWIKI_BASE_URL=https://edit.bhikitia.org</span>{' '}
                before switching public DNS.
              </li>
            </ul>
          </div>

          <div className="p-4 rounded-lg bg-[#f8fafc] dark:bg-[#0a0f1d] border border-[#e2e8f0] dark:border-[#1e293b]">
            <h3 className="font-semibold text-[#0f1f38] dark:text-[#f8fafc] mb-2">
              2. Lock Down Staff MediaWiki &amp; Exclude Indexing
            </h3>
            <pre className="p-3 rounded bg-white dark:bg-[#111827] border border-[#e2e8f0] dark:border-[#1e293b] font-mono-tabular text-[11px] overflow-x-auto text-slate-800 dark:text-slate-200">
{`# LocalSettings.php (edit.bhikitia.org)
$wgGroupPermissions['*']['edit'] = false;
$wgGroupPermissions['*']['createaccount'] = false;

# LiteSpeed .htaccess on edit.bhikitia.org
Header always set X-Robots-Tag "noindex, nofollow"
# Plus /robots.txt -> User-agent: * / Disallow: /`}
            </pre>
          </div>

          <div className="p-4 rounded-lg bg-[#f8fafc] dark:bg-[#0a0f1d] border border-[#e2e8f0] dark:border-[#1e293b]">
            <h3 className="font-semibold text-[#0f1f38] dark:text-[#f8fafc] mb-2">
              3. Cut Over Public DNS (en.bhikitia.org)
            </h3>
            <p className="text-slate-600 dark:text-slate-300">
              Point <span className="font-mono-tabular">en.bhikitia.org</span> DNS to this headless frontend
              deployment. All <span className="font-mono-tabular">/wiki/...</span> URLs, canonical tags,{' '}
              <span className="font-mono-tabular">/sitemap.xml</span>, and MediaWiki images remain intact.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-[#f8fafc] dark:bg-[#0a0f1d] border border-[#e2e8f0] dark:border-[#1e293b]">
            <h3 className="font-semibold text-[#0f1f38] dark:text-[#f8fafc] mb-2">
              4. On-Edit Cache Refresh Webhook
            </h3>
            <p className="text-slate-600 dark:text-slate-300 mb-2">
              Trigger instant cache invalidation on MediaWiki <span className="font-mono-tabular">PageSaveComplete</span>:
            </p>
            <pre className="p-2.5 rounded bg-white dark:bg-[#111827] border border-[#e2e8f0] dark:border-[#1e293b] font-mono-tabular text-[11px] overflow-x-auto">
{`POST https://en.bhikitia.org/api/revalidate
x-revalidate-secret: <REVALIDATION_SECRET>
{ "slug": "A._K._Fazlul_Huq" }`}
            </pre>
          </div>
        </div>
      </section>
    </div>
  );
}
