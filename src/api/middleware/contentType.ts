/**
 * VeilChain Content-Type Validation Middleware
 *
 * Ensures requests use appropriate content types to prevent
 * content confusion attacks and request smuggling.
 */

import type { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Allowed content types for JSON API
 */
const ALLOWED_CONTENT_TYPES = [
  'application/json',
  'application/json; charset=utf-8',
  'application/json;charset=utf-8',
  'application/json; charset=UTF-8',
  'application/json;charset=UTF-8',
];

/**
 * Methods that require a request body
 */
const METHODS_WITH_BODY = ['POST', 'PUT', 'PATCH'];

/**
 * Routes to skip content-type validation
 */
const SKIP_ROUTES = [
  '/health',
  '/v1/auth/github',
  '/v1/auth/github/callback',
  '/v1/auth/google',
  '/v1/auth/google/callback',
];

/**
 * Create content-type validation middleware
 */
export function createContentTypeMiddleware() {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    // Skip for routes that don't need validation
    if (SKIP_ROUTES.some(route => request.url.startsWith(route))) {
      return;
    }

    // Only validate methods that have request bodies
    if (!METHODS_WITH_BODY.includes(request.method)) {
      return;
    }

    const contentType = request.headers['content-type'];

    // If no body is expected (content-length 0 or missing), skip
    const contentLength = request.headers['content-length'];
    if (!contentLength || contentLength === '0') {
      return;
    }

    // Validate content-type header exists
    if (!contentType) {
      return reply.code(415).send({
        error: {
          code: 'UNSUPPORTED_MEDIA_TYPE',
          message: 'Content-Type header is required for requests with body',
        },
      });
    }

    // Normalize and check content-type
    const normalizedType = contentType.toLowerCase().trim();
    const isAllowed = ALLOWED_CONTENT_TYPES.some(
      allowed => normalizedType.startsWith(allowed.toLowerCase())
    );

    if (!isAllowed) {
      return reply.code(415).send({
        error: {
          code: 'UNSUPPORTED_MEDIA_TYPE',
          message: 'Content-Type must be application/json',
          details: {
            received: contentType,
            allowed: ['application/json'],
          },
        },
      });
    }
  };
}

/**
 * Validate request body size before parsing
 */
export function createBodySizeMiddleware(maxSizeBytes: number = 50 * 1024 * 1024) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const contentLength = request.headers['content-length'];

    if (contentLength) {
      const size = parseInt(contentLength, 10);

      if (isNaN(size)) {
        return reply.code(400).send({
          error: {
            code: 'INVALID_CONTENT_LENGTH',
            message: 'Invalid Content-Length header',
          },
        });
      }

      if (size > maxSizeBytes) {
        return reply.code(413).send({
          error: {
            code: 'PAYLOAD_TOO_LARGE',
            message: `Request body exceeds maximum size of ${Math.round(maxSizeBytes / 1024 / 1024)}MB`,
          },
        });
      }
    }
  };
}
