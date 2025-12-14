/**
 * VeilChain SDK Tests
 *
 * Comprehensive tests for the SDK client and offline verification.
 */

import { jest } from '@jest/globals';
import {
  VeilChainClient,
  verifyProofOffline,
  verifyProofWithDetails,
  verifyProofsBatch,
  verifyProofsConsistency,
  serializeProofForStorage,
  deserializeProofFromStorage,
  encodeProofToString,
  decodeProofFromString,
  verifyEncodedProof,
  getProofMetadata,
  areProofsForSameEntry,
  reconstructRootFromProofs,
  VeilChainError,
  NetworkError,
  AuthenticationError,
  ValidationError,
  NotFoundError,
  ProofVerificationError,
  RateLimitError,
  ServerError,
  isRetryableError
} from '../src/index.js';
import { MerkleTree } from '../src/core/merkle.js';
import { sha256 } from '../src/core/hash.js';
import type { MerkleProof, LedgerMetadata } from '../src/types.js';

// Helper to create mock Response objects
function createMockResponse(data: any, status = 200, ok = true): Response {
  const response = {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => data,
    text: async () => JSON.stringify(data),
    blob: async () => new Blob([JSON.stringify(data)]),
    arrayBuffer: async () => new ArrayBuffer(0),
    formData: async () => new FormData(),
    clone: function() { return this; },
    body: null,
    bodyUsed: false,
    redirected: false,
    type: 'basic',
    url: ''
  } as Response;

  return response;
}

// Mock fetch globally
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

describe('VeilChain SDK', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('Error Classes', () => {
    it('should create VeilChainError with code', () => {
      const error = new VeilChainError('Test error', 'TEST_CODE');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.name).toBe('VeilChainError');
    });

    it('should create NetworkError with status code', () => {
      const error = new NetworkError('Network failed', 500);
      expect(error.message).toBe('Network failed');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('NETWORK_ERROR');
    });

    it('should create AuthenticationError', () => {
      const error = new AuthenticationError();
      expect(error.message).toBe('Authentication failed');
      expect(error.code).toBe('AUTH_ERROR');
    });

    it('should create ValidationError with field', () => {
      const error = new ValidationError('Invalid input', 'email');
      expect(error.message).toBe('Invalid input');
      expect(error.field).toBe('email');
    });

    it('should create NotFoundError', () => {
      const error = new NotFoundError('Ledger', 'ledger-123');
      expect(error.message).toBe('Ledger with ID ledger-123 not found');
    });

    it('should create ProofVerificationError with proof data', () => {
      const proofData = { leaf: 'abc123' };
      const error = new ProofVerificationError('Invalid proof', proofData);
      expect(error.message).toBe('Invalid proof');
      expect(error.proofData).toEqual(proofData);
    });

    it('should create RateLimitError with retry after', () => {
      const error = new RateLimitError('Too many requests', 5000);
      expect(error.retryAfter).toBe(5000);
    });

    it('should identify retryable errors', () => {
      expect(isRetryableError(new NetworkError('Timeout'))).toBe(true);
      expect(isRetryableError(new ServerError('Server error', 500))).toBe(true);
      expect(isRetryableError(new RateLimitError())).toBe(true);
      expect(isRetryableError(new AuthenticationError())).toBe(false);
      expect(isRetryableError(new ValidationError('Bad input'))).toBe(false);
    });
  });

  describe('VeilChainClient Configuration', () => {
    it('should create client with valid config', () => {
      const client = new VeilChainClient({
        apiKey: 'test-key',
        baseUrl: 'https://api.example.com'
      });
      expect(client).toBeInstanceOf(VeilChainClient);
    });

    it('should throw error without apiKey', () => {
      expect(() => {
        new VeilChainClient({
          apiKey: '',
          baseUrl: 'https://api.example.com'
        });
      }).toThrow('apiKey is required');
    });

    it('should throw error without baseUrl', () => {
      expect(() => {
        new VeilChainClient({
          apiKey: 'test-key',
          baseUrl: ''
        });
      }).toThrow('baseUrl is required');
    });

    it('should remove trailing slash from baseUrl', () => {
      const client = new VeilChainClient({
        apiKey: 'test-key',
        baseUrl: 'https://api.example.com/'
      });
      expect(client).toBeInstanceOf(VeilChainClient);
    });

    it('should accept custom timeout and retry settings', () => {
      const client = new VeilChainClient({
        apiKey: 'test-key',
        baseUrl: 'https://api.example.com',
        timeout: 5000,
        maxRetries: 5,
        retryDelay: 500
      });
      expect(client).toBeInstanceOf(VeilChainClient);
    });
  });

  describe('VeilChainClient - Ledger Operations', () => {
    let client: VeilChainClient;

    beforeEach(() => {
      client = new VeilChainClient({
        apiKey: 'test-key',
        baseUrl: 'https://api.example.com'
      });
    });

    it('should create a ledger', async () => {
      const mockLedger: LedgerMetadata = {
        id: 'ledger-123',
        name: 'Test Ledger',
        description: 'A test ledger',
        createdAt: new Date(),
        rootHash: sha256('initial'),
        entryCount: 0n
      };

      mockFetch.mockResolvedValueOnce(
        createMockResponse({ ledger: mockLedger })
      );

      const result = await client.createLedger({
        name: 'Test Ledger',
        description: 'A test ledger'
      });

      expect(result.id).toBe('ledger-123');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/ledgers',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-key',
            'Content-Type': 'application/json'
          })
        })
      );
    });

    it('should get a ledger by ID', async () => {
      const mockLedger: LedgerMetadata = {
        id: 'ledger-123',
        name: 'Test Ledger',
        createdAt: new Date(),
        rootHash: sha256('root'),
        entryCount: 5n
      };

      mockFetch.mockResolvedValueOnce(
        createMockResponse(mockLedger)
      );

      const result = await client.getLedger('ledger-123');
      expect(result.id).toBe('ledger-123');
    });

    it('should list ledgers with pagination', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ledgers: [],
          total: 0,
          offset: 0,
          limit: 10
        })
      );

      const result = await client.listLedgers({ offset: 0, limit: 10 });
      expect(result.ledgers).toEqual([]);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('offset=0'),
        expect.anything()
      );
    });

    it('should delete a ledger', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(undefined, 204)
      );

      await client.deleteLedger('ledger-123');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/ledgers/ledger-123',
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('VeilChainClient - Entry Operations', () => {
    let client: VeilChainClient;

    beforeEach(() => {
      client = new VeilChainClient({
        apiKey: 'test-key',
        baseUrl: 'https://api.example.com'
      });
    });

    it('should append an entry', async () => {
      const mockResult = {
        result: {
          entry: {
            id: 'entry-123',
            position: 0n,
            data: { event: 'login' },
            hash: sha256('data'),
            createdAt: new Date()
          },
          proof: {
            leaf: sha256('leaf'),
            index: 0,
            proof: [],
            directions: [],
            root: sha256('root')
          },
          previousRoot: sha256('prev'),
          newRoot: sha256('new')
        }
      };

      mockFetch.mockResolvedValueOnce(
        createMockResponse(mockResult)
      );

      const result = await client.append('ledger-123', { event: 'login' });
      expect(result.entry.data).toEqual({ event: 'login' });
    });

    it('should get an entry by ID', async () => {
      const mockEntry = {
        id: 'entry-123',
        position: 0n,
        data: { event: 'login' },
        hash: sha256('data'),
        createdAt: new Date()
      };

      mockFetch.mockResolvedValueOnce(
        createMockResponse(mockEntry)
      );

      const result = await client.getEntry('ledger-123', 'entry-123');
      expect(result.id).toBe('entry-123');
    });

    it('should list entries with pagination', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          entries: [],
          total: 0,
          offset: 0,
          limit: 10
        })
      );

      const result = await client.listEntries('ledger-123', { offset: 0, limit: 10 });
      expect(result.entries).toEqual([]);
    });
  });

  describe('VeilChainClient - Proof Operations', () => {
    let client: VeilChainClient;

    beforeEach(() => {
      client = new VeilChainClient({
        apiKey: 'test-key',
        baseUrl: 'https://api.example.com'
      });
    });

    it('should get a proof', async () => {
      const mockProof: MerkleProof = {
        leaf: sha256('leaf'),
        index: 0,
        proof: [sha256('sibling')],
        directions: ['right'],
        root: sha256('root')
      };

      mockFetch.mockResolvedValueOnce(
        createMockResponse({ proof: mockProof })
      );

      const result = await client.getProof('ledger-123', 'entry-123');
      expect(result.leaf).toBe(mockProof.leaf);
    });

    it('should get root hash', async () => {
      const mockLedger: LedgerMetadata = {
        id: 'ledger-123',
        name: 'Test',
        createdAt: new Date(),
        rootHash: sha256('root'),
        entryCount: 5n
      };

      mockFetch.mockResolvedValueOnce(
        createMockResponse(mockLedger)
      );

      const rootHash = await client.getRootHash('ledger-123');
      expect(rootHash).toBe(mockLedger.rootHash);
    });
  });

  describe('VeilChainClient - Error Handling', () => {
    let client: VeilChainClient;

    beforeEach(() => {
      client = new VeilChainClient({
        apiKey: 'test-key',
        baseUrl: 'https://api.example.com',
        maxRetries: 0, // Don't retry for error handling tests
        retryDelay: 10
      });
    });

    it('should handle 401 authentication error', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ message: 'Invalid API key' }, 401, false)
      );

      await expect(client.getLedger('ledger-123')).rejects.toThrow(AuthenticationError);
    });

    it('should handle 404 not found error', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ resource: 'Ledger', id: 'ledger-123' }, 404, false)
      );

      await expect(client.getLedger('ledger-123')).rejects.toThrow(NotFoundError);
    });

    it('should handle 400 validation error', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ message: 'Invalid input', field: 'name' }, 400, false)
      );

      await expect(
        client.createLedger({ name: '' })
      ).rejects.toThrow(ValidationError);
    });

    it('should handle 429 rate limit error', async () => {
      const response = createMockResponse({ message: 'Rate limit exceeded', retryAfter: 5000 }, 429, false);
      mockFetch.mockResolvedValueOnce(response);

      await expect(client.getLedger('ledger-123')).rejects.toThrow(RateLimitError);
    });

    it('should handle 500 server error', async () => {
      const response = createMockResponse({ message: 'Internal server error' }, 500, false);
      mockFetch.mockResolvedValueOnce(response);

      await expect(client.getLedger('ledger-123')).rejects.toThrow(ServerError);
    });

    it('should retry on network errors', async () => {
      // Create a client with retries enabled for this test
      const retryClient = new VeilChainClient({
        apiKey: 'test-key',
        baseUrl: 'https://api.example.com',
        maxRetries: 1,
        retryDelay: 10
      });

      // First attempt fails with 503, second succeeds
      mockFetch
        .mockResolvedValueOnce(
          createMockResponse({ message: 'Service unavailable' }, 503, false)
        )
        .mockResolvedValueOnce(
          createMockResponse({ id: 'ledger-123', name: 'Test', createdAt: new Date(), rootHash: sha256('root'), entryCount: 0n })
        );

      const result = await retryClient.getLedger('ledger-123');
      expect(result.id).toBe('ledger-123');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should handle timeout errors', async () => {
      mockFetch.mockImplementationOnce(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('AbortError')), 50);
        });
      });

      await expect(
        client.getLedger('ledger-123')
      ).rejects.toThrow();
    });
  });

  describe('Offline Proof Verification', () => {
    let tree: MerkleTree;
    let proofs: MerkleProof[];

    beforeEach(() => {
      // Create a test tree with multiple leaves
      tree = new MerkleTree();
      const leaves = ['data1', 'data2', 'data3', 'data4'].map(d => sha256(d));
      leaves.forEach(leaf => tree.append(leaf));

      // Generate proofs for all leaves
      proofs = leaves.map((_, index) => tree.getProof(index));
    });

    it('should verify a valid proof offline', () => {
      const isValid = verifyProofOffline(proofs[0]);
      expect(isValid).toBe(true);
    });

    it('should throw on invalid proof', () => {
      const invalidProof = { ...proofs[0], root: sha256('wrong-root') };
      expect(() => verifyProofOffline(invalidProof)).toThrow(ProofVerificationError);
    });

    it('should verify proof with details', () => {
      const result = verifyProofWithDetails(proofs[0]);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.root).toBe(tree.root);
    });

    it('should verify multiple proofs in batch', () => {
      const results = verifyProofsBatch(proofs);
      expect(results.every(r => r.valid)).toBe(true);
      expect(results).toHaveLength(4);
    });

    it('should verify proofs consistency', () => {
      const isConsistent = verifyProofsConsistency(proofs);
      expect(isConsistent).toBe(true);
    });

    it('should detect inconsistent proofs', () => {
      const inconsistentProofs = [
        proofs[0],
        { ...proofs[1], root: sha256('different-root') }
      ];
      const isConsistent = verifyProofsConsistency(inconsistentProofs);
      expect(isConsistent).toBe(false);
    });

    it('should serialize and deserialize proofs', () => {
      const serialized = serializeProofForStorage(proofs[0]);
      expect(serialized.v).toBe(1);
      expect(serialized.l).toBe(proofs[0].leaf);

      const deserialized = deserializeProofFromStorage(serialized);
      expect(deserialized.leaf).toBe(proofs[0].leaf);
      expect(deserialized.root).toBe(proofs[0].root);
    });

    it('should encode and decode proofs as strings', () => {
      const encoded = encodeProofToString(proofs[0]);
      expect(typeof encoded).toBe('string');

      const decoded = decodeProofFromString(encoded);
      expect(decoded.leaf).toBe(proofs[0].leaf);
      expect(decoded.root).toBe(proofs[0].root);
    });

    it('should verify encoded proof', () => {
      const encoded = encodeProofToString(proofs[0]);
      const isValid = verifyEncodedProof(encoded);
      expect(isValid).toBe(true);
    });

    it('should extract proof metadata', () => {
      const metadata = getProofMetadata(proofs[0]);
      expect(metadata.index).toBe(0);
      expect(metadata.leafHash).toBe(proofs[0].leaf);
      expect(metadata.rootHash).toBe(tree.root);
      expect(metadata.pathLength).toBe(proofs[0].proof.length);
    });

    it('should check if proofs are for same entry', () => {
      const same = areProofsForSameEntry(proofs[0], proofs[0]);
      expect(same).toBe(true);

      const different = areProofsForSameEntry(proofs[0], proofs[1]);
      expect(different).toBe(false);
    });

    it('should reconstruct root from proofs', () => {
      const reconstructedRoot = reconstructRootFromProofs(proofs);
      expect(reconstructedRoot).toBe(tree.root);
    });

    it('should return null for inconsistent proof reconstruction', () => {
      const invalidProof = { ...proofs[0], root: sha256('wrong') };
      const reconstructedRoot = reconstructRootFromProofs([invalidProof]);
      expect(reconstructedRoot).toBeNull();
    });

    it('should handle empty proof array in reconstruction', () => {
      const reconstructedRoot = reconstructRootFromProofs([]);
      expect(reconstructedRoot).toBeNull();
    });
  });

  describe('Health Check', () => {
    let client: VeilChainClient;

    beforeEach(() => {
      client = new VeilChainClient({
        apiKey: 'test-key',
        baseUrl: 'https://api.example.com'
      });
    });

    it('should check API health', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: 'healthy',
          version: '0.1.0',
          uptime: 12345,
          timestamp: new Date().toISOString()
        })
      );

      const health = await client.health();
      expect(health.status).toBe('healthy');
      expect(health.version).toBe('0.1.0');
    });
  });
});
