'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function ArticleHeaderSearch() {
  const [query, setQuery] = useState('');
  const router = useRouter();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    router.push(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : '/search');
  }

  return (
    <>
      <form
        onSubmit={submit}
        role="search"
        aria-label="Search the Bhikitia encyclopedia"
        className="hidden items-center gap-2 rounded-full border border-line bg-surface py-1 pl-3.5 pr-1.5 transition-colors focus-within:border-brand lg:flex"
      >
        <Search className="h-4 w-4 shrink-0 text-ink-subtle" aria-hidden="true" />
        <label className="sr-only" htmlFor="article-header-search">
          Search the Bhikitia encyclopedia
        </label>
        <input
          id="article-header-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search the encyclopedia"
          className="h-8 w-40 bg-transparent text-sm text-ink outline-none placeholder:text-ink-subtle md:w-52"
        />
      </form>
      <Link href="/search" className="bh-icon-btn lg:hidden" aria-label="Search the encyclopedia">
        <Search className="h-4 w-4" aria-hidden="true" />
      </Link>
    </>
  );
}
