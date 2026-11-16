import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, FilePlus2 } from 'lucide-react';
import { SearchBar } from '../components/SearchBar.tsx';
import type { WikiSearchResult } from '../types/index.ts';

export function SearchPage() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const [results, setResults] = useState<WikiSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = query ? `Search: ${query} — Bhikitia` : 'Search Encyclopedia — Bhikitia';
    if (!query.trim()) {
      setResults([]);
      return;
    }

    let mounted = true;
    setLoading(true);
    fetch(`/api/wiki/search?q=${encodeURIComponent(query)}&limit=25`)
      .then((res) => (res.ok ? res.json() : { results: [] }))
      .then((data) => {
        if (mounted) setResults(data.results || []);
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [query]);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-8 pb-16">
      <div className="pb-6 border-b border-[#e2e8f0] dark:border-[#1e293b]">
        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[#1d4ed8] dark:text-sky-400">
          MediaWiki Full-Text Index
        </p>
        <h1 className="mt-2 font-editorial text-2xl sm:text-3xl font-bold text-[#0f1f38] dark:text-[#f8fafc]">
          Search Bhikitia Articles
        </h1>
        <div className="mt-5">
          <SearchBar initialQuery={query} />
        </div>
      </div>

      <div className="mt-6">
        {!query.trim() ? (
          <div className="p-8 rounded-lg border border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#111827] text-center">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Enter a person, historical event, institution, or topic above to query the live MediaWiki repository.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-3 text-xs">
              {['Bangladesh', 'Fazlul Huq', 'SAFF Championship', 'Interim government'].map((sample) => (
                <Link
                  key={sample}
                  to={`/search?q=${encodeURIComponent(sample)}`}
                  className="px-3 py-1.5 rounded border border-[#cbd5e1] dark:border-[#334155] hover:border-[#1d4ed8] text-[#0f1f38] dark:text-[#f8fafc]"
                >
                  {sample}
                </Link>
              ))}
            </div>
          </div>
        ) : loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-24 rounded-lg bg-slate-200/60 dark:bg-slate-800/60 animate-pulse"
              />
            ))}
          </div>
        ) : results.length === 0 ? (
          <div className="p-8 rounded-lg border border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#111827]">
            <h2 className="font-editorial text-lg font-bold text-[#0f1f38] dark:text-[#f8fafc]">
              No matching articles for &ldquo;{query}&rdquo;
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              This topic is not yet published in Bhikitia. Submit a request with verifiable references for editorial review.
            </p>
            <Link
              to={`/submit?title=${encodeURIComponent(query)}`}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded bg-[#0f1f38] hover:bg-[#1d4ed8] text-white transition-colors"
            >
              <FilePlus2 className="h-4 w-4" aria-hidden="true" />
              <span>Request &ldquo;{query}&rdquo;</span>
            </Link>
          </div>
        ) : (
          <div>
            <div className="mb-3 text-xs text-slate-500 dark:text-slate-400">
              Showing <span className="font-mono-tabular font-semibold">{results.length}</span> matches for{' '}
              <span className="font-semibold text-[#0f1f38] dark:text-[#f8fafc]">&ldquo;{query}&rdquo;</span>
            </div>
            <div className="divide-y divide-[#e2e8f0] dark:divide-[#1e293b] border border-[#e2e8f0] dark:border-[#1e293b] rounded-lg bg-white dark:bg-[#111827]">
              {results.map((item) => (
                <Link
                  key={item.pageid}
                  to={`/wiki/${encodeURIComponent(item.slug)}`}
                  className="block p-5 hover:bg-[#f8fafc] dark:hover:bg-[#1e293b]/50 transition-colors group"
                >
                  <div className="flex items-center justify-between gap-4">
                    <h2 className="font-editorial text-lg font-bold text-[#1d4ed8] dark:text-sky-400 group-hover:underline">
                      {item.title}
                    </h2>
                    <ArrowRight className="h-4 w-4 text-slate-400 shrink-0" aria-hidden="true" />
                  </div>
                  <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {item.snippet}...
                  </p>
                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono-tabular">
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
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
