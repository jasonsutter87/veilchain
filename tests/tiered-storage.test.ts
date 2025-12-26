/**
 * VeilChain Tiered Storage Tests
 *
 * Tests the automatic tiering behavior between PostgreSQL and blob storage.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { MemoryStorage } from '../src/storage/memory.js';
import { TieredStorage } from '../src/storage/tiered.js';
import { sha256 } from '../src/core/hash.js';
import type { LedgerEntry } from '../src/types.js';
import { GENESIS_HASH } from '../src/types.js';

// Simple mock for BlobStorage
function createMockBlobStorage() {
  const blobs = new Map<string, { data: unknown; metadata: unknown }>();

  return {
    put: async (ledgerId: string, entryId: string, data: unknown) => {
      const key = `${ledgerId}/${entryId}`;
      const metadata = {
        entryId,
        ledgerId,
        contentHash: sha256(JSON.stringify(data)),
        size: JSON.stringify(data).length,
      };
      blobs.set(key, { data, metadata });
      return metadata;
    },
    get: async (ledgerId: string, entryId: string) => {
      const key = `${ledgerId}/${entryId}`;
      const stored = blobs.get(key);
      if (!stored) return null;
      return {
        data: Buffer.from(JSON.stringify(stored.data)),
        metadata: stored.metadata,
      };
    },
    exists: async (ledgerId: string, entryId: string) => {
      return blobs.has(`${ledgerId}/${entryId}`);
    },
    delete: async (ledgerId: string, entryId: string) => {
      return blobs.delete(`${ledgerId}/${entryId}`);
    },
    getMetadata: async (ledgerId: string, entryId: string) => {
      const stored = blobs.get(`${ledgerId}/${entryId}`);
      return stored?.metadata ?? null;
    },
    healthCheck: async () => true,
    initialize: async () => {},
    clear: () => blobs.clear(),
  };
}

describe('TieredStorage', () => {
  let memoryStorage: MemoryStorage;
  let mockBlob: ReturnType<typeof createMockBlobStorage>;
  let tieredStorage: TieredStorage;
  const ledgerId = 'test-ledger';

  beforeEach(async () => {
    memoryStorage = new MemoryStorage();
    mockBlob = createMockBlobStorage();
    tieredStorage = new TieredStorage(
      memoryStorage,
      mockBlob as any,
      { sizeThreshold: 100 } // Low threshold for testing
    );

    // Create test ledger
    await memoryStorage.createLedgerMetadata({
      id: ledgerId,
      name: 'Test Ledger',
      createdAt: new Date(),
      rootHash: sha256('empty'),
      entryCount: 0n,
    });
  });

  describe('small entries (below threshold)', () => {
    it('should store directly in primary storage', async () => {
      const entry: LedgerEntry = {
        id: 'small-entry',
        position: 0n,
        data: { msg: 'hi' }, // Small data
        hash: sha256('small'),
        parentHash: GENESIS_HASH,
        createdAt: new Date(),
      };

      await tieredStorage.put(ledgerId, entry);

      // Should be retrievable from primary
      const retrieved = await memoryStorage.get(ledgerId, 'small-entry');
      expect(retrieved).not.toBeNull();
      expect(retrieved!.data).toEqual({ msg: 'hi' });
    });

    it('should retrieve small entries without modification', async () => {
      const entry: LedgerEntry = {
        id: 'small-entry',
        position: 0n,
        data: { msg: 'hi' },
        hash: sha256('small'),
        parentHash: GENESIS_HASH,
        createdAt: new Date(),
      };

      await tieredStorage.put(ledgerId, entry);
      const retrieved = await tieredStorage.get(ledgerId, 'small-entry');

      expect(retrieved).toEqual(entry);
    });
  });

  describe('large entries (above threshold)', () => {
    it('should store data in blob storage for large entries', async () => {
      const largeData = { content: 'x'.repeat(200) }; // Exceeds 100 byte threshold
      const entry: LedgerEntry = {
        id: 'large-entry',
        position: 0n,
        data: largeData,
        hash: sha256('large'),
        parentHash: GENESIS_HASH,
        createdAt: new Date(),
      };

      await tieredStorage.put(ledgerId, entry);

      // Primary should have blob reference, not actual data
      const primaryEntry = await memoryStorage.get(ledgerId, 'large-entry');
      expect(primaryEntry).not.toBeNull();
      expect(primaryEntry!.data).toHaveProperty('__type', '__VEILCHAIN_BLOB__');
    });

    it('should retrieve large entries transparently', async () => {
      const largeData = { content: 'x'.repeat(200) };
      const entry: LedgerEntry = {
        id: 'large-entry',
        position: 0n,
        data: largeData,
        hash: sha256('large'),
        parentHash: GENESIS_HASH,
        createdAt: new Date(),
      };

      await tieredStorage.put(ledgerId, entry);
      const retrieved = await tieredStorage.get(ledgerId, 'large-entry');

      expect(retrieved).not.toBeNull();
      expect(retrieved!.data).toEqual(largeData);
    });
  });

  describe('mixed operations', () => {
    it('should handle both small and large entries in list', async () => {
      // Add small entry
      const smallEntry: LedgerEntry = {
        id: 'small',
        position: 0n,
        data: { size: 'small' },
        hash: sha256('small'),
        parentHash: GENESIS_HASH,
        createdAt: new Date(),
      };
      await tieredStorage.put(ledgerId, smallEntry);

      // Add large entry
      const largeData = { content: 'x'.repeat(200) };
      const largeEntry: LedgerEntry = {
        id: 'large',
        position: 1n,
        data: largeData,
        hash: sha256('large'),
        parentHash: sha256('small'),
        createdAt: new Date(),
      };
      await tieredStorage.put(ledgerId, largeEntry);

      const entries = await tieredStorage.list(ledgerId, {});

      expect(entries).toHaveLength(2);
      expect(entries[0].data).toEqual({ size: 'small' });
      expect(entries[1].data).toEqual(largeData);
    });
  });

  describe('blob storage detection', () => {
    it('should correctly identify entries in blob storage', async () => {
      // Small entry
      await tieredStorage.put(ledgerId, {
        id: 'small',
        position: 0n,
        data: { msg: 'hi' },
        hash: sha256('small'),
        parentHash: GENESIS_HASH,
        createdAt: new Date(),
      });

      // Large entry
      await tieredStorage.put(ledgerId, {
        id: 'large',
        position: 1n,
        data: { content: 'x'.repeat(200) },
        hash: sha256('large'),
        parentHash: sha256('small'),
        createdAt: new Date(),
      });

      const smallInBlob = await tieredStorage.isInBlobStorage(ledgerId, 'small');
      const largeInBlob = await tieredStorage.isInBlobStorage(ledgerId, 'large');

      expect(smallInBlob).toBe(false);
      expect(largeInBlob).toBe(true);
    });
  });

  describe('storage statistics', () => {
    it('should report correct storage distribution', async () => {
      // Add small entry
      await tieredStorage.put(ledgerId, {
        id: 'small',
        position: 0n,
        data: { msg: 'hi' },
        hash: sha256('small'),
        parentHash: GENESIS_HASH,
        createdAt: new Date(),
      });

      // Add large entry
      await tieredStorage.put(ledgerId, {
        id: 'large',
        position: 1n,
        data: { content: 'x'.repeat(200) },
        hash: sha256('large'),
        parentHash: sha256('small'),
        createdAt: new Date(),
      });

      const stats = await tieredStorage.getStorageStats(ledgerId);

      expect(stats.totalEntries).toBe(2);
      expect(stats.primaryStorageEntries).toBe(1);
      expect(stats.blobStorageEntries).toBe(1);
    });
  });

  describe('delegated operations', () => {
    it('should delegate metadata operations to primary', async () => {
      const metadata = await tieredStorage.getLedgerMetadata(ledgerId);
      expect(metadata).not.toBeNull();
      expect(metadata!.name).toBe('Test Ledger');
    });

    it('should delegate listLedgers to primary', async () => {
      const ledgers = await tieredStorage.listLedgers();
      expect(ledgers).toHaveLength(1);
    });

    it('should delegate getAllLeafHashes to primary', async () => {
      await tieredStorage.put(ledgerId, {
        id: 'entry1',
        position: 0n,
        data: { msg: 'hi' },
        hash: sha256('entry1'),
        parentHash: GENESIS_HASH,
        createdAt: new Date(),
      });

      const hashes = await tieredStorage.getAllLeafHashes(ledgerId);
      expect(hashes).toHaveLength(1);
    });
  });

  describe('health check', () => {
    it('should check both storage backends', async () => {
      const health = await tieredStorage.healthCheck();

      expect(health.primary).toBe(true);
      expect(health.blob).toBe(true);
    });
  });

  describe('disabled tiering', () => {
    it('should always use primary when tiering disabled', async () => {
      const noTierStorage = new TieredStorage(
        memoryStorage,
        mockBlob as any,
        { enableTiering: false }
      );

      // Need to create a new ledger for this test
      await memoryStorage.createLedgerMetadata({
        id: 'no-tier-ledger',
        name: 'No Tier Ledger',
        createdAt: new Date(),
        rootHash: sha256('empty'),
        entryCount: 0n,
      });

      const largeEntry: LedgerEntry = {
        id: 'large',
        position: 0n,
        data: { content: 'x'.repeat(1000) },
        hash: sha256('large'),
        parentHash: GENESIS_HASH,
        createdAt: new Date(),
      };

      await noTierStorage.put('no-tier-ledger', largeEntry);

      // Should be in primary with actual data (not blob reference)
      const retrieved = await memoryStorage.get('no-tier-ledger', 'large');
      expect(retrieved!.data).toHaveProperty('content');
    });
  });

  describe('get by position', () => {
    it('should retrieve entries by position', async () => {
      await tieredStorage.put(ledgerId, {
        id: 'entry0',
        position: 0n,
        data: { index: 0 },
        hash: sha256('entry0'),
        parentHash: GENESIS_HASH,
        createdAt: new Date(),
      });

      await tieredStorage.put(ledgerId, {
        id: 'entry1',
        position: 1n,
        data: { index: 1 },
        hash: sha256('entry1'),
        parentHash: sha256('entry0'),
        createdAt: new Date(),
      });

      const entry = await tieredStorage.getByPosition(ledgerId, 1n);
      expect(entry).not.toBeNull();
      expect(entry!.id).toBe('entry1');
    });
  });
});
