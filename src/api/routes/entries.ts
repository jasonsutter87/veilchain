/**
 * VeilChain Entry Management Routes
 *
 * Endpoints for appending and retrieving ledger entries.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type {
  AppendEntryRequest,
  AppendEntryResponse,
  GetEntryResponse,
  LedgerService
} from '../types.js';

/**
 * Register entry routes
 */
export async function registerEntryRoutes(
  fastify: FastifyInstance,
  service: LedgerService
): Promise<void> {
  /**
   * Append a new entry to ledger
   * POST /v1/ledgers/:id/entries
   */
  fastify.post<{
    Params: { id: string };
    Body: AppendEntryRequest;
    Reply: AppendEntryResponse;
  }>(
    '/v1/ledgers/:id/entries',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' }
          }
        },
        body: {
          type: 'object',
          required: ['data'],
          properties: {
            data: {},
            idempotencyKey: { type: 'string' },
            metadata: { type: 'object' }
          }
        },
        response: {
          201: {
            type: 'object',
            properties: {
              entry: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  position: { type: 'string' },
                  hash: { type: 'string' },
                  createdAt: { type: 'string' }
                }
              },
              proof: {
                type: 'object',
                properties: {
                  leaf: { type: 'string' },
                  index: { type: 'number' },
                  proof: { type: 'array', items: { type: 'string' } },
                  directions: { type: 'array', items: { type: 'string' } },
                  root: { type: 'string' }
                }
              },
              previousRoot: { type: 'string' },
              newRoot: { type: 'string' }
            }
          }
        }
      }
    },
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: AppendEntryRequest;
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { id: ledgerId } = request.params;
        const { data, idempotencyKey, metadata } = request.body;

        // Validate data is provided
        if (data === undefined || data === null) {
          return reply.code(400).send({
            error: {
              code: 'INVALID_DATA',
              message: 'Entry data is required'
            }
          });
        }

        // Append entry
        const result = await service.appendEntry(ledgerId, data, {
          idempotencyKey,
          metadata
        });

        const response: AppendEntryResponse = {
          entry: {
            id: result.entry.id,
            position: result.entry.position.toString(),
            data: result.entry.data,
            hash: result.entry.hash,
            createdAt: result.entry.createdAt.toISOString()
          },
          proof: result.proof,
          previousRoot: result.previousRoot,
          newRoot: result.newRoot
        };

        return reply.code(201).send(response);
      } catch (error: any) {
        fastify.log.error(error, 'Error appending entry');

        // Handle specific errors
        if (error.message.includes('not found')) {
          return reply.code(404).send({
            error: {
              code: 'LEDGER_NOT_FOUND',
              message: error.message
            }
          });
        }

        if (error.message.includes('idempotency')) {
          return reply.code(409).send({
            error: {
              code: 'DUPLICATE_ENTRY',
              message: error.message
            }
          });
        }

        return reply.code(500).send({
          error: {
            code: 'ENTRY_APPEND_FAILED',
            message: error.message || 'Failed to append entry'
          }
        });
      }
    }
  );

  /**
   * Get a specific entry
   * GET /v1/ledgers/:id/entries/:eid
   */
  fastify.get<{
    Params: { id: string; eid: string };
    Querystring: { includeProof?: string };
    Reply: GetEntryResponse;
  }>(
    '/v1/ledgers/:id/entries/:eid',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id', 'eid'],
          properties: {
            id: { type: 'string' },
            eid: { type: 'string' }
          }
        },
        querystring: {
          type: 'object',
          properties: {
            includeProof: { type: 'string', enum: ['true', 'false'] }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              position: { type: 'string' },
              hash: { type: 'string' },
              createdAt: { type: 'string' },
              proof: {
                type: 'object',
                properties: {
                  leaf: { type: 'string' },
                  index: { type: 'number' },
                  proof: { type: 'array', items: { type: 'string' } },
                  directions: { type: 'array', items: { type: 'string' } },
                  root: { type: 'string' }
                }
              }
            }
          }
        }
      }
    },
    async (
      request: FastifyRequest<{
        Params: { id: string; eid: string };
        Querystring: { includeProof?: string };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { id: ledgerId, eid: entryId } = request.params;
        const includeProof = request.query.includeProof === 'true';

        const entry = await service.getEntry(ledgerId, entryId, includeProof);

        if (!entry) {
          return reply.code(404).send({
            error: {
              code: 'ENTRY_NOT_FOUND',
              message: `Entry ${entryId} not found in ledger ${ledgerId}`
            }
          });
        }

        const response: GetEntryResponse = {
          id: entry.id,
          position: entry.position.toString(),
          data: entry.data,
          hash: entry.hash,
          createdAt: entry.createdAt.toISOString(),
          proof: entry.proof
        };

        return reply.send(response);
      } catch (error: any) {
        fastify.log.error(error, 'Error retrieving entry');
        return reply.code(500).send({
          error: {
            code: 'ENTRY_RETRIEVAL_FAILED',
            message: error.message || 'Failed to retrieve entry'
          }
        });
      }
    }
  );
}
