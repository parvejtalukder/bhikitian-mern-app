import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, BookOpen, Compass, Search, TriangleAlert } from 'lucide-react';
import { SearchBar } from '../components/SearchBar.tsx';
import { HOMEPAGE_SUGGESTED_SEARCHES } from '../lib/homepage';
import type { WikiSearchResult } from '../types/index.ts';

export function SearchPage() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const [results, setResults] = useState<WikiSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    document.title = query ? `Search: ${query} — The Bhikitia Encyclopedia` : 'Search the Encyclopedia — The Bhikitia Encyclopedia';
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(false);
    fetch(`/api/wiki/search?q=${encodeURIComponent(query)}&limit=25`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error('Search request failed.');
        return res.json();
      })
      .then((data) => {
        if (!controller.signal.aborted) setResults(Array.isArray(data.results) ? data.results : []);
      })
      .catch((requestError: unknown) => {
        if (requestError instanceof DOMException && requestError.name === 'AbortError') return;
        if (!controller.signal.aborted) {
          setResults([]);
          setError(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [query]);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-20 pt-10 sm:px-6 lg:px-8">
      <header className="border-b border-line pb-7">
        <p className="bh-eyebrow">Search the collection</p>
        <h1 className="mt-3 font-editorial text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Search Bhikitia Articles
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-muted">
          Find biographies, places, historical events, institutions, and ideas from the encyclopedia.
        </p>
        <div className="mt-6 lg:hidden">
          <SearchBar initialQuery={query} />
        </div>
      </header>

      <div className="mt-8">
        {!query.trim() ? (
          <div className="bh-card flex flex-col items-center px-6 py-14 text-center">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand">
              <Compass className="h-6 w-6" aria-hidden="true" />
            </span>
            <h2 className="mt-5 font-editorial text-xl font-bold text-ink">Start with a subject</h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-ink-muted">
              Search for a person, place, historical event, institution, or topic in the encyclopedia. Try one of
              the suggestions below to get started.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {HOMEPAGE_SUGGESTED_SEARCHES.map((sample) => (
                <Link key={sample} to={`/search?q=${encodeURIComponent(sample)}`} className="bh-chip">
                  {sample}
                </Link>
              ))}
            </div>
          </div>
        ) : loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((row) => (
              <div key={row} className="h-28 animate-pulse rounded-2xl border border-line bg-surface-muted/60" />
            ))}
          </div>
        ) : error ? (
          <div className="bh-card flex flex-col items-start px-6 py-10 sm:px-8" role="alert">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-soft text-accent">
              <TriangleAlert className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2 className="mt-4 font-editorial text-xl font-bold text-ink">Search is temporarily unavailable</h2>
            <p className="mt-2 text-sm leading-6 text-ink-muted">Search did not respond. Please try again.</p>
            <button type="button" onClick={() => window.location.reload()} className="bh-btn bh-btn-primary mt-6">
              Try again
            </button>
          </div>
        ) : results.length === 0 ? (
          <div className="bh-card flex flex-col items-center px-6 py-14 text-center">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-muted text-ink-subtle">
              <Search className="h-6 w-6" aria-hidden="true" />
            </span>
            <h2 className="mt-5 font-editorial text-xl font-bold text-ink">
              No matching articles for &ldquo;{query}&rdquo;
            </h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-ink-muted">
              Try a broader topic or a different spelling. Searching a single word or a full name works best.
            </p>
          </div>
        ) : (
          <>
            <p className="text-xs text-ink-muted">
              Showing <span className="font-mono-tabular font-semibold text-ink">{results.length}</span> matches for{' '}
              <span className="font-semibold text-ink">&ldquo;{query}&rdquo;</span>
            </p>
            <ul className="mt-4 space-y-3">
              {results.map((item) => (
                <li key={item.pageid}>
                  <a
                    href={`/wiki/${encodeURIComponent(item.slug)}`}
                    className="bh-card bh-card-hover group flex items-start gap-4 p-5"
                  >
                    <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
                      <BookOpen className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-3">
                        <span className="font-editorial text-lg font-bold text-ink transition-colors group-hover:text-brand">
                          {item.title}
                        </span>
                        <ArrowRight
                          className="mt-1 h-4 w-4 shrink-0 text-ink-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-brand"
                          aria-hidden="true"
                        />
                      </span>
                      {item.snippet && (
                        <span className="mt-1.5 block text-sm leading-6 text-ink-muted">
                          {item.snippet}
                          {item.snippet.endsWith('...') ? '' : '...'}
                        </span>
                      )}
                      <span className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-subtle font-mono-tabular">
                        <span>{item.wordcount.toLocaleString()} words</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          Updated{' '}
                          {new Date(item.timestamp).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      </span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
