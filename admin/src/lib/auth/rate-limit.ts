import 'server-only';

const WINDOW_MS = 15 * 60 * 1000;

type Bucket = { count: number; resetAt: number };

// Compteurs en mémoire du processus : suffisant pour une instance unique.
// Derrière plusieurs instances, les porter dans un stockage partagé.
const buckets = new Map<string, Bucket>();

/** Consomme une tentative sur `key` ; false quand `max` est dépassé dans la fenêtre. */
export function takeAttempt(key: string, max: number, now = Date.now()) {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size >= 10_000) sweep(now);
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= max;
}

export function clearAttempts(key: string) {
  buckets.delete(key);
}

function sweep(now: number) {
  for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
}
