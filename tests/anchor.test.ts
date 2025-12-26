/**
 * VeilChain Anchor Service Tests
 *
 * Tests for the external anchoring functionality.
 */

import { createAnchorService } from '../src/services/anchor.js';
import type { AnchorService } from '../src/services/anchor.js';

describe('Anchor Service', () => {
  let anchorService: AnchorService;

  beforeEach(() => {
    anchorService = createAnchorService(); // Creates memory service when no pool
  });

  describe('createAnchor', () => {
    it('should create a pending anchor', async () => {
      const anchor = await anchorService.createAnchor({
        ledgerId: 'ledger_test_1',
        rootHash: 'abc123def456',
        entryCount: 100n,
        anchorType: 'bitcoin'
      });

      expect(anchor.id).toMatch(/^anchor_/);
      expect(anchor.ledgerId).toBe('ledger_test_1');
      expect(anchor.rootHash).toBe('abc123def456');
      expect(anchor.entryCount).toBe(100n);
      expect(anchor.anchorType).toBe('bitcoin');
      expect(anchor.status).toBe('pending');
      expect(anchor.createdAt).toBeInstanceOf(Date);
    });

    it('should create anchors for different types', async () => {
      const types = ['bitcoin', 'ethereum', 'opentimestamps', 'rfc3161'] as const;

      for (const type of types) {
        const anchor = await anchorService.createAnchor({
          ledgerId: 'ledger_test_2',
          rootHash: 'hash123',
          entryCount: 50n,
          anchorType: type
        });

        expect(anchor.anchorType).toBe(type);
      }
    });
  });

  describe('getAnchor', () => {
    it('should retrieve an existing anchor', async () => {
      const created = await anchorService.createAnchor({
        ledgerId: 'ledger_test_3',
        rootHash: 'hash456',
        entryCount: 25n,
        anchorType: 'ethereum'
      });

      const retrieved = await anchorService.getAnchor(created.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(created.id);
      expect(retrieved!.ledgerId).toBe('ledger_test_3');
    });

    it('should return null for non-existent anchor', async () => {
      const result = await anchorService.getAnchor('non_existent_id');
      expect(result).toBeNull();
    });
  });

  describe('listAnchors', () => {
    beforeEach(async () => {
      // Create multiple anchors
      await anchorService.createAnchor({
        ledgerId: 'ledger_list_1',
        rootHash: 'hash1',
        entryCount: 10n,
        anchorType: 'bitcoin'
      });
      await anchorService.createAnchor({
        ledgerId: 'ledger_list_1',
        rootHash: 'hash2',
        entryCount: 20n,
        anchorType: 'ethereum'
      });
      await anchorService.createAnchor({
        ledgerId: 'ledger_list_1',
        rootHash: 'hash3',
        entryCount: 30n,
        anchorType: 'bitcoin'
      });
      await anchorService.createAnchor({
        ledgerId: 'ledger_list_2',
        rootHash: 'hash4',
        entryCount: 40n,
        anchorType: 'bitcoin'
      });
    });

    it('should list anchors for a specific ledger', async () => {
      const result = await anchorService.listAnchors('ledger_list_1');
      expect(result.anchors).toHaveLength(3);
      expect(result.total).toBe(3);
    });

    it('should filter by anchor type', async () => {
      const result = await anchorService.listAnchors('ledger_list_1', {
        anchorType: 'bitcoin'
      });
      expect(result.anchors).toHaveLength(2);
      expect(result.anchors.every(a => a.anchorType === 'bitcoin')).toBe(true);
    });

    it('should filter by status', async () => {
      const result = await anchorService.listAnchors('ledger_list_1', {
        status: 'pending'
      });
      expect(result.anchors).toHaveLength(3);
      expect(result.anchors.every(a => a.status === 'pending')).toBe(true);
    });

    it('should return empty for non-existent ledger', async () => {
      const result = await anchorService.listAnchors('non_existent');
      expect(result.anchors).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should paginate results', async () => {
      const page1 = await anchorService.listAnchors('ledger_list_1', { limit: 2 });
      expect(page1.anchors).toHaveLength(2);

      const page2 = await anchorService.listAnchors('ledger_list_1', {
        limit: 2,
        offset: 2
      });
      expect(page2.anchors).toHaveLength(1);
    });
  });

  describe('updateAnchorStatus', () => {
    it('should update anchor to confirmed status', async () => {
      const anchor = await anchorService.createAnchor({
        ledgerId: 'ledger_update_1',
        rootHash: 'hash_update',
        entryCount: 100n,
        anchorType: 'bitcoin'
      });

      await anchorService.updateAnchorStatus(anchor.id, {
        status: 'confirmed',
        externalTxId: 'btc_tx_123',
        externalBlockHeight: 800000,
        externalBlockHash: 'block_hash_456',
        externalTimestamp: new Date(),
        proofData: { merkleRoot: 'proof_root' }
      });

      const updated = await anchorService.getAnchor(anchor.id);
      expect(updated!.status).toBe('confirmed');
      expect(updated!.externalTxId).toBe('btc_tx_123');
      expect(updated!.externalBlockHeight).toBe(800000);
      expect(updated!.confirmedAt).toBeInstanceOf(Date);
    });

    it('should update anchor to failed status', async () => {
      const anchor = await anchorService.createAnchor({
        ledgerId: 'ledger_update_2',
        rootHash: 'hash_fail',
        entryCount: 50n,
        anchorType: 'ethereum'
      });

      await anchorService.updateAnchorStatus(anchor.id, {
        status: 'failed',
        errorMessage: 'Transaction failed: insufficient gas'
      });

      const updated = await anchorService.getAnchor(anchor.id);
      expect(updated!.status).toBe('failed');
      expect(updated!.errorMessage).toBe('Transaction failed: insufficient gas');
    });
  });

  describe('getPendingAnchors', () => {
    it('should return only pending anchors', async () => {
      // Create some anchors
      const anchor1 = await anchorService.createAnchor({
        ledgerId: 'ledger_pending_1',
        rootHash: 'hash_p1',
        entryCount: 10n,
        anchorType: 'bitcoin'
      });
      await anchorService.createAnchor({
        ledgerId: 'ledger_pending_2',
        rootHash: 'hash_p2',
        entryCount: 20n,
        anchorType: 'ethereum'
      });

      // Confirm one of them
      await anchorService.updateAnchorStatus(anchor1.id, {
        status: 'confirmed',
        externalTxId: 'tx_123'
      });

      const pending = await anchorService.getPendingAnchors();
      expect(pending).toHaveLength(1);
      expect(pending[0].ledgerId).toBe('ledger_pending_2');
    });

    it('should respect limit parameter', async () => {
      // Create multiple pending anchors
      for (let i = 0; i < 5; i++) {
        await anchorService.createAnchor({
          ledgerId: `ledger_limit_${i}`,
          rootHash: `hash_${i}`,
          entryCount: BigInt(i * 10),
          anchorType: 'bitcoin'
        });
      }

      const pending = await anchorService.getPendingAnchors(3);
      expect(pending).toHaveLength(3);
    });
  });
});
