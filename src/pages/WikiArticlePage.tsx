import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowUpRight,
  BookOpen,
  Check,
  Code2,
  Copy,
  ExternalLink,
  FilePlus2,
  History,
  List,
  MessageSquare,
  RefreshCw,
  Wrench,
} from 'lucide-react';
import { SearchBar } from '../components/SearchBar.tsx';
import type { WikiArticleResponse, WikiRevision } from '../types/index.ts';

type ArticleTab = 'read' | 'source' | 'history' | 'discussion' | 'tools';

export function WikiArticlePage() {
  const params = useParams();
  const navigate = useNavigate();
  const rawSlug = params['*'] || 'Main_Page';

  const [article, setArticle] = useState<WikiArticleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ArticleTab>('read');

  const [sourceText, setSourceText] = useState<string | null>(null);
  const [sourceLoading, setSourceLoading] = useState(false);

  const [revisions, setRevisions] = useState<WikiRevision[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [tocMobileOpen, setTocMobileOpen] = useState(false);
  const [copiedCanonical, setCopiedCanonical] = useState(false);
  const [revalidating, setRevalidating] = useState(false);

  const loadArticle = async (slugToLoad: string, fresh = false) => {
    setLoading(true);
    setError(null);
    setActiveTab('read');
    setSourceText(null);
    setRevisions([]);

    try {
      const res = await fetch(
        `/api/wiki/article?slug=${encodeURIComponent(slugToLoad)}${fresh ? '&fresh=1' : ''}`
      );
      if (!res.ok) {
        throw new Error(`Unable to load MediaWiki article (HTTP ${res.status})`);
      }
      const data: WikiArticleResponse = await res.json();
      setArticle(data);
      document.title = data.exists
        ? `${data.displayTitle} — Bhikitia`
        : `${data.title} (Not Found) — Bhikitia`;

      // Update canonical link tag dynamically
      let canonicalEl = document.querySelector('link[rel="canonical"]');
      if (!canonicalEl) {
        canonicalEl = document.createElement('link');
        canonicalEl.setAttribute('rel', 'canonical');
        document.head.appendChild(canonicalEl);
      }
      canonicalEl.setAttribute('href', data.canonicalUrl);

      // Canonicalize redirected URL without losing redirect notice
      if (data.exists && data.redirectedFrom && data.slug !== slugToLoad) {
        navigate(`/wiki/${encodeURIComponent(data.slug)}`, {
          replace: true,
          state: { redirectedFrom: data.redirectedFrom },
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect to MediaWiki API.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadArticle(rawSlug);
  }, [rawSlug]);

  const handleTabSwitch = async (tab: ArticleTab) => {
    setActiveTab(tab);
    if (!article?.exists) return;

    if (tab === 'source' && sourceText === null && !sourceLoading) {
      setSourceLoading(true);
      try {
        const res = await fetch(`/api/wiki/source?slug=${encodeURIComponent(article.slug)}`);
        if (res.ok) {
          const data = await res.json();
          setSourceText(data.wikitext || '(No wikitext content returned)');
        }
      } finally {
        setSourceLoading(false);
      }
    }

    if (tab === 'history' && revisions.length === 0 && !historyLoading) {
      setHistoryLoading(true);
      try {
        const res = await fetch(`/api/wiki/history?slug=${encodeURIComponent(article.slug)}`);
        if (res.ok) {
          const data = await res.json();
          setRevisions(data.revisions || []);
        }
      } finally {
        setHistoryLoading(false);
      }
    }
  };

  // Intercept internal /wiki/ and /submit? clicks inside parsed MediaWiki HTML
  const handleProseClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    const anchor = target?.closest('a');
    if (!anchor) return;

    const href = anchor.getAttribute('href');
    if (!href) return;

    if (href.startsWith('/wiki/') || href.startsWith('/submit')) {
      e.preventDefault();
      navigate(href);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (href.startsWith('#')) {
      e.preventDefault();
      const id = decodeURIComponent(href.slice(1));
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  const handleCopyCanonical = async () => {
    if (!article) return;
    await navigator.clipboard.writeText(article.canonicalUrl);
    setCopiedCanonical(true);
    setTimeout(() => setCopiedCanonical(false), 1800);
  };

  const handleRefreshArticle = async () => {
    setRevalidating(true);
    await loadArticle(article?.slug || rawSlug, true);
    setRevalidating(false);
  };

  return (
    <div className="max-w-[1340px] mx-auto px-4 sm:px-6 pt-6 pb-16">
      {/* Compact Encyclopedia Search Strip */}
      <div className="mb-6 pb-4 border-b border-[#e2e8f0] dark:border-[#1e293b] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
          <Link to="/" className="hover:text-[#1d4ed8] dark:hover:text-sky-400">
            Bhikitia
          </Link>
          <span aria-hidden="true">/</span>
          <span>Encyclopedia</span>
          {article?.slug && (
            <>
              <span aria-hidden="true">/</span>
              <span className="font-mono-tabular text-[#0f1f38] dark:text-[#f8fafc] truncate max-w-[240px]">
                {article.slug}
              </span>
            </>
          )}
        </div>
        <div className="w-full sm:w-96">
          <SearchBar compact placeholder="Jump to or search another article..." />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="hidden lg:block lg:col-span-2 space-y-2.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-5 bg-slate-200/70 dark:bg-slate-800 rounded animate-pulse" />
            ))}
          </div>
          <div className="lg:col-span-7 space-y-4">
            <div className="h-10 w-2/3 bg-slate-200/70 dark:bg-slate-800 rounded animate-pulse" />
            <div className="h-4 w-full bg-slate-200/70 dark:bg-slate-800 rounded animate-pulse" />
            <div className="h-4 w-5/6 bg-slate-200/70 dark:bg-slate-800 rounded animate-pulse" />
            <div className="h-48 w-full bg-slate-200/70 dark:bg-slate-800 rounded animate-pulse" />
          </div>
          <div className="lg:col-span-3">
            <div className="h-72 bg-slate-200/70 dark:bg-slate-800 rounded-lg animate-pulse" />
          </div>
        </div>
      ) : error ? (
        <div className="max-w-2xl mx-auto p-6 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-rose-700 dark:text-rose-300 shrink-0 mt-0.5" />
            <div>
              <h1 className="font-editorial text-lg font-bold text-rose-900 dark:text-rose-200">
                Unable to reach MediaWiki backend
              </h1>
              <p className="mt-1 text-sm text-rose-800 dark:text-rose-300">{error}</p>
              <button
                type="button"
                onClick={() => loadArticle(rawSlug, true)}
                className="mt-4 px-4 py-2 text-xs font-semibold rounded bg-[#0f1f38] text-white hover:bg-[#1d4ed8] transition-colors cursor-pointer"
              >
                Retry MediaWiki Fetch
              </button>
            </div>
          </div>
        </div>
      ) : !article?.exists ? (
        /* Missing Page State */
        <div className="max-w-3xl mx-auto bg-white dark:bg-[#111827] border border-[#e2e8f0] dark:border-[#1e293b] rounded-xl p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-amber-700 dark:text-amber-300">
            Missing Encyclopedia Entry
          </p>
          <h1 className="mt-2 font-editorial text-2xl sm:text-3xl font-bold text-[#0f1f38] dark:text-[#f8fafc]">
            &ldquo;{article?.title}&rdquo; does not exist yet on Bhikitia
          </h1>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            No published MediaWiki revision was found for <span className="font-mono-tabular">/wiki/{article?.slug}</span>.
            You can submit an editorial article request with verifiable references, or browse close matches below.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              to={`/submit?title=${encodeURIComponent(article?.title || '')}`}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded bg-[#0f1f38] hover:bg-[#1d4ed8] text-white transition-colors"
            >
              <FilePlus2 className="h-4 w-4" aria-hidden="true" />
              <span>Request this article</span>
            </Link>
            <a
              href={article?.editUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded border border-[#cbd5e1] dark:border-[#334155] text-[#0f1f38] dark:text-[#f8fafc] hover:bg-[#f1f5f9] dark:hover:bg-[#1e293b] transition-colors"
            >
              <span>Create on Staff MediaWiki</span>
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </div>

          {article?.suggestions && article.suggestions.length > 0 && (
            <div className="mt-8 pt-6 border-t border-[#e2e8f0] dark:border-[#1e293b]">
              <h2 className="text-sm font-semibold text-[#0f1f38] dark:text-[#f8fafc] mb-3">
                Related published entries
              </h2>
              <div className="divide-y divide-[#e2e8f0] dark:divide-[#1e293b] border border-[#e2e8f0] dark:border-[#1e293b] rounded-lg">
                {article.suggestions.map((s) => (
                  <Link
                    key={s.slug}
                    to={`/wiki/${encodeURIComponent(s.slug)}`}
                    className="block p-3.5 hover:bg-[#f8fafc] dark:hover:bg-[#1e293b]/50 transition-colors"
                  >
                    <div className="font-semibold text-sm text-[#1d4ed8] dark:text-sky-400">
                      {s.title}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                      {s.snippet}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Asymmetric 3-Column Encyclopedia Layout */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT RAIL (~240px / 2 cols): Table of Contents & Languages */}
          <aside className="lg:col-span-2 lg:sticky lg:top-20 space-y-5">
            {/* Mobile TOC Drawer Toggle */}
            {article.sections.length > 0 && (
              <div className="lg:hidden border border-[#e2e8f0] dark:border-[#1e293b] rounded-lg bg-[#f8fafc] dark:bg-[#111827]">
                <button
                  type="button"
                  onClick={() => setTocMobileOpen((v) => !v)}
                  className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-semibold text-[#0f1f38] dark:text-[#f8fafc] cursor-pointer"
                >
                  <span className="inline-flex items-center gap-2">
                    <List className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Contents ({article.sections.length})</span>
                  </span>
                  <span>{tocMobileOpen ? 'Hide' : 'Show'}</span>
                </button>
                {tocMobileOpen && (
                  <nav className="px-4 pb-3 border-t border-[#e2e8f0] dark:border-[#1e293b] pt-2 space-y-1.5">
                    {article.sections.map((sec) => (
                      <a
                        key={sec.index}
                        href={`#${sec.anchor}`}
                        onClick={() => setTocMobileOpen(false)}
                        className="block text-xs text-slate-600 dark:text-slate-300 hover:text-[#1d4ed8]"
                        style={{ paddingLeft: `${Math.max(0, Number(sec.level) - 2) * 10}px` }}
                      >
                        <span className="font-mono-tabular text-slate-400 mr-1.5">{sec.number}</span>
                        <span>{sec.line}</span>
                      </a>
                    ))}
                  </nav>
                )}
              </div>
            )}

            {/* Desktop Left TOC */}
            <div className="hidden lg:block border border-[#e2e8f0] dark:border-[#1e293b] rounded-lg bg-[#f8fafc] dark:bg-[#111827] p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-500 dark:text-slate-400 mb-3">
                Contents
              </div>
              {article.sections.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">Single-section entry</p>
              ) : (
                <nav className="space-y-1.5" aria-label="Article table of contents">
                  {article.sections.map((sec) => (
                    <a
                      key={sec.index}
                      href={`#${sec.anchor}`}
                      className="block text-xs leading-snug text-slate-600 dark:text-slate-300 hover:text-[#1d4ed8] dark:hover:text-sky-400 transition-colors"
                      style={{ paddingLeft: `${Math.max(0, Number(sec.level) - 2) * 10}px` }}
                    >
                      <span className="font-mono-tabular text-slate-400 mr-1">{sec.number}</span>
                      <span>{sec.line}</span>
                    </a>
                  ))}
                </nav>
              )}
            </div>

            {/* Language Switcher */}
            {article.langLinks.length > 0 && (
              <div className="hidden lg:block border border-[#e2e8f0] dark:border-[#1e293b] rounded-lg bg-[#f8fafc] dark:bg-[#111827] p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-500 dark:text-slate-400 mb-2">
                  Languages
                </div>
                <ul className="space-y-1.5">
                  {article.langLinks.map((lang) => (
                    <li key={lang.lang}>
                      <a
                        href={lang.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[#1d4ed8] dark:text-sky-400 hover:underline inline-flex items-center gap-1"
                      >
                        <span>{lang.autonym}</span>
                        <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>

          {/* CENTER CANVAS (max-w-3xl / 7 cols): Title, Action Bar, Prose */}
          <article className="lg:col-span-7 min-w-0">
            {article.redirectedFrom && (
              <div className="mb-4 px-3.5 py-2 rounded bg-[#f8fafc] dark:bg-[#111827] border border-[#e2e8f0] dark:border-[#1e293b] text-xs text-slate-600 dark:text-slate-300">
                Redirected from <span className="font-semibold">{article.redirectedFrom}</span>
              </div>
            )}

            <header className="pb-4 border-b border-[#e2e8f0] dark:border-[#1e293b]">
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-1.5 flex flex-wrap items-center gap-2">
                <span>Bhikitia Encyclopedia</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-tabular">Rev #{article.revId}</span>
                {article.lastModified && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>
                      Updated{' '}
                      {new Date(article.lastModified).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </>
                )}
              </div>
              <h1 className="font-editorial text-3xl sm:text-[2.125rem] font-bold leading-[1.25] tracking-[-0.015em] text-[#0f1f38] dark:text-[#f8fafc] text-balance">
                {article.displayTitle}
              </h1>
            </header>

            {/* MediaWiki Action Bar */}
            <div className="flex items-center justify-between border-b border-[#e2e8f0] dark:border-[#1e293b] overflow-x-auto">
              <div className="flex items-center gap-1 sm:gap-2" role="tablist">
                {[
                  { id: 'read' as const, label: 'Read', Icon: BookOpen },
                  { id: 'source' as const, label: 'View Source', Icon: Code2 },
                  { id: 'history' as const, label: 'History', Icon: History },
                  { id: 'discussion' as const, label: 'Discussion', Icon: MessageSquare },
                  { id: 'tools' as const, label: 'Tools', Icon: Wrench },
                ].map((tab) => {
                  const active = activeTab === tab.id;
                  const Icon = tab.Icon;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => handleTabSwitch(tab.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-2.5 text-xs sm:text-sm whitespace-nowrap shrink-0 border-b-2 transition-colors cursor-pointer ${
                        active
                          ? 'border-[#1d4ed8] text-[#0f1f38] dark:text-[#f8fafc] font-semibold'
                          : 'border-transparent text-[#64748b] dark:text-slate-400 hover:text-[#0f1f38] dark:hover:text-[#f8fafc]'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              <a
                href={article.editUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#1d4ed8] dark:text-sky-400 hover:underline whitespace-nowrap shrink-0"
              >
                <span>Staff Edit</span>
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            </div>

            {/* Tablet / Mobile Infobox placement right below title/tabs */}
            {activeTab === 'read' && article.infoboxHtml && (
              <div className="lg:hidden mt-6 rounded-lg overflow-hidden border border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#111827] mw-infobox-container">
                <div
                  onClick={handleProseClick}
                  dangerouslySetInnerHTML={{ __html: article.infoboxHtml }}
                />
              </div>
            )}

            {/* Tab Panels */}
            {activeTab === 'read' && (
              <div className="mt-6 max-w-3xl">
                <div
                  className="mw-article-prose"
                  onClick={handleProseClick}
                  dangerouslySetInnerHTML={{ __html: article.html || '' }}
                />

                {article.categories.length > 0 && (
                  <div className="mt-10 pt-5 border-t border-[#e2e8f0] dark:border-[#1e293b] text-xs text-slate-600 dark:text-slate-400">
                    <span className="font-semibold text-[#0f1f38] dark:text-[#f8fafc] mr-2">
                      Categories:
                    </span>
                    {article.categories.map((cat, idx) => (
                      <React.Fragment key={cat}>
                        {idx > 0 && <span className="mx-1.5" aria-hidden="true">·</span>}
                        <Link
                          to={`/search?q=${encodeURIComponent(cat)}`}
                          className="text-[#1d4ed8] dark:text-sky-400 hover:underline"
                        >
                          {cat}
                        </Link>
                      </React.Fragment>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'source' && (
              <div className="mt-6 border border-[#e2e8f0] dark:border-[#1e293b] rounded-lg bg-white dark:bg-[#111827] overflow-hidden">
                <div className="px-4 py-3 bg-[#f8fafc] dark:bg-[#0a0f1d] border-b border-[#e2e8f0] dark:border-[#1e293b] flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#0f1f38] dark:text-[#f8fafc]">
                    MediaWiki Wikitext Source (Read-Only Mirror)
                  </span>
                  <a
                    href={article.editUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#1d4ed8] dark:text-sky-400 hover:underline inline-flex items-center gap-1"
                  >
                    <span>Edit on edit.bhikitia.org</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                {sourceLoading ? (
                  <div className="p-6 text-sm text-slate-500">Loading wikitext from MediaWiki...</div>
                ) : (
                  <pre className="p-4 text-xs font-mono-tabular leading-relaxed overflow-x-auto text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                    {sourceText}
                  </pre>
                )}
              </div>
            )}

            {activeTab === 'history' && (
              <div className="mt-6 border border-[#e2e8f0] dark:border-[#1e293b] rounded-lg bg-white dark:bg-[#111827] overflow-hidden">
                <div className="px-4 py-3 bg-[#f8fafc] dark:bg-[#0a0f1d] border-b border-[#e2e8f0] dark:border-[#1e293b] text-xs font-semibold text-[#0f1f38] dark:text-[#f8fafc]">
                  MediaWiki Revision History (Latest 20)
                </div>
                {historyLoading ? (
                  <div className="p-6 text-sm text-slate-500">Loading revision log...</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#f8fafc] dark:bg-[#0a0f1d] text-slate-500 dark:text-slate-400 border-b border-[#e2e8f0] dark:border-[#1e293b]">
                        <tr>
                          <th className="py-2.5 px-3 font-semibold">Rev ID</th>
                          <th className="py-2.5 px-3 font-semibold">Timestamp</th>
                          <th className="py-2.5 px-3 font-semibold">Contributor</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Size</th>
                          <th className="py-2.5 px-3 font-semibold">Edit Summary</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#e2e8f0] dark:divide-[#1e293b]">
                        {revisions.map((rev) => (
                          <tr key={rev.revid} className="hover:bg-[#f8fafc] dark:hover:bg-[#1e293b]/40">
                            <td className="py-2.5 px-3 font-mono-tabular text-[#1d4ed8] dark:text-sky-400">
                              #{rev.revid}
                            </td>
                            <td className="py-2.5 px-3 font-mono-tabular whitespace-nowrap">
                              {new Date(rev.timestamp).toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3 font-medium">{rev.user}</td>
                            <td className="py-2.5 px-3 font-mono-tabular text-right">
                              {rev.size.toLocaleString()} B
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                              {rev.comment || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'discussion' && (
              <div className="mt-6 p-6 rounded-lg border border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#111827]">
                <h2 className="font-editorial text-lg font-bold text-[#0f1f38] dark:text-[#f8fafc]">
                  Editorial Discussion &amp; Corrections
                </h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Public Talk page edits are managed by authenticated MediaWiki editors. External contributors
                  wishing to suggest factual updates, new citations, or corrections to{' '}
                  <span className="font-semibold">{article.displayTitle}</span> can submit a tracked intake
                  request directly to the editorial desk.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Link
                    to={`/submit?title=${encodeURIComponent(article.title)}&type=update_correction`}
                    className="px-4 py-2 text-xs font-semibold rounded bg-[#0f1f38] hover:bg-[#1d4ed8] text-white transition-colors"
                  >
                    Submit Correction Request
                  </Link>
                  <a
                    href={article.editUrl.replace('action=edit', '').replace('title=', 'title=Talk:')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 text-xs font-medium rounded border border-[#cbd5e1] dark:border-[#334155] text-[#0f1f38] dark:text-[#f8fafc] hover:bg-[#f1f5f9] dark:hover:bg-[#1e293b] transition-colors inline-flex items-center gap-1.5"
                  >
                    <span>Open Staff Talk Page</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            )}

            {activeTab === 'tools' && (
              <div className="mt-6 p-6 rounded-lg border border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#111827] space-y-5">
                <div>
                  <h2 className="font-editorial text-lg font-bold text-[#0f1f38] dark:text-[#f8fafc]">
                    Canonical Metadata &amp; Cache Tools
                  </h2>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Cache state: <span className="font-mono-tabular font-semibold">{article.cacheStatus}</span> ·
                    Fetched {new Date(article.fetchedAt).toLocaleTimeString()}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                    Public Canonical URL
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={article.canonicalUrl}
                      className="flex-1 h-9 px-3 text-xs font-mono-tabular rounded border border-[#cbd5e1] dark:border-[#334155] bg-[#f8fafc] dark:bg-[#0a0f1d]"
                    />
                    <button
                      type="button"
                      onClick={handleCopyCanonical}
                      className="h-9 px-3 text-xs font-semibold rounded border border-[#cbd5e1] dark:border-[#334155] hover:bg-[#f1f5f9] dark:hover:bg-[#1e293b] inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      {copiedCanonical ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                      <span>{copiedCanonical ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                    Scholarly Citation
                  </label>
                  <div className="p-3 rounded border border-[#e2e8f0] dark:border-[#1e293b] bg-[#f8fafc] dark:bg-[#0a0f1d] text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                    Bhikitia contributors. &ldquo;{article.displayTitle}.&rdquo;{' '}
                    <em>Bhikitia, The Open Encyclopedia</em>. MediaWiki Revision #{article.revId}.{' '}
                    {article.canonicalUrl}.
                  </div>
                </div>

                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleRefreshArticle}
                    disabled={revalidating}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded bg-[#0f1f38] hover:bg-[#1d4ed8] text-white transition-colors cursor-pointer disabled:opacity-60"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${revalidating ? 'animate-spin' : ''}`} />
                    <span>{revalidating ? 'Refreshing...' : 'Force Fresh MediaWiki Parse'}</span>
                  </button>
                </div>
              </div>
            )}
          </article>

          {/* RIGHT RAIL (~300px / 3 cols): Extracted Infobox & Reference Metadata */}
          <aside className="lg:col-span-3 space-y-5 lg:sticky lg:top-20">
            {article.infoboxHtml && (
              <div className="hidden lg:block rounded-lg overflow-hidden border border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#111827] mw-infobox-container">
                <div
                  onClick={handleProseClick}
                  dangerouslySetInnerHTML={{ __html: article.infoboxHtml }}
                />
              </div>
            )}

            <div className="rounded-lg border border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#111827] p-4 space-y-3 text-xs">
              <div className="font-semibold text-[#0f1f38] dark:text-[#f8fafc] pb-2 border-b border-[#e2e8f0] dark:border-[#1e293b]">
                Archival Record Metadata
              </div>
              <dl className="space-y-2">
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500 dark:text-slate-400">Page ID</dt>
                  <dd className="font-mono-tabular font-medium">{article.pageId}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500 dark:text-slate-400">Revision</dt>
                  <dd className="font-mono-tabular font-medium">#{article.revId}</dd>
                </div>
                {article.lastEditor && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500 dark:text-slate-400">Last Editor</dt>
                    <dd className="font-medium truncate max-w-[150px]">{article.lastEditor}</dd>
                  </div>
                )}
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500 dark:text-slate-400">Cache</dt>
                  <dd className="font-mono-tabular">{article.cacheStatus}</dd>
                </div>
              </dl>

              <div className="pt-2 border-t border-[#e2e8f0] dark:border-[#1e293b] flex flex-col gap-2">
                <Link
                  to={`/submit?title=${encodeURIComponent(article.title)}&type=update_correction`}
                  className="w-full text-center py-2 px-3 rounded border border-[#cbd5e1] dark:border-[#334155] font-medium text-[#0f1f38] dark:text-[#f8fafc] hover:bg-[#f1f5f9] dark:hover:bg-[#1e293b] transition-colors"
                >
                  Suggest an Update
                </Link>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
