/**
 * Single source of truth for the public homepage curation.
 *
 * Both the Next.js portal response (`server/mediawikiClient.ts` -> getPortalData)
 * and the homepage fallback UI (`src/legacy-pages/HomePage.tsx`) import from this
 * module so the curated allowlist can never drift between them.
 *
 * Every slug below was verified against the public wiki:
 * `action=query&titles=...` returned `pageid` (not `missing`) for each one.
 */

export interface CuratedEntry {
  title: string;
  slug: string;
  category: string;
  excerpt: string;
}

export interface HomepageTopic {
  title: string;
  description: string;
  /** `href` is either an internal `/wiki/<slug>` path or a `/search?q=...` path. */
  links: Array<{ label: string; href: string }>;
}

/**
 * Verified curated allowlist. Only articles present in this list may be promoted
 * on the homepage. Verified 2026-11-16 against https://en.bhikitia.org/api.php.
 */
export const HOMEPAGE_CURATED_SLUGS: readonly string[] = [
  'Nelson_Mandela',
  'Bangladesh',
  'United_Kingdom',
  'Japan',
  'History_of_Bengal',
  'History_of_Nepal',
  'Bengali_people',
  'Culture_of_Bangladesh',
  'Bengali_literature',
  'Science',
  'World_Wide_Web',
  'United_Nations',
  '2024_Interim_government_of_Bangladesh',
  'India',
];

/** Hero lead for the homepage. Always the first featured entry. */
export const HOMEPAGE_LEAD: CuratedEntry = {
  title: 'Nelson Mandela',
  slug: 'Nelson_Mandela',
  category: 'Biography · Southern Africa',
  excerpt:
    'A South African leader whose long campaign against apartheid and later presidency made him a global symbol of reconciliation.',
};

/** Selected Reading entries. Deliberately excludes the hero lead. */
export const HOMEPAGE_SELECTED_READING: CuratedEntry[] = [
  {
    title: 'Bangladesh',
    slug: 'Bangladesh',
    category: 'Places · South Asia',
    excerpt: 'A South Asian country shaped by delta rivers, a distinct language, and a modern national history.',
  },
  {
    title: 'United Kingdom',
    slug: 'United_Kingdom',
    category: 'Places · Europe',
    excerpt: 'A country whose history, institutions, and culture have influenced life around the world.',
  },
  {
    title: 'Japan',
    slug: 'Japan',
    category: 'Places · East Asia',
    excerpt: 'An island country known for its history, culture, and technological influence.',
  },
  {
    title: 'History of Bengal',
    slug: 'History_of_Bengal',
    category: 'History · South Asia',
    excerpt: 'The long regional record of trade, literature, and political change across the Bengal delta.',
  },
];

/** Ordered featured entries: hero first, then Selected Reading. Used by the portal response. */
export const HOMEPAGE_FEATURED_ENTRIES: CuratedEntry[] = [
  HOMEPAGE_LEAD,
  ...HOMEPAGE_SELECTED_READING,
];

/** Suggested searches shown under the homepage search box (Bangladesh beside other regions). */
export const HOMEPAGE_SUGGESTED_SEARCHES: readonly string[] = [
  'Science',
  'United Nations',
  'Bangladesh',
  'India',
];

/** Topic cards. Bangladesh features alongside articles from other regions. */
export const HOMEPAGE_TOPICS: HomepageTopic[] = [
  {
    title: 'History',
    description: 'Turning points, movements, and the people who shaped societies across regions.',
    links: [
      { label: 'History of Bengal', href: '/wiki/History_of_Bengal' },
      { label: 'History of Nepal', href: '/wiki/History_of_Nepal' },
    ],
  },
  {
    title: 'People',
    description: 'Biographies of leaders, thinkers, artists, and public figures.',
    links: [
      { label: 'Nelson Mandela', href: '/wiki/Nelson_Mandela' },
      { label: 'Bengali people', href: '/wiki/Bengali_people' },
    ],
  },
  {
    title: 'Places',
    description: 'Countries, regions, and the places that shape our shared world.',
    links: [
      { label: 'Bangladesh', href: '/wiki/Bangladesh' },
      { label: 'United Kingdom', href: '/wiki/United_Kingdom' },
    ],
  },
  {
    title: 'Culture',
    description: 'Languages, literature, traditions, and creative life across communities.',
    links: [
      { label: 'Culture of Bangladesh', href: '/wiki/Culture_of_Bangladesh' },
      { label: 'Bengali literature', href: '/wiki/Bengali_literature' },
    ],
  },
  {
    title: 'Science & Technology',
    description: 'Ideas, discoveries, and technologies that shape how we understand the world.',
    links: [
      { label: 'Science', href: '/wiki/Science' },
      { label: 'World Wide Web', href: '/wiki/World_Wide_Web' },
    ],
  },
  {
    title: 'Society & Politics',
    description: 'Institutions, public life, governance, and contemporary affairs.',
    links: [
      { label: 'United Nations', href: '/wiki/United_Nations' },
      { label: '2024 Interim government of Bangladesh', href: '/wiki/2024_Interim_government_of_Bangladesh' },
    ],
  },
];

/** Selected Reading maximum length used by the homepage list. */
export const HOMEPAGE_SELECTED_READING_LIMIT = 4;

/** True when `slug` is part of the verified curated allowlist. */
export function isCuratedSlug(slug: string): boolean {
  return HOMEPAGE_CURATED_SLUGS.includes(slug);
}
