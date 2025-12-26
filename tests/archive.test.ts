/**
 * VeilChain Archive (Soft Delete) Tests
 *
 * Tests for the ledger archive/unarchive functionality.
 */

import { MemoryStorage } from '../src/storage/memory.js';
import type { LedgerMetadata } from '../src/types.js';

describe('Ledger Archive (Soft Delete)', () => {
  let storage: MemoryStorage;

  beforeEach(async () => {
    storage = new MemoryStorage();
  });

  describe('archiveLedger', () => {
    it('should archive an active ledger', async () => {
      // Create a ledger
      const metadata: LedgerMetadata = {
        id: 'ledger_test_1',
        name: 'Test Ledger',
        description: 'Test description',
        createdAt: new Date(),
        rootHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        entryCount: 0n
      };
      await storage.createLedgerMetadata(metadata);

      // Archive it
      await storage.archiveLedger('ledger_test_1');

      // Verify it's archived
      const archived = await storage.getLedgerMetadata('ledger_test_1');
      expect(archived).not.toBeNull();
      expect(archived!.archivedAt).toBeDefined();
      expect(archived!.archivedAt).toBeInstanceOf(Date);
    });

    it('should throw error when archiving non-existent ledger', async () => {
      await expect(storage.archiveLedger('non_existent'))
        .rejects.toThrow('not found');
    });

    it('should throw error when archiving already archived ledger', async () => {
      const metadata: LedgerMetadata = {
        id: 'ledger_test_2',
        name: 'Test Ledger 2',
        createdAt: new Date(),
        rootHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        entryCount: 0n
      };
      await storage.createLedgerMetadata(metadata);
      await storage.archiveLedger('ledger_test_2');

      await expect(storage.archiveLedger('ledger_test_2'))
        .rejects.toThrow('already archived');
    });
  });

  describe('unarchiveLedger', () => {
    it('should unarchive an archived ledger', async () => {
      // Create and archive a ledger
      const metadata: LedgerMetadata = {
        id: 'ledger_test_3',
        name: 'Test Ledger 3',
        createdAt: new Date(),
        rootHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        entryCount: 0n
      };
      await storage.createLedgerMetadata(metadata);
      await storage.archiveLedger('ledger_test_3');

      // Unarchive it
      await storage.unarchiveLedger('ledger_test_3');

      // Verify it's restored
      const restored = await storage.getLedgerMetadata('ledger_test_3');
      expect(restored).not.toBeNull();
      expect(restored!.archivedAt).toBeUndefined();
    });

    it('should throw error when unarchiving non-existent ledger', async () => {
      await expect(storage.unarchiveLedger('non_existent'))
        .rejects.toThrow('not found');
    });

    it('should throw error when unarchiving active ledger', async () => {
      const metadata: LedgerMetadata = {
        id: 'ledger_test_4',
        name: 'Test Ledger 4',
        createdAt: new Date(),
        rootHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        entryCount: 0n
      };
      await storage.createLedgerMetadata(metadata);

      await expect(storage.unarchiveLedger('ledger_test_4'))
        .rejects.toThrow('not archived');
    });
  });

  describe('listLedgers with archive filter', () => {
    beforeEach(async () => {
      // Create multiple ledgers
      for (let i = 1; i <= 5; i++) {
        const metadata: LedgerMetadata = {
          id: `ledger_list_${i}`,
          name: `Test Ledger ${i}`,
          createdAt: new Date(Date.now() - i * 1000), // Different timestamps
          rootHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          entryCount: 0n
        };
        await storage.createLedgerMetadata(metadata);
      }

      // Archive ledgers 2 and 4
      await storage.archiveLedger('ledger_list_2');
      await storage.archiveLedger('ledger_list_4');
    });

    it('should exclude archived ledgers by default', async () => {
      const ledgers = await storage.listLedgers();
      expect(ledgers).toHaveLength(3);
      expect(ledgers.map(l => l.id)).not.toContain('ledger_list_2');
      expect(ledgers.map(l => l.id)).not.toContain('ledger_list_4');
    });

    it('should include archived ledgers when requested', async () => {
      const ledgers = await storage.listLedgers({ includeArchived: true });
      expect(ledgers).toHaveLength(5);
    });

    it('should paginate correctly with archive filter', async () => {
      const page1 = await storage.listLedgers({ limit: 2 });
      expect(page1).toHaveLength(2);

      const page2 = await storage.listLedgers({ limit: 2, offset: 2 });
      expect(page2).toHaveLength(1);
    });
  });
});
