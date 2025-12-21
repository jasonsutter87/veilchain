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
import { createProofExportService, type ProofExportFormat } from '../../services/proofExport.js';

/**
 * Register proof routes
 */
export async function registerProofRoutes(
  fastify: FastifyInstance,
  service: LedgerService
): Promise<void> {
  const proofExport = createProofExportService(process.env.BASE_URL);
  /**
   * Get inclusion proof for an entry
   * GET /v1/ledgers/:id/proof/:eid
   */
  fastify.get<{
    Params: { id: string; eid: string };
    Querystring: { format?: ProofExportFormat };
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
        querystring: {
          type: 'object',
          properties: {
            format: { type: 'string', enum: ['json', 'cbor', 'compact'] }
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
              },
              verificationUrl: { type: 'string' }
            }
          }
        }
      }
    },
    async (
      request: FastifyRequest<{
        Params: { id: string; eid: string };
        Querystring: { format?: ProofExportFormat };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { id: ledgerId, eid: entryId } = request.params;
        const format = request.query.format || 'json';

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

        // Handle different export formats
        if (format === 'cbor') {
          const cbor = proofExport.exportAsCbor(ledgerId, entryId, proof, entry.hash);
          return reply
            .header('Content-Type', 'application/cbor')
            .header('Content-Disposition', `attachment; filename="proof-${entryId}.cbor"`)
            .send(Buffer.from(cbor, 'base64'));
        }

        if (format === 'compact') {
          const compact = proofExport.exportAsCompact(proof);
          return reply.send({
            proof: compact,
            entry: {
              id: entry.id,
              position: entry.position.toString(),
              hash: entry.hash
            },
            verificationUrl: proofExport.getVerificationUrl(ledgerId, entryId),
          });
        }

        // Default JSON format
        const response: GetProofResponse = {
          proof,
          entry: {
            id: entry.id,
            position: entry.position.toString(),
            hash: entry.hash
          },
          verificationUrl: proofExport.getVerificationUrl(ledgerId, entryId),
        };

        return reply.send(response);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to retrieve proof';
        fastify.log.error(error, 'Error retrieving proof');
        return reply.code(500).send({
          error: {
            code: 'PROOF_RETRIEVAL_FAILED',
            message
          }
        });
      }
    }
  );

  /**
   * Export proof with full metadata
   * GET /v1/ledgers/:id/proof/:eid/export
   */
  fastify.get<{
    Params: { id: string; eid: string };
    Querystring: { format?: ProofExportFormat; includeData?: string };
  }>(
    '/v1/ledgers/:id/proof/:eid/export',
    async (request, reply) => {
      try {
        const { id: ledgerId, eid: entryId } = request.params;
        const includeData = request.query.includeData === 'true';

        const entry = await service.getEntry(ledgerId, entryId, true);
        if (!entry || !entry.proof) {
          return reply.code(404).send({
            error: {
              code: 'ENTRY_NOT_FOUND',
              message: `Entry ${entryId} not found in ledger ${ledgerId}`
            }
          });
        }

        const exportData = proofExport.exportAsJson(
          ledgerId,
          entryId,
          entry.proof,
          entry.hash,
          includeData ? entry.data : undefined
        );

        // Set appropriate headers for download
        reply.header('Content-Disposition', `attachment; filename="veilchain-proof-${entryId}.json"`);

        return reply.send(exportData);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to export proof';
        fastify.log.error(error, 'Error exporting proof');
        return reply.code(500).send({
          error: {
            code: 'PROOF_EXPORT_FAILED',
            message
          }
        });
      }
    }
  );

  /**
   * Generate QR code for proof verification
   * GET /v1/ledgers/:id/proof/:eid/qr
   */
  fastify.get<{
    Params: { id: string; eid: string };
    Querystring: { size?: string };
  }>(
    '/v1/ledgers/:id/proof/:eid/qr',
    async (request, reply) => {
      try {
        const { id: ledgerId, eid: entryId } = request.params;
        const size = parseInt(request.query.size || '200', 10);

        const proof = await service.getProof(ledgerId, entryId);
        if (!proof) {
          return reply.code(404).send({
            error: {
              code: 'PROOF_NOT_FOUND',
              message: `Entry ${entryId} not found in ledger ${ledgerId}`
            }
          });
        }

        const qrData = proofExport.getQRCodeData(ledgerId, entryId, proof.root);
        const svg = proofExport.generateQRCodeSvg(qrData, size);

        return reply
          .header('Content-Type', 'image/svg+xml')
          .send(svg);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to generate QR code';
        fastify.log.error(error, 'Error generating QR code');
        return reply.code(500).send({
          error: {
            code: 'QR_GENERATION_FAILED',
            message
          }
        });
      }
    }
  );

  /**
   * Verify a compact proof
   * POST /v1/verify/compact
   */
  fastify.post<{
    Body: {
      v: number;
      l: string;
      r: string;
      i: number;
      p: string;
      d: string;
    };
  }>(
    '/v1/verify/compact',
    async (request, reply) => {
      try {
        const compact = request.body;

        // Convert compact proof to full proof
        const proof = proofExport.parseCompactProof(compact);

        // Verify
        const valid = MerkleTree.verify(proof);

        return reply.send({
          valid,
          leaf: proof.leaf,
          root: proof.root,
          index: proof.index,
          proofLength: proof.proof.length,
          error: valid ? undefined : 'Proof verification failed',
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to verify compact proof';
        fastify.log.error(error, 'Error verifying compact proof');
        return reply.code(400).send({
          error: {
            code: 'INVALID_COMPACT_PROOF',
            message
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
