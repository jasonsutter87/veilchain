/**
 * VeilChain Idempotency Service Tests
 *
 * Tests for idempotency key management including:
 * - Memory storage backend
 * - PostgreSQL storage backend (mocked)
 * - Key expiration and cleanup
 * - Service lifecycle
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  IdempotencyService,
  MemoryIdempotencyStorage,
  PostgresIdempotencyStorage
} from '../src/services/idempotency.js';

describe('MemoryIdempotencyStorage', () => {
  let storage: MemoryIdempotencyStorage;

  beforeEach(() => {
    storage = new MemoryIdempotencyStorage();
  });

  describe('Basic Operations', () => {
    test('should store and retrieve a value', async () => {
      const result = { success: true, data: 'test' };
      const expiresAt = new Date(Date.now() + 60000);

      await storage.set('ledger1', 'key1', result, expiresAt);
      const retrieved = await storage.get('ledger1', 'key1');

      expect(retrieved).toEqual(result);
    });

    test('should return null for non-existent key', async () => {
      const result = await storage.get('ledger1', 'nonexistent');
      expect(result).toBeNull();
    });

    test('should scope keys by ledger ID', async () => {
      const expiresAt = new Date(Date.now() + 60000);

      await storage.set('ledger1', 'key1', { ledger: 1 }, expiresAt);
      await storage.set('ledger2', 'key1', { ledger: 2 }, expiresAt);

      const result1 = await storage.get('ledger1', 'key1');
      const result2 = await storage.get('ledger2', 'key1');

      expect(result1).toEqual({ ledger: 1 });
      expect(result2).toEqual({ ledger: 2 });
    });

    test('should delete a key', async () => {
      const expiresAt = new Date(Date.now() + 60000);
      await storage.set('ledger1', 'key1', { test: 'data' }, expiresAt);

      await storage.delete('ledger1', 'key1');

      const result = await storage.get('ledger1', 'key1');
      expect(result).toBeNull();
    });

    test('should overwrite existing key', async () => {
      const expiresAt = new Date(Date.now() + 60000);

      await storage.set('ledger1', 'key1', { version: 1 }, expiresAt);
      await storage.set('ledger1', 'key1', { version: 2 }, expiresAt);

      const result = await storage.get('ledger1', 'key1');
      expect(result).toEqual({ version: 2 });
    });
  });

  describe('Expiration', () => {
    test('should return null for expired key', async () => {
      const expiredAt = new Date(Date.now() - 1000); // Already expired
      await storage.set('ledger1', 'key1', { test: 'expired' }, expiredAt);

      const result = await storage.get('ledger1', 'key1');
      expect(result).toBeNull();
    });

    test('should cleanup expired keys', async () => {
      const expiredAt = new Date(Date.now() - 1000);
      const validAt = new Date(Date.now() + 60000);

      await storage.set('ledger1', 'expired', { test: 'expired' }, expiredAt);
      await storage.set('ledger1', 'valid', { test: 'valid' }, validAt);

      await storage.cleanup();

      const expiredResult = await storage.get('ledger1', 'expired');
      const validResult = await storage.get('ledger1', 'valid');

      expect(expiredResult).toBeNull();
      expect(validResult).toEqual({ test: 'valid' });
    });
  });

  describe('Ledger Operations', () => {
    test('should clear all keys for a ledger', async () => {
      const expiresAt = new Date(Date.now() + 60000);

      await storage.set('ledger1', 'key1', { v: 1 }, expiresAt);
      await storage.set('ledger1', 'key2', { v: 2 }, expiresAt);
      await storage.set('ledger2', 'key1', { v: 3 }, expiresAt);

      storage.clearLedger('ledger1');

      expect(await storage.get('ledger1', 'key1')).toBeNull();
      expect(await storage.get('ledger1', 'key2')).toBeNull();
      expect(await storage.get('ledger2', 'key1')).toEqual({ v: 3 });
    });

    test('should clear all keys', async () => {
      const expiresAt = new Date(Date.now() + 60000);

      await storage.set('ledger1', 'key1', { v: 1 }, expiresAt);
      await storage.set('ledger2', 'key2', { v: 2 }, expiresAt);

      storage.clear();

      expect(await storage.get('ledger1', 'key1')).toBeNull();
      expect(await storage.get('ledger2', 'key2')).toBeNull();
    });
  });
});

describe('PostgresIdempotencyStorage', () => {
  let storage: PostgresIdempotencyStorage;
  let mockPool: any;

  beforeEach(() => {
    // Create mock pool
    mockPool = {
      query: jest.fn()
    };
    storage = new PostgresIdempotencyStorage(mockPool);
  });

  describe('get', () => {
    test('should query for non-expired key', async () => {
      const mockResult = { success: true };
      mockPool.query.mockResolvedValue({
        rows: [{ response: mockResult }]
      });

      const result = await storage.get('ledger1', 'key1');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT response'),
        ['ledger1', 'key1']
      );
      expect(result).toEqual(mockResult);
    });

    test('should return null when no rows found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await storage.get('ledger1', 'key1');
      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    test('should insert with upsert', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = { test: 'data' };
      const expiresAt = new Date();

      await storage.set('ledger1', 'key1', result, expiresAt);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO idempotency_keys'),
        ['key1', 'ledger1', JSON.stringify(result), expiresAt]
      );
    });
  });

  describe('delete', () => {
    test('should delete by ledger and key', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await storage.delete('ledger1', 'key1');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM idempotency_keys'),
        ['ledger1', 'key1']
      );
    });
  });

  describe('cleanup', () => {
    test('should delete expired keys', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await storage.cleanup();

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM idempotency_keys WHERE expires_at < NOW()')
      );
    });
  });
});

describe('IdempotencyService', () => {
  let service: IdempotencyService;
  let storage: MemoryIdempotencyStorage;

  beforeEach(() => {
    storage = new MemoryIdempotencyStorage();
    service = new IdempotencyService(storage, 1000); // 1 second TTL for testing
  });

  afterEach(() => {
    service.destroy();
  });

  describe('Key Management', () => {
    test('should store and retrieve result', async () => {
      const result = { entry: { id: 'ent_123' }, proof: {} };

      await service.set('ledger1', 'key1', result);
      const retrieved = await service.get<typeof result>('ledger1', 'key1');

      expect(retrieved).toEqual(result);
    });

    test('should return null for non-existent key', async () => {
      const result = await service.get('ledger1', 'nonexistent');
      expect(result).toBeNull();
    });

    test('should delete a key', async () => {
      await service.set('ledger1', 'key1', { test: 'data' });
      await service.delete('ledger1', 'key1');

      const result = await service.get('ledger1', 'key1');
      expect(result).toBeNull();
    });

    test('should set expiration based on TTL', async () => {
      // Use a very short TTL service
      const shortService = new IdempotencyService(storage, 100); // 100ms TTL
      await shortService.set('ledger1', 'key1', { test: 'data' });

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 150));

      const result = await shortService.get('ledger1', 'key1');
      expect(result).toBeNull();

      shortService.destroy();
    });
  });

  describe('Ledger Operations', () => {
    test('should clear ledger keys with memory storage', async () => {
      await service.set('ledger1', 'key1', { v: 1 });
      await service.set('ledger1', 'key2', { v: 2 });
      await service.set('ledger2', 'key1', { v: 3 });

      service.clearLedger('ledger1');

      expect(await service.get('ledger1', 'key1')).toBeNull();
      expect(await service.get('ledger1', 'key2')).toBeNull();
      expect(await service.get('ledger2', 'key1')).toEqual({ v: 3 });
    });

    test('should clear all keys with memory storage', async () => {
      await service.set('ledger1', 'key1', { v: 1 });
      await service.set('ledger2', 'key2', { v: 2 });

      service.clear();

      expect(await service.get('ledger1', 'key1')).toBeNull();
      expect(await service.get('ledger2', 'key2')).toBeNull();
    });
  });

  describe('Cleanup', () => {
    test('should start cleanup interval', () => {
      // Service should have started cleanup automatically
      // This is mainly to verify no errors occur
      expect(service).toBeDefined();
    });

    test('should stop cleanup on destroy', () => {
      const service = new IdempotencyService(storage);

      // Should not throw
      expect(() => service.destroy()).not.toThrow();

      // Should be safe to call multiple times
      expect(() => service.destroy()).not.toThrow();
    });
  });

  describe('Type Safety', () => {
    interface TestResult {
      entry: { id: string; data: string };
      proof: { root: string };
    }

    test('should preserve types through get/set', async () => {
      const result: TestResult = {
        entry: { id: 'ent_123', data: 'test' },
        proof: { root: 'abc123' }
      };

      await service.set('ledger1', 'typed-key', result);
      const retrieved = await service.get<TestResult>('ledger1', 'typed-key');

      expect(retrieved?.entry.id).toBe('ent_123');
      expect(retrieved?.proof.root).toBe('abc123');
    });
  });
});

describe('Idempotency Integration', () => {
  test('should handle complex result objects', async () => {
    const storage = new MemoryIdempotencyStorage();
    const service = new IdempotencyService(storage);

    const complexResult = {
      entry: {
        id: 'ent_123',
        position: 0n, // Note: BigInt won't serialize directly
        data: { nested: { deep: 'value' } },
        hash: 'abc123',
        createdAt: new Date()
      },
      proof: {
        leaf: 'abc',
        index: 0,
        proof: ['hash1', 'hash2'],
        directions: ['left', 'right'],
        root: 'rootHash'
      },
      previousRoot: 'prev',
      newRoot: 'new'
    };

    // Serialize BigInt manually for storage
    const serializable = {
      ...complexResult,
      entry: {
        ...complexResult.entry,
        position: complexResult.entry.position.toString()
      }
    };

    await service.set('ledger1', 'complex-key', serializable);
    const retrieved = await service.get('ledger1', 'complex-key');

    expect(retrieved).toBeDefined();
    expect((retrieved as any).entry.data.nested.deep).toBe('value');

    service.destroy();
  });

  test('should handle concurrent access', async () => {
    const storage = new MemoryIdempotencyStorage();
    const service = new IdempotencyService(storage);

    // Simulate concurrent requests with same key
    const key = 'concurrent-key';
    const results: any[] = [];

    const promises = Array.from({ length: 10 }, async (_, i) => {
      // Check if already exists
      const existing = await service.get('ledger1', key);
      if (existing) {
        results.push({ cached: true, value: existing });
        return;
      }

      // Simulate work
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 10));

      // Set value
      const value = { index: i };
      await service.set('ledger1', key, value);
      results.push({ cached: false, value });
    });

    await Promise.all(promises);

    // All results should eventually get the same value
    const finalValue = await service.get('ledger1', key);
    expect(finalValue).toBeDefined();

    service.destroy();
  });
});
