import Link from 'next/link';
import type { ReactNode } from 'react';
import { BrandMark } from './BrandMark';

interface SiteHeaderProps {
  /** Extra controls rendered to the right of the built-in Explore link. */
  actions?: ReactNode;
}

export function SiteHeader({ actions }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-2 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 rounded-full">
          <BrandMark size={34} />
          <span className="font-editorial text-lg font-bold tracking-tight">Bhikitia</span>
          <span className="hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-subtle lg:inline">
            Encyclopedia
          </span>
        </Link>
        <nav className="ml-auto flex items-center gap-1" aria-label="Primary navigation">
          <Link
            href="/search"
            className="inline-flex h-9 items-center rounded-full px-3 text-sm font-semibold text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
          >
            Explore
          </Link>
          {actions}
        </nav>
      </div>
    </header>
  );
}
