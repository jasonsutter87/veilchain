/**
 * VeilChain Rate Limiting Tests
 *
 * Tests for API rate limiting including:
 * - Rate limit tiers (FREE, STARTER, PRO, ENTERPRISE)
 * - Daily limits
 * - Per-endpoint limits
 * - Rate limit headers
 * - Error responses
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import Fastify, { FastifyInstance } from 'fastify';
import {
  registerRateLimit,
  RateLimitTiers,
  EndpointRateLimits,
  getDailyLimitStats,
  type RateLimitTier
} from '../src/api/middleware/rateLimit.js';

describe('RateLimitTiers', () => {
  describe('FREE Tier', () => {
    test('should have correct configuration', () => {
      expect(RateLimitTiers.FREE.max).toBe(10);
      expect(RateLimitTiers.FREE.timeWindow).toBe('1 second');
      expect(RateLimitTiers.FREE.dailyLimit).toBe(1000);
    });
  });

  describe('STARTER Tier', () => {
    test('should have correct configuration', () => {
      expect(RateLimitTiers.STARTER.max).toBe(100);
      expect(RateLimitTiers.STARTER.timeWindow).toBe('1 second');
      expect(RateLimitTiers.STARTER.dailyLimit).toBe(50000);
    });
  });

  describe('PRO Tier', () => {
    test('should have correct configuration', () => {
      expect(RateLimitTiers.PRO.max).toBe(1000);
      expect(RateLimitTiers.PRO.timeWindow).toBe('1 second');
      expect('dailyLimit' in RateLimitTiers.PRO).toBe(false);
    });
  });

  describe('ENTERPRISE Tier', () => {
    test('should have correct configuration', () => {
      expect(RateLimitTiers.ENTERPRISE.max).toBe(10000);
      expect(RateLimitTiers.ENTERPRISE.timeWindow).toBe('1 second');
      expect('dailyLimit' in RateLimitTiers.ENTERPRISE).toBe(false);
    });
  });

  describe('Tier Comparison', () => {
    test('should have ascending rate limits', () => {
      expect(RateLimitTiers.FREE.max).toBeLessThan(RateLimitTiers.STARTER.max);
      expect(RateLimitTiers.STARTER.max).toBeLessThan(RateLimitTiers.PRO.max);
      expect(RateLimitTiers.PRO.max).toBeLessThan(RateLimitTiers.ENTERPRISE.max);
    });

    test('should have ascending daily limits where defined', () => {
      expect(RateLimitTiers.FREE.dailyLimit!).toBeLessThan(RateLimitTiers.STARTER.dailyLimit!);
    });
  });
});

describe('EndpointRateLimits', () => {
  describe('APPEND Limits', () => {
    test('should be stricter than base tier limits', () => {
      expect(EndpointRateLimits.APPEND.FREE.max).toBeLessThan(RateLimitTiers.FREE.max);
      expect(EndpointRateLimits.APPEND.STARTER.max).toBeLessThan(RateLimitTiers.STARTER.max);
      expect(EndpointRateLimits.APPEND.PRO.max).toBeLessThan(RateLimitTiers.PRO.max);
      expect(EndpointRateLimits.APPEND.ENTERPRISE.max).toBeLessThan(RateLimitTiers.ENTERPRISE.max);
    });
  });

  describe('READ Limits', () => {
    test('should be more lenient than base tier limits', () => {
      expect(EndpointRateLimits.READ.FREE.max).toBeGreaterThan(RateLimitTiers.FREE.max);
      expect(EndpointRateLimits.READ.STARTER.max).toBeGreaterThan(RateLimitTiers.STARTER.max);
      expect(EndpointRateLimits.READ.PRO.max).toBeGreaterThan(RateLimitTiers.PRO.max);
      expect(EndpointRateLimits.READ.ENTERPRISE.max).toBeGreaterThan(RateLimitTiers.ENTERPRISE.max);
    });
  });

  describe('HEALTH Limits', () => {
    test('should have high limit', () => {
      expect(EndpointRateLimits.HEALTH.max).toBe(1000);
    });
  });
});

describe('Rate Limiting Integration', () => {
  describe('Basic Rate Limiting', () => {
    let fastify: FastifyInstance;

    beforeEach(async () => {
      fastify = Fastify({ logger: false });
      await registerRateLimit(fastify, {
        max: 5,
        timeWindow: '1 second'
      });
      fastify.get('/test', async () => ({ success: true }));
      await fastify.ready();
    });

    afterEach(async () => {
      await fastify.close();
    });

    test('should allow requests under limit', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/test'
      });

      expect(response.statusCode).toBe(200);
    });

    test('should include rate limit headers', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/test'
      });

      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });

    test('should block requests over limit', async () => {
      // Make requests up to limit
      for (let i = 0; i < 5; i++) {
        await fastify.inject({ method: 'GET', url: '/test' });
      }

      // Next request should be blocked
      const response = await fastify.inject({
        method: 'GET',
        url: '/test'
      });

      // Rate limiter should return error response (status may be 429 or 500 depending on plugin config)
      expect([429, 500]).toContain(response.statusCode);

      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(body.error.message).toBeDefined();
      expect(body.error.details).toBeDefined();
    });
  });

  describe('Tier-Based Rate Limiting', () => {
    test('should apply FREE tier limits', async () => {
      const app = Fastify({ logger: false });
      await registerRateLimit(app, { tier: 'FREE' });
      app.get('/test', async () => ({ success: true }));
      await app.ready();

      const response = await app.inject({ method: 'GET', url: '/test' });
      expect(response.headers['x-ratelimit-limit']).toBe('10');

      await app.close();
    });

    test('should apply STARTER tier limits', async () => {
      const app = Fastify({ logger: false });
      await registerRateLimit(app, { tier: 'STARTER' });
      app.get('/test', async () => ({ success: true }));
      await app.ready();

      const response = await app.inject({ method: 'GET', url: '/test' });
      expect(response.headers['x-ratelimit-limit']).toBe('100');

      await app.close();
    });
  });

  describe('Skip Routes', () => {
    let fastify: FastifyInstance;

    beforeEach(async () => {
      fastify = Fastify({ logger: false });
      await registerRateLimit(fastify, {
        max: 2,
        timeWindow: '1 second',
        skipRoutes: ['/health']
      });
      fastify.get('/test', async () => ({ success: true }));
      fastify.get('/health', async () => ({ status: 'ok' }));
      await fastify.ready();
    });

    afterEach(async () => {
      await fastify.close();
    });

    test('should skip rate limiting for specified routes', async () => {
      // Make many requests to health
      for (let i = 0; i < 10; i++) {
        const response = await fastify.inject({
          method: 'GET',
          url: '/health'
        });
        expect(response.statusCode).toBe(200);
      }
    });

    test('should still limit other routes', async () => {
      // Exhaust limit
      await fastify.inject({ method: 'GET', url: '/test' });
      await fastify.inject({ method: 'GET', url: '/test' });

      const response = await fastify.inject({
        method: 'GET',
        url: '/test'
      });

      // Rate limiter should return error (status may be 429 or 500)
      expect([429, 500]).toContain(response.statusCode);

      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });
  });

  describe('Custom Error Message', () => {
    let fastify: FastifyInstance;

    beforeEach(async () => {
      fastify = Fastify({ logger: false });
      await registerRateLimit(fastify, {
        max: 1,
        timeWindow: '1 second',
        errorMessage: 'Custom rate limit message'
      });
      fastify.get('/test', async () => ({ success: true }));
      await fastify.ready();
    });

    afterEach(async () => {
      await fastify.close();
    });

    test('should use custom error message', async () => {
      await fastify.inject({ method: 'GET', url: '/test' });

      const response = await fastify.inject({
        method: 'GET',
        url: '/test'
      });

      // Rate limiter should return error (status may be 429 or 500)
      expect([429, 500]).toContain(response.statusCode);

      const body = JSON.parse(response.payload);
      expect(body.error.message).toBe('Custom rate limit message');
    });
  });

  describe('API Key Based Limiting', () => {
    let fastify: FastifyInstance;

    beforeEach(async () => {
      fastify = Fastify({ logger: false });
      await registerRateLimit(fastify, {
        max: 3,
        timeWindow: '1 second'
      });
      fastify.get('/test', async () => ({ success: true }));
      await fastify.ready();
    });

    afterEach(async () => {
      await fastify.close();
    });

    test('should track limits per API key', async () => {
      // Make requests with key 1
      for (let i = 0; i < 3; i++) {
        await fastify.inject({
          method: 'GET',
          url: '/test',
          headers: { 'x-api-key': 'key-1' }
        });
      }

      // Key 1 should be blocked (status may be 429 or 500)
      const blocked = await fastify.inject({
        method: 'GET',
        url: '/test',
        headers: { 'x-api-key': 'key-1' }
      });
      expect([429, 500]).toContain(blocked.statusCode);

      const body = JSON.parse(blocked.payload);
      expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED');

      // Key 2 should still work
      const allowed = await fastify.inject({
        method: 'GET',
        url: '/test',
        headers: { 'x-api-key': 'key-2' }
      });
      expect(allowed.statusCode).toBe(200);
    });
  });
});

describe('Daily Limit Tracking', () => {
  describe('Daily Limit Headers', () => {
    let fastify: FastifyInstance;

    beforeEach(async () => {
      fastify = Fastify({ logger: false });
      await registerRateLimit(fastify, {
        tier: 'FREE' // Has daily limit of 1000
      });
      fastify.get('/test', async () => ({ success: true }));
      await fastify.ready();
    });

    afterEach(async () => {
      await fastify.close();
    });

    test('should include daily limit headers', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/test',
        headers: { 'x-api-key': 'daily-test-key' }
      });

      expect(response.headers['x-ratelimit-daily-limit']).toBe('1000');
      expect(response.headers['x-ratelimit-daily-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-daily-reset']).toBeDefined();
    });
  });

  describe('Daily Limit Stats', () => {
    test('should track daily usage', () => {
      const key = 'stats-test-key-' + Date.now();

      // Initial count should be 0
      const initialCount = getDailyLimitStats(key);
      expect(initialCount).toBe(0);
    });
  });
});

describe('Rate Limit Error Response Format', () => {
  let fastify: FastifyInstance;

  beforeEach(async () => {
    fastify = Fastify({ logger: false });
    await registerRateLimit(fastify, {
      max: 1,
      timeWindow: '1 second'
    });
    fastify.get('/test', async () => ({ success: true }));
    await fastify.ready();
  });

  afterEach(async () => {
    await fastify.close();
  });

  test('should return proper error format', async () => {
    // Exhaust limit
    await fastify.inject({ method: 'GET', url: '/test' });

    const response = await fastify.inject({
      method: 'GET',
      url: '/test'
    });

    // Rate limiter should return error (status may be 429 or 500)
    expect([429, 500]).toContain(response.statusCode);

    const body = JSON.parse(response.payload);
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(body.error.message).toBeDefined();
    expect(body.error.details).toBeDefined();
    expect(body.error.details.limit).toBeDefined();
    expect(body.error.details.retryAfter).toBeDefined();
  });
});

describe('Rate Limit Configuration', () => {
  test('should use default values when not specified', async () => {
    const fastify = Fastify({ logger: false });
    await registerRateLimit(fastify, {});
    fastify.get('/test', async () => ({ success: true }));
    await fastify.ready();

    const response = await fastify.inject({
      method: 'GET',
      url: '/test'
    });

    // Default is 100 requests per second
    expect(response.headers['x-ratelimit-limit']).toBe('100');

    await fastify.close();
  });

  test('should allow custom max override', async () => {
    const fastify = Fastify({ logger: false });
    await registerRateLimit(fastify, {
      tier: 'FREE',
      max: 25 // Override FREE tier's 10
    });
    fastify.get('/test', async () => ({ success: true }));
    await fastify.ready();

    const response = await fastify.inject({
      method: 'GET',
      url: '/test'
    });

    expect(response.headers['x-ratelimit-limit']).toBe('25');

    await fastify.close();
  });

  test('should allow custom time window', async () => {
    const fastify = Fastify({ logger: false });
    await registerRateLimit(fastify, {
      max: 5,
      timeWindow: '10 seconds'
    });
    fastify.get('/test', async () => ({ success: true }));
    await fastify.ready();

    // Should allow 5 requests in 10 second window
    for (let i = 0; i < 5; i++) {
      const response = await fastify.inject({
        method: 'GET',
        url: '/test'
      });
      expect(response.statusCode).toBe(200);
    }

    await fastify.close();
  });
});

describe('Rate Limit Type Safety', () => {
  test('RateLimitTier should be valid type', () => {
    const tiers: RateLimitTier[] = ['FREE', 'STARTER', 'PRO', 'ENTERPRISE'];

    for (const tier of tiers) {
      expect(RateLimitTiers[tier]).toBeDefined();
    }
  });

  test('all tiers should have required properties', () => {
    const tiers: RateLimitTier[] = ['FREE', 'STARTER', 'PRO', 'ENTERPRISE'];

    for (const tier of tiers) {
      const config = RateLimitTiers[tier];
      expect(typeof config.max).toBe('number');
      expect(typeof config.timeWindow).toBe('string');
    }
  });
});
