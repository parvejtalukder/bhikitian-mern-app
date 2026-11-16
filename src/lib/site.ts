/**
 * Canonical public origin used for absolute URLs (sitemap, robots).
 *
 * Returns `null` when `PUBLIC_SITE_URL` is missing or still a placeholder value,
 * so metadata routes emit a valid, neutral response instead of publishing URLs
 * for the wrong domain.
 */
export function resolvePublicSiteUrl(): string | null {
  const raw = (process.env.PUBLIC_SITE_URL || '').trim().replace(/\/+$/, '');
  if (!/^https?:\/\/[^/]+$/i.test(raw)) return null;
  try {
    const host = new URL(raw).hostname.toLowerCase();
    if (host.endsWith('.example') || host.startsWith('your-')) return null;
    return raw;
  } catch {
    return null;
  }
}
