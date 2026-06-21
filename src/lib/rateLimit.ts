/**
 * In-memory rate limiter for Cloudflare Workers.
 *
 * NOTE: Workers isolates are short-lived and each isolate maintains its own
 * Map, so this provides best-effort (not distributed) limiting. For stricter
 * limits, back this with KV or Durable Objects.
 */

type RateBucket = { count: number; firstRequest: number };

const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_REQUESTS = 5; // 5 requests per window per IP

const buckets = new Map<string, RateBucket>();

// Periodic cleanup of expired buckets to prevent unbounded Map growth.
// Runs on every check call — cheap because we only prune a single key.
const lastCleanup = { time: Date.now() };

function pruneExpired(now: number): void {
  // Run full sweep at most once per minute.
  if (now - lastCleanup.time < 60_000) return;
  lastCleanup.time = now;
  for (const [key, bucket] of buckets) {
    if (now - bucket.firstRequest > WINDOW_MS) {
      buckets.delete(key);
    }
  }
}

export interface RateLimitResult {
  allowed: boolean;
  /** Remaining requests in the current window. */
  remaining: number;
  /** ms until the window resets (only meaningful when blocked). */
  retryAfter: number;
}

/**
 * Check (and increment) the rate limit for a given key (usually an IP).
 * Returns whether the request is allowed plus metadata for headers.
 */
export function checkRateLimit(key: string): RateLimitResult {
  const now = Date.now();
  pruneExpired(now);

  const bucket = buckets.get(key);

  if (!bucket || now - bucket.firstRequest > WINDOW_MS) {
    // Start a fresh window.
    buckets.set(key, { count: 1, firstRequest: now });
    return { allowed: true, remaining: MAX_REQUESTS - 1, retryAfter: 0 };
  }

  bucket.count++;
  const remaining = Math.max(0, MAX_REQUESTS - bucket.count);
  const allowed = bucket.count <= MAX_REQUESTS;
  const retryAfter = allowed ? 0 : Math.ceil((WINDOW_MS - (now - bucket.firstRequest)) / 1000);

  return { allowed, remaining, retryAfter };
}

/**
 * Extract the client IP from a Cloudflare request using CF-Connecting-IP,
 * falling back to X-Forwarded-For and finally "unknown".
 */
export function getClientIp(req: Request): string {
  const cf = req.headers.get("CF-Connecting-IP");
  if (cf) return cf;
  const xff = req.headers.get("X-Forwarded-For");
  if (xff) return xff.split(",")[0].trim();
  return "unknown";
}

export const RATE_LIMIT_CONFIG = {
  WINDOW_MS,
  MAX_REQUESTS,
} as const;
