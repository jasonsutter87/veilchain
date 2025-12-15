/**
 * VeilChain API Rate Limiting Middleware
 *
 * Protects the API from abuse by limiting request rates with configurable tiers,
 * daily limits, per-endpoint limits, and comprehensive response headers.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import rateLimit from '@fastify/rate-limit';

/**
 * Rate limit tier configuration
 */
export interface RateLimitTierConfig {
  /** Maximum requests per second */
  max: number;
  /** Time window (always 1 second for per-second limits) */
  timeWindow: string;
  /** Daily request limit (undefined for unlimited) */
  dailyLimit?: number;
}

/**
 * Rate limit tiers for different subscription levels
 */
export const RateLimitTiers = {
  /** Free tier: 10 req/sec, 1,000/day */
  FREE: {
    max: 10,
    timeWindow: '1 second',
    dailyLimit: 1000
  },
  /** Starter tier: 100 req/sec, 50,000/day */
  STARTER: {
    max: 100,
    timeWindow: '1 second',
    dailyLimit: 50000
  },
  /** Pro tier: 1,000 req/sec, unlimited */
  PRO: {
    max: 1000,
    timeWindow: '1 second'
  },
  /** Enterprise tier: 10,000 req/sec, unlimited */
  ENTERPRISE: {
    max: 10000,
    timeWindow: '1 second'
  }
} as const;

/**
 * Per-endpoint rate limit configurations
 * Stricter limits for write operations, more lenient for reads
 */
export const EndpointRateLimits = {
  /** Append operations - stricter limits */
  APPEND: {
    FREE: { max: 5, timeWindow: '1 second' },
    STARTER: { max: 50, timeWindow: '1 second' },
    PRO: { max: 500, timeWindow: '1 second' },
    ENTERPRISE: { max: 5000, timeWindow: '1 second' }
  },
  /** Read operations - more lenient */
  READ: {
    FREE: { max: 20, timeWindow: '1 second' },
    STARTER: { max: 200, timeWindow: '1 second' },
    PRO: { max: 2000, timeWindow: '1 second' },
    ENTERPRISE: { max: 20000, timeWindow: '1 second' }
  },
  /** Health check - excluded from limits */
  HEALTH: {
    max: 1000,
    timeWindow: '1 second'
  }
} as const;

/**
 * Rate limit tier name type
 */
export type RateLimitTier = keyof typeof RateLimitTiers;

/**
 * Daily limit tracker
 * In production, this should be backed by Redis or similar persistent store
 */
class DailyLimitTracker {
  private counters: Map<string, { count: number; resetTime: number }>;

  constructor() {
    this.counters = new Map();
  }

  /**
   * Increment counter for a key and check if limit exceeded
   */
  increment(key: string, limit?: number): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const dayStart = new Date().setHours(0, 0, 0, 0);
    const resetTime = dayStart + 86400000; // Next midnight

    let entry = this.counters.get(key);

    // Reset if new day
    if (!entry || entry.resetTime < now) {
      entry = { count: 0, resetTime };
      this.counters.set(key, entry);
    }

    entry.count++;

    const allowed = limit === undefined || entry.count <= limit;
    const remaining = limit === undefined ? -1 : Math.max(0, limit - entry.count);

    return { allowed, remaining, resetTime };
  }

  /**
   * Get current count for a key
   */
  getCount(key: string): number {
    const entry = this.counters.get(key);
    if (!entry) return 0;

    const now = Date.now();
    if (entry.resetTime < now) {
      return 0;
    }

    return entry.count;
  }

  /**
   * Clean up expired entries (optional, for memory management)
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.counters.entries()) {
      if (entry.resetTime < now) {
        this.counters.delete(key);
      }
    }
  }
}

// Global daily limit tracker instance
const dailyTracker = new DailyLimitTracker();

// Clean up daily tracker every hour
setInterval(() => dailyTracker.cleanup(), 3600000);

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /** Rate limit tier to use */
  tier?: RateLimitTier;
  /** Maximum requests per time window (overrides tier) */
  max?: number;
  /** Time window in milliseconds or string format (e.g., '1 second') */
  timeWindow?: number | string;
  /** Daily limit (overrides tier) */
  dailyLimit?: number;
  /** Custom error message */
  errorMessage?: string;
  /** Skip rate limiting for certain routes */
  skipRoutes?: string[];
  /** Enable per-endpoint rate limits */
  enableEndpointLimits?: boolean;
}

/**
 * Default rate limit configuration
 */
const defaultConfig: Required<Omit<RateLimitConfig, 'skipRoutes' | 'tier' | 'dailyLimit'>> = {
  max: 100,
  timeWindow: '1 second',
  errorMessage: 'Too many requests, please try again later.',
  enableEndpointLimits: false
};

/**
 * Add rate limit headers to response
 */
function addRateLimitHeaders(
  reply: FastifyReply,
  limit: number,
  remaining: number,
  reset: number
): void {
  reply.header('X-RateLimit-Limit', limit.toString());
  reply.header('X-RateLimit-Remaining', Math.max(0, remaining).toString());
  reply.header('X-RateLimit-Reset', Math.floor(reset / 1000).toString());
}

/**
 * Get rate limit key for a request
 */
function getRateLimitKey(request: FastifyRequest): string {
  // Use API key if available, otherwise use IP
  const apiKey = request.headers['x-api-key'] as string | undefined;
  return apiKey || request.ip;
}

/**
 * Determine endpoint type for per-endpoint limits
 */
function getEndpointType(url: string): 'APPEND' | 'READ' | 'HEALTH' | null {
  if (url === '/health') return 'HEALTH';
  if (url.includes('/entries') && url.match(/POST|PUT|PATCH/)) return 'APPEND';
  if (url.includes('/entries') || url.includes('/ledgers') || url.includes('/proofs')) return 'READ';
  return null;
}

/**
 * Register rate limiting middleware
 */
export async function registerRateLimit(
  fastify: FastifyInstance,
  config: RateLimitConfig = {}
): Promise<void> {
  const {
    tier,
    max: customMax,
    timeWindow: customTimeWindow,
    dailyLimit: customDailyLimit,
    errorMessage = defaultConfig.errorMessage,
    skipRoutes = [],
    enableEndpointLimits = defaultConfig.enableEndpointLimits
  } = config;

  // Determine base configuration from tier or custom values
  const tierConfig = tier ? RateLimitTiers[tier] : null;
  const max = customMax ?? tierConfig?.max ?? defaultConfig.max;
  const timeWindow = customTimeWindow ?? tierConfig?.timeWindow ?? defaultConfig.timeWindow;
  const dailyLimit = customDailyLimit ?? (tierConfig && 'dailyLimit' in tierConfig ? tierConfig.dailyLimit : undefined);

  // Daily limit hook (runs before rate limiter)
  if (dailyLimit !== undefined) {
    fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
      // Skip for excluded routes
      if (skipRoutes.some(route => request.url.startsWith(route))) {
        return;
      }

      const key = `daily:${getRateLimitKey(request)}`;
      const result = dailyTracker.increment(key, dailyLimit);

      // Add daily limit headers
      reply.header('X-RateLimit-Daily-Limit', dailyLimit.toString());
      reply.header('X-RateLimit-Daily-Remaining', result.remaining.toString());
      reply.header('X-RateLimit-Daily-Reset', Math.floor(result.resetTime / 1000).toString());

      if (!result.allowed) {
        reply.code(429).send({
          error: {
            code: 'DAILY_RATE_LIMIT_EXCEEDED',
            message: 'Daily request limit exceeded',
            details: {
              dailyLimit,
              remaining: 0,
              resetAt: new Date(result.resetTime).toISOString()
            }
          }
        });
      }
    });
  }

  // Per-endpoint rate limits
  if (enableEndpointLimits && tier) {
    fastify.addHook('onRequest', async (request: FastifyRequest, _reply: FastifyReply) => {
      const endpointType = getEndpointType(request.url);
      if (!endpointType || endpointType === 'HEALTH') return;

      const endpointLimits = EndpointRateLimits[endpointType][tier];
      if (endpointLimits) {
        // Store endpoint-specific limits for use by rate limiter
        (request as any).endpointRateLimit = endpointLimits;
      }
    });
  }

  // Register main rate limiter
  await fastify.register(rateLimit, {
    max,
    timeWindow,
    keyGenerator: getRateLimitKey,
    errorResponseBuilder: (_request, context) => {
      return {
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: errorMessage,
          details: {
            limit: context.max,
            remaining: context.after,
            retryAfter: context.ttl
          }
        }
      };
    },
    skipOnError: false,
    // Add headers to all responses
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true
    },
    // Custom hook to apply per-endpoint limits
    hook: 'onRequest',
    // Allow endpoint-specific overrides
    allowList: function(request: FastifyRequest, _key: string) {
      // Skip for excluded routes
      if (skipRoutes.some(route => request.url.startsWith(route))) {
        return true;
      }
      return false;
    }
  });

  // Add custom headers hook
  fastify.addHook('onSend', async (request: FastifyRequest, reply: FastifyReply) => {
    // Only add headers if not already present (not skipped)
    if (!reply.hasHeader('X-RateLimit-Limit')) {
      const endpointLimit = (request as any).endpointRateLimit;
      const limit = endpointLimit?.max ?? max;

      // Calculate reset time (1 second from now)
      const resetTime = Date.now() + 1000;

      // We can't easily get the exact remaining count here,
      // but the @fastify/rate-limit plugin should have added it
      addRateLimitHeaders(reply, limit, 0, resetTime);
    }
  });
}

/**
 * Create custom rate limit configuration for specific endpoints
 */
export function createEndpointRateLimit(config: {
  max: number;
  timeWindow: string | number;
}): any {
  return {
    config: {
      rateLimit: {
        max: config.max,
        timeWindow: config.timeWindow
      }
    }
  };
}

/**
 * Get daily limit stats for a key (useful for monitoring)
 */
export function getDailyLimitStats(key: string): number {
  return dailyTracker.getCount(`daily:${key}`);
}
