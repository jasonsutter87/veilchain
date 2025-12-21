/**
 * VeilChain JWT Authentication Middleware
 *
 * Validates JWT access tokens from the Authorization header and attaches
 * user context to requests.
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import type { AuthContext, UserTier, ApiKeyType } from '../../types.js';
import type { AuthService } from '../../services/auth.js';
import type { ApiKeyService } from '../../services/apiKey.js';

/**
 * JWT middleware configuration
 */
export interface JwtMiddlewareConfig {
  /** Auth service for token validation */
  authService: AuthService;
  /** API key service for API key validation (optional) */
  apiKeyService?: ApiKeyService;
  /** Routes to skip authentication */
  skipRoutes?: string[];
  /** Allow unauthenticated requests (attach context if present) */
  optional?: boolean;
}

/**
 * Extended request type with auth context
 */
export interface AuthenticatedRequest extends FastifyRequest {
  auth?: AuthContext;
}

/**
 * Create JWT authentication middleware
 */
export function createJwtMiddleware(config: JwtMiddlewareConfig) {
  const { authService, apiKeyService, skipRoutes = [], optional = false } = config;

  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const req = request as AuthenticatedRequest;

    // Check if route should be skipped
    const shouldSkip = skipRoutes.some(route => {
      if (route.endsWith('*')) {
        return request.url.startsWith(route.slice(0, -1));
      }
      return request.url === route || request.url.startsWith(route + '?');
    });

    if (shouldSkip) {
      return;
    }

    // Try JWT from Authorization header
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const payload = authService.verifyAccessToken(token);

        // Check if token is revoked
        if (payload.jti && await authService.isTokenRevoked(payload.jti)) {
          if (!optional) {
            return reply.code(401).send({
              error: {
                code: 'TOKEN_REVOKED',
                message: 'Token has been revoked',
              },
            });
          }
          return;
        }

        // Attach auth context
        req.auth = {
          userId: payload.sub,
          email: payload.email,
          tier: payload.tier as UserTier,
          authMethod: 'jwt',
          jti: payload.jti,
        };
        return;
      } catch (error) {
        if (!optional) {
          const message = error instanceof Error ? error.message : 'Invalid token';
          return reply.code(401).send({
            error: {
              code: 'INVALID_TOKEN',
              message,
            },
          });
        }
        // If optional, continue without auth
      }
    }

    // Try API key from x-api-key header
    const apiKey = request.headers['x-api-key'] as string | undefined;
    if (apiKey && apiKeyService) {
      try {
        const validation = await apiKeyService.validate(apiKey);
        if (validation) {
          // Attach auth context
          req.auth = {
            userId: validation.userId,
            email: validation.email,
            tier: validation.tier,
            authMethod: 'api_key',
            apiKeyId: validation.keyId,
            apiKeyType: validation.keyType,
          };

          // Update usage stats asynchronously
          apiKeyService.updateUsage(validation.keyId).catch(() => {
            // Ignore errors, don't block request
          });

          return;
        }
      } catch (error) {
        if (!optional) {
          return reply.code(401).send({
            error: {
              code: 'INVALID_API_KEY',
              message: 'Invalid API key',
            },
          });
        }
      }
    }

    // No valid authentication found
    if (!optional) {
      return reply.code(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }
  };
}

/**
 * Middleware to require authentication
 * Use after createJwtMiddleware to ensure auth context exists
 */
export function requireAuth() {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const req = request as AuthenticatedRequest;

    if (!req.auth) {
      return reply.code(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }
  };
}

/**
 * Middleware to require specific user tier
 */
export function requireTier(minTier: UserTier) {
  const tierLevels: Record<UserTier, number> = {
    FREE: 0,
    STARTER: 1,
    PRO: 2,
    ENTERPRISE: 3,
  };

  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const req = request as AuthenticatedRequest;

    if (!req.auth) {
      return reply.code(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    const userTierLevel = tierLevels[req.auth.tier] ?? 0;
    const requiredTierLevel = tierLevels[minTier];

    if (userTierLevel < requiredTierLevel) {
      return reply.code(403).send({
        error: {
          code: 'INSUFFICIENT_TIER',
          message: `This action requires ${minTier} tier or higher`,
        },
      });
    }
  };
}

/**
 * Middleware to require specific API key type
 */
export function requireApiKeyType(allowedTypes: ApiKeyType[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const req = request as AuthenticatedRequest;

    if (!req.auth) {
      return reply.code(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    // JWT users have full access
    if (req.auth.authMethod === 'jwt') {
      return;
    }

    // Check API key type
    if (req.auth.apiKeyType && !allowedTypes.includes(req.auth.apiKeyType)) {
      return reply.code(403).send({
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: `This action requires one of the following API key types: ${allowedTypes.join(', ')}`,
        },
      });
    }
  };
}

/**
 * Get auth context from request
 */
export function getAuthContext(request: FastifyRequest): AuthContext | undefined {
  return (request as AuthenticatedRequest).auth;
}

/**
 * Require auth context (throws if not present)
 */
export function requireAuthContext(request: FastifyRequest): AuthContext {
  const auth = getAuthContext(request);
  if (!auth) {
    throw new Error('Authentication required');
  }
  return auth;
}
