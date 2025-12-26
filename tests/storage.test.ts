/**
 * VeilChain Storage Tests
 * Updated for cryptographic chaining and sequence enforcement
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

  describe('entries with cryptographic chaining', () => {
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
        id: 'ent_0',
        position: 0n,
        data: { message: 'hello' },
        hash: sha256('hello'),
        parentHash: GENESIS_HASH,
        createdAt: new Date()
      };

      await storage.put(ledgerId, entry);
      const retrieved = await storage.getByPosition(ledgerId, 0n);

      expect(retrieved).toEqual(entry);
    });

    it('should enforce sequential positions', async () => {
      const entry0: LedgerEntry = {
        id: 'ent_0',
        position: 0n,
        data: { message: 'first' },
        hash: sha256('first'),
        parentHash: GENESIS_HASH,
        createdAt: new Date()
      };

      // Try to add entry at position 5 (should fail - must be sequential)
      const entry5: LedgerEntry = {
        id: 'ent_5',
        position: 5n,
        data: { message: 'fifth' },
        hash: sha256('fifth'),
        parentHash: entry0.hash,
        createdAt: new Date()
      };

      await storage.put(ledgerId, entry0);
      await expect(storage.put(ledgerId, entry5)).rejects.toThrow('Sequence violation');
    });

    it('should enforce cryptographic chain integrity', async () => {
      const entry0: LedgerEntry = {
        id: 'ent_0',
        position: 0n,
        data: { message: 'first' },
        hash: sha256('first'),
        parentHash: GENESIS_HASH,
        createdAt: new Date()
      };

      // Entry with wrong parent hash
      const entry1: LedgerEntry = {
        id: 'ent_1',
        position: 1n,
        data: { message: 'second' },
        hash: sha256('second'),
        parentHash: 'wrong_hash_value_here',
        createdAt: new Date()
      };

      await storage.put(ledgerId, entry0);
      await expect(storage.put(ledgerId, entry1)).rejects.toThrow('Chain integrity violation');
    });

    it('should enforce genesis hash for first entry', async () => {
      const entry: LedgerEntry = {
        id: 'ent_0',
        position: 0n,
        data: { message: 'first' },
        hash: sha256('first'),
        parentHash: 'not_genesis_hash',
        createdAt: new Date()
      };

      await expect(storage.put(ledgerId, entry)).rejects.toThrow('GENESIS_HASH');
    });

    it('should enforce append-only (reject duplicate positions)', async () => {
      const entry1: LedgerEntry = {
        id: 'ent_0',
        position: 0n,
        data: { message: 'first' },
        hash: sha256('first'),
        parentHash: GENESIS_HASH,
        createdAt: new Date()
      };

      const entry2: LedgerEntry = {
        id: 'ent_0_dup',
        position: 0n, // Same position!
        data: { message: 'second' },
        hash: sha256('second'),
        parentHash: GENESIS_HASH,
        createdAt: new Date()
      };

      await storage.put(ledgerId, entry1);
      await expect(storage.put(ledgerId, entry2)).rejects.toThrow('append-only');
    });

    it('should list entries with pagination', async () => {
      // Add 10 entries with proper chaining
      let prevHash = GENESIS_HASH;
      for (let i = 0; i < 10; i++) {
        const hash = sha256(`entry${i}`);
        await storage.put(ledgerId, {
          id: `ent_${i}`,
          position: BigInt(i),
          data: { index: i },
          hash,
          parentHash: prevHash,
          createdAt: new Date()
        });
        prevHash = hash;
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
      let prevHash = GENESIS_HASH;

      for (let i = 0; i < 5; i++) {
        const hash = sha256(`entry${i}`);
        hashes.push(hash);
        await storage.put(ledgerId, {
          id: `ent_${i}`,
          position: BigInt(i),
          data: { index: i },
          hash,
          parentHash: prevHash,
          createdAt: new Date()
        });
        prevHash = hash;
      }

      const retrieved = await storage.getAllLeafHashes(ledgerId);
      expect(retrieved).toEqual(hashes);
    });

    it('should get last entry hash', async () => {
      // Empty ledger should return genesis hash
      const emptyHash = await storage.getLastEntryHash(ledgerId);
      expect(emptyHash).toBe(GENESIS_HASH);

      // Add an entry
      const hash0 = sha256('entry0');
      await storage.put(ledgerId, {
        id: 'ent_0',
        position: 0n,
        data: { index: 0 },
        hash: hash0,
        parentHash: GENESIS_HASH,
        createdAt: new Date()
      });

      const lastHash = await storage.getLastEntryHash(ledgerId);
      expect(lastHash).toBe(hash0);
    });

    it('should verify ledger integrity', async () => {
      // Add properly chained entries
      let prevHash = GENESIS_HASH;
      for (let i = 0; i < 5; i++) {
        const hash = sha256(`entry${i}`);
        await storage.put(ledgerId, {
          id: `ent_${i}`,
          position: BigInt(i),
          data: { index: i },
          hash,
          parentHash: prevHash,
          createdAt: new Date()
        });
        prevHash = hash;
      }

      const result = await storage.verifyLedgerIntegrity(ledgerId);
      expect(result.isValid).toBe(true);
      expect(result.chainValid).toBe(true);
      expect(result.sequenceValid).toBe(true);
      expect(result.entryCount).toBe(5n);
      expect(result.errors).toHaveLength(0);
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
