/**
 * VeilChain Anchor Routes
 *
 * Endpoints for managing external anchors (timestamping to external chains).
 */

import type { FastifyInstance } from 'fastify';
import type { AnchorService, AnchorType, AnchorStatus } from '../../services/anchor.js';
import type { LedgerService } from '../types.js';
import type { AuditService } from '../../services/audit.js';
import { getAuthContext } from '../middleware/jwt.js';

/**
 * Anchor response type
 */
interface AnchorResponse {
  id: string;
  ledgerId: string;
  rootHash: string;
  entryCount: string;
  anchorType: string;
  status: string;
  externalTxId?: string;
  externalBlockHeight?: number;
  externalBlockHash?: string;
  externalTimestamp?: string;
  proofData?: Record<string, unknown>;
  createdAt: string;
  confirmedAt?: string;
  errorMessage?: string;
}

/**
 * Register anchor routes
 */
export async function registerAnchorRoutes(
  fastify: FastifyInstance,
  anchorService: AnchorService,
  ledgerService: LedgerService,
  auditService?: AuditService
): Promise<void> {
  /**
   * List anchors for a ledger
   * GET /v1/ledgers/:id/anchors
   */
  fastify.get<{
    Params: { id: string };
    Querystring: {
      status?: AnchorStatus;
      type?: AnchorType;
      limit?: string;
      offset?: string;
    };
  }>(
    '/v1/ledgers/:id/anchors',
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
            status: { type: 'string', enum: ['pending', 'confirmed', 'failed'] },
            type: { type: 'string', enum: ['bitcoin', 'ethereum', 'opentimestamps', 'rfc3161'] },
            limit: { type: 'string' },
            offset: { type: 'string' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              anchors: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    ledgerId: { type: 'string' },
                    rootHash: { type: 'string' },
                    entryCount: { type: 'string' },
                    anchorType: { type: 'string' },
                    status: { type: 'string' },
                    externalTxId: { type: 'string' },
                    externalBlockHeight: { type: 'number' },
                    externalBlockHash: { type: 'string' },
                    externalTimestamp: { type: 'string' },
                    createdAt: { type: 'string' },
                    confirmedAt: { type: 'string' }
                  }
                }
              },
              total: { type: 'number' },
              offset: { type: 'number' },
              limit: { type: 'number' }
            }
          }
        }
      }
    },
    async (request, reply) => {
      try {
        const { id: ledgerId } = request.params;

        // Check if ledger exists
        const ledger = await ledgerService.getLedger(ledgerId);
        if (!ledger) {
          return reply.code(404).send({
            error: {
              code: 'LEDGER_NOT_FOUND',
              message: `Ledger ${ledgerId} not found`
            }
          });
        }

        const limit = request.query.limit ? parseInt(request.query.limit, 10) : 100;
        const offset = request.query.offset ? parseInt(request.query.offset, 10) : 0;

        const result = await anchorService.listAnchors(ledgerId, {
          status: request.query.status,
          anchorType: request.query.type,
          limit,
          offset
        });

        const anchors: AnchorResponse[] = result.anchors.map(anchor => ({
          id: anchor.id,
          ledgerId: anchor.ledgerId,
          rootHash: anchor.rootHash,
          entryCount: anchor.entryCount.toString(),
          anchorType: anchor.anchorType,
          status: anchor.status,
          externalTxId: anchor.externalTxId,
          externalBlockHeight: anchor.externalBlockHeight,
          externalBlockHash: anchor.externalBlockHash,
          externalTimestamp: anchor.externalTimestamp?.toISOString(),
          proofData: anchor.proofData,
          createdAt: anchor.createdAt.toISOString(),
          confirmedAt: anchor.confirmedAt?.toISOString(),
          errorMessage: anchor.errorMessage
        }));

        return reply.send({
          anchors,
          total: result.total,
          offset,
          limit
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to list anchors';
        fastify.log.error(error, 'Error listing anchors');
        return reply.code(500).send({
          error: {
            code: 'ANCHOR_LIST_FAILED',
            message
          }
        });
      }
    }
  );

  /**
   * Create a new anchor (trigger manual anchoring)
   * POST /v1/ledgers/:id/anchor
   */
  fastify.post<{
    Params: { id: string };
    Body: {
      type: AnchorType;
    };
  }>(
    '/v1/ledgers/:id/anchor',
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
          required: ['type'],
          properties: {
            type: { type: 'string', enum: ['bitcoin', 'ethereum', 'opentimestamps', 'rfc3161'] }
          }
        },
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              ledgerId: { type: 'string' },
              rootHash: { type: 'string' },
              entryCount: { type: 'string' },
              anchorType: { type: 'string' },
              status: { type: 'string' },
              createdAt: { type: 'string' },
              message: { type: 'string' }
            }
          }
        }
      }
    },
    async (request, reply) => {
      try {
        const { id: ledgerId } = request.params;
        const { type: anchorType } = request.body;

        // Check if ledger exists and get current state
        const ledger = await ledgerService.getLedger(ledgerId);
        if (!ledger) {
          return reply.code(404).send({
            error: {
              code: 'LEDGER_NOT_FOUND',
              message: `Ledger ${ledgerId} not found`
            }
          });
        }

        // Check if ledger has entries
        if (ledger.entryCount === 0n) {
          return reply.code(400).send({
            error: {
              code: 'EMPTY_LEDGER',
              message: 'Cannot anchor an empty ledger'
            }
          });
        }

        // Get current root
        const rootData = await ledgerService.getCurrentRoot(ledgerId);
        if (!rootData) {
          return reply.code(500).send({
            error: {
              code: 'ROOT_NOT_FOUND',
              message: 'Failed to get current root hash'
            }
          });
        }

        // Create anchor
        const anchor = await anchorService.createAnchor({
          ledgerId,
          rootHash: rootData.rootHash,
          entryCount: rootData.entryCount,
          anchorType
        });

        // Audit log
        if (auditService) {
          const auth = getAuthContext(request);
          await auditService.log({
            userId: auth?.userId,
            apiKeyId: auth?.apiKeyId,
            action: 'create_ledger', // Using create_ledger as there's no anchor action type
            resourceType: 'ledger',
            resourceId: ledgerId,
            details: {
              action: 'create_anchor',
              anchorId: anchor.id,
              anchorType,
              rootHash: rootData.rootHash
            },
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'],
          });
        }

        const response: AnchorResponse & { message: string } = {
          id: anchor.id,
          ledgerId: anchor.ledgerId,
          rootHash: anchor.rootHash,
          entryCount: anchor.entryCount.toString(),
          anchorType: anchor.anchorType,
          status: anchor.status,
          createdAt: anchor.createdAt.toISOString(),
          message: `Anchor request created. The root hash will be anchored to ${anchorType} shortly.`
        };

        return reply.code(201).send(response);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to create anchor';
        fastify.log.error(error, 'Error creating anchor');
        return reply.code(500).send({
          error: {
            code: 'ANCHOR_CREATION_FAILED',
            message
          }
        });
      }
    }
  );

  /**
   * Get a specific anchor
   * GET /v1/ledgers/:id/anchors/:aid
   */
  fastify.get<{
    Params: { id: string; aid: string };
  }>(
    '/v1/ledgers/:id/anchors/:aid',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id', 'aid'],
          properties: {
            id: { type: 'string' },
            aid: { type: 'string' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              ledgerId: { type: 'string' },
              rootHash: { type: 'string' },
              entryCount: { type: 'string' },
              anchorType: { type: 'string' },
              status: { type: 'string' },
              externalTxId: { type: 'string' },
              externalBlockHeight: { type: 'number' },
              externalBlockHash: { type: 'string' },
              externalTimestamp: { type: 'string' },
              proofData: { type: 'object' },
              createdAt: { type: 'string' },
              confirmedAt: { type: 'string' },
              errorMessage: { type: 'string' }
            }
          }
        }
      }
    },
    async (request, reply) => {
      try {
        const { id: ledgerId, aid: anchorId } = request.params;

        // Check if ledger exists
        const ledger = await ledgerService.getLedger(ledgerId);
        if (!ledger) {
          return reply.code(404).send({
            error: {
              code: 'LEDGER_NOT_FOUND',
              message: `Ledger ${ledgerId} not found`
            }
          });
        }

        const anchor = await anchorService.getAnchor(anchorId);
        if (!anchor) {
          return reply.code(404).send({
            error: {
              code: 'ANCHOR_NOT_FOUND',
              message: `Anchor ${anchorId} not found`
            }
          });
        }

        // Verify anchor belongs to this ledger
        if (anchor.ledgerId !== ledgerId) {
          return reply.code(404).send({
            error: {
              code: 'ANCHOR_NOT_FOUND',
              message: `Anchor ${anchorId} not found in ledger ${ledgerId}`
            }
          });
        }

        const response: AnchorResponse = {
          id: anchor.id,
          ledgerId: anchor.ledgerId,
          rootHash: anchor.rootHash,
          entryCount: anchor.entryCount.toString(),
          anchorType: anchor.anchorType,
          status: anchor.status,
          externalTxId: anchor.externalTxId,
          externalBlockHeight: anchor.externalBlockHeight,
          externalBlockHash: anchor.externalBlockHash,
          externalTimestamp: anchor.externalTimestamp?.toISOString(),
          proofData: anchor.proofData,
          createdAt: anchor.createdAt.toISOString(),
          confirmedAt: anchor.confirmedAt?.toISOString(),
          errorMessage: anchor.errorMessage
        };

        return reply.send(response);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to get anchor';
        fastify.log.error(error, 'Error getting anchor');
        return reply.code(500).send({
          error: {
            code: 'ANCHOR_RETRIEVAL_FAILED',
            message
          }
        });
      }
    }
  );
}
