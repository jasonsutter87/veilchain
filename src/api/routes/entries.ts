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
  BatchAppendRequest,
  BatchAppendResponse,
  LedgerService
} from '../types.js';
import type { AuditService } from '../../services/audit.js';
import {
  createEntrySizeValidator,
  createBatchSizeValidator,
  schemaValidator,
  type ValidationConfig,
  DEFAULT_VALIDATION_CONFIG
} from '../middleware/validation.js';
import { getAuthContext } from '../middleware/jwt.js';

/**
 * Register entry routes
 */
export async function registerEntryRoutes(
  fastify: FastifyInstance,
  service: LedgerService,
  validationConfig: ValidationConfig = DEFAULT_VALIDATION_CONFIG,
  auditService?: AuditService
): Promise<void> {
  /**
   * List entries in a ledger
   * GET /v1/ledgers/:id/entries
   */
  fastify.get<{
    Params: { id: string };
    Querystring: { offset?: string; limit?: string };
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
        const { id: ledgerId } = request.params;
        const offset = request.query.offset ? BigInt(request.query.offset) : 0n;
        const limit = request.query.limit ? parseInt(request.query.limit, 10) : 100;

        const result = await service.listEntries(ledgerId, { offset, limit });

        const response = {
          entries: result.entries.map(entry => ({
            id: entry.id,
            position: entry.position.toString(),
            data: entry.data,
            hash: entry.hash,
            createdAt: entry.createdAt.toISOString()
          })),
          total: result.total.toString(),
          offset: offset.toString(),
          limit
        };

        return reply.send(response);
      } catch (error: any) {
        fastify.log.error(error, 'Error listing entries');

        if (error.message.includes('not found')) {
          return reply.code(404).send({
            error: {
              code: 'LEDGER_NOT_FOUND',
              message: error.message
            }
          });
        }

        return reply.code(500).send({
          error: {
            code: 'ENTRY_LIST_FAILED',
            message: error.message || 'Failed to list entries'
          }
        });
      }
    }
  );

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
      preValidation: createEntrySizeValidator(validationConfig),
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

        // Get ledger metadata to check for schema
        const ledger = await service.getLedger(ledgerId);
        if (!ledger) {
          return reply.code(404).send({
            error: {
              code: 'LEDGER_NOT_FOUND',
              message: `Ledger ${ledgerId} not found`
            }
          });
        }

        // Validate against ledger schema if one exists
        if (ledger.schema) {
          const validationError = schemaValidator.validate(
            ledgerId,
            ledger.schema,
            data
          );
          if (validationError) {
            return reply.code(400).send({
              error: {
                code: validationError.code,
                message: validationError.message,
                details: validationError.details
              }
            });
          }
        }

        // Append entry
        const result = await service.appendEntry(ledgerId, data, {
          idempotencyKey,
          metadata
        });

        // Audit log
        if (auditService) {
          const auth = getAuthContext(request);
          await auditService.log({
            userId: auth?.userId,
            apiKeyId: auth?.apiKeyId,
            action: 'append_entry',
            resourceType: 'entry',
            resourceId: result.entry.id,
            details: {
              ledgerId,
              position: result.entry.position.toString(),
              hash: result.entry.hash,
            },
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'],
          });
        }

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
   * Batch append entries to ledger
   * POST /v1/ledgers/:id/entries/batch
   *
   * Appends multiple entries in a single request for better performance.
   * Entries are processed sequentially to maintain order.
   * Partial failures are supported - successful entries remain committed.
   */
  fastify.post<{
    Params: { id: string };
    Body: BatchAppendRequest;
    Reply: BatchAppendResponse;
  }>(
    '/v1/ledgers/:id/entries/batch',
    {
      preValidation: createBatchSizeValidator(validationConfig),
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
          required: ['entries'],
          properties: {
            entries: {
              type: 'array',
              minItems: 1,
              maxItems: 1000,
              items: {
                type: 'object',
                required: ['data'],
                properties: {
                  data: {},
                  idempotencyKey: { type: 'string' },
                  metadata: { type: 'object' }
                }
              }
            }
          }
        }
      }
    },
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: BatchAppendRequest;
      }>,
      reply: FastifyReply
    ) => {
      const { id: ledgerId } = request.params;
      const { entries } = request.body;

      // Validate batch size
      if (!entries || entries.length === 0) {
        return reply.code(400).send({
          error: {
            code: 'INVALID_BATCH',
            message: 'At least one entry is required'
          }
        });
      }

      if (entries.length > 1000) {
        return reply.code(400).send({
          error: {
            code: 'BATCH_TOO_LARGE',
            message: 'Maximum batch size is 1000 entries'
          }
        });
      }

      // Check if ledger exists
      const ledger = await service.getLedger(ledgerId);
      if (!ledger) {
        return reply.code(404).send({
          error: {
            code: 'LEDGER_NOT_FOUND',
            message: `Ledger ${ledgerId} not found`
          }
        });
      }

      const results: BatchAppendResponse['results'] = [];
      let previousRoot = ledger.rootHash;
      let currentRoot = previousRoot;
      let successful = 0;
      let failed = 0;

      // Process entries sequentially to maintain order
      for (const entryRequest of entries) {
        try {
          // Validate entry data
          if (entryRequest.data === undefined || entryRequest.data === null) {
            results.push({
              success: false,
              error: {
                code: 'INVALID_DATA',
                message: 'Entry data is required'
              }
            });
            failed++;
            continue;
          }

          // Validate against ledger schema if one exists
          if (ledger.schema) {
            const validationError = schemaValidator.validate(
              ledgerId,
              ledger.schema,
              entryRequest.data
            );
            if (validationError) {
              results.push({
                success: false,
                error: {
                  code: validationError.code,
                  message: validationError.message
                }
              });
              failed++;
              continue;
            }
          }

          const result = await service.appendEntry(ledgerId, entryRequest.data, {
            idempotencyKey: entryRequest.idempotencyKey,
            metadata: entryRequest.metadata
          });

          currentRoot = result.newRoot;

          results.push({
            success: true,
            entry: {
              id: result.entry.id,
              position: result.entry.position.toString(),
              data: result.entry.data,
              hash: result.entry.hash,
              createdAt: result.entry.createdAt.toISOString()
            },
            proof: result.proof
          });
          successful++;
        } catch (error: any) {
          fastify.log.error(error, 'Error in batch append');

          let errorCode = 'ENTRY_APPEND_FAILED';
          if (error.message.includes('idempotency')) {
            errorCode = 'DUPLICATE_ENTRY';
          }

          results.push({
            success: false,
            error: {
              code: errorCode,
              message: error.message || 'Failed to append entry'
            }
          });
          failed++;
        }
      }

      // Audit log batch append
      if (auditService && successful > 0) {
        const auth = getAuthContext(request);
        await auditService.log({
          userId: auth?.userId,
          apiKeyId: auth?.apiKeyId,
          action: 'batch_append_entries',
          resourceType: 'ledger',
          resourceId: ledgerId,
          details: {
            total: entries.length,
            successful,
            failed,
            previousRoot,
            newRoot: currentRoot,
          },
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        });
      }

      const response: BatchAppendResponse = {
        results,
        summary: {
          total: entries.length,
          successful,
          failed
        },
        previousRoot,
        newRoot: currentRoot
      };

      // Return 207 Multi-Status if there were partial failures
      const statusCode = failed > 0 && successful > 0 ? 207 : (failed === entries.length ? 400 : 201);
      return reply.code(statusCode).send(response);
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
