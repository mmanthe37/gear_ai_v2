interface Bucket {
  count: number;
  resetAt: number;
}

export class RateLimiter {
  private windowMs: number;
  private maxRequests: number;
  private buckets = new Map<string, Bucket>();

  constructor({
    windowMs = 60_000,
    maxRequests = 60,
  }: { windowMs?: number; maxRequests?: number } = {}) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  /** Returns true if the request is allowed, false if rate-limited. */
  check(userId: string): boolean {
    const now = Date.now();
    const bucket = this.buckets.get(userId);

    if (!bucket || now >= bucket.resetAt) {
      this.buckets.set(userId, { count: 1, resetAt: now + this.windowMs });
      return true;
    }

    if (bucket.count < this.maxRequests) {
      bucket.count++;
      return true;
    }

    return false;
  }

  /** Reset the rate limit window for a user. */
  reset(userId: string): void {
    this.buckets.delete(userId);
  }
}
