/**
 * VeilChain Public Routes
 *
 * Public endpoints that allow anyone to verify ledger state without authentication.
 * These endpoints are designed for transparency and external verification.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { Pool } from 'pg';
import { MerkleTree } from '../../core/merkle.js';
import type {
  PublicRootResponse,
  PublicRootsResponse,
  VerifyProofRequest,
  VerifyProofResponse,
  LedgerService
} from '../types.js';

/**
 * Register public routes
 */
export async function registerPublicRoutes(
  fastify: FastifyInstance,
  service: LedgerService,
  pool?: Pool
): Promise<void> {
  /**
   * Get current root hash (public, no authentication required)
   * GET /v1/public/ledgers/:id/root
   */
  fastify.get<{
    Params: { id: string };
    Reply: PublicRootResponse;
  }>(
    '/v1/public/ledgers/:id/root',
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
              ledgerId: { type: 'string' },
              rootHash: { type: 'string' },
              entryCount: { type: 'string' },
              timestamp: { type: 'string' },
              signature: { type: 'string' }
            },
            required: ['ledgerId', 'rootHash', 'entryCount', 'timestamp']
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

        const response: PublicRootResponse = {
          ledgerId: id,
          rootHash: rootData.rootHash,
          entryCount: rootData.entryCount.toString(),
          timestamp: rootData.lastEntryAt?.toISOString() || new Date().toISOString()
        };

        // TODO: Add signature if signing key is configured
        // This would allow cryptographic verification of the root export
        // response.signature = signRootHash(rootData.rootHash, privateKey);

        return reply.send(response);
      } catch (error: any) {
        fastify.log.error(error, 'Error retrieving public root');
        return reply.code(500).send({
          error: {
            code: 'ROOT_RETRIEVAL_FAILED',
            message: error.message || 'Failed to retrieve root hash'
          }
        });
      }
    }
  );

  /**
   * Get historical root hashes (if available)
   * GET /v1/public/ledgers/:id/roots
   *
   * This endpoint would return historical snapshots of the ledger root.
   * Currently returns only the current root, but can be extended to support
   * historical roots from a separate audit log or snapshot table.
   */
  fastify.get<{
    Params: { id: string };
    Querystring: { limit?: string; offset?: string };
    Reply: PublicRootsResponse;
  }>(
    '/v1/public/ledgers/:id/roots',
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
            limit: { type: 'string' },
            offset: { type: 'string' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              ledgerId: { type: 'string' },
              roots: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    rootHash: { type: 'string' },
                    entryCount: { type: 'string' },
                    timestamp: { type: 'string' },
                    signature: { type: 'string' }
                  },
                  required: ['rootHash', 'entryCount', 'timestamp']
                }
              },
              total: { type: 'number' },
              offset: { type: 'number' },
              limit: { type: 'number' }
            },
            required: ['ledgerId', 'roots', 'total', 'offset', 'limit']
          }
        }
      }
    },
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Querystring: { limit?: string; offset?: string };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { id } = request.params;
        const limit = Math.min(request.query.limit ? parseInt(request.query.limit, 10) : 100, 1000);
        const offset = request.query.offset ? parseInt(request.query.offset, 10) : 0;

        // Check if ledger exists first
        const rootData = await service.getCurrentRoot(id);

        if (!rootData) {
          return reply.code(404).send({
            error: {
              code: 'LEDGER_NOT_FOUND',
              message: `Ledger ${id} not found`
            }
          });
        }

        let roots: Array<{
          rootHash: string;
          entryCount: string;
          timestamp: string;
        }>;
        let total: number;

        // Query historical roots from database if pool is available
        if (pool) {
          const countResult = await pool.query(
            'SELECT COUNT(*) FROM root_history WHERE ledger_id = $1',
            [id]
          );
          total = parseInt(countResult.rows[0].count, 10);

          const historyResult = await pool.query(
            `SELECT root_hash, entry_count, created_at
             FROM root_history
             WHERE ledger_id = $1
             ORDER BY created_at DESC
             LIMIT $2 OFFSET $3`,
            [id, limit, offset]
          );

          roots = historyResult.rows.map(row => ({
            rootHash: row.root_hash,
            entryCount: row.entry_count.toString(),
            timestamp: new Date(row.created_at).toISOString()
          }));
        } else {
          // Fallback: return only current root if no pool
          roots = [
            {
              rootHash: rootData.rootHash,
              entryCount: rootData.entryCount.toString(),
              timestamp: rootData.lastEntryAt?.toISOString() || new Date().toISOString()
            }
          ];
          total = 1;
        }

        const response: PublicRootsResponse = {
          ledgerId: id,
          roots,
          total,
          offset,
          limit
        };

        return reply.send(response);
      } catch (error: any) {
        fastify.log.error(error, 'Error retrieving public roots');
        return reply.code(500).send({
          error: {
            code: 'ROOTS_RETRIEVAL_FAILED',
            message: error.message || 'Failed to retrieve historical roots'
          }
        });
      }
    }
  );

  /**
   * Verify a Merkle proof (stateless, public)
   * POST /v1/public/verify
   *
   * This is a duplicate of /v1/verify but explicitly under the public namespace
   * to make it clear that proof verification doesn't require authentication.
   */
  fastify.post<{
    Body: VerifyProofRequest;
    Reply: VerifyProofResponse;
  }>(
    '/v1/public/verify',
    {
      schema: {
        body: {
          type: 'object',
          required: ['proof'],
          properties: {
            proof: {
              type: 'object',
              required: ['leaf', 'index', 'proof', 'directions', 'root'],
              properties: {
                leaf: { type: 'string' },
                index: { type: 'number' },
                proof: { type: 'array', items: { type: 'string' } },
                directions: { type: 'array', items: { type: 'string' } },
                root: { type: 'string' }
              }
            }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              valid: { type: 'boolean' },
              leaf: { type: 'string' },
              root: { type: 'string' },
              index: { type: 'number' },
              proofLength: { type: 'number' },
              error: { type: 'string' }
            },
            required: ['valid', 'leaf', 'root', 'index', 'proofLength']
          }
        }
      }
    },
    async (
      request: FastifyRequest<{
        Body: VerifyProofRequest;
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { proof } = request.body;

        // Validate proof structure
        if (!proof.leaf || !proof.root) {
          return reply.code(400).send({
            error: {
              code: 'INVALID_PROOF',
              message: 'Proof must contain leaf and root hashes'
            }
          });
        }

        if (proof.proof.length !== proof.directions.length) {
          return reply.code(400).send({
            error: {
              code: 'INVALID_PROOF',
              message: 'Proof array and directions array must have the same length'
            }
          });
        }

        // Verify the proof using MerkleTree static method
        const valid = MerkleTree.verify(proof);

        const response: VerifyProofResponse = {
          valid,
          leaf: proof.leaf,
          root: proof.root,
          index: proof.index,
          proofLength: proof.proof.length
        };

        // Add error message if verification failed
        if (!valid) {
          response.error = 'Proof verification failed - computed root does not match provided root';
        }

        return reply.send(response);
      } catch (error: any) {
        fastify.log.error(error, 'Error verifying proof');

        // Return error in response format
        const response: VerifyProofResponse = {
          valid: false,
          leaf: request.body.proof?.leaf || '',
          root: request.body.proof?.root || '',
          index: request.body.proof?.index || 0,
          proofLength: request.body.proof?.proof?.length || 0,
          error: error.message || 'Proof verification failed'
        };

        return reply.send(response);
      }
    }
  );
}
