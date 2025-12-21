/**
 * VeilChain PII (Personally Identifiable Information) Utilities
 *
 * Provides utilities for detecting, masking, and redacting PII
 * from logs, audit trails, and error messages.
 */

/**
 * PII detection patterns
 */
const PII_PATTERNS = {
  // Email addresses
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,

  // Phone numbers (various formats)
  phone: /(\+?1[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g,

  // Social Security Numbers
  ssn: /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g,

  // Credit card numbers (basic detection)
  creditCard: /\b(?:\d{4}[-.\s]?){3}\d{4}\b/g,

  // IP addresses
  ipv4: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
  ipv6: /\b(?:[a-fA-F0-9]{1,4}:){7}[a-fA-F0-9]{1,4}\b/g,

  // API keys (VeilChain format)
  apiKey: /vc_live_[a-zA-Z0-9+/=]{32,}/g,

  // JWT tokens
  jwt: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g,

  // Passwords in common formats
  password: /["']?password["']?\s*[:=]\s*["']?[^"'\s,}]{4,}["']?/gi,

  // Bearer tokens
  bearer: /Bearer\s+[a-zA-Z0-9._-]+/gi,

  // Authorization headers
  authorization: /["']?authorization["']?\s*[:=]\s*["'][^"']+["']/gi,
};

/**
 * Sensitive field names to always redact
 */
const SENSITIVE_FIELDS = [
  'password',
  'passwordHash',
  'password_hash',
  'secret',
  'apiKey',
  'api_key',
  'apiSecret',
  'api_secret',
  'token',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'privateKey',
  'private_key',
  'ssn',
  'socialSecurity',
  'creditCard',
  'credit_card',
  'cardNumber',
  'card_number',
  'cvv',
  'cvc',
  'pin',
  'authorization',
];

/**
 * Redaction options
 */
export interface RedactionOptions {
  /** Replacement string for redacted content */
  replacement?: string;
  /** Whether to preserve format (e.g., email@***.com) */
  preserveFormat?: boolean;
  /** Additional patterns to redact */
  additionalPatterns?: Record<string, RegExp>;
  /** Additional field names to redact */
  additionalFields?: string[];
  /** Fields to exclude from redaction */
  excludeFields?: string[];
}

/**
 * Default redaction options
 */
const DEFAULT_OPTIONS: RedactionOptions = {
  replacement: '[REDACTED]',
  preserveFormat: true,
  additionalPatterns: {},
  additionalFields: [],
  excludeFields: [],
};

/**
 * Mask an email address
 */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '[REDACTED]';

  const maskedLocal = local.length > 2
    ? local[0] + '*'.repeat(local.length - 2) + local[local.length - 1]
    : '*'.repeat(local.length);

  return `${maskedLocal}@${domain}`;
}

/**
 * Mask a phone number
 */
function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '[REDACTED]';
  return '***-***-' + digits.slice(-4);
}

/**
 * Mask an IP address
 */
function maskIp(ip: string): string {
  if (ip.includes(':')) {
    // IPv6
    return ip.split(':').slice(0, 4).join(':') + ':****:****:****:****';
  }
  // IPv4
  const parts = ip.split('.');
  return `${parts[0]}.${parts[1]}.***.***`;
}

/**
 * Mask a credit card number
 */
function maskCreditCard(card: string): string {
  const digits = card.replace(/\D/g, '');
  if (digits.length < 4) return '[REDACTED]';
  return '**** **** **** ' + digits.slice(-4);
}

/**
 * Mask an API key
 */
function maskApiKey(key: string): string {
  if (key.length < 12) return '[REDACTED]';
  return key.substring(0, 8) + '****' + key.slice(-4);
}

/**
 * Redact PII from a string
 */
export function redactString(input: string, options: RedactionOptions = {}): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let result = input;

  // Apply pattern-based redaction
  const allPatterns = { ...PII_PATTERNS, ...opts.additionalPatterns };

  for (const [type, pattern] of Object.entries(allPatterns)) {
    result = result.replace(pattern, (match) => {
      if (opts.preserveFormat) {
        switch (type) {
          case 'email':
            return maskEmail(match);
          case 'phone':
            return maskPhone(match);
          case 'ipv4':
          case 'ipv6':
            return maskIp(match);
          case 'creditCard':
            return maskCreditCard(match);
          case 'apiKey':
            return maskApiKey(match);
          default:
            return opts.replacement || '[REDACTED]';
        }
      }
      return opts.replacement || '[REDACTED]';
    });
  }

  return result;
}

/**
 * Redact PII from an object recursively
 */
export function redactObject<T>(
  input: T,
  options: RedactionOptions = {},
  depth: number = 0
): T {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const maxDepth = 20;

  if (depth > maxDepth) {
    return '[MAX_DEPTH]' as unknown as T;
  }

  if (input === null || input === undefined) {
    return input;
  }

  if (typeof input === 'string') {
    return redactString(input, opts) as unknown as T;
  }

  if (typeof input === 'number' || typeof input === 'boolean') {
    return input;
  }

  if (Array.isArray(input)) {
    return input.map(item => redactObject(item, opts, depth + 1)) as unknown as T;
  }

  if (typeof input === 'object') {
    const result: Record<string, unknown> = {};
    const sensitiveFields = [...SENSITIVE_FIELDS, ...(opts.additionalFields || [])];
    const excludeFields = opts.excludeFields || [];

    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      // Check if field should be excluded from redaction
      if (excludeFields.some(f => key.toLowerCase().includes(f.toLowerCase()))) {
        result[key] = value;
        continue;
      }

      // Check if field name is sensitive
      if (sensitiveFields.some(f => key.toLowerCase().includes(f.toLowerCase()))) {
        result[key] = opts.replacement || '[REDACTED]';
        continue;
      }

      // Recursively redact nested values
      result[key] = redactObject(value, opts, depth + 1);
    }

    return result as T;
  }

  return input;
}

/**
 * Create a redacted copy safe for logging
 */
export function safeForLogging<T>(input: T, options: RedactionOptions = {}): T {
  return redactObject(input, {
    ...options,
    preserveFormat: true, // Better for debugging
  });
}

/**
 * Check if a value contains PII
 */
export function containsPii(input: unknown): boolean {
  if (typeof input === 'string') {
    for (const pattern of Object.values(PII_PATTERNS)) {
      if (pattern.test(input)) {
        return true;
      }
    }
    return false;
  }

  if (Array.isArray(input)) {
    return input.some(item => containsPii(item));
  }

  if (typeof input === 'object' && input !== null) {
    for (const [key, value] of Object.entries(input)) {
      // Check key name
      if (SENSITIVE_FIELDS.some(f => key.toLowerCase().includes(f.toLowerCase()))) {
        return true;
      }
      // Check value
      if (containsPii(value)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Hash sensitive data for logging (one-way)
 */
export function hashForLogging(value: string): string {
  // Simple non-cryptographic hash for logging purposes only
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    const char = value.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `hash:${Math.abs(hash).toString(16).padStart(8, '0')}`;
}

/**
 * Create a logging-safe request summary
 */
export function createRequestLogEntry(request: {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
  ip?: string;
}): Record<string, unknown> {
  return {
    method: request.method,
    url: redactString(request.url),
    ip: request.ip ? maskIp(request.ip) : undefined,
    headers: request.headers ? redactObject({
      // Only include safe headers
      'content-type': request.headers['content-type'],
      'user-agent': request.headers['user-agent'],
      'x-request-id': request.headers['x-request-id'],
      // Redact authorization
      authorization: request.headers.authorization ? '[PRESENT]' : undefined,
    }) : undefined,
    // Don't log body by default
    hasBody: !!request.body,
  };
}

/**
 * Create a logging-safe error summary
 */
export function createErrorLogEntry(error: Error & { code?: string; statusCode?: number }): Record<string, unknown> {
  return {
    name: error.name,
    code: error.code,
    statusCode: error.statusCode,
    message: redactString(error.message),
    // Don't include full stack in production
    stack: process.env.NODE_ENV !== 'production'
      ? redactString(error.stack || '')
      : undefined,
  };
}

/**
 * Redact all occurrences of a specific value
 */
export function redactValue(input: string, valueToRedact: string): string {
  if (!valueToRedact || valueToRedact.length < 4) {
    return input;
  }
  return input.split(valueToRedact).join('[REDACTED]');
}
