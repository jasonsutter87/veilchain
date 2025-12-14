/**
 * VeilChain Ledger Service Tests
 *
 * Tests the complete ledger lifecycle including:
 * - Ledger creation and retrieval
 * - Entry appending with Merkle tree updates
 * - Proof generation and verification
 * - Idempotency handling
 * - Event emission
 * - Tree reconstruction
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { EventEmitter } from 'events';
import { LedgerService } from '../src/services/ledger.js';
import { IdempotencyService } from '../src/services/idempotency.js';
import { MemoryStorage } from '../src/storage/memory.js';
import { MerkleTree } from '../src/core/merkle.js';
import type { LedgerMetadata, LedgerEntry, MerkleProof } from '../src/types.js';

describe('LedgerService', () => {
  let storage: MemoryStorage;
  let service: LedgerService;
  let events: EventEmitter;

  beforeEach(() => {
    storage = new MemoryStorage();
    events = new EventEmitter();
    service = new LedgerService(storage, { eventEmitter: events });
  });

  afterEach(() => {
    service.destroy();
  });

  describe('Ledger Creation', () => {
    test('should create a new ledger', async () => {
      const ledger = await service.createLedger({
        name: 'Test Ledger',
        description: 'A test ledger'
      });

      expect(ledger.id).toMatch(/^ledger_/);
      expect(ledger.name).toBe('Test Ledger');
      expect(ledger.description).toBe('A test ledger');
      expect(ledger.entryCount).toBe(0n);
      expect(ledger.rootHash).toBeDefined();
      expect(ledger.createdAt).toBeInstanceOf(Date);
      expect(ledger.lastEntryAt).toBeUndefined();
    });

    test('should emit ledger:created event', async () => {
      let emittedMetadata: LedgerMetadata | undefined;
      events.on('ledger:created', (metadata) => {
        emittedMetadata = metadata;
      });

      const ledger = await service.createLedger({
        name: 'Event Test'
      });

      expect(emittedMetadata).toBeDefined();
      expect(emittedMetadata?.id).toBe(ledger.id);
      expect(emittedMetadata?.name).toBe('Event Test');
    });

    test('should persist ledger metadata', async () => {
      const created = await service.createLedger({
        name: 'Persistent Ledger'
      });

      const retrieved = await service.getLedger(created.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.name).toBe('Persistent Ledger');
    });
  });

  describe('Entry Appending', () => {
    let ledgerId: string;

    beforeEach(async () => {
      const ledger = await service.createLedger({
        name: 'Append Test Ledger'
      });
      ledgerId = ledger.id;
    });

    test('should append an entry', async () => {
      const data = { message: 'Hello, World!' };
      const result = await service.append(ledgerId, data);

      expect(result.entry.id).toMatch(/^ent_/);
      expect(result.entry.position).toBe(0n);
      expect(result.entry.data).toEqual(data);
      expect(result.entry.hash).toMatch(/^[a-f0-9]{64}$/);
      expect(result.entry.createdAt).toBeInstanceOf(Date);
      expect(result.proof).toBeDefined();
      expect(result.previousRoot).toBeDefined();
      expect(result.newRoot).toBeDefined();
      expect(result.newRoot).not.toBe(result.previousRoot);
    });

    test('should append multiple entries with correct positions', async () => {
      const entries = [
        { value: 'first' },
        { value: 'second' },
        { value: 'third' }
      ];

      const results = [];
      for (const data of entries) {
        const result = await service.append(ledgerId, data);
        results.push(result);
      }

      expect(results[0].entry.position).toBe(0n);
      expect(results[1].entry.position).toBe(1n);
      expect(results[2].entry.position).toBe(2n);

      // Each append should change the root
      expect(results[0].newRoot).not.toBe(results[1].newRoot);
      expect(results[1].newRoot).not.toBe(results[2].newRoot);
    });

    test('should update ledger metadata on append', async () => {
      await service.append(ledgerId, { test: 'data' });

      const metadata = await service.getLedger(ledgerId);
      expect(metadata?.entryCount).toBe(1n);
      expect(metadata?.lastEntryAt).toBeInstanceOf(Date);

      await service.append(ledgerId, { test: 'data2' });
      const updated = await service.getLedger(ledgerId);
      expect(updated?.entryCount).toBe(2n);
    });

    test('should emit entry:appended event', async () => {
      let emittedEntry: LedgerEntry | undefined;
      let emittedProof: MerkleProof | undefined;

      events.on('entry:appended', (_lid, entry, proof) => {
        emittedEntry = entry;
        emittedProof = proof;
      });

      const data = { event: 'test' };
      await service.append(ledgerId, data);

      expect(emittedEntry).toBeDefined();
      expect(emittedEntry?.data).toEqual(data);
      expect(emittedProof).toBeDefined();
    });

    test('should emit root:updated event', async () => {
      let emittedPreviousRoot: string | undefined;
      let emittedNewRoot: string | undefined;

      events.on('root:updated', (_lid, prevRoot, newRoot) => {
        emittedPreviousRoot = prevRoot;
        emittedNewRoot = newRoot;
      });

      await service.append(ledgerId, { test: 'data' });

      expect(emittedPreviousRoot).toBeDefined();
      expect(emittedNewRoot).toBeDefined();
      expect(emittedPreviousRoot).not.toBe(emittedNewRoot);
    });

    test('should include proof in appended entry', async () => {
      const result = await service.append(ledgerId, { test: 'proof' });

      expect(result.proof.leaf).toBe(result.entry.hash);
      expect(result.proof.index).toBe(Number(result.entry.position));
      expect(result.proof.root).toBe(result.newRoot);
      expect(result.proof.proof).toBeInstanceOf(Array);
      expect(result.proof.directions).toBeInstanceOf(Array);
    });
  });

  describe('Idempotency', () => {
    let ledgerId: string;

    beforeEach(async () => {
      const ledger = await service.createLedger({
        name: 'Idempotency Test'
      });
      ledgerId = ledger.id;
    });

    test('should prevent duplicate appends with same idempotency key', async () => {
      const data = { unique: 'data' };
      const idempotencyKey = 'test-key-123';

      const result1 = await service.append(ledgerId, data, { idempotencyKey });
      const result2 = await service.append(ledgerId, data, { idempotencyKey });

      // Should return the same result
      expect(result1.entry.id).toBe(result2.entry.id);
      expect(result1.entry.position).toBe(result2.entry.position);
      expect(result1.newRoot).toBe(result2.newRoot);

      // Should only have one entry in storage
      const metadata = await service.getLedger(ledgerId);
      expect(metadata?.entryCount).toBe(1n);
    });

    test('should allow different operations with different keys', async () => {
      const result1 = await service.append(
        ledgerId,
        { value: 'first' },
        { idempotencyKey: 'key-1' }
      );

      const result2 = await service.append(
        ledgerId,
        { value: 'second' },
        { idempotencyKey: 'key-2' }
      );

      expect(result1.entry.id).not.toBe(result2.entry.id);
      expect(result1.entry.position).toBe(0n);
      expect(result2.entry.position).toBe(1n);

      const metadata = await service.getLedger(ledgerId);
      expect(metadata?.entryCount).toBe(2n);
    });

    test('should allow appends without idempotency key', async () => {
      const data = { test: 'data' };

      const result1 = await service.append(ledgerId, data);
      const result2 = await service.append(ledgerId, data);

      // Without idempotency key, each append creates a new entry
      expect(result1.entry.id).not.toBe(result2.entry.id);
      expect(result1.entry.position).toBe(0n);
      expect(result2.entry.position).toBe(1n);
    });
  });

  describe('Entry Retrieval', () => {
    let ledgerId: string;
    let entryIds: string[] = [];

    beforeEach(async () => {
      const ledger = await service.createLedger({
        name: 'Retrieval Test'
      });
      ledgerId = ledger.id;

      // Add some test entries
      for (let i = 0; i < 5; i++) {
        const result = await service.append(ledgerId, { index: i });
        entryIds.push(result.entry.id);
      }
    });

    test('should get entry by ID', async () => {
      const entry = await service.getEntry(ledgerId, entryIds[2]);

      expect(entry).toBeDefined();
      expect(entry?.id).toBe(entryIds[2]);
      expect(entry?.position).toBe(2n);
      expect(entry?.data).toEqual({ index: 2 });
    });

    test('should return null for non-existent entry', async () => {
      const entry = await service.getEntry(ledgerId, 'ent_nonexistent');
      expect(entry).toBeNull();
    });

    test('should get entry by position', async () => {
      const entry = await service.getEntryByPosition(ledgerId, 3n);

      expect(entry).toBeDefined();
      expect(entry?.position).toBe(3n);
      expect(entry?.data).toEqual({ index: 3 });
    });

    test('should list entries with pagination', async () => {
      const entries = await service.listEntries(ledgerId, {
        offset: 1n,
        limit: 2
      });

      expect(entries).toHaveLength(2);
      expect(entries[0].position).toBe(1n);
      expect(entries[1].position).toBe(2n);
    });

    test('should list all entries without pagination', async () => {
      const entries = await service.listEntries(ledgerId);

      expect(entries.length).toBeGreaterThanOrEqual(5);
      // Verify order
      for (let i = 0; i < entries.length - 1; i++) {
        expect(entries[i].position < entries[i + 1].position).toBe(true);
      }
    });
  });

  describe('Proof Generation and Verification', () => {
    let ledgerId: string;

    beforeEach(async () => {
      const ledger = await service.createLedger({
        name: 'Proof Test'
      });
      ledgerId = ledger.id;

      // Add entries
      await service.append(ledgerId, { value: 'first' });
      await service.append(ledgerId, { value: 'second' });
      await service.append(ledgerId, { value: 'third' });
    });

    test('should generate proof for entry', async () => {
      const proof = await service.getProof(ledgerId, 1n);

      expect(proof).toBeDefined();
      expect(proof?.index).toBe(1);
      expect(proof?.leaf).toMatch(/^[a-f0-9]{64}$/);
      expect(proof?.root).toMatch(/^[a-f0-9]{64}$/);
      expect(proof?.proof).toBeInstanceOf(Array);
      expect(proof?.directions).toBeInstanceOf(Array);
    });

    test('should return null for invalid position', async () => {
      const proof = await service.getProof(ledgerId, 999n);
      expect(proof).toBeNull();
    });

    test('should verify valid proof', async () => {
      const proof = await service.getProof(ledgerId, 0n);
      expect(proof).toBeDefined();

      const isValid = await service.verifyProof(ledgerId, proof!);
      expect(isValid).toBe(true);
    });

    test('should reject proof with tampered leaf', async () => {
      const proof = await service.getProof(ledgerId, 0n);
      expect(proof).toBeDefined();

      // Tamper with the proof
      const tamperedProof = {
        ...proof!,
        leaf: 'a'.repeat(64) // Invalid leaf hash
      };

      const isValid = await service.verifyProof(ledgerId, tamperedProof);
      expect(isValid).toBe(false);
    });

    test('should reject proof with wrong root', async () => {
      const proof = await service.getProof(ledgerId, 0n);
      expect(proof).toBeDefined();

      // Tamper with root
      const tamperedProof = {
        ...proof!,
        root: 'b'.repeat(64)
      };

      const isValid = await service.verifyProof(ledgerId, tamperedProof);
      expect(isValid).toBe(false);
    });
  });

  describe('Tree Reconstruction', () => {
    test('should reconstruct tree from storage', async () => {
      const ledger = await service.createLedger({
        name: 'Reconstruction Test'
      });

      // Add some entries
      const entries = [];
      for (let i = 0; i < 10; i++) {
        const result = await service.append(ledger.id, { value: i });
        entries.push(result);
      }

      const rootBeforeReconstruction = await service.getRootHash(ledger.id);

      // Reconstruct tree
      const tree = await service.reconstructTree(ledger.id);

      expect(tree.size).toBe(10);
      expect(tree.root).toBe(rootBeforeReconstruction);

      // Verify proofs still work
      const proof = tree.getProof(5);
      expect(MerkleTree.verify(proof)).toBe(true);
    });

    test('should throw on root hash mismatch', async () => {
      const ledger = await service.createLedger({
        name: 'Mismatch Test'
      });

      await service.append(ledger.id, { test: 'data' });

      // Corrupt the metadata root
      await storage.updateLedgerMetadata(ledger.id, {
        rootHash: 'a'.repeat(64)
      });

      await expect(service.reconstructTree(ledger.id)).rejects.toThrow(
        /root mismatch/
      );
    });

    test('should auto-reconstruct tree when not in memory', async () => {
      const ledger = await service.createLedger({
        name: 'Auto Reconstruct'
      });

      await service.append(ledger.id, { value: 'test' });

      // Create new service instance (trees not in memory)
      const newService = new LedgerService(storage);

      // Getting proof should trigger reconstruction
      const proof = await newService.getProof(ledger.id, 0n);
      expect(proof).toBeDefined();
      expect(proof?.index).toBe(0);

      newService.destroy();
    });
  });

  describe('Statistics', () => {
    test('should get ledger statistics', async () => {
      const ledger = await service.createLedger({
        name: 'Stats Test'
      });

      await service.append(ledger.id, { value: 1 });
      await service.append(ledger.id, { value: 2 });

      const stats = await service.getStats(ledger.id);

      expect(stats).toBeDefined();
      expect(stats?.entryCount).toBe(2n);
      expect(stats?.treeSize).toBe(2);
      expect(stats?.rootHash).toMatch(/^[a-f0-9]{64}$/);
      expect(stats?.createdAt).toBeInstanceOf(Date);
      expect(stats?.lastEntryAt).toBeInstanceOf(Date);
    });

    test('should return null for non-existent ledger', async () => {
      const stats = await service.getStats('ledger_nonexistent');
      expect(stats).toBeNull();
    });
  });

  describe('Error Handling', () => {
    test('should emit error event on append failure', async () => {
      let emittedError: Error | undefined;
      events.on('error', (error) => {
        emittedError = error;
      });

      // Try to append to non-existent ledger
      await expect(
        service.append('ledger_nonexistent', { test: 'data' })
      ).rejects.toThrow();

      expect(emittedError).toBeDefined();
    });

    test('should rollback tree on storage failure', async () => {
      const ledger = await service.createLedger({
        name: 'Rollback Test'
      });

      await service.append(ledger.id, { value: 'first' });

      // Mock storage failure
      const originalPut = storage.put.bind(storage);
      storage.put = async () => {
        throw new Error('Storage failure');
      };

      await expect(
        service.append(ledger.id, { value: 'second' })
      ).rejects.toThrow('Storage failure');

      // Restore storage
      storage.put = originalPut;

      // Next append should work and use correct position
      const result = await service.append(ledger.id, { value: 'third' });
      expect(result.entry.position).toBe(1n); // Not 2, because previous failed
    });
  });

  describe('IdempotencyService Integration', () => {
    test('should use custom idempotency service', async () => {
      const customIdempotency = new IdempotencyService(1000); // 1 second TTL
      const customService = new LedgerService(storage, {
        idempotencyService: customIdempotency
      });

      const ledger = await customService.createLedger({
        name: 'Custom Idempotency'
      });

      await customService.append(
        ledger.id,
        { test: 'data' },
        { idempotencyKey: 'custom-key' }
      );

      const stats = customIdempotency.getStats();
      expect(stats.activeKeys).toBe(1);

      customService.destroy();
      customIdempotency.destroy();
    });
  });

  describe('Resource Cleanup', () => {
    test('should cleanup resources on destroy', () => {
      const service = new LedgerService(storage);

      // Verify service can be destroyed without errors
      expect(() => service.destroy()).not.toThrow();
    });
  });
});
