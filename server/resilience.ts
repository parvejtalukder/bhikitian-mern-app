/**
 * Small, dependency-free resilience primitives used by the MediaWiki client:
 * bounded concurrency, a circuit breaker, single-flight request coalescing and
 * an LRU+TTL cache with a separate "serve stale" window.
 *
 * All of these are in-process. Across replicas they multiply by replica count,
 * which is why the deployment also relies on HTTP/CDN caching (shared) — see
 * docs/performance-report.md.
 */

export class ThrottledError extends Error {
  constructor(message: string, public readonly kind: 'queue_full' | 'queue_timeout') {
    super(message);
    this.name = 'ThrottledError';
  }
}

interface QueueEntry {
  resolve: () => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout> | null;
}

/**
 * Bounds how many upstream requests a process may have in flight at once so a
 * traffic burst cannot fan out into unbounded MediaWiki load. The queue itself
 * is bounded and waits are bounded: past either limit callers get a
 * ThrottledError and the route falls back to a cached/stale response instead of
 * queueing forever.
 */
export class Semaphore {
  private active = 0;
  private queue: QueueEntry[] = [];

  constructor(
    public readonly name: string,
    private readonly limit: number,
    private readonly maxQueue = 200,
    private readonly waitTimeoutMs = 2000
  ) {}

  get activeCount(): number {
    return this.active;
  }

  get queuedCount(): number {
    return this.queue.length;
  }

  get limitValue(): number {
    return this.limit;
  }

  private acquire(): Promise<void> {
    if (this.active < this.limit) {
      this.active += 1;
      return Promise.resolve();
    }
    if (this.queue.length >= this.maxQueue) {
      return Promise.reject(new ThrottledError(`${this.name} queue is full`, 'queue_full'));
    }
    return new Promise<void>((resolve, reject) => {
      const entry: QueueEntry = {
        resolve: () => {
          if (entry.timer) clearTimeout(entry.timer);
          resolve();
        },
        reject,
        timer: null,
      };
      entry.timer = setTimeout(() => {
        const index = this.queue.indexOf(entry);
        if (index >= 0) this.queue.splice(index, 1);
        reject(new ThrottledError(`${this.name} wait timed out`, 'queue_timeout'));
      }, this.waitTimeoutMs);
      this.queue.push(entry);
    });
  }

  private release(): void {
    const next = this.queue.shift();
    if (next) {
      // Hand the slot straight to the next waiter: `active` stays the same.
      next.resolve();
      return;
    }
    this.active = Math.max(0, this.active - 1);
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}

/**
 * Trips after `threshold` consecutive failures and then fails fast for
 * `openMs`, so an outage is not amplified by every reader retrying upstream.
 */
export class CircuitBreaker {
  private consecutiveFailures = 0;
  private openedUntil = 0;
  private trips = 0;

  constructor(
    public readonly name: string,
    private readonly threshold = 5,
    private readonly openMs = 10_000
  ) {}

  get state(): 'closed' | 'open' {
    return Date.now() < this.openedUntil ? 'open' : 'closed';
  }

  get isOpen(): boolean {
    return this.state === 'open';
  }

  get tripCount(): number {
    return this.trips;
  }

  get failureCount(): number {
    return this.consecutiveFailures;
  }

  allow(): boolean {
    return !this.isOpen;
  }

  onSuccess(): void {
    this.consecutiveFailures = 0;
    this.openedUntil = 0;
  }

  onFailure(): { opened: boolean } {
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.threshold) {
      this.openedUntil = Date.now() + this.openMs;
      this.trips += 1;
      this.consecutiveFailures = 0;
      return { opened: true };
    }
    return { opened: false };
  }
}

/**
 * Coalesces concurrent identical work into one upstream call. This is the
 * "thundering herd" protection: N concurrent readers of a cold article produce
 * exactly one MediaWiki request.
 */
export class SingleFlight {
  private inFlight = new Map<string, Promise<unknown>>();

  get size(): number {
    return this.inFlight.size;
  }

  get keys(): string[] {
    return [...this.inFlight.keys()];
  }

  run<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.inFlight.get(key) as Promise<T> | undefined;
    if (existing) return existing;
    const promise = (async () => fn())().finally(() => {
      this.inFlight.delete(key);
    });
    this.inFlight.set(key, promise);
    return promise;
  }
}

export interface TtlEntry<V> {
  value: V;
  storedAt: number;
  /** After this timestamp the value is stale but still servable. */
  freshUntil: number;
  /** After this timestamp the value must not be served at all. */
  staleUntil: number;
}

/**
 * Bounded LRU cache with a fresh window plus a longer stale window. The stale
 * window is what lets the reader serve the last successful article while
 * MediaWiki is down, without unbounded memory growth (oldest entries evicted).
 */
export class TtlLru<V> {
  private map = new Map<string, TtlEntry<V>>();

  constructor(private readonly maxEntries: number) {}

  get size(): number {
    return this.map.size;
  }

  peek(key: string): TtlEntry<V> | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (entry.staleUntil <= Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    return entry;
  }

  get(key: string): TtlEntry<V> | undefined {
    const entry = this.peek(key);
    if (!entry) return undefined;
    // Refresh LRU recency for genuinely fresh entries only; stale entries keep
    // their position so recovery data is evicted first.
    if (entry.freshUntil > Date.now()) {
      this.map.delete(key);
      this.map.set(key, entry);
    }
    return entry;
  }

  set(key: string, value: V, options: { ttlMs: number; staleMs: number }): TtlEntry<V> {
    const now = Date.now();
    const entry: TtlEntry<V> = {
      value,
      storedAt: now,
      freshUntil: now + options.ttlMs,
      staleUntil: now + options.ttlMs + options.staleMs,
    };
    this.map.delete(key);
    this.map.set(key, entry);
    this.evictIfNeeded();
    return entry;
  }

  delete(key: string): boolean {
    return this.map.delete(key);
  }

  /** Keep a value usable only as recovery data (never fresh). */
  markStaleOnly(key: string): void {
    const entry = this.map.get(key);
    if (entry) entry.freshUntil = 0;
  }

  clear(): void {
    this.map.clear();
  }

  private evictIfNeeded(): void {
    while (this.map.size > this.maxEntries) {
      const oldest = this.map.keys().next();
      if (oldest.done) return;
      this.map.delete(oldest.value);
    }
  }
}

/** Read a positive integer env var with clamping, so misconfiguration is safe. */
export function readIntEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

/** Read an enum-ish env var, falling back when the value is not recognised. */
export function readEnumEnv<T extends string>(name: string, allowed: readonly T[], fallback: T): T {
  const raw = (process.env[name] || '').trim().toLowerCase();
  const match = allowed.find((value) => value === raw);
  return match ?? fallback;
}
