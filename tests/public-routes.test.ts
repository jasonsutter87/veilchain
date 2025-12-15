/**
 * VeilChain Public Routes Tests
 *
 * Tests for public API endpoints including:
 * - GET /v1/public/ledgers/:id/root - Get current root hash
 * - GET /v1/public/ledgers/:id/roots - Get historical roots
 * - POST /v1/public/verify - Verify Merkle proof
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import Fastify, { FastifyInstance } from 'fastify';
import { registerPublicRoutes } from '../src/api/routes/public.js';
import { MerkleTree } from '../src/core/merkle.js';
import type { LedgerService } from '../src/api/types.js';

// Mock LedgerService for testing
function createMockService(): LedgerService {
  const ledgers = new Map<string, {
    id: string;
    rootHash: string;
    entryCount: bigint;
    lastEntryAt?: Date;
  }>();

  // Add test ledger
  ledgers.set('test-ledger-1', {
    id: 'test-ledger-1',
    rootHash: 'a'.repeat(64),
    entryCount: 5n,
    lastEntryAt: new Date('2024-01-15T10:00:00Z')
  });

  return {
    getCurrentRoot: async (ledgerId: string) => {
      const ledger = ledgers.get(ledgerId);
      if (!ledger) return null;
      return {
        rootHash: ledger.rootHash,
        entryCount: ledger.entryCount,
        lastEntryAt: ledger.lastEntryAt
      };
    },
    // Other methods can be stubs
    createLedger: async () => ({} as any),
    getLedger: async () => ({} as any),
    listLedgers: async () => ({ ledgers: [], total: 0 }),
    appendEntry: async () => ({} as any),
    getEntry: async () => null,
    listEntries: async () => ({ entries: [], total: 0n }),
    getProof: async () => null
  };
}

describe('Public Routes', () => {
  let fastify: FastifyInstance;
  let mockService: LedgerService;

  beforeAll(async () => {
    fastify = Fastify({ logger: false });
    mockService = createMockService();
    await registerPublicRoutes(fastify, mockService);
    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();
  });

  describe('GET /v1/public/ledgers/:id/root', () => {
    test('should return current root for existing ledger', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/v1/public/ledgers/test-ledger-1/root'
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.payload);
      expect(body.ledgerId).toBe('test-ledger-1');
      expect(body.rootHash).toBe('a'.repeat(64));
      expect(body.entryCount).toBe('5');
      expect(body.timestamp).toBeDefined();
    });

    test('should return 404 for non-existent ledger', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/v1/public/ledgers/nonexistent/root'
      });

      expect(response.statusCode).toBe(404);

      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('LEDGER_NOT_FOUND');
    });

    test('should not require authentication', async () => {
      // No auth headers - should still work
      const response = await fastify.inject({
        method: 'GET',
        url: '/v1/public/ledgers/test-ledger-1/root'
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('GET /v1/public/ledgers/:id/roots', () => {
    test('should return roots list for existing ledger', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/v1/public/ledgers/test-ledger-1/roots'
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.payload);
      expect(body.ledgerId).toBe('test-ledger-1');
      expect(body.roots).toBeInstanceOf(Array);
      expect(body.roots.length).toBeGreaterThan(0);
      expect(body.total).toBeGreaterThanOrEqual(1);
      expect(body.offset).toBeDefined();
      expect(body.limit).toBeDefined();
    });

    test('should return 404 for non-existent ledger', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/v1/public/ledgers/nonexistent/roots'
      });

      expect(response.statusCode).toBe(404);
    });

    test('should accept pagination parameters', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/v1/public/ledgers/test-ledger-1/roots?limit=10&offset=0'
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.payload);
      expect(body.limit).toBe(10);
      expect(body.offset).toBe(0);
    });
  });

  describe('POST /v1/public/verify', () => {
    let validProof: {
      leaf: string;
      index: number;
      proof: string[];
      directions: string[];
      root: string;
    };

    beforeEach(() => {
      // Create a real proof using MerkleTree
      const tree = new MerkleTree();
      tree.append('leaf1hash'.padEnd(64, '0'));
      tree.append('leaf2hash'.padEnd(64, '0'));
      tree.append('leaf3hash'.padEnd(64, '0'));

      validProof = tree.getProof(1);
    });

    test('should verify valid proof', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/public/verify',
        payload: { proof: validProof }
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.payload);
      expect(body.valid).toBe(true);
      expect(body.leaf).toBe(validProof.leaf);
      expect(body.root).toBe(validProof.root);
      expect(body.index).toBe(validProof.index);
      expect(body.proofLength).toBe(validProof.proof.length);
    });

    test('should reject proof with tampered leaf', async () => {
      const tamperedProof = {
        ...validProof,
        leaf: 'tampered'.padEnd(64, '0')
      };

      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/public/verify',
        payload: { proof: tamperedProof }
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.payload);
      expect(body.valid).toBe(false);
      expect(body.error).toBeDefined();
    });

    test('should reject proof with tampered root', async () => {
      const tamperedProof = {
        ...validProof,
        root: 'tampered'.padEnd(64, '0')
      };

      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/public/verify',
        payload: { proof: tamperedProof }
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.payload);
      expect(body.valid).toBe(false);
    });

    test('should reject proof with tampered sibling', async () => {
      const tamperedProof = {
        ...validProof,
        proof: validProof.proof.map(() => 'tampered'.padEnd(64, '0'))
      };

      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/public/verify',
        payload: { proof: tamperedProof }
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.payload);
      expect(body.valid).toBe(false);
    });

    test('should reject proof with mismatched array lengths', async () => {
      const invalidProof = {
        ...validProof,
        directions: [...validProof.directions, 'left'] // Extra direction
      };

      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/public/verify',
        payload: { proof: invalidProof }
      });

      expect(response.statusCode).toBe(400);

      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('INVALID_PROOF');
    });

    test('should reject proof without leaf', async () => {
      const { leaf, ...proofWithoutLeaf } = validProof;

      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/public/verify',
        payload: { proof: proofWithoutLeaf }
      });

      expect(response.statusCode).toBe(400);
    });

    test('should reject proof without root', async () => {
      const { root, ...proofWithoutRoot } = validProof;

      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/public/verify',
        payload: { proof: proofWithoutRoot }
      });

      expect(response.statusCode).toBe(400);
    });

    test('should not require authentication', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/public/verify',
        payload: { proof: validProof }
      });

      expect(response.statusCode).toBe(200);
    });
  });
});

describe('Public Routes - Edge Cases', () => {
  let fastify: FastifyInstance;

  beforeAll(async () => {
    fastify = Fastify({ logger: false });

    // Create service that throws errors
    const errorService: LedgerService = {
      getCurrentRoot: async () => {
        throw new Error('Database connection failed');
      },
      createLedger: async () => ({} as any),
      getLedger: async () => ({} as any),
      listLedgers: async () => ({ ledgers: [], total: 0 }),
      appendEntry: async () => ({} as any),
      getEntry: async () => null,
      listEntries: async () => ({ entries: [], total: 0n }),
      getProof: async () => null
    };

    await registerPublicRoutes(fastify, errorService);
    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();
  });

  test('should handle service errors gracefully', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/v1/public/ledgers/any-ledger/root'
    });

    expect(response.statusCode).toBe(500);

    const body = JSON.parse(response.payload);
    expect(body.error.code).toBe('ROOT_RETRIEVAL_FAILED');
  });
});

describe('Public Routes - Proof Verification Integration', () => {
  test('should verify proof for single-entry tree', () => {
    const tree = new MerkleTree();
    const leaf = 'single_leaf'.padEnd(64, '0');
    tree.append(leaf);

    const proof = tree.getProof(0);

    // Single entry tree has empty proof (leaf is root)
    expect(proof.proof).toHaveLength(0);
    expect(proof.leaf).toBe(leaf);
    expect(proof.root).toBe(leaf);

    const isValid = MerkleTree.verify(proof);
    expect(isValid).toBe(true);
  });

  test('should verify proof for large tree', () => {
    const tree = new MerkleTree();

    // Add 100 entries
    for (let i = 0; i < 100; i++) {
      tree.append(`leaf_${i}`.padEnd(64, '0'));
    }

    // Verify proof for entry in middle
    const proof = tree.getProof(50);
    const isValid = MerkleTree.verify(proof);
    expect(isValid).toBe(true);

    // Proof depth should be log2(100) rounded up
    expect(proof.proof.length).toBe(7); // ceil(log2(100)) = 7
  });

  test('should verify proofs for all entries', () => {
    const tree = new MerkleTree();

    for (let i = 0; i < 16; i++) {
      tree.append(`leaf_${i}`.padEnd(64, '0'));
    }

    // Verify every entry
    for (let i = 0; i < 16; i++) {
      const proof = tree.getProof(i);
      const isValid = MerkleTree.verify(proof);
      expect(isValid).toBe(true);
    }
  });
});
