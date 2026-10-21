// ─────────────────────────────────────────────────────────────────────────────
//  server/rate-limiter.js — Rate Limiting, Usage Tracking, & Safety Guards
// ─────────────────────────────────────────────────────────────────────────────

class RateLimiter {
  constructor() {
    // In-memory sliding window for requests per user
    // In production, this can also sync to Redis or Supabase public.ai_provider_usage
    this.userRequests = new Map(); // userId -> Array<number timestamps>
    this.activeUserLocks = new Set(); // userId -> boolean (prevents duplicate concurrent generation)
    this.maxRequestsPerMinute = 25;
    this.maxDailyRequests = 300;
    this.userDailyCount = new Map(); // userId -> { date: string, count: number }
  }

  /**
   * Acquire a generation lock for a user to prevent duplicate parallel requests
   */
  acquireLock(userId) {
    if (this.activeUserLocks.has(userId)) {
      return false;
    }
    this.activeUserLocks.add(userId);
    return true;
  }

  /**
   * Release generation lock
   */
  releaseLock(userId) {
    this.activeUserLocks.delete(userId);
  }

  /**
   * Check rate limit for an authenticated user
   * @param {string} userId
   * @returns {{allowed: boolean, message?: string}}
   */
  checkLimit(userId) {
    const now = Date.now();
    const today = new Date().toISOString().slice(0, 10);

    // 1. Sliding window per-minute check
    let timestamps = this.userRequests.get(userId) || [];
    timestamps = timestamps.filter(ts => now - ts < 60000);
    this.userRequests.set(userId, timestamps);

    if (timestamps.length >= this.maxRequestsPerMinute) {
      return {
        allowed: false,
        message: 'Rate limit exceeded: You are making requests too quickly. Please wait a few seconds before trying again.'
      };
    }

    // 2. Daily count check
    const daily = this.userDailyCount.get(userId) || { date: today, count: 0 };
    if (daily.date !== today) {
      daily.date = today;
      daily.count = 0;
    }

    if (daily.count >= this.maxDailyRequests) {
      return {
        allowed: false,
        message: 'Daily usage quota reached. To ensure fair access across all students, your limit resets tomorrow.'
      };
    }

    return { allowed: true };
  }

  /**
   * Record a successful request
   */
  recordRequest(userId) {
    const now = Date.now();
    const today = new Date().toISOString().slice(0, 10);

    const timestamps = this.userRequests.get(userId) || [];
    timestamps.push(now);
    this.userRequests.set(userId, timestamps);

    const daily = this.userDailyCount.get(userId) || { date: today, count: 0 };
    if (daily.date !== today) {
      daily.date = today;
      daily.count = 0;
    }
    daily.count += 1;
    this.userDailyCount.set(userId, daily);
  }

  /**
   * Admin usage statistics overview
   */
  getAdminStats() {
    const totalTrackedUsers = this.userDailyCount.size;
    let totalDailyRequests = 0;
    for (const d of this.userDailyCount.values()) {
      totalDailyRequests += d.count;
    }
    return {
      activeUsersToday: totalTrackedUsers,
      totalRequestsToday: totalDailyRequests,
      maxPerMinuteLimit: this.maxRequestsPerMinute,
      maxDailyLimit: this.maxDailyRequests
    };
  }
}

export const rateLimiter = new RateLimiter();
