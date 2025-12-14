/**
 * VeilChain Proof Management Routes
 *
 * Endpoints for generating and verifying Merkle proofs.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { MerkleTree } from '../../core/merkle.js';
import type {
  GetProofResponse,
  VerifyProofRequest,
  VerifyProofResponse,
  LedgerService
} from '../types.js';

/**
 * Register proof routes
 */
export async function registerProofRoutes(
  fastify: FastifyInstance,
  service: LedgerService
): Promise<void> {
  /**
   * Get inclusion proof for an entry
   * GET /v1/ledgers/:id/proof/:eid
   */
  fastify.get<{
    Params: { id: string; eid: string };
    Reply: GetProofResponse;
  }>(
    '/v1/ledgers/:id/proof/:eid',
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
        response: {
          200: {
            type: 'object',
            properties: {
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
              entry: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  position: { type: 'string' },
                  hash: { type: 'string' }
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
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { id: ledgerId, eid: entryId } = request.params;

        // Get the proof
        const proof = await service.getProof(ledgerId, entryId);

        if (!proof) {
          return reply.code(404).send({
            error: {
              code: 'PROOF_NOT_FOUND',
              message: `Proof for entry ${entryId} not found in ledger ${ledgerId}`
            }
          });
        }

        // Get basic entry info
        const entry = await service.getEntry(ledgerId, entryId, false);

        if (!entry) {
          return reply.code(404).send({
            error: {
              code: 'ENTRY_NOT_FOUND',
              message: `Entry ${entryId} not found in ledger ${ledgerId}`
            }
          });
        }

        const response: GetProofResponse = {
          proof,
          entry: {
            id: entry.id,
            position: entry.position.toString(),
            hash: entry.hash
          }
        };

        return reply.send(response);
      } catch (error: any) {
        fastify.log.error(error, 'Error retrieving proof');
        return reply.code(500).send({
          error: {
            code: 'PROOF_RETRIEVAL_FAILED',
            message: error.message || 'Failed to retrieve proof'
          }
        });
      }
    }
  );

  /**
   * Verify a Merkle proof (stateless)
   * POST /v1/verify
   */
  fastify.post<{
    Body: VerifyProofRequest;
    Reply: VerifyProofResponse;
  }>(
    '/v1/verify',
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
            }
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
