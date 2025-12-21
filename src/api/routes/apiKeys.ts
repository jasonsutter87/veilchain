/**
 * VeilChain API Key Routes
 *
 * Handles API key creation, listing, and revocation.
 */

import type { FastifyInstance } from 'fastify';
import type { ApiKeyService } from '../../services/apiKey.js';
import type { ApiKeyType } from '../../types.js';
import { getAuthContext } from '../middleware/jwt.js';

/**
 * Request body types
 */
interface CreateApiKeyBody {
  name: string;
  type: ApiKeyType;
  scopedLedgers?: string[];
  expiresInDays?: number;
}

/**
 * Register API key routes
 */
export async function registerApiKeyRoutes(
  fastify: FastifyInstance,
  apiKeyService: ApiKeyService
): Promise<void> {
  /**
   * GET /v1/api-keys - List user's API keys
   */
  fastify.get(
    '/v1/api-keys',
    async (request, reply) => {
      const auth = getAuthContext(request);
      if (!auth) {
        return reply.code(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const keys = await apiKeyService.list(auth.userId);

      // Convert bigint to string for JSON serialization
      const serializedKeys = keys.map(key => ({
        ...key,
        usageCount: key.usageCount.toString(),
      }));

      return reply.code(200).send({ keys: serializedKeys });
    }
  );

  /**
   * POST /v1/api-keys - Create new API key
   */
  fastify.post<{ Body: CreateApiKeyBody }>(
    '/v1/api-keys',
    {
      schema: {
        body: {
          type: 'object',
          required: ['name', 'type'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            type: { type: 'string', enum: ['admin', 'write', 'read', 'scoped'] },
            scopedLedgers: {
              type: 'array',
              items: { type: 'string' },
            },
            expiresInDays: { type: 'number', minimum: 1, maximum: 365 },
          },
        },
      },
    },
    async (request, reply) => {
      const auth = getAuthContext(request);
      if (!auth) {
        return reply.code(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      // Validate scoped ledgers for scoped keys
      if (request.body.type === 'scoped' && !request.body.scopedLedgers?.length) {
        return reply.code(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Scoped keys require at least one ledger ID',
          },
        });
      }

      const result = await apiKeyService.create({
        userId: auth.userId,
        name: request.body.name,
        keyType: request.body.type,
        scopedLedgers: request.body.scopedLedgers,
        expiresInDays: request.body.expiresInDays,
      });

      return reply.code(201).send({
        key: result.key, // Full key - only shown once!
        keyId: result.keyId,
        keyPrefix: result.keyPrefix,
        name: result.name,
        type: result.keyType,
        scopedLedgers: result.scopedLedgers,
        createdAt: result.createdAt.toISOString(),
        expiresAt: result.expiresAt?.toISOString(),
        warning: 'Store this key securely. It will not be shown again.',
      });
    }
  );

  /**
   * GET /v1/api-keys/:id - Get API key details
   */
  fastify.get<{ Params: { id: string } }>(
    '/v1/api-keys/:id',
    async (request, reply) => {
      const auth = getAuthContext(request);
      if (!auth) {
        return reply.code(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const key = await apiKeyService.get(auth.userId, request.params.id);
      if (!key) {
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: 'API key not found' },
        });
      }

      return reply.code(200).send({
        ...key,
        usageCount: key.usageCount.toString(),
      });
    }
  );

  /**
   * DELETE /v1/api-keys/:id - Revoke API key
   */
  fastify.delete<{ Params: { id: string }; Body?: { reason?: string } }>(
    '/v1/api-keys/:id',
    async (request, reply) => {
      const auth = getAuthContext(request);
      if (!auth) {
        return reply.code(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const revoked = await apiKeyService.revoke(
        auth.userId,
        request.params.id,
        request.body?.reason
      );

      if (!revoked) {
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: 'API key not found or already revoked' },
        });
      }

      return reply.code(200).send({
        message: 'API key revoked successfully',
      });
    }
  );

  /**
   * GET /v1/api-keys/:id/usage - Get API key usage statistics
   */
  fastify.get<{ Params: { id: string } }>(
    '/v1/api-keys/:id/usage',
    async (request, reply) => {
      const auth = getAuthContext(request);
      if (!auth) {
        return reply.code(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const stats = await apiKeyService.getUsageStats(auth.userId, request.params.id);
      if (!stats) {
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: 'API key not found' },
        });
      }

      return reply.code(200).send({
        usageCount: stats.usageCount.toString(),
        lastUsedAt: stats.lastUsedAt?.toISOString(),
        createdAt: stats.createdAt.toISOString(),
        expiresAt: stats.expiresAt?.toISOString(),
      });
    }
  );
}
