import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, LoaderCircle, Search, Sparkles, TriangleAlert } from 'lucide-react';
import type { WikiSearchResult } from '../types/index.ts';

interface SearchBarProps {
  initialQuery?: string;
  compact?: boolean;
  placeholder?: string;
}

const AUTOCOMPLETE_TIMEOUT_MS = 3500;
/**
 * Keystroke debounce. Autocomplete is the biggest request amplifier in the
 * product, so we wait for a typing pause before asking the server, then reuse
 * the answer for the rest of the session (bounded to the last 24 queries).
 */
const AUTOCOMPLETE_DEBOUNCE_MS = 300;
const AUTOCOMPLETE_MIN_LENGTH = 2;
const SESSION_CACHE_MAX = 24;
/** Matches the server-side cap so oversize queries are never sent. */
const MAX_QUERY_LENGTH = 200;

const sessionSuggestions = new Map<string, WikiSearchResult[]>();

function readSessionCache(key: string): WikiSearchResult[] | undefined {
  const hit = sessionSuggestions.get(key);
  if (!hit) return undefined;
  // Refresh recency (Map preserves insertion order).
  sessionSuggestions.delete(key);
  sessionSuggestions.set(key, hit);
  return hit;
}

function writeSessionCache(key: string, value: WikiSearchResult[]): void {
  sessionSuggestions.delete(key);
  sessionSuggestions.set(key, value);
  while (sessionSuggestions.size > SESSION_CACHE_MAX) {
    const oldest = sessionSuggestions.keys().next();
    if (oldest.done) return;
    sessionSuggestions.delete(oldest.value);
  }
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
  const [requestError, setRequestError] = useState(false);
  /** Bumped by "Try again" so the effect below issues a genuinely fresh request. */
  const [reloadToken, setReloadToken] = useState(0);
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
    const trimmed = query.trim().slice(0, MAX_QUERY_LENGTH);
    if (trimmed.length < AUTOCOMPLETE_MIN_LENGTH) {
      setSuggestions([]);
      setLoading(false);
      setRequestError(false);
      return;
    }

    const cacheKey = trimmed.toLocaleLowerCase();
    const cachedSuggestions = readSessionCache(cacheKey);
    if (cachedSuggestions) {
      setSuggestions(cachedSuggestions);
      setRequestError(false);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setRequestError(false);
      let timedOut = false;
      const timeout = window.setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, AUTOCOMPLETE_TIMEOUT_MS);
      try {
        const res = await fetch(`/api/wiki/search?q=${encodeURIComponent(trimmed)}&limit=6`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error('Search request failed.');
        const data = await res.json();
        const list = Array.isArray(data.results) ? data.results : [];
        writeSessionCache(cacheKey, list);
        setSuggestions(list);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError' && !timedOut) return;
        setSuggestions([]);
        setRequestError(true);
      } finally {
        window.clearTimeout(timeout);
        if (!controller.signal.aborted || timedOut) setLoading(false);
      }
    }, AUTOCOMPLETE_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, reloadToken]);

  const handleSearchAll = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      navigate('/search');
      return;
    }
    setOpen(false);
    navigate(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  const showDropdown = open && query.trim().length >= AUTOCOMPLETE_MIN_LENGTH;

  return (
    <div ref={containerRef} className="relative w-full">
      <form
        onSubmit={handleSearchAll}
        role="search"
        aria-label="Search the Bhikitia encyclopedia"
        className={
          compact
            ? 'flex items-center gap-2 rounded-full border border-line bg-surface px-3 transition-colors focus-within:border-brand'
            : 'flex items-center gap-2 rounded-full border border-line-strong bg-surface p-1.5 pl-4 shadow-card transition-colors focus-within:border-brand'
        }
      >
        <Search className="h-4 w-4 shrink-0 text-ink-subtle" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          aria-label="Search the Bhikitia encyclopedia"
          className={
            compact
              ? 'h-9 min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-subtle'
              : 'h-10 min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-subtle'
          }
        />
        {!compact && (
          <button type="submit" className="bh-btn bh-btn-primary h-10 px-5">
            Search
          </button>
        )}
      </form>

      {showDropdown && (
        <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-40 overflow-hidden rounded-2xl border border-line bg-surface shadow-pop">
          <div className="flex items-center justify-between gap-3 border-b border-line bg-surface-muted px-4 py-2.5 text-xs">
            <span className="inline-flex items-center gap-1.5 font-semibold text-ink-muted">
              {loading ? (
                <>
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin text-brand" aria-hidden="true" />
                  Searching Bhikitia…
                </>
              ) : requestError ? (
                <>
                  <TriangleAlert className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                  Search is temporarily unavailable
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5 text-brand" aria-hidden="true" />
                  Encyclopedia matches
                </>
              )}
            </span>
            <button type="button" onClick={handleSearchAll} className="font-semibold text-brand hover:underline">
              Full search results
            </button>
          </div>

          {requestError && !loading ? (
            <div className="px-4 py-4 text-sm text-ink-muted">
              <p>We could not load live matches right now.</p>
              <button
                type="button"
                onClick={() => setReloadToken((token) => token + 1)}
                className="mt-2 text-xs font-semibold text-brand hover:underline"
              >
                Try again
              </button>
            </div>
          ) : loading && suggestions.length === 0 ? (
            <div className="space-y-2 p-3">
              {[0, 1, 2].map((row) => (
                <div key={row} className="h-9 animate-pulse rounded-lg bg-surface-muted" />
              ))}
            </div>
          ) : suggestions.length === 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-4 text-sm text-ink-muted">
              <span>No exact match found for &ldquo;{query.trim()}&rdquo;.</span>
              <span className="text-xs text-ink-subtle">Try another search</span>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {suggestions.map((item) => (
                <li key={item.pageid}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      window.location.assign(`/wiki/${encodeURIComponent(item.slug)}`);
                    }}
                    className="group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-muted"
                  >
                    <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                      <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">{item.title}</span>
                      {item.snippet && (
                        <span className="mt-0.5 line-clamp-1 block text-xs text-ink-subtle">{item.snippet}</span>
                      )}
                    </span>
                    <ArrowRight
                      className="mt-1 h-4 w-4 shrink-0 text-ink-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-brand"
                      aria-hidden="true"
                    />
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
