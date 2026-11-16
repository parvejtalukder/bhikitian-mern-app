import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter } from '../components/SiteFooter';
import { SiteHeader } from '../components/SiteHeader';
import { ThemeToggle } from '../components/ThemeToggle';
import { HOMEPAGE_SUGGESTED_SEARCHES } from '../lib/homepage';

export const metadata: Metadata = {
  title: 'Page not found',
  description: 'The page you are looking for is not available in The Bhikitia Encyclopedia.',
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <SiteHeader actions={<ThemeToggle />} />

      <main className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 py-20 text-center sm:px-6 sm:py-28">
        <p className="font-mono-tabular text-5xl font-bold leading-none tracking-tight text-line-strong sm:text-6xl">
          404
        </p>
        <h1 className="mt-5 font-editorial text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Page not found
        </h1>
        <p className="mt-4 max-w-lg text-[15px] leading-7 text-ink-muted">
          The page you requested is not part of the encyclopedia. It may have moved, or the article has not been
          published yet.
        </p>

        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Link href="/" className="bh-btn bh-btn-primary">
            Back to the homepage
          </Link>
          <Link href="/search" className="bh-btn bh-btn-secondary">
            Search the encyclopedia
          </Link>
        </div>

        <div className="mt-12 w-full border-t border-line pt-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-subtle">Try a suggested search</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {HOMEPAGE_SUGGESTED_SEARCHES.map((term) => (
              <Link key={term} href={`/search?q=${encodeURIComponent(term)}`} className="bh-chip">
                {term}
              </Link>
            ))}
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
