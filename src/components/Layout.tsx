import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, Moon, Sun, X } from 'lucide-react';
import { useTheme } from '../context/ThemeContext.tsx';
import { BrandMark } from './BrandMark.tsx';

export function Layout({ children }: { children: React.ReactNode }) {
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `text-sm font-medium whitespace-nowrap shrink-0 transition-colors pb-0.5 border-b-2 ${
      isActive
        ? 'text-[#0f1f38] dark:text-[#f8fafc] border-[#1d4ed8]'
        : 'text-[#475569] dark:text-[#94a3b8] border-transparent hover:text-[#0f1f38] dark:hover:text-[#f8fafc]'
    }`;

  return (
    <div className="min-h-screen flex flex-col bg-[#fdfbf7] dark:bg-[#0a0f1d] text-[#0f172a] dark:text-[#f8fafc] transition-colors">
      {/* Strict 3-Zone Top Bar */}
      <header className="sticky top-0 z-30 bg-[#fdfbf7]/95 dark:bg-[#0a0f1d]/95 backdrop-blur-sm border-b border-[#e2e8f0] dark:border-[#1e293b]">
        <div className="max-w-[1340px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Brand Wordmark */}
          <Link
            to="/"
            className="flex items-center gap-2.5 text-xl font-bold tracking-tight text-[#0f1f38] dark:text-[#f8fafc] whitespace-nowrap shrink-0 font-editorial"
          >
            <BrandMark size={32} />
            <span>Bhikitia</span>
          </Link>

          {/* Zone 2: 4–5 concise single-line nav links */}
          <nav className="hidden md:flex items-center gap-6" aria-label="Primary navigation">
            <NavLink to="/wiki/Main_Page" className={navLinkClass}>
              Encyclopedia
            </NavLink>
            <NavLink to="/search" className={navLinkClass}>
              Search
            </NavLink>
            <NavLink to="/submit/track" className={navLinkClass}>
              Track Request
            </NavLink>
            <NavLink to="/submit/admin" className={navLinkClass}>
              Staff Console
            </NavLink>
            <NavLink to="/architecture" className={navLinkClass}>
              Architecture
            </NavLink>
          </nav>

          {/* Zone 3: 1 primary CTA */}
          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/submit"
              className="hidden sm:inline-flex items-center justify-center px-4 py-2 text-xs font-semibold text-white bg-[#0f1f38] hover:bg-[#1d4ed8] dark:bg-[#1d4ed8] dark:hover:bg-blue-600 rounded transition-colors whitespace-nowrap shrink-0"
            >
              Submit Article
            </Link>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Toggle navigation menu"
              className="md:hidden inline-flex items-center justify-center h-10 w-10 rounded border border-[#cbd5e1] dark:border-[#1e293b] text-[#0f1f38] dark:text-[#f8fafc] cursor-pointer"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#e2e8f0] dark:border-[#1e293b] bg-[#f8fafc] dark:bg-[#111827] px-4 py-3 space-y-2">
            <div className="flex flex-col space-y-2">
              <Link to="/wiki/Main_Page" onClick={() => setMobileMenuOpen(false)} className="py-2 text-sm font-medium">
                Encyclopedia
              </Link>
              <Link to="/search" onClick={() => setMobileMenuOpen(false)} className="py-2 text-sm font-medium">
                Search
              </Link>
              <Link to="/submit" onClick={() => setMobileMenuOpen(false)} className="py-2 text-sm font-semibold text-[#1d4ed8] dark:text-sky-400">
                Submit Article
              </Link>
              <Link to="/submit/track" onClick={() => setMobileMenuOpen(false)} className="py-2 text-sm font-medium">
                Track Request
              </Link>
              <Link to="/submit/admin" onClick={() => setMobileMenuOpen(false)} className="py-2 text-sm font-medium">
                Staff Console
              </Link>
              <Link to="/architecture" onClick={() => setMobileMenuOpen(false)} className="py-2 text-sm font-medium">
                Architecture &amp; DNS
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1">{children}</main>

      {/* Institutional Editorial Footer */}
      <footer className="border-t border-[#e2e8f0] dark:border-[#1e293b] bg-[#f8fafc] dark:bg-[#111827] mt-16">
        <div className="max-w-[1340px] mx-auto px-4 sm:px-6 py-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 font-editorial font-bold text-[#0f1f38] dark:text-[#f8fafc]">
                <BrandMark size={24} />
                <span>Bhikitia</span>
              </div>
              <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 max-w-xl leading-relaxed">
                Public encyclopedia edition at <span className="font-mono-tabular">en.bhikitia.org</span> powered by
                MediaWiki 1.44.0 as the authoritative knowledge store. Staff authoring and template governance
                reside behind authentication at <span className="font-mono-tabular">edit.bhikitia.org</span>.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
              <button
                type="button"
                onClick={toggleTheme}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#cbd5e1] dark:border-[#334155] bg-white dark:bg-[#0a0f1d] text-[#0f1f38] dark:text-[#f8fafc] font-medium hover:bg-[#f1f5f9] dark:hover:bg-[#1e293b] transition-colors cursor-pointer"
              >
                {theme === 'dark' ? (
                  <>
                    <Sun className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
                    <span>Parchment Light</span>
                  </>
                ) : (
                  <>
                    <Moon className="h-3.5 w-3.5 text-[#0f1f38]" aria-hidden="true" />
                    <span>Midnight Reading</span>
                  </>
                )}
              </button>

              <a
                href="https://bn.bhikitia.org"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#1d4ed8] dark:hover:text-sky-400 transition-colors"
              >
                বাংলা সংস্করণ (bn.bhikitia.org)
              </a>
              <Link to="/architecture" className="hover:text-[#1d4ed8] dark:hover:text-sky-400 transition-colors">
                Hosting &amp; DNS Audit
              </Link>
              <a href="/sitemap.xml" className="hover:text-[#1d4ed8] dark:hover:text-sky-400 transition-colors">
                Sitemap XML
              </a>
              <a href="/robots.txt" className="hover:text-[#1d4ed8] dark:hover:text-sky-400 transition-colors">
                robots.txt
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
