/**
 * Tiny in-memory token bucket, keyed by session (or IP fallback). Guards mutation
 * endpoints against runaway clients / replay bursts (ТЗ §44). Not a distributed limiter —
 * for a single-VPS deployment that is enough.
 */
interface Bucket {
  tokens: number;
  updatedAt: number;
}

const buckets = new Map<string, Bucket>();
const CAPACITY = 30; // burst
const REFILL_PER_SEC = 1; // sustained

export function rateLimit(key: string, cost = 1): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const b = buckets.get(key) ?? { tokens: CAPACITY, updatedAt: now };
  const elapsed = (now - b.updatedAt) / 1000;
  b.tokens = Math.min(CAPACITY, b.tokens + elapsed * REFILL_PER_SEC);
  b.updatedAt = now;

  if (b.tokens < cost) {
    buckets.set(key, b);
    return { ok: false, retryAfter: Math.ceil((cost - b.tokens) / REFILL_PER_SEC) };
  }
  b.tokens -= cost;
  buckets.set(key, b);
  return { ok: true, retryAfter: 0 };
}

/** Test helper. */
export function _resetRateLimit(): void {
  buckets.clear();
}
