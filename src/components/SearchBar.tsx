import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, Search } from 'lucide-react';
import type { WikiSearchResult } from '../types/index.ts';

interface SearchBarProps {
  initialQuery?: string;
  compact?: boolean;
  placeholder?: string;
}

export function SearchBar({
  initialQuery = '',
  compact = false,
  placeholder = 'Search encyclopedia articles, biographies, or topics...',
}: SearchBarProps) {
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<WikiSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/wiki/search?q=${encodeURIComponent(trimmed)}&limit=6`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data.results || []);
        }
      } catch {
        // Silent typeahead fallback
      } finally {
        setLoading(false);
      }
    }, 220);

    return () => clearTimeout(timer);
  }, [query]);

  const handleOpenArticle = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    setOpen(false);
    const slug = trimmed.replace(/\s+/g, '_');
    navigate(`/wiki/${encodeURIComponent(slug)}`);
  };

  const handleSearchAll = () => {
    const trimmed = query.trim();
    if (!trimmed) {
      navigate('/search');
      return;
    }
    setOpen(false);
    navigate(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <form
        onSubmit={handleOpenArticle}
        className={`flex flex-col sm:flex-row items-stretch sm:items-center gap-2 ${
          compact ? '' : 'bg-white dark:bg-[#111827] p-1.5 rounded border border-[#cbd5e1] dark:border-[#1e293b]'
        }`}
      >
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            placeholder={placeholder}
            aria-label="Search Bhikitia encyclopedia"
            className={`w-full pl-9 pr-3 text-sm bg-white dark:bg-[#0a0f1d] text-[#0f172a] dark:text-[#f8fafc] placeholder:text-slate-400 rounded border border-[#cbd5e1] dark:border-[#1e293b] focus:outline-none focus:border-[#1d4ed8] focus-visible:ring-2 focus-visible:ring-[#1d4ed8]/20 ${
              compact ? 'h-9' : 'h-11'
            }`}
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="submit"
            className={`inline-flex items-center justify-center gap-1.5 rounded bg-[#0f1f38] hover:bg-[#1d4ed8] text-white font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              compact ? 'h-9 px-3.5 text-xs' : 'h-11 px-4 text-sm'
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Open article</span>
          </button>
          {!compact && (
            <button
              type="button"
              onClick={handleSearchAll}
              className="inline-flex items-center justify-center gap-1.5 h-11 px-4 text-sm font-medium rounded border border-[#cbd5e1] dark:border-[#334155] text-[#1e293b] dark:text-[#f8fafc] hover:bg-[#f1f5f9] dark:hover:bg-[#1e293b] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Search all articles</span>
            </button>
          )}
        </div>
      </form>

      {open && query.trim().length >= 2 && (
        <div
          className="absolute left-0 right-0 top-full mt-1.5 z-40 rounded-lg bg-white dark:bg-[#111827] border border-[#cbd5e1] dark:border-[#1e293b] overflow-hidden"
          style={{
            boxShadow:
              '0 4px 12px -2px rgba(15, 31, 56, 0.08), 0 2px 6px -1px rgba(15, 31, 56, 0.04)',
          }}
        >
          <div className="px-3 py-2 bg-[#f8fafc] dark:bg-[#0a0f1d] border-b border-[#e2e8f0] dark:border-[#1e293b] flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{loading ? 'Searching live MediaWiki index...' : 'Encyclopedia matches'}</span>
            <button
              type="button"
              onClick={handleSearchAll}
              className="text-[#1d4ed8] dark:text-sky-400 hover:underline font-medium cursor-pointer"
            >
              Full search results
            </button>
          </div>
          {suggestions.length === 0 && !loading ? (
            <div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>No exact match found for &ldquo;{query.trim()}&rdquo;.</span>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  navigate(`/submit?title=${encodeURIComponent(query.trim())}`);
                }}
                className="text-xs font-semibold text-[#1d4ed8] dark:text-sky-400 hover:underline cursor-pointer"
              >
                Request article
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-[#e2e8f0] dark:divide-[#1e293b]">
              {suggestions.map((item) => (
                <li key={item.pageid}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      navigate(`/wiki/${encodeURIComponent(item.slug)}`);
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-[#f8fafc] dark:hover:bg-[#1e293b]/60 transition-colors flex items-start justify-between gap-3 cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-[#0f1f38] dark:text-[#f8fafc] truncate">
                        {item.title}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                        {item.snippet}
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
