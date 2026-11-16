/**
 * Dependency-free metrics registry + structured logger.
 *
 * Rationale: the app ships no APM/metrics SDK and we did not want to add a
 * runtime dependency for counters and latency histograms. Everything here is
 * in-process and cheap (Map lookups + a few array writes), exposed as JSON or
 * Prometheus text from `/api/metrics` so an external collector can scrape it.
 *
 * Cross-replica note: these counters are per replica. Aggregate by scraping
 * every replica separately, or ship the structured logs to a log pipeline.
 */

type Labels = Record<string, string | number | boolean>;

interface HistogramState {
  buckets: number[];
  counts: number[];
  sum: number;
  count: number;
}

const counters = new Map<string, number>();
const histograms = new Map<string, HistogramState>();
const gauges = new Map<string, number>();
const startedAt = Date.now();

/** Millisecond buckets tuned for cache/upstream work (p50..p99 readable). */
export const LATENCY_BUCKETS = [5, 10, 25, 50, 75, 100, 200, 300, 500, 750, 1000, 2000, 5000, 15000];

function labelKey(labels?: Labels): string {
  if (!labels) return '';
  return Object.entries(labels)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}=${String(value)}`)
    .sort()
    .join(',');
}

function key(name: string, labels?: Labels): string {
  const lk = labelKey(labels);
  return lk ? `${name}{${lk}}` : name;
}

export function increment(name: string, labels?: Labels, value = 1): void {
  const k = key(name, labels);
  counters.set(k, (counters.get(k) || 0) + value);
}

export function setGauge(name: string, value: number, labels?: Labels): void {
  gauges.set(key(name, labels), value);
}

export function observe(name: string, milliseconds: number, labels?: Labels): void {
  const k = key(name, labels);
  let state = histograms.get(k);
  if (!state) {
    state = { buckets: LATENCY_BUCKETS, counts: new Array(LATENCY_BUCKETS.length).fill(0), sum: 0, count: 0 };
    histograms.set(k, state);
  }
  state.sum += milliseconds;
  state.count += 1;
  for (let i = 0; i < state.buckets.length; i += 1) {
    if (milliseconds <= state.buckets[i]) {
      state.counts[i] += 1;
      return;
    }
  }
}

/** Time an async operation, recording latency plus an outcome counter. */
export async function time<T>(
  name: string,
  labels: Labels | undefined,
  fn: () => Promise<T>,
  outcomeOf?: (result: T | Error) => string
): Promise<T> {
  const startedAtMs = Date.now();
  try {
    const result = await fn();
    observe(name, Date.now() - startedAtMs, labels);
    if (outcomeOf) increment(`${name}.total`, { ...labels, outcome: outcomeOf(result) });
    return result;
  } catch (error) {
    observe(name, Date.now() - startedAtMs, labels);
    if (outcomeOf) increment(`${name}.total`, { ...labels, outcome: outcomeOf(error as Error) });
    throw error;
  }
}

export interface MetricsSnapshot {
  startedAt: string;
  uptimeSeconds: number;
  counters: Record<string, number>;
  gauges: Record<string, number>;
  histograms: Record<string, { count: number; sumMs: number; avgMs: number; p50Ms: number; p95Ms: number; p99Ms: number }>;
}

function percentile(state: HistogramState, p: number): number {
  if (state.count === 0) return 0;
  const target = Math.ceil((p / 100) * state.count);
  let cumulative = 0;
  for (let i = 0; i < state.counts.length; i += 1) {
    cumulative += state.counts[i];
    if (cumulative >= target) return state.buckets[i];
  }
  return state.buckets[state.buckets.length - 1];
}

export function snapshot(): MetricsSnapshot {
  const histogramsOut: MetricsSnapshot['histograms'] = {};
  for (const [k, state] of histograms) {
    histogramsOut[k] = {
      count: state.count,
      sumMs: Math.round(state.sum),
      avgMs: state.count ? Number((state.sum / state.count).toFixed(2)) : 0,
      p50Ms: percentile(state, 50),
      p95Ms: percentile(state, 95),
      p99Ms: percentile(state, 99),
    };
  }
  return {
    startedAt: new Date(startedAt).toISOString(),
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    counters: Object.fromEntries(counters),
    gauges: Object.fromEntries(gauges),
    histograms: histogramsOut,
  };
}

function parseKey(raw: string): { name: string; labels: string } {
  const idx = raw.indexOf('{');
  if (idx === -1) return { name: raw, labels: '' };
  return { name: raw.slice(0, idx), labels: raw.slice(idx + 1, -1) };
}

function promLabels(labels: string, extra?: string): string {
  const all = [labels, extra].filter(Boolean).join(',');
  return all ? `{${all}}` : '';
}

/** Prometheus text exposition so a standard collector can scrape `/api/metrics?format=prometheus`. */
export function renderPrometheus(extraLabel = ''): string {
  const lines: string[] = [];
  const seen = new Set<string>();
  const sanitize = (name: string) => name.replace(/[^a-zA-Z0-9_:]/g, '_');

  for (const [k, value] of counters) {
    const { name, labels } = parseKey(k);
    if (!seen.has(name)) {
      lines.push(`# TYPE ${sanitize(name)} counter`);
      seen.add(name);
    }
    lines.push(`${sanitize(name)}${promLabels(labels, extraLabel)} ${value}`);
  }
  for (const [k, value] of gauges) {
    const { name, labels } = parseKey(k);
    if (!seen.has(name)) {
      lines.push(`# TYPE ${sanitize(name)} gauge`);
      seen.add(name);
    }
    lines.push(`${sanitize(name)}${promLabels(labels, extraLabel)} ${value}`);
  }
  for (const [k, state] of histograms) {
    const { name, labels } = parseKey(k);
    const base = sanitize(`${name}_ms`);
    if (!seen.has(base)) {
      lines.push(`# TYPE ${base} histogram`);
      seen.add(base);
    }
    const prefix = extraLabel ? `${extraLabel},` : '';
    let cumulative = 0;
    for (let i = 0; i < state.buckets.length; i += 1) {
      cumulative += state.counts[i];
      lines.push(`${base}_bucket${promLabels(labels, `${prefix}le="${state.buckets[i]}"`)} ${cumulative}`);
    }
    lines.push(`${base}_bucket${promLabels(labels, `${prefix}le="+Inf"`)} ${state.count}`);
    lines.push(`${base}_sum${promLabels(labels, extraLabel)} ${state.sum}`);
    lines.push(`${base}_count${promLabels(labels, extraLabel)} ${state.count}`);
  }
  return lines.join('\n') + '\n';
}

/**
 * Structured single-line JSON logs. Reuses the platform's existing stdout
 * collection (Docker/Vercel/journald) instead of adding a logging dependency.
 */
function emit(level: 'info' | 'warn' | 'error', event: string, fields?: Record<string, unknown>): void {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...fields });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.info(line);
}

export const log = {
  info: (event: string, fields?: Record<string, unknown>) => emit('info', event, fields),
  warn: (event: string, fields?: Record<string, unknown>) => emit('warn', event, fields),
  error: (event: string, fields?: Record<string, unknown>) => emit('error', event, fields),
};
