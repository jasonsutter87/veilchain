/**
 * VeilChain SDK Error Classes
 *
 * Custom error types for better error handling and debugging.
 */

/**
 * Base error class for all VeilChain SDK errors
 */
export class VeilChainError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = 'VeilChainError';
    Object.setPrototypeOf(this, VeilChainError.prototype);
  }
}

/**
 * Network-related errors (connection, timeout, etc.)
 */
export class NetworkError extends VeilChainError {
  constructor(message: string, public readonly statusCode?: number) {
    super(message, 'NETWORK_ERROR');
    this.name = 'NetworkError';
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

/**
 * Authentication/authorization errors
 */
export class AuthenticationError extends VeilChainError {
  constructor(message: string = 'Authentication failed') {
    super(message, 'AUTH_ERROR');
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/**
 * Validation errors (invalid input, schema mismatch, etc.)
 */
export class ValidationError extends VeilChainError {
  constructor(message: string, public readonly field?: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Resource not found errors
 */
export class NotFoundError extends VeilChainError {
  constructor(resource: string, id?: string) {
    const message = id ? `${resource} with ID ${id} not found` : `${resource} not found`;
    super(message, 'NOT_FOUND');
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * Proof verification errors
 */
export class ProofVerificationError extends VeilChainError {
  constructor(message: string, public readonly proofData?: unknown) {
    super(message, 'PROOF_VERIFICATION_ERROR');
    this.name = 'ProofVerificationError';
    Object.setPrototypeOf(this, ProofVerificationError.prototype);
  }
}

/**
 * Rate limiting errors
 */
export class RateLimitError extends VeilChainError {
  constructor(
    message: string = 'Rate limit exceeded',
    public readonly retryAfter?: number
  ) {
    super(message, 'RATE_LIMIT');
    this.name = 'RateLimitError';
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

/**
 * Server errors (5xx status codes)
 */
export class ServerError extends VeilChainError {
  constructor(message: string, public readonly statusCode?: number) {
    super(message, 'SERVER_ERROR');
    this.name = 'ServerError';
    Object.setPrototypeOf(this, ServerError.prototype);
  }
}

/**
 * Helper to determine if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof NetworkError) {
    // Retry on network timeouts and 5xx errors
    return !error.statusCode || error.statusCode >= 500;
  }
  if (error instanceof ServerError) {
    return true;
  }
  if (error instanceof RateLimitError) {
    return true;
  }
  return false;
}

/**
 * Parse an HTTP error response into the appropriate error class
 */
export function parseErrorResponse(
  statusCode: number,
  body: any
): VeilChainError {
  const message = body?.message || body?.error || `Request failed with status ${statusCode}`;

  switch (statusCode) {
    case 401:
    case 403:
      return new AuthenticationError(message);
    case 404:
      return new NotFoundError(body?.resource || 'Resource', body?.id);
    case 400:
      return new ValidationError(message, body?.field);
    case 429:
      return new RateLimitError(message, body?.retryAfter);
    case 500:
    case 502:
    case 503:
    case 504:
      return new ServerError(message, statusCode);
    default:
      if (statusCode >= 400 && statusCode < 500) {
        return new ValidationError(message);
      }
      if (statusCode >= 500) {
        return new ServerError(message, statusCode);
      }
      return new VeilChainError(message, `HTTP_${statusCode}`);
  }
}
