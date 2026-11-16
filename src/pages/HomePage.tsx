import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  FilePlus2,
  Globe2,
  SearchCheck,
  ShieldCheck,
} from 'lucide-react';
import { SearchBar } from '../components/SearchBar.tsx';
import type { PortalData } from '../types/index.ts';

const HERO_IMG = '/src/assets/images/bhikitia_archive_hero_1794809163572.jpg';

export function HomePage() {
  const [portal, setPortal] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [edition, setEdition] = useState<'en' | 'bn'>('en');

  useEffect(() => {
    document.title = 'Bhikitia — Headless Bilingual Encyclopedia';
    let mounted = true;
    fetch('/api/portal')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (mounted && data) setPortal(data);
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const stats = portal?.statistics;

  return (
    <div className="max-w-[1340px] mx-auto px-4 sm:px-6 pt-8 pb-12">
      {/* Operational Utility Ribbon */}
      <div className="mb-6 pb-3 border-b border-[#e2e8f0] dark:border-[#1e293b] flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <Globe2 className="h-3.5 w-3.5 text-[#1d4ed8] dark:text-sky-400" aria-hidden="true" />
          <span>Public Canonical Host:</span>
          <span className="font-mono-tabular font-semibold text-[#0f1f38] dark:text-[#f8fafc]">
            en.bhikitia.org
          </span>
          <span aria-hidden="true">·</span>
          <span>Source of Truth:</span>
          <span className="font-mono-tabular">
            {portal?.siteInfo?.generator || 'MediaWiki 1.44.0'}
          </span>
        </div>

        <div className="flex items-center gap-1 p-0.5 bg-[#f1f5f9] dark:bg-[#111827] rounded border border-[#e2e8f0] dark:border-[#1e293b]">
          <button
            type="button"
            onClick={() => setEdition('en')}
            className={`px-2.5 py-1 text-xs font-medium rounded-sm transition-colors cursor-pointer whitespace-nowrap ${
              edition === 'en'
                ? 'bg-white dark:bg-[#1e293b] text-[#0f1f38] dark:text-[#f8fafc]'
                : 'text-slate-600 dark:text-slate-400 hover:text-[#0f1f38]'
            }`}
          >
            English (en)
          </button>
          <a
            href="https://bn.bhikitia.org"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setEdition('bn')}
            className="px-2.5 py-1 text-xs font-medium rounded-sm text-slate-600 dark:text-slate-400 hover:text-[#0f1f38] dark:hover:text-[#f8fafc] transition-colors whitespace-nowrap"
          >
            বাংলা (bn)
          </a>
        </div>
      </div>

      {/* Hero Split */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        <div className="lg:col-span-7 flex flex-col justify-center py-2">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#1d4ed8] dark:text-sky-400 mb-3">
            Open Bilingual Reference Archive
          </p>
          <h1 className="font-editorial text-3xl sm:text-[2.65rem] font-bold leading-[1.2] tracking-[-0.02em] text-[#0f1f38] dark:text-[#f8fafc] text-balance">
            Verified encyclopedic knowledge, structured for permanent public access.
          </h1>
          <p className="mt-4 text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
            Bhikitia pairs a distraction-free reading surface at{' '}
            <span className="font-mono-tabular text-sm text-[#0f1f38] dark:text-[#f8fafc]">en.bhikitia.org</span>{' '}
            with an authenticated MediaWiki editorial repository—preserving citations, infoboxes, and revision history.
          </p>

          <div className="mt-7">
            <SearchBar />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
            <span>Popular entries:</span>
            <Link to="/wiki/A._K._Fazlul_Huq" className="text-[#1d4ed8] dark:text-sky-400 hover:underline">
              A. K. Fazlul Huq
            </Link>
            <span aria-hidden="true">·</span>
            <Link
              to="/wiki/2024_Interim_government_of_Bangladesh"
              className="text-[#1d4ed8] dark:text-sky-400 hover:underline"
            >
              2024 Interim government of Bangladesh
            </Link>
            <span aria-hidden="true">·</span>
            <Link to="/wiki/2026_SAFF_Championship" className="text-[#1d4ed8] dark:text-sky-400 hover:underline">
              2026 SAFF Championship
            </Link>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="h-full min-h-[260px] rounded-xl overflow-hidden border border-[#e2e8f0] dark:border-[#1e293b] bg-[#f8fafc] dark:bg-[#111827]">
            <img
              src={HERO_IMG}
              alt="Sunlit university reference library reading desk with archival encyclopedia volumes"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* Full-Width 4-Column Live MediaWiki KPI Strip */}
      <section
        aria-label="Live encyclopedia metrics"
        className="mt-10 grid grid-cols-2 lg:grid-cols-4 border border-[#e2e8f0] dark:border-[#1e293b] rounded-lg bg-white dark:bg-[#111827] divide-y lg:divide-y-0 lg:divide-x divide-[#e2e8f0] dark:divide-[#1e293b]"
      >
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Published Articles</div>
          <div className="mt-1 text-2xl font-bold font-mono-tabular text-[#0f1f38] dark:text-[#f8fafc]">
            {loading ? '—' : (stats?.articles ?? 1316).toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Namespace 0 entries</div>
        </div>
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Recorded Revisions</div>
          <div className="mt-1 text-2xl font-bold font-mono-tabular text-[#0f1f38] dark:text-[#f8fafc]">
            {loading ? '—' : (stats?.edits ?? 28849).toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">MediaWiki revision audit</div>
        </div>
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Indexed Media Files</div>
          <div className="mt-1 text-2xl font-bold font-mono-tabular text-[#0f1f38] dark:text-[#f8fafc]">
            {loading ? '—' : (stats?.images ?? 210).toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Archival portraits &amp; plates</div>
        </div>
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Editorial Accounts</div>
          <div className="mt-1 text-2xl font-bold font-mono-tabular text-[#0f1f38] dark:text-[#f8fafc]">
            {loading ? '—' : (stats?.users ?? 119).toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {stats?.admins ?? 8} administrators
          </div>
        </div>
      </section>

      {/* Featured Entries & Live Recent Revisions */}
      <section className="mt-12 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7">
          <div className="flex items-center justify-between pb-3 border-b border-[#e2e8f0] dark:border-[#1e293b]">
            <h2 className="font-editorial text-xl font-bold text-[#0f1f38] dark:text-[#f8fafc]">
              Featured Encyclopedia Entries
            </h2>
            <Link
              to="/wiki/Main_Page"
              className="text-xs font-semibold text-[#1d4ed8] dark:text-sky-400 hover:underline inline-flex items-center gap-1"
            >
              <span>Browse Main Page</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>

          <div className="mt-4 divide-y divide-[#e2e8f0] dark:divide-[#1e293b] border border-[#e2e8f0] dark:border-[#1e293b] rounded-lg bg-white dark:bg-[#111827]">
            {(portal?.featuredEntries || [
              {
                title: 'A. K. Fazlul Huq',
                slug: 'A._K._Fazlul_Huq',
                category: 'Biography · History of Bengal',
                excerpt:
                  'Renowned Bengali lawyer, writer, and statesman known as Sher-e-Bangla.',
              },
              {
                title: '2024 Interim government of Bangladesh',
                slug: '2024_Interim_government_of_Bangladesh',
                category: 'Governance · Contemporary Politics',
                excerpt:
                  'Constitutional transition, advisory council composition, and reform commissions.',
              },
              {
                title: '2018 Bangladesh quota reform protests',
                slug: '2018_Bangladesh_quota_reform_protests',
                category: 'Civic Movements · Public Policy',
                excerpt:
                  'Nationwide student mobilization advocating merit-based civil service reform.',
              },
              {
                title: '2026 SAFF Championship',
                slug: '2026_SAFF_Championship',
                category: 'Sports · South Asia',
                excerpt:
                  'Biennial international men’s football championship organized by SAFF.',
              },
            ]).map((entry) => (
              <Link
                key={entry.slug}
                to={`/wiki/${encodeURIComponent(entry.slug)}`}
                className="block p-5 hover:bg-[#f8fafc] dark:hover:bg-[#1e293b]/50 transition-colors group"
              >
                <div className="text-xs text-slate-500 dark:text-slate-400">{entry.category}</div>
                <h3 className="mt-1 font-editorial text-lg font-bold text-[#0f1f38] dark:text-[#f8fafc] group-hover:text-[#1d4ed8] dark:group-hover:text-sky-400 transition-colors">
                  {entry.title}
                </h3>
                <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {entry.excerpt}
                </p>
              </Link>
            ))}
          </div>
        </div>

        {/* Live Recent Changes Feed from MediaWiki */}
        <div className="lg:col-span-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#e2e8f0] dark:border-[#1e293b]">
            <h2 className="font-editorial text-xl font-bold text-[#0f1f38] dark:text-[#f8fafc]">
              Recent MediaWiki Revisions
            </h2>
            <Link
              to="/search?q=Bangladesh"
              className="text-xs font-semibold text-[#1d4ed8] dark:text-sky-400 hover:underline"
            >
              Explore index
            </Link>
          </div>

          <div className="mt-4 border border-[#e2e8f0] dark:border-[#1e293b] rounded-lg bg-white dark:bg-[#111827] divide-y divide-[#e2e8f0] dark:divide-[#1e293b]">
            {loading ? (
              <div className="p-5 space-y-3">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="h-10 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                ))}
              </div>
            ) : (portal?.recentChanges || []).length === 0 ? (
              <div className="p-5 text-sm text-slate-500 dark:text-slate-400">
                No recent namespace revisions returned by the MediaWiki API.
              </div>
            ) : (
              portal!.recentChanges.slice(0, 6).map((rc) => {
                const delta = (rc.newlen || 0) - (rc.oldlen || 0);
                return (
                  <Link
                    key={rc.rcid}
                    to={`/wiki/${encodeURIComponent(rc.slug)}`}
                    className="block px-4 py-3 hover:bg-[#f8fafc] dark:hover:bg-[#1e293b]/50 transition-colors"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-semibold text-sm text-[#1d4ed8] dark:text-sky-400 truncate">
                        {rc.title}
                      </span>
                      <span
                        className={`text-xs font-mono-tabular shrink-0 ${
                          delta >= 0
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-rose-700 dark:text-rose-400'
                        }`}
                      >
                        {delta >= 0 ? `+${delta}` : delta} B
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span>Editor: {rc.user}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-tabular">
                        {new Date(rc.timestamp).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* Editorial Submission & Intake Desk */}
      <section className="mt-14 border border-[#e2e8f0] dark:border-[#1e293b] rounded-xl bg-[#f8fafc] dark:bg-[#111827] p-6 sm:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7">
            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[#92400e] dark:text-amber-300">
              Editorial Desk &amp; Intake Workflow
            </p>
            <h2 className="mt-2 font-editorial text-2xl font-bold text-[#0f1f38] dark:text-[#f8fafc]">
              Submit an article request, biography, or factual correction
            </h2>
            <p className="mt-2.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
              Every submission receives an instant Tracking ID, editorial source review, transparent pricing
              with institutional waivers up to 100%, WhatsApp and email follow-up, and permanent publication
              on MediaWiki at <span className="font-mono-tabular">en.bhikitia.org</span>.
            </p>
          </div>

          <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3 gap-3">
            <Link
              to="/submit"
              className="flex flex-col justify-between p-4 rounded-lg bg-[#0f1f38] hover:bg-[#1d4ed8] text-white transition-colors"
            >
              <FilePlus2 className="h-5 w-5 mb-3" aria-hidden="true" />
              <div>
                <div className="text-sm font-semibold">Submit Intake</div>
                <div className="text-xs text-slate-200 mt-0.5">Get a Tracking ID</div>
              </div>
            </Link>
            <Link
              to="/submit/track"
              className="flex flex-col justify-between p-4 rounded-lg bg-white dark:bg-[#0a0f1d] border border-[#e2e8f0] dark:border-[#1e293b] hover:border-[#1d4ed8] transition-colors"
            >
              <SearchCheck className="h-5 w-5 text-[#1d4ed8] dark:text-sky-400 mb-3" aria-hidden="true" />
              <div>
                <div className="text-sm font-semibold text-[#0f1f38] dark:text-[#f8fafc]">Track Status</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Verify &amp; pay</div>
              </div>
            </Link>
            <Link
              to="/submit/admin"
              className="flex flex-col justify-between p-4 rounded-lg bg-white dark:bg-[#0a0f1d] border border-[#e2e8f0] dark:border-[#1e293b] hover:border-[#1d4ed8] transition-colors"
            >
              <ShieldCheck className="h-5 w-5 text-[#0f1f38] dark:text-slate-300 mb-3" aria-hidden="true" />
              <div>
                <div className="text-sm font-semibold text-[#0f1f38] dark:text-[#f8fafc]">Staff Console</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Manage queue</div>
              </div>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
