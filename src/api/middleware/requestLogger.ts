/**
 * VeilChain Request Logging Middleware
 *
 * Comprehensive request/response logging with PII redaction,
 * timing metrics, and structured output.
 */

import type { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { safeForLogging, createErrorLogEntry } from '../../services/pii.js';

/**
 * Request log entry structure
 */
export interface RequestLogEntry {
  timestamp: string;
  requestId: string;
  method: string;
  url: string;
  path: string;
  statusCode?: number;
  duration?: number;
  ip: string;
  userAgent?: string;
  userId?: string;
  apiKeyId?: string;
  contentLength?: number;
  responseSize?: number;
  error?: Record<string, unknown>;
  tags?: string[];
}

/**
 * Request logger options
 */
export interface RequestLoggerOptions {
  /** Log level for successful requests */
  level?: 'debug' | 'info' | 'warn' | 'error';
  /** Log level for errors */
  errorLevel?: 'warn' | 'error';
  /** Routes to skip logging */
  skipRoutes?: string[];
  /** Include request body in logs (with PII redaction) */
  logBody?: boolean;
  /** Include response body in logs (with PII redaction) */
  logResponse?: boolean;
  /** Maximum body size to log (bytes) */
  maxBodySize?: number;
  /** Custom log handler */
  handler?: (entry: RequestLogEntry) => void;
  /** Enable slow request warning */
  slowRequestThreshold?: number;
}

/**
 * Default options
 */
const DEFAULT_OPTIONS: RequestLoggerOptions = {
  level: 'info',
  errorLevel: 'error',
  skipRoutes: ['/health'],
  logBody: false,
  logResponse: false,
  maxBodySize: 10_000,
  slowRequestThreshold: 3000, // 3 seconds
};

/**
 * Extract auth context from request
 */
function getAuthInfo(request: FastifyRequest): { userId?: string; apiKeyId?: string } {
  const auth = (request as { authContext?: { userId?: string; apiKeyId?: string } }).authContext;
  return {
    userId: auth?.userId,
    apiKeyId: auth?.apiKeyId,
  };
}

/**
 * Get client IP address
 */
function getClientIp(request: FastifyRequest): string {
  // Check common proxy headers
  const forwardedFor = request.headers['x-forwarded-for'];
  if (forwardedFor) {
    const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    return ips.split(',')[0].trim();
  }

  const realIp = request.headers['x-real-ip'];
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp;
  }

  return request.ip || 'unknown';
}

/**
 * Create request logger middleware
 */
export function createRequestLogger(options: RequestLoggerOptions = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    // Skip certain routes
    if (opts.skipRoutes?.some(route => request.url.startsWith(route))) {
      return;
    }

    // Store start time
    (request as { startTime?: bigint }).startTime = process.hrtime.bigint();
  };
}

/**
 * Register request logging hooks
 */
export function registerRequestLogger(
  fastify: FastifyInstance,
  options: RequestLoggerOptions = {}
): void {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // onRequest hook - capture start time
  fastify.addHook('onRequest', async (request) => {
    if (opts.skipRoutes?.some(route => request.url.startsWith(route))) {
      return;
    }
    (request as { startTime?: bigint }).startTime = process.hrtime.bigint();
  });

  // onResponse hook - log completed request
  fastify.addHook('onResponse', async (request, reply) => {
    if (opts.skipRoutes?.some(route => request.url.startsWith(route))) {
      return;
    }

    const startTime = (request as { startTime?: bigint }).startTime;
    const endTime = process.hrtime.bigint();
    const duration = startTime ? Number((endTime - startTime) / 1_000_000n) : undefined;

    const authInfo = getAuthInfo(request);
    const contentLength = request.headers['content-length'];

    const entry: RequestLogEntry = {
      timestamp: new Date().toISOString(),
      requestId: request.id,
      method: request.method,
      url: request.url.split('?')[0], // Remove query params for privacy
      path: request.routeOptions?.url || request.url.split('?')[0],
      statusCode: reply.statusCode,
      duration,
      ip: getClientIp(request),
      userAgent: request.headers['user-agent'],
      userId: authInfo.userId,
      apiKeyId: authInfo.apiKeyId,
      contentLength: contentLength ? parseInt(contentLength, 10) : undefined,
      tags: [],
    };

    // Add tags for special cases
    if (duration && opts.slowRequestThreshold && duration > opts.slowRequestThreshold) {
      entry.tags?.push('slow');
    }

    if (reply.statusCode >= 400 && reply.statusCode < 500) {
      entry.tags?.push('client-error');
    }

    if (reply.statusCode >= 500) {
      entry.tags?.push('server-error');
    }

    // Use custom handler or default logging
    if (opts.handler) {
      opts.handler(entry);
    } else {
      const level = reply.statusCode >= 500 ? opts.errorLevel : opts.level;
      const logFn = fastify.log[level || 'info'].bind(fastify.log);
      logFn(entry, `${request.method} ${request.url.split('?')[0]} ${reply.statusCode} ${duration}ms`);
    }
  });

  // onError hook - log errors
  fastify.addHook('onError', async (request, _reply, error) => {
    if (opts.skipRoutes?.some(route => request.url.startsWith(route))) {
      return;
    }

    const authInfo = getAuthInfo(request);

    const entry: RequestLogEntry = {
      timestamp: new Date().toISOString(),
      requestId: request.id,
      method: request.method,
      url: request.url.split('?')[0],
      path: request.routeOptions?.url || request.url.split('?')[0],
      ip: getClientIp(request),
      userAgent: request.headers['user-agent'],
      userId: authInfo.userId,
      apiKeyId: authInfo.apiKeyId,
      error: createErrorLogEntry(error),
      tags: ['error'],
    };

    if (opts.handler) {
      opts.handler(entry);
    } else {
      fastify.log[opts.errorLevel || 'error'](entry, `Error: ${error.message}`);
    }
  });
}

/**
 * Create structured log output for external systems
 */
export function formatLogForExport(entry: RequestLogEntry): string {
  return JSON.stringify({
    ...entry,
    // Ensure PII redaction
    ip: entry.ip ? entry.ip.split('.').slice(0, 2).join('.') + '.*.*' : undefined,
  });
}

/**
 * Log sanitization for request bodies
 */
export function sanitizeRequestBody(body: unknown, maxSize: number = 10_000): unknown {
  if (!body) return undefined;

  // Stringify to check size
  let stringified: string;
  try {
    stringified = JSON.stringify(body);
  } catch {
    return '[UNSTRINGIFIABLE]';
  }

  if (stringified.length > maxSize) {
    return '[BODY_TOO_LARGE]';
  }

  // Apply PII redaction
  return safeForLogging(body);
}

/**
 * Create an audit-friendly log entry
 */
export function createAuditLogEntry(
  request: FastifyRequest,
  action: string,
  resourceType?: string,
  resourceId?: string,
  details?: Record<string, unknown>
): Record<string, unknown> {
  const authInfo = getAuthInfo(request);

  return {
    timestamp: new Date().toISOString(),
    requestId: request.id,
    action,
    resourceType,
    resourceId,
    userId: authInfo.userId,
    apiKeyId: authInfo.apiKeyId,
    ip: getClientIp(request),
    userAgent: request.headers['user-agent'],
    details: details ? safeForLogging(details) : undefined,
  };
}
