/**
 * VeilChain Storage Tests
 */

import { MemoryStorage } from '../src/storage/memory.js';
import { sha256 } from '../src/core/hash.js';
import type { LedgerEntry, LedgerMetadata } from '../src/types.js';
import { GENESIS_HASH } from '../src/types.js';

describe('MemoryStorage', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  describe('ledger metadata', () => {
    it('should create and retrieve ledger metadata', async () => {
      const metadata: LedgerMetadata = {
        id: 'test-ledger',
        name: 'Test Ledger',
        description: 'A test ledger',
        createdAt: new Date(),
        rootHash: sha256('empty'),
        entryCount: 0n
      };

      await storage.createLedgerMetadata(metadata);
      const retrieved = await storage.getLedgerMetadata('test-ledger');

      expect(retrieved).toEqual(metadata);
    });

    it('should update ledger metadata', async () => {
      const metadata: LedgerMetadata = {
        id: 'test-ledger',
        name: 'Test Ledger',
        createdAt: new Date(),
        rootHash: sha256('empty'),
        entryCount: 0n
      };

      await storage.createLedgerMetadata(metadata);
      await storage.updateLedgerMetadata('test-ledger', {
        rootHash: sha256('new-root'),
        entryCount: 5n
      });

      const retrieved = await storage.getLedgerMetadata('test-ledger');
      expect(retrieved?.rootHash).toBe(sha256('new-root'));
      expect(retrieved?.entryCount).toBe(5n);
    });

    it('should throw when creating duplicate ledger', async () => {
      const metadata: LedgerMetadata = {
        id: 'test-ledger',
        name: 'Test Ledger',
        createdAt: new Date(),
        rootHash: sha256('empty'),
        entryCount: 0n
      };

      await storage.createLedgerMetadata(metadata);
      await expect(storage.createLedgerMetadata(metadata)).rejects.toThrow();
    });

    it('should return null for non-existent ledger', async () => {
      const result = await storage.getLedgerMetadata('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('entries', () => {
    const ledgerId = 'test-ledger';

    beforeEach(async () => {
      await storage.createLedgerMetadata({
        id: ledgerId,
        name: 'Test Ledger',
        createdAt: new Date(),
        rootHash: sha256('empty'),
        entryCount: 0n
      });
    });

    it('should store and retrieve entries by ID', async () => {
      const entry: LedgerEntry = {
        id: 'ent_123',
        position: 0n,
        data: { message: 'hello' },
        hash: sha256('hello'),
        parentHash: GENESIS_HASH,
        createdAt: new Date()
      };

      await storage.put(ledgerId, entry);
      const retrieved = await storage.get(ledgerId, 'ent_123');

      expect(retrieved).toEqual(entry);
    });

    it('should retrieve entries by position', async () => {
      const entry: LedgerEntry = {
        id: 'ent_123',
        position: 5n,
        data: { message: 'hello' },
        hash: sha256('hello'),
        createdAt: new Date()
      };

      await storage.put(ledgerId, entry);
      const retrieved = await storage.getByPosition(ledgerId, 5n);

      expect(retrieved).toEqual(entry);
    });

    it('should enforce append-only (reject duplicate positions)', async () => {
      const entry1: LedgerEntry = {
        id: 'ent_1',
        position: 0n,
        data: { message: 'first' },
        hash: sha256('first'),
        createdAt: new Date()
      };

      const entry2: LedgerEntry = {
        id: 'ent_2',
        position: 0n, // Same position!
        data: { message: 'second' },
        hash: sha256('second'),
        createdAt: new Date()
      };

      await storage.put(ledgerId, entry1);
      await expect(storage.put(ledgerId, entry2)).rejects.toThrow('append-only');
    });

    it('should list entries with pagination', async () => {
      // Add 10 entries
      for (let i = 0; i < 10; i++) {
        await storage.put(ledgerId, {
          id: `ent_${i}`,
          position: BigInt(i),
          data: { index: i },
          hash: sha256(`entry${i}`),
          createdAt: new Date()
        });
      }

      // Get first 5
      const first5 = await storage.list(ledgerId, { limit: 5 });
      expect(first5).toHaveLength(5);
      expect(first5[0].position).toBe(0n);
      expect(first5[4].position).toBe(4n);

      // Get next 5
      const next5 = await storage.list(ledgerId, { offset: 5n, limit: 5 });
      expect(next5).toHaveLength(5);
      expect(next5[0].position).toBe(5n);
    });

    it('should return all leaf hashes in order', async () => {
      const hashes: string[] = [];

      for (let i = 0; i < 5; i++) {
        const hash = sha256(`entry${i}`);
        hashes.push(hash);
        await storage.put(ledgerId, {
          id: `ent_${i}`,
          position: BigInt(i),
          data: { index: i },
          hash,
          createdAt: new Date()
        });
      }

      const retrieved = await storage.getAllLeafHashes(ledgerId);
      expect(retrieved).toEqual(hashes);
    });
  });

  describe('cleanup', () => {
    it('should clear all data', async () => {
      await storage.createLedgerMetadata({
        id: 'test',
        name: 'Test',
        createdAt: new Date(),
        rootHash: sha256('empty'),
        entryCount: 0n
      });

      await storage.clear();

      const stats = storage.getStats();
      expect(stats.ledgers).toBe(0);
      expect(stats.totalEntries).toBe(0);
    });

    it('should delete specific ledger', async () => {
      await storage.createLedgerMetadata({
        id: 'keep',
        name: 'Keep',
        createdAt: new Date(),
        rootHash: sha256('empty'),
        entryCount: 0n
      });

      await storage.createLedgerMetadata({
        id: 'delete',
        name: 'Delete',
        createdAt: new Date(),
        rootHash: sha256('empty'),
        entryCount: 0n
      });

      await storage.deleteLedger('delete');

      expect(await storage.getLedgerMetadata('keep')).not.toBeNull();
      expect(await storage.getLedgerMetadata('delete')).toBeNull();
    });
  });
});
