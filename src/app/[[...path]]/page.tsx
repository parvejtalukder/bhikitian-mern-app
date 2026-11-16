import { notFound } from 'next/navigation';
import LegacyShell from '../legacy-shell';

/** The legacy reader app only serves the homepage and these client routes. */
const LEGACY_ROUTES = new Set(['search', 'wiki']);

/**
 * Prerender the two reader entry points so the shell HTML is served from the
 * full-route cache and can be cached by a CDN (`s-maxage` for static pages).
 * Everything else still resolves on demand and 404s through the branded page.
 */
export function generateStaticParams() {
  return [{ path: [] }, { path: ['search'] }, { path: ['wiki'] }];
}

export default async function LegacyApp({ params }: { params: Promise<{ path?: string[] }> }) {
  const path = (await params).path || [];
  // Unknown paths fall through to the branded 404 instead of silently rendering the home page.
  if (path.length > 1 || (path.length === 1 && !LEGACY_ROUTES.has(path[0]))) notFound();
  return <LegacyShell />;
}
