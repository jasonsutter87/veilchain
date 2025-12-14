/**
 * VeilChain API Authentication Middleware
 *
 * Simple API key-based authentication for protecting endpoints.
 */

import type { FastifyRequest, FastifyReply } from 'fastify';

/**
 * API key authentication configuration
 */
export interface AuthConfig {
  /** API key to validate against */
  apiKey?: string;
  /** Header name for API key */
  headerName?: string;
  /** Allow unauthenticated health checks */
  allowHealthCheck?: boolean;
}

/**
 * Create authentication middleware
 */
export function createAuthMiddleware(config: AuthConfig = {}) {
  const {
    apiKey,
    headerName = 'x-api-key',
    allowHealthCheck = true
  } = config;

  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    // Skip authentication if no API key is configured
    if (!apiKey) {
      return;
    }

    // Allow health check endpoint without authentication
    if (allowHealthCheck && request.url === '/health') {
      return;
    }

    // Get API key from header
    const providedKey = request.headers[headerName];

    // Check if API key is provided
    if (!providedKey) {
      reply.code(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'API key is required',
          details: {
            header: headerName
          }
        }
      });
      return;
    }

    // Validate API key
    if (providedKey !== apiKey) {
      reply.code(401).send({
        error: {
          code: 'INVALID_API_KEY',
          message: 'Invalid API key'
        }
      });
      return;
    }

    // Authentication successful
    (request as any).apiKey = providedKey;
  };
}

/**
 * Extract API key from request
 */
export function getApiKey(request: FastifyRequest, headerName = 'x-api-key'): string | undefined {
  return request.headers[headerName] as string | undefined;
}

/**
 * Validate API key format
 */
export function isValidApiKeyFormat(key: string): boolean {
  // API key should be at least 32 characters
  // and contain only alphanumeric characters and dashes
  const apiKeyPattern = /^[a-zA-Z0-9-]{32,}$/;
  return apiKeyPattern.test(key);
}

/**
 * Generate a secure API key
 * Note: This is a simple implementation for development.
 * Production should use cryptographically secure methods.
 */
export function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let key = '';

  // Generate a 64-character key
  for (let i = 0; i < 64; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return key;
}
