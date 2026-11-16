import React from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { BrandMark } from './BrandMark.tsx';
import { SearchBar } from './SearchBar.tsx';
import { ThemeToggle } from './ThemeToggle.tsx';

const navPill = ({ isActive }: { isActive: boolean }) =>
  `inline-flex h-9 items-center rounded-full px-3 text-sm font-semibold transition-colors ${
    isActive ? 'bg-brand-soft text-brand' : 'text-ink-muted hover:bg-surface-muted hover:text-ink'
  }`;

const footerLink = 'text-ink-muted transition-colors hover:text-brand';

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isHome = location.pathname === '/';
  const initialSearchQuery = new URLSearchParams(location.search).get('q') || '';

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-2 px-4 sm:px-6 lg:gap-4 lg:px-8">
          <Link to="/" className="flex shrink-0 items-center gap-2.5 rounded-full">
            <BrandMark size={34} />
            <span className="font-editorial text-lg font-bold tracking-tight">Bhikitia</span>
            <span className="hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-subtle lg:inline">
              Encyclopedia
            </span>
          </Link>

          <div className={`${isHome ? 'hidden' : 'hidden lg:block'} ml-auto min-w-0 lg:w-72 xl:w-80`}>
            <SearchBar compact initialQuery={initialSearchQuery} placeholder="Search the encyclopedia" />
          </div>

          {/*
            Header alignment:
            - homepage: the header search is hidden, so the nav itself takes the
              auto margin and sits on the right.
            - other pages (lg+): the search box takes the auto margin, so the nav
              only resets its own margin from lg upward (`lg:ml-0` must NOT apply
              on the homepage, or it would override `ml-auto` and collapse the nav
              against the wordmark).
          */}
          <nav
            className={`ml-auto flex items-center gap-1 ${isHome ? '' : 'lg:ml-0'}`}
            aria-label="Primary navigation"
          >
            <NavLink to="/" end className={navPill}>
              Home
            </NavLink>
            <NavLink to="/search" className={navPill}>
              Explore
            </NavLink>
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="mt-20 border-t border-line bg-surface">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.5fr_1fr_1fr] lg:px-8">
          <div>
            <Link to="/" className="flex items-center gap-2.5">
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
              <Link to="/" className={footerLink}>
                Home
              </Link>
              <Link to="/search" className={footerLink}>
                Search the encyclopedia
              </Link>
              <a href="mailto:editorial@bhikitia.org" className={footerLink}>
                Contact the editors
              </a>
            </div>
          </div>
          <div>
            <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink">Indexing</h2>
            <div className="mt-4 flex flex-col items-start gap-2.5 text-sm">
              <a href="/sitemap.xml" className={`inline-flex items-center gap-1.5 ${footerLink}`}>
                Sitemap <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
              <a href="/robots.txt" className={`inline-flex items-center gap-1.5 ${footerLink}`}>
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
    </div>
  );
}
