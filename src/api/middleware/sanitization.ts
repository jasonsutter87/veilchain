/**
 * VeilChain Input Sanitization Middleware
 *
 * Sanitizes request inputs to prevent XSS, injection attacks,
 * and malformed data from reaching business logic.
 */

import type { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Dangerous patterns to detect and block
 */
const DANGEROUS_PATTERNS = [
  // Script injection
  /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,

  // SQL injection (basic patterns)
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE)\b.*\b(FROM|INTO|TABLE|WHERE)\b)/gi,
  /;\s*(DROP|DELETE|TRUNCATE)\s/gi,

  // Path traversal
  /\.\.[\/\\]/g,

  // Null byte injection
  /\x00/g,

  // Command injection
  /[|;&`$]/g,
];

/**
 * Maximum string length for any input field
 */
const MAX_STRING_LENGTH = 100_000;

/**
 * Maximum depth for nested objects
 */
const MAX_OBJECT_DEPTH = 10;

/**
 * Sanitization options
 */
export interface SanitizationOptions {
  /** Enable strict mode - blocks suspicious patterns */
  strict?: boolean;
  /** Maximum string length allowed */
  maxStringLength?: number;
  /** Maximum object nesting depth */
  maxDepth?: number;
  /** Fields to skip sanitization (e.g., passwords, encrypted data) */
  skipFields?: string[];
  /** Routes to skip entirely */
  skipRoutes?: string[];
}

/**
 * Default sanitization options
 */
const DEFAULT_OPTIONS: SanitizationOptions = {
  strict: false,
  maxStringLength: MAX_STRING_LENGTH,
  maxDepth: MAX_OBJECT_DEPTH,
  skipFields: ['password', 'passwordHash', 'token', 'refreshToken', 'key'],
  skipRoutes: ['/health'],
};

/**
 * Sanitization result
 */
interface SanitizationResult {
  sanitized: unknown;
  warnings: string[];
  blocked: boolean;
  blockReason?: string;
}

/**
 * Sanitize a string value
 */
function sanitizeString(
  value: string,
  fieldName: string,
  options: SanitizationOptions
): SanitizationResult {
  const warnings: string[] = [];

  // Check max length
  if (value.length > (options.maxStringLength || MAX_STRING_LENGTH)) {
    return {
      sanitized: value,
      warnings: [],
      blocked: true,
      blockReason: `Field '${fieldName}' exceeds maximum length`,
    };
  }

  // In strict mode, check for dangerous patterns
  if (options.strict) {
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(value)) {
        return {
          sanitized: value,
          warnings: [],
          blocked: true,
          blockReason: `Field '${fieldName}' contains suspicious pattern`,
        };
      }
    }
  }

  // Basic sanitization - trim whitespace
  let sanitized = value.trim();

  // Remove null bytes (always)
  if (sanitized.includes('\x00')) {
    sanitized = sanitized.replace(/\x00/g, '');
    warnings.push(`Removed null bytes from '${fieldName}'`);
  }

  // Normalize unicode
  try {
    sanitized = sanitized.normalize('NFC');
  } catch {
    // Keep original if normalization fails
  }

  return {
    sanitized,
    warnings,
    blocked: false,
  };
}

/**
 * Recursively sanitize an object
 */
function sanitizeObject(
  value: unknown,
  options: SanitizationOptions,
  depth: number = 0,
  path: string = ''
): SanitizationResult {
  const maxDepth = options.maxDepth || MAX_OBJECT_DEPTH;
  const skipFields = options.skipFields || [];

  // Check depth
  if (depth > maxDepth) {
    return {
      sanitized: value,
      warnings: [],
      blocked: true,
      blockReason: `Object nesting exceeds maximum depth at '${path}'`,
    };
  }

  // Handle null/undefined
  if (value === null || value === undefined) {
    return { sanitized: value, warnings: [], blocked: false };
  }

  // Handle primitives
  if (typeof value === 'string') {
    const fieldName = path.split('.').pop() || path;

    // Skip certain fields
    if (skipFields.some(f => fieldName.toLowerCase().includes(f.toLowerCase()))) {
      return { sanitized: value, warnings: [], blocked: false };
    }

    return sanitizeString(value, path || 'value', options);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return { sanitized: value, warnings: [], blocked: false };
  }

  // Handle arrays
  if (Array.isArray(value)) {
    const allWarnings: string[] = [];
    const sanitizedArray: unknown[] = [];

    for (let i = 0; i < value.length; i++) {
      const result = sanitizeObject(value[i], options, depth + 1, `${path}[${i}]`);
      if (result.blocked) {
        return result;
      }
      sanitizedArray.push(result.sanitized);
      allWarnings.push(...result.warnings);
    }

    return { sanitized: sanitizedArray, warnings: allWarnings, blocked: false };
  }

  // Handle objects
  if (typeof value === 'object') {
    const allWarnings: string[] = [];
    const sanitizedObj: Record<string, unknown> = {};

    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      // Sanitize key itself
      const keyResult = sanitizeString(key, 'key', options);
      if (keyResult.blocked) {
        return keyResult;
      }

      const sanitizedKey = keyResult.sanitized as string;
      allWarnings.push(...keyResult.warnings);

      // Sanitize value
      const newPath = path ? `${path}.${sanitizedKey}` : sanitizedKey;
      const result = sanitizeObject(val, options, depth + 1, newPath);
      if (result.blocked) {
        return result;
      }

      sanitizedObj[sanitizedKey] = result.sanitized;
      allWarnings.push(...result.warnings);
    }

    return { sanitized: sanitizedObj, warnings: allWarnings, blocked: false };
  }

  // Unknown type - pass through
  return { sanitized: value, warnings: [], blocked: false };
}

/**
 * Create input sanitization middleware
 */
export function createSanitizationMiddleware(options: SanitizationOptions = {}) {
  const finalOptions = { ...DEFAULT_OPTIONS, ...options };

  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    // Skip certain routes
    if (finalOptions.skipRoutes?.some(route => request.url.startsWith(route))) {
      return;
    }

    // Sanitize query parameters
    if (request.query && typeof request.query === 'object') {
      const queryResult = sanitizeObject(request.query, finalOptions, 0, 'query');
      if (queryResult.blocked) {
        return reply.code(400).send({
          error: {
            code: 'INVALID_INPUT',
            message: queryResult.blockReason || 'Invalid query parameters',
          },
        });
      }
      // Note: Fastify query is read-only, but we validated it
    }

    // Sanitize request body
    if (request.body && typeof request.body === 'object') {
      const bodyResult = sanitizeObject(request.body, finalOptions, 0, 'body');
      if (bodyResult.blocked) {
        return reply.code(400).send({
          error: {
            code: 'INVALID_INPUT',
            message: bodyResult.blockReason || 'Invalid request body',
          },
        });
      }

      // Replace body with sanitized version
      (request as { body: unknown }).body = bodyResult.sanitized;

      // Log warnings in development
      if (bodyResult.warnings.length > 0 && process.env.NODE_ENV !== 'production') {
        console.warn('Input sanitization warnings:', bodyResult.warnings);
      }
    }

    // Sanitize path parameters
    if (request.params && typeof request.params === 'object') {
      const paramsResult = sanitizeObject(request.params, finalOptions, 0, 'params');
      if (paramsResult.blocked) {
        return reply.code(400).send({
          error: {
            code: 'INVALID_INPUT',
            message: paramsResult.blockReason || 'Invalid path parameters',
          },
        });
      }
    }
  };
}

/**
 * Validate and sanitize a ledger ID
 */
export function sanitizeLedgerId(id: string): string | null {
  // Ledger IDs should match pattern: ledger_<timestamp>_<random>
  const pattern = /^ledger_[a-z0-9]+_[a-z0-9]+$/;

  if (!pattern.test(id)) {
    return null;
  }

  if (id.length > 64) {
    return null;
  }

  return id;
}

/**
 * Validate and sanitize an entry ID
 */
export function sanitizeEntryId(id: string): string | null {
  // Entry IDs should match pattern: <ledger_id>-<position>
  const pattern = /^ledger_[a-z0-9]+_[a-z0-9]+-\d+$/;

  if (!pattern.test(id)) {
    return null;
  }

  if (id.length > 128) {
    return null;
  }

  return id;
}

/**
 * Validate pagination parameters
 */
export function sanitizePagination(params: {
  offset?: string | number;
  limit?: string | number;
}): { offset: number; limit: number } | null {
  const MAX_LIMIT = 1000;
  const DEFAULT_LIMIT = 50;
  const MAX_OFFSET = 1_000_000;

  let offset = 0;
  let limit = DEFAULT_LIMIT;

  if (params.offset !== undefined) {
    const parsed = typeof params.offset === 'string'
      ? parseInt(params.offset, 10)
      : params.offset;

    if (isNaN(parsed) || parsed < 0 || parsed > MAX_OFFSET) {
      return null;
    }
    offset = parsed;
  }

  if (params.limit !== undefined) {
    const parsed = typeof params.limit === 'string'
      ? parseInt(params.limit, 10)
      : params.limit;

    if (isNaN(parsed) || parsed < 1 || parsed > MAX_LIMIT) {
      return null;
    }
    limit = parsed;
  }

  return { offset, limit };
}

/**
 * Validate email format
 */
export function sanitizeEmail(email: string): string | null {
  // Basic email validation
  const pattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  const trimmed = email.trim().toLowerCase();

  if (!pattern.test(trimmed)) {
    return null;
  }

  if (trimmed.length > 255) {
    return null;
  }

  return trimmed;
}

/**
 * Validate UUID format
 */
export function sanitizeUuid(id: string): string | null {
  const pattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

  const trimmed = id.trim().toLowerCase();

  if (!pattern.test(trimmed)) {
    return null;
  }

  return trimmed;
}
