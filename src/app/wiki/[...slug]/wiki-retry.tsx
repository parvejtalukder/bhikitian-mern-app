'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';

/**
 * "Try again" for the unavailable/stale article states.
 *
 * The article route is cached (ISR + CDN), so a `?retry=1` query parameter is
 * not evidence of a fresh request — it would either be ignored by the cache or
 * create a second cache key. Instead this asks the server to purge the cached
 * copy and re-read MediaWiki, then refreshes the current route.
 */
export function WikiRetry({ slug, label = 'Try again' }: { slug: string; label?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function retry() {
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch(`/api/wiki/refresh?slug=${encodeURIComponent(slug)}`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`refresh failed (${res.status})`);
      startTransition(() => router.refresh());
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  const working = busy || pending;

  return (
    <span className="inline-flex items-center gap-3">
      <button
        type="button"
        onClick={retry}
        disabled={working}
        className="bh-btn bh-btn-primary disabled:opacity-70"
        aria-live="polite"
      >
        <RefreshCw className={`h-4 w-4 ${working ? 'animate-spin' : ''}`} aria-hidden="true" />
        {working ? 'Checking…' : label}
      </button>
      {failed && <span className="text-xs text-ink-subtle">Still unavailable — please try again shortly.</span>}
    </span>
  );
}
