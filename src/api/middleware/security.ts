/**
 * VeilChain Security Configuration
 *
 * Enhanced security headers and CORS configuration for production.
 */

import type { FastifyInstance } from 'fastify';

/**
 * Environment-aware CORS origins
 */
export function getCorsOrigins(): string[] | boolean {
  const env = process.env.NODE_ENV || 'development';
  const allowedOrigins = process.env.CORS_ORIGINS;

  // Development - allow all
  if (env === 'development') {
    return true;
  }

  // Production - require explicit origins
  if (allowedOrigins) {
    return allowedOrigins.split(',').map(origin => origin.trim());
  }

  // Default production origins
  return [
    'https://veilchain.io',
    'https://www.veilchain.io',
    'https://api.veilchain.io',
    'https://app.veilchain.io',
  ];
}

/**
 * CORS configuration for Fastify
 */
export function getCorsConfig() {
  const origins = getCorsOrigins();

  return {
    origin: origins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-API-Key',
      'X-Request-ID',
      'X-Idempotency-Key',
      'Accept',
      'Accept-Language',
      'Accept-Encoding',
    ],
    exposedHeaders: [
      'X-Request-ID',
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
      'X-RateLimit-Policy',
    ],
    maxAge: 86400, // 24 hours
    preflightContinue: false,
    optionsSuccessStatus: 204,
  };
}

/**
 * Helmet security headers configuration
 */
export function getHelmetConfig() {
  const isDev = process.env.NODE_ENV === 'development';

  return {
    // Content Security Policy
    contentSecurityPolicy: isDev ? false : {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
        childSrc: ["'none'"],
        workerSrc: ["'self'"],
        connectSrc: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        upgradeInsecureRequests: isDev ? null : [],
      },
    },

    // Cross-Origin-Embedder-Policy
    crossOriginEmbedderPolicy: false, // Disabled for API

    // Cross-Origin-Opener-Policy
    crossOriginOpenerPolicy: { policy: 'same-origin' as const },

    // Cross-Origin-Resource-Policy
    crossOriginResourcePolicy: { policy: 'same-origin' as const },

    // DNS Prefetch Control
    dnsPrefetchControl: { allow: false },

    // Frameguard - prevent clickjacking
    frameguard: { action: 'deny' as const },

    // Hide X-Powered-By
    hidePoweredBy: true,

    // HSTS
    hsts: isDev ? false : {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },

    // IE No Open
    ieNoOpen: true,

    // No Sniff
    noSniff: true,

    // Origin Agent Cluster
    originAgentCluster: true,

    // Permitted Cross-Domain Policies
    permittedCrossDomainPolicies: { permittedPolicies: 'none' as const },

    // Referrer Policy
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' as const },

    // XSS Filter (legacy, but kept for older browsers)
    xssFilter: true,
  };
}

/**
 * Add custom security headers
 */
export function registerSecurityHeaders(fastify: FastifyInstance): void {
  fastify.addHook('onSend', async (request, reply) => {
    // Remove any server identification
    reply.removeHeader('Server');
    reply.removeHeader('X-Powered-By');

    // Add request ID for tracing
    const requestId = request.id || request.headers['x-request-id'];
    if (requestId) {
      reply.header('X-Request-ID', requestId);
    }

    // Cache control for API responses
    if (!reply.hasHeader('Cache-Control')) {
      reply.header('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      reply.header('Pragma', 'no-cache');
      reply.header('Expires', '0');
    }

    // Permissions Policy (Feature Policy)
    reply.header('Permissions-Policy',
      'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()'
    );

    // Additional security headers
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('X-XSS-Protection', '1; mode=block');
  });
}

/**
 * Security-related request validation
 */
export function registerSecurityValidation(fastify: FastifyInstance): void {
  fastify.addHook('onRequest', async (request, reply) => {
    // Block requests with suspicious headers
    const host = request.headers.host;

    // Validate Host header matches expected
    if (process.env.NODE_ENV === 'production' && process.env.EXPECTED_HOST) {
      const expectedHost = process.env.EXPECTED_HOST;
      if (host && !host.includes(expectedHost)) {
        return reply.code(400).send({
          error: {
            code: 'INVALID_HOST',
            message: 'Invalid Host header',
          },
        });
      }
    }

    // Detect and block HTTP Request Smuggling attempts
    const contentLength = request.headers['content-length'];
    const transferEncoding = request.headers['transfer-encoding'];

    if (contentLength && transferEncoding) {
      // Both headers present - potential request smuggling
      return reply.code(400).send({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Invalid request headers',
        },
      });
    }

    // Block requests with null bytes in headers
    for (const [, value] of Object.entries(request.headers)) {
      if (typeof value === 'string' && value.includes('\x00')) {
        return reply.code(400).send({
          error: {
            code: 'INVALID_HEADER',
            message: 'Invalid header value',
          },
        });
      }
    }
  });
}

/**
 * Trusted proxy configuration
 */
export function getTrustedProxies(): string[] {
  const trustedProxies = process.env.TRUSTED_PROXIES;

  if (trustedProxies) {
    return trustedProxies.split(',').map(p => p.trim());
  }

  // Default trusted proxies for common cloud providers
  return [
    'loopback',      // 127.0.0.0/8, ::1/128
    'linklocal',     // 169.254.0.0/16, fe80::/10
    'uniquelocal',   // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, fc00::/7
  ];
}

/**
 * Rate limiting headers configuration
 */
export function getRateLimitHeaders(info: {
  limit: number;
  remaining: number;
  reset: number;
  policy: string;
}): Record<string, string> {
  return {
    'X-RateLimit-Limit': info.limit.toString(),
    'X-RateLimit-Remaining': info.remaining.toString(),
    'X-RateLimit-Reset': info.reset.toString(),
    'X-RateLimit-Policy': info.policy,
    'Retry-After': info.remaining <= 0 ? info.reset.toString() : '',
  };
}

/**
 * Apply all security configurations
 */
export async function applySecurityConfig(fastify: FastifyInstance): Promise<void> {
  registerSecurityHeaders(fastify);
  registerSecurityValidation(fastify);
}
