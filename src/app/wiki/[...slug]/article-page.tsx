import Link from 'next/link';
import { CalendarDays, ChevronRight, ListTree } from 'lucide-react';
import { ArticleHeaderSearch } from '../../../components/ArticleHeaderSearch';
import { SanitizedHtml } from '../../../components/SanitizedHtml';
import { SiteFooter } from '../../../components/SiteFooter';
import { SiteHeader } from '../../../components/SiteHeader';
import { ThemeToggle } from '../../../components/ThemeToggle';
import type { WikiArticleResponse } from '../../../../server/types';
import { WikiRetry } from './wiki-retry';

function formatUpdated(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ArticlePage({
  article,
  stale = false,
  staleAgeMs,
}: {
  article: WikiArticleResponse;
  /** True when this is the last successful copy served during an outage. */
  stale?: boolean;
  staleAgeMs?: number;
}) {
  const showContents = article.sections.some(
    (section) => section.line.trim().toLowerCase() !== 'references'
  );
  const updated = formatUpdated(article.lastModified);
  const staleMinutes = staleAgeMs ? Math.max(1, Math.round(staleAgeMs / 60_000)) : null;

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <SiteHeader
        actions={
          <>
            <ArticleHeaderSearch />
            <ThemeToggle />
          </>
        }
      />

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs text-ink-subtle">
          <Link href="/" className="transition-colors hover:text-brand">
            Bhikitia
          </Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <Link href="/search" className="transition-colors hover:text-brand">
            Encyclopedia
          </Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="text-ink-muted">{article.displayTitle}</span>
        </nav>

        <header className="mt-6 border-b border-line pb-7">
          <p className="bh-eyebrow">Reference article</p>
          <h1 className="mt-3 max-w-4xl font-editorial text-3xl font-bold leading-tight tracking-tight text-ink sm:text-5xl">
            {article.displayTitle}
          </h1>
          {article.redirectedFrom && (
            <p className="mt-3 text-sm text-ink-subtle">
              Redirected from <span className="font-medium text-ink-muted">{article.redirectedFrom}</span>
            </p>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-2 text-xs">
            {article.sourceUrl && (
              <a href={article.sourceUrl} target="_blank" rel="noopener noreferrer" className="bh-chip">
                Source: Bhikitia
              </a>
            )}
            {/* A revision is only shown when MediaWiki returned a verified id and URL. */}
            {article.revId && article.revisionUrl && (
              <a href={article.revisionUrl} target="_blank" rel="noopener noreferrer" className="bh-chip">
                Revision {article.revId}
              </a>
            )}
            {updated && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-muted px-3 py-1.5 font-medium text-ink-muted">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                Updated {updated}
              </span>
            )}
          </div>
          {stale && (
            <div
              className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface-muted px-4 py-3 text-sm text-ink-muted"
              role="status"
            >
              <span>
                Showing the last saved copy of this article
                {staleMinutes ? ` (about ${staleMinutes} min old)` : ''} while the encyclopedia
                reconnects.
              </span>
              <WikiRetry slug={article.slug} label="Check again" />
            </div>
          )}
        </header>

        <div className="mt-9 grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-12">
          <div className="min-w-0">
            <SanitizedHtml className="mw-article-prose" html={article.html || ''} />
          </div>

          <aside className="order-first space-y-5 lg:order-last lg:sticky lg:top-24 lg:h-fit">
            {article.infoboxHtml && (
              <section className="mw-infobox-container overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
                <SanitizedHtml html={article.infoboxHtml} />
              </section>
            )}
            {showContents && (
              <section className="bh-card p-5">
                <h2 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-ink">
                  <ListTree className="h-4 w-4 text-brand" aria-hidden="true" />
                  Contents
                </h2>
                {article.sections.length ? (
                  <ol className="mt-3 space-y-0.5">
                    {article.sections.map((section) => (
                      <li key={section.index}>
                        <a
                          href={`#${section.anchor}`}
                          className="flex gap-2.5 rounded-lg px-2 py-1.5 text-sm text-ink-muted transition-colors hover:bg-surface-muted hover:text-brand"
                        >
                          <span className="font-mono-tabular text-xs leading-6 text-ink-subtle">
                            {section.number}
                          </span>
                          <span className="leading-6">{section.line}</span>
                        </a>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-3 text-sm text-ink-muted">This article has no section headings.</p>
                )}
              </section>
            )}
          </aside>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
