/**
 * VeilChain Ledger Management Routes
 *
 * Endpoints for creating and retrieving ledger metadata.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type {
  CreateLedgerRequest,
  CreateLedgerResponse,
  GetLedgerResponse,
  GetRootResponse,
  LedgerService
} from '../types.js';
import {
  createLedgerValidator,
  type ValidationConfig,
  DEFAULT_VALIDATION_CONFIG
} from '../middleware/validation.js';

/**
 * Register ledger routes
 */
export async function registerLedgerRoutes(
  fastify: FastifyInstance,
  service: LedgerService,
  validationConfig: ValidationConfig = DEFAULT_VALIDATION_CONFIG
): Promise<void> {
  /**
   * List all ledgers
   * GET /v1/ledgers
   */
  fastify.get<{
    Querystring: { offset?: string; limit?: string };
  }>(
    '/v1/ledgers',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            offset: { type: 'string' },
            limit: { type: 'string' }
          }
        }
      }
    },
    async (request, reply) => {
      try {
        const offset = request.query.offset ? parseInt(request.query.offset, 10) : 0;
        const limit = request.query.limit ? parseInt(request.query.limit, 10) : 100;

        const result = await service.listLedgers({ offset, limit });

        const response = {
          ledgers: result.ledgers.map(ledger => ({
            id: ledger.id,
            name: ledger.name,
            description: ledger.description,
            rootHash: ledger.rootHash,
            entryCount: ledger.entryCount.toString(),
            createdAt: ledger.createdAt.toISOString(),
            lastEntryAt: ledger.lastEntryAt?.toISOString()
          })),
          total: result.total,
          offset,
          limit
        };

        return reply.send(response);
      } catch (error: any) {
        fastify.log.error(error, 'Error listing ledgers');
        return reply.code(500).send({
          error: {
            code: 'LEDGER_LIST_FAILED',
            message: error.message || 'Failed to list ledgers'
          }
        });
      }
    }
  );

  /**
   * Create a new ledger
   * POST /v1/ledgers
   */
  fastify.post<{
    Body: CreateLedgerRequest;
    Reply: CreateLedgerResponse;
  }>(
    '/v1/ledgers',
    {
      preValidation: createLedgerValidator(validationConfig),
      schema: {
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: validationConfig.maxNameLength },
            description: { type: 'string', maxLength: validationConfig.maxDescriptionLength },
            schema: { type: 'object' }
          }
        },
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              description: { type: 'string' },
              rootHash: { type: 'string' },
              createdAt: { type: 'string' },
              entryCount: { type: 'string' }
            }
          }
        }
      }
    },
    async (request: FastifyRequest<{ Body: CreateLedgerRequest }>, reply: FastifyReply) => {
      try {
        const { name, description, schema } = request.body;

        // Validate name
        if (!name || name.trim().length === 0) {
          return reply.code(400).send({
            error: {
              code: 'INVALID_NAME',
              message: 'Ledger name is required'
            }
          });
        }

        // Create ledger
        const metadata = await service.createLedger({
          name: name.trim(),
          description: description?.trim(),
          schema
        });

        const response: CreateLedgerResponse = {
          id: metadata.id,
          name: metadata.name,
          description: metadata.description,
          rootHash: metadata.rootHash,
          createdAt: metadata.createdAt.toISOString(),
          entryCount: metadata.entryCount.toString(),
          schema: metadata.schema
        };

        return reply.code(201).send(response);
      } catch (error: any) {
        fastify.log.error(error, 'Error creating ledger');
        return reply.code(500).send({
          error: {
            code: 'LEDGER_CREATION_FAILED',
            message: error.message || 'Failed to create ledger'
          }
        });
      }
    }
  );

  /**
   * Get ledger metadata
   * GET /v1/ledgers/:id
   */
  fastify.get<{
    Params: { id: string };
    Reply: GetLedgerResponse;
  }>(
    '/v1/ledgers/:id',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              description: { type: 'string' },
              rootHash: { type: 'string' },
              entryCount: { type: 'string' },
              createdAt: { type: 'string' },
              lastEntryAt: { type: 'string' }
            }
          }
        }
      }
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;

        const metadata = await service.getLedger(id);

        if (!metadata) {
          return reply.code(404).send({
            error: {
              code: 'LEDGER_NOT_FOUND',
              message: `Ledger ${id} not found`
            }
          });
        }

        const response: GetLedgerResponse = {
          id: metadata.id,
          name: metadata.name,
          description: metadata.description,
          rootHash: metadata.rootHash,
          entryCount: metadata.entryCount.toString(),
          createdAt: metadata.createdAt.toISOString(),
          lastEntryAt: metadata.lastEntryAt?.toISOString(),
          schema: metadata.schema
        };

        return reply.send(response);
      } catch (error: any) {
        fastify.log.error(error, 'Error retrieving ledger');
        return reply.code(500).send({
          error: {
            code: 'LEDGER_RETRIEVAL_FAILED',
            message: error.message || 'Failed to retrieve ledger'
          }
        });
      }
    }
  );

  /**
   * Get current root hash
   * GET /v1/ledgers/:id/root
   */
  fastify.get<{
    Params: { id: string };
    Reply: GetRootResponse;
  }>(
    '/v1/ledgers/:id/root',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              rootHash: { type: 'string' },
              entryCount: { type: 'string' },
              lastEntryAt: { type: 'string' }
            }
          }
        }
      }
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;

        const rootData = await service.getCurrentRoot(id);

        if (!rootData) {
          return reply.code(404).send({
            error: {
              code: 'LEDGER_NOT_FOUND',
              message: `Ledger ${id} not found`
            }
          });
        }

        const response: GetRootResponse = {
          rootHash: rootData.rootHash,
          entryCount: rootData.entryCount.toString(),
          lastEntryAt: rootData.lastEntryAt?.toISOString()
        };

        return reply.send(response);
      } catch (error: any) {
        fastify.log.error(error, 'Error retrieving root hash');
        return reply.code(500).send({
          error: {
            code: 'ROOT_RETRIEVAL_FAILED',
            message: error.message || 'Failed to retrieve root hash'
          }
        });
      }
    }
  );
}
