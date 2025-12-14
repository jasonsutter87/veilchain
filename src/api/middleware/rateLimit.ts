/**
 * VeilChain API Rate Limiting Middleware
 *
 * Protects the API from abuse by limiting request rates.
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';
import rateLimit from '@fastify/rate-limit';

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /** Maximum requests per time window */
  max?: number;
  /** Time window in milliseconds or string format (e.g., '1 minute') */
  timeWindow?: number | string;
  /** Custom error message */
  errorMessage?: string;
  /** Skip rate limiting for certain routes */
  skipRoutes?: string[];
}

/**
 * Default rate limit configuration
 */
const defaultConfig: Required<Omit<RateLimitConfig, 'skipRoutes'>> = {
  max: 100,
  timeWindow: '1 minute',
  errorMessage: 'Too many requests, please try again later.'
};

/**
 * Register rate limiting middleware
 */
export async function registerRateLimit(
  fastify: FastifyInstance,
  config: RateLimitConfig = {}
): Promise<void> {
  const {
    max = defaultConfig.max,
    timeWindow = defaultConfig.timeWindow,
    errorMessage = defaultConfig.errorMessage,
    skipRoutes = []
  } = config;

  await fastify.register(rateLimit, {
    max,
    timeWindow,
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
    skipOnError: false
  });

  // Add skip logic as a hook if needed
  if (skipRoutes.length > 0) {
    fastify.addHook('onRequest', async (request: FastifyRequest) => {
      if (skipRoutes.some(route => request.url.startsWith(route))) {
        // @ts-ignore - accessing internal rate limit property
        request.skipRateLimit = true;
      }
    });
  }
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
 * Pre-defined rate limit tiers
 */
export const RateLimitTiers = {
  /** Very strict - for mutation operations */
  STRICT: {
    max: 10,
    timeWindow: '1 minute'
  },
  /** Standard - for most read operations */
  STANDARD: {
    max: 100,
    timeWindow: '1 minute'
  },
  /** Relaxed - for health checks and public endpoints */
  RELAXED: {
    max: 1000,
    timeWindow: '1 minute'
  }
} as const;
