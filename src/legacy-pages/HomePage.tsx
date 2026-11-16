import { useEffect, useState } from 'react';
import { ArrowRight, ArrowUpRight, FlaskConical, Globe2, Landmark, Palette, Scale, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SearchBar } from '../components/SearchBar.tsx';
import {
  HOMEPAGE_FEATURED_ENTRIES,
  HOMEPAGE_LEAD,
  HOMEPAGE_SELECTED_READING_LIMIT,
  HOMEPAGE_SUGGESTED_SEARCHES,
  HOMEPAGE_TOPICS,
} from '../lib/homepage';
import type { PortalData } from '../types/index.ts';

const HERO_IMG = '/assets/bhikitia_archive_hero.jpg';

const TOPIC_ICONS = {
  History: Landmark,
  People: Users,
  Places: Globe2,
  Culture: Palette,
  'Science & Technology': FlaskConical,
  'Society & Politics': Scale,
} as const;

const sectionLink = 'inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline';

export function HomePage() {
  const [portal, setPortal] = useState<PortalData | null>(null);

  useEffect(() => {
    document.title = 'The Bhikitia Encyclopedia';
    fetch('/api/wiki/portal')
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setPortal(data))
      .catch(() => setPortal(null));
  }, []);

  // Portal response and this fallback both come from the shared curated allowlist.
  const featured = portal?.featuredEntries?.length ? portal.featuredEntries : HOMEPAGE_FEATURED_ENTRIES;
  const lead = featured[0] || HOMEPAGE_LEAD;
  // The hero lead is never repeated inside Selected Reading.
  const selectedReading = featured
    .filter((entry) => entry.slug !== lead.slug)
    .slice(0, HOMEPAGE_SELECTED_READING_LIMIT);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-20 pt-10 sm:px-6 lg:px-8 lg:pt-16">
      <section className="grid items-center gap-10 lg:grid-cols-[1.02fr_.98fr] lg:gap-14">
        <div>
          <p className="bh-eyebrow">The Bhikitia Encyclopedia</p>
          <h1 className="mt-4 max-w-2xl font-editorial text-4xl font-bold leading-[1.06] tracking-tight text-ink sm:text-5xl">
            Explore people, places, ideas, and events from around the world.
          </h1>
          <p className="mt-5 max-w-xl text-[17px] leading-7 text-ink-muted">
            Read carefully edited articles across history, geography, culture, science, and public life.
          </p>
          <div className="mt-8 max-w-xl">
            <SearchBar placeholder="Search people, places, events, and ideas" />
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-subtle">Suggested</span>
            {HOMEPAGE_SUGGESTED_SEARCHES.map((term) => (
              <Link key={term} to={`/search?q=${encodeURIComponent(term)}`} className="bh-chip">
                {term}
              </Link>
            ))}
          </div>
        </div>

        <a
          href={`/wiki/${encodeURIComponent(lead.slug)}`}
          className="group relative block overflow-hidden rounded-3xl border border-line bg-brand-soft shadow-lift"
        >
          <div className="relative h-[19rem] w-full sm:h-[23rem] lg:h-[26rem]">
            <img
              src={HERO_IMG}
              alt=""
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0b1120] via-[#0b1120]/40 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6 sm:p-7">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white backdrop-blur">
                Featured reading
              </span>
              <h2 className="mt-3 font-editorial text-2xl font-bold text-white sm:text-3xl">{lead.title}</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-white/85">{lead.excerpt}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-white">
                Read the article
                <ArrowRight
                  className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </span>
            </div>
          </div>
        </a>
      </section>

      <section className="mt-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="bh-eyebrow">Start exploring</p>
            <h2 className="mt-2 font-editorial text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              Browse by topic
            </h2>
          </div>
          <Link to="/search" className={sectionLink}>
            All articles <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {HOMEPAGE_TOPICS.map((topic) => {
            const Icon = TOPIC_ICONS[topic.title as keyof typeof TOPIC_ICONS] || Globe2;
            return (
              <article key={topic.title} className="bh-card bh-card-hover flex h-full flex-col p-6">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-editorial text-lg font-bold text-ink">{topic.title}</h3>
                <p className="mt-2 text-sm leading-6 text-ink-muted">{topic.description}</p>
                <div className="mt-5 space-y-2.5 border-t border-line pt-4">
                  {topic.links.map((link) => {
                    const label = (
                      <>
                        {link.label}
                        <ArrowUpRight
                          className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100"
                          aria-hidden="true"
                        />
                      </>
                    );
                    return link.href.startsWith('/search') ? (
                      <Link
                        key={link.href}
                        to={link.href}
                        className="group flex items-center gap-1.5 text-sm font-semibold text-brand"
                      >
                        {label}
                      </Link>
                    ) : (
                      <a
                        key={link.href}
                        href={link.href}
                        className="group flex items-center gap-1.5 text-sm font-semibold text-brand"
                      >
                        {label}
                      </a>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mt-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="bh-eyebrow">Curated</p>
            <h2 className="mt-2 font-editorial text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              Selected reading
            </h2>
          </div>
          <Link to="/search" className={sectionLink}>
            Explore the collection <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          {selectedReading.map((entry) => (
            <a
              key={entry.slug}
              href={`/wiki/${encodeURIComponent(entry.slug)}`}
              className="bh-card bh-card-hover group flex h-full flex-col p-6"
            >
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-subtle">
                {entry.category}
              </span>
              <h3 className="mt-2 flex items-start justify-between gap-3 font-editorial text-lg font-bold text-ink transition-colors group-hover:text-brand">
                <span>{entry.title}</span>
                <ArrowUpRight
                  className="mt-1 h-4 w-4 shrink-0 text-ink-subtle transition-colors group-hover:text-brand"
                  aria-hidden="true"
                />
              </h3>
              <p className="mt-2 text-sm leading-6 text-ink-muted">{entry.excerpt}</p>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}

