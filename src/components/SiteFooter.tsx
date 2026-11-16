import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { BrandMark } from './BrandMark';

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-line bg-surface">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.5fr_1fr_1fr] lg:px-8">
        <div>
          <Link href="/" className="flex items-center gap-2.5">
            <BrandMark size={32} />
            <span className="font-editorial text-base font-bold">The Bhikitia Encyclopedia</span>
          </Link>
          <p className="mt-4 max-w-md text-sm leading-6 text-ink-muted">
            An international encyclopedia covering history, geography, culture, science, and public life.
          </p>
        </div>
        <div>
          <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink">Explore</h2>
          <div className="mt-4 flex flex-col items-start gap-2.5 text-sm">
            <Link href="/" className="text-ink-muted transition-colors hover:text-brand">
              Home
            </Link>
            <Link href="/search" className="text-ink-muted transition-colors hover:text-brand">
              Search the encyclopedia
            </Link>
            <a href="mailto:editorial@bhikitia.org" className="text-ink-muted transition-colors hover:text-brand">
              Contact the editors
            </a>
          </div>
        </div>
        <div>
          <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink">Indexing</h2>
          <div className="mt-4 flex flex-col items-start gap-2.5 text-sm">
            <a
              href="/sitemap.xml"
              className="inline-flex items-center gap-1.5 text-ink-muted transition-colors hover:text-brand"
            >
              Sitemap <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
            <a
              href="/robots.txt"
              className="inline-flex items-center gap-1.5 text-ink-muted transition-colors hover:text-brand"
            >
              Robots <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-5 text-xs text-ink-subtle sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <span>A clearer way to explore the world, one article at a time.</span>
          <span>Article text is served from the Bhikitia wiki.</span>
        </div>
      </div>
    </footer>
  );
}
