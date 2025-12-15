/**
 * Batch Proof Tests
 *
 * Tests for efficient batch proof generation and verification
 */

import { MerkleTree } from '../src/core/merkle.js';
import { sha256 } from '../src/core/hash.js';
import {
  generateBatchProof,
  verifyBatchProof,
  getBatchProofStats
} from '../src/core/batch-proof.js';

describe('Batch Proof Generation', () => {
  let tree: MerkleTree;
  const testData = ['entry1', 'entry2', 'entry3', 'entry4', 'entry5', 'entry6', 'entry7', 'entry8'];
  const testHashes = testData.map(d => sha256(d));

  beforeEach(() => {
    tree = new MerkleTree();
    testHashes.forEach(hash => tree.append(hash));
  });

  describe('generateBatchProof', () => {
    test('should generate batch proof for multiple entries', () => {
      const indices = [0, 2, 5];
      const batchProof = generateBatchProof(tree, indices);

      expect(batchProof.leaves).toHaveLength(3);
      expect(batchProof.indices).toEqual(indices);
      expect(batchProof.root).toBe(tree.root);
      expect(batchProof.proof.length).toBeGreaterThan(0);
    });

    test('should generate proof for single entry', () => {
      const indices = [3];
      const batchProof = generateBatchProof(tree, indices);

      expect(batchProof.leaves).toHaveLength(1);
      expect(batchProof.indices).toEqual(indices);
      expect(batchProof.leaves[0]).toBe(testHashes[3]);
    });

    test('should generate proof for all entries', () => {
      const indices = [0, 1, 2, 3, 4, 5, 6, 7];
      const batchProof = generateBatchProof(tree, indices);

      expect(batchProof.leaves).toHaveLength(8);
      expect(batchProof.indices).toEqual(indices);
      expect(batchProof.root).toBe(tree.root);
    });

    test('should sort indices automatically', () => {
      const indices = [5, 1, 3];
      const batchProof = generateBatchProof(tree, indices);

      expect(batchProof.indices).toEqual([1, 3, 5]);
      expect(batchProof.leaves[0]).toBe(testHashes[1]);
      expect(batchProof.leaves[1]).toBe(testHashes[3]);
      expect(batchProof.leaves[2]).toBe(testHashes[5]);
    });

    test('should throw error for empty indices', () => {
      expect(() => generateBatchProof(tree, [])).toThrow(
        'Cannot generate batch proof for empty indices array'
      );
    });

    test('should throw error for out of bounds index', () => {
      expect(() => generateBatchProof(tree, [0, 99])).toThrow('out of bounds');
    });

    test('should throw error for negative index', () => {
      expect(() => generateBatchProof(tree, [0, -1])).toThrow('out of bounds');
    });

    test('should throw error for duplicate indices', () => {
      expect(() => generateBatchProof(tree, [1, 2, 1])).toThrow('Duplicate index');
    });

    test('should optimize proof with shared nodes', () => {
      const indices = [0, 1]; // Adjacent entries share many proof nodes
      const batchProof = generateBatchProof(tree, indices);
      const stats = getBatchProofStats(batchProof);

      // Batch proof should use fewer nodes than individual proofs
      expect(stats.sharedProofNodes).toBeLessThan(stats.individualProofNodes);
    });
  });

  describe('verifyBatchProof', () => {
    test('should verify valid batch proof', () => {
      const indices = [0, 3, 7];
      const batchProof = generateBatchProof(tree, indices);
      const isValid = verifyBatchProof(batchProof);

      expect(isValid).toBe(true);
    });

    test('should verify single entry batch proof', () => {
      const indices = [4];
      const batchProof = generateBatchProof(tree, indices);
      const isValid = verifyBatchProof(batchProof);

      expect(isValid).toBe(true);
    });

    test('should verify batch proof for all entries', () => {
      const indices = [0, 1, 2, 3, 4, 5, 6, 7];
      const batchProof = generateBatchProof(tree, indices);
      const isValid = verifyBatchProof(batchProof);

      expect(isValid).toBe(true);
    });

    test('should reject proof with tampered leaf', () => {
      const indices = [0, 2];
      const batchProof = generateBatchProof(tree, indices);

      // Tamper with a leaf
      batchProof.leaves[0] = sha256('tampered');

      const isValid = verifyBatchProof(batchProof);
      expect(isValid).toBe(false);
    });

    test('should reject proof with tampered root', () => {
      const indices = [0, 2];
      const batchProof = generateBatchProof(tree, indices);

      // Tamper with root
      batchProof.root = sha256('tampered');

      const isValid = verifyBatchProof(batchProof);
      expect(isValid).toBe(false);
    });

    test('should reject proof with tampered proof node', () => {
      const indices = [0, 2];
      const batchProof = generateBatchProof(tree, indices);

      // Tamper with a proof node
      if (batchProof.proof.length > 0) {
        batchProof.proof[0] = sha256('tampered');
      }

      const isValid = verifyBatchProof(batchProof);
      expect(isValid).toBe(false);
    });

    test('should reject proof with mismatched array lengths', () => {
      const indices = [0, 2];
      const batchProof = generateBatchProof(tree, indices);

      // Remove a leaf but keep indices
      batchProof.leaves.pop();

      const isValid = verifyBatchProof(batchProof);
      expect(isValid).toBe(false);
    });

    test('should reject proof with corrupted proof map', () => {
      const indices = [0, 2];
      const batchProof = generateBatchProof(tree, indices);

      // Corrupt proof map
      if (batchProof.proofMap.length > 0 && batchProof.proofMap[0].length > 0) {
        batchProof.proofMap[0][0] = 999; // Invalid proof index
      }

      const isValid = verifyBatchProof(batchProof);
      expect(isValid).toBe(false);
    });
  });

  describe('getBatchProofStats', () => {
    test('should calculate stats for batch proof', () => {
      const indices = [0, 1, 2];
      const batchProof = generateBatchProof(tree, indices);
      const stats = getBatchProofStats(batchProof);

      expect(stats.numEntries).toBe(3);
      expect(stats.sharedProofNodes).toBeGreaterThan(0);
      expect(stats.individualProofNodes).toBeGreaterThan(0);
      expect(stats.spaceSavingsPercent).toBeGreaterThanOrEqual(0);
    });

    test('should show space savings for adjacent entries', () => {
      const indices = [0, 1, 2, 3];
      const batchProof = generateBatchProof(tree, indices);
      const stats = getBatchProofStats(batchProof);

      // Adjacent entries should have significant space savings
      expect(stats.spaceSavingsPercent).toBeGreaterThan(0);
      expect(stats.sharedProofNodes).toBeLessThan(stats.individualProofNodes);
    });

    test('should show stats for single entry', () => {
      const indices = [5];
      const batchProof = generateBatchProof(tree, indices);
      const stats = getBatchProofStats(batchProof);

      expect(stats.numEntries).toBe(1);
      expect(stats.sharedProofNodes).toBe(stats.individualProofNodes);
      expect(stats.spaceSavingsPercent).toBe(0);
    });
  });

  describe('Performance and Edge Cases', () => {
    test('should handle large batch efficiently', () => {
      const largeBatch = Array.from({ length: 8 }, (_, i) => i);
      const start = Date.now();
      const batchProof = generateBatchProof(tree, largeBatch);
      const duration = Date.now() - start;

      expect(batchProof.leaves).toHaveLength(8);
      expect(duration).toBeLessThan(100); // Should be fast
    });

    test('should work with power-of-two tree size', () => {
      const indices = [0, 3, 7];
      const batchProof = generateBatchProof(tree, indices);

      expect(verifyBatchProof(batchProof)).toBe(true);
    });

    test('should work with non-power-of-two tree size', () => {
      const oddTree = new MerkleTree();
      const oddHashes = ['a', 'b', 'c', 'd', 'e'].map(d => sha256(d));
      oddHashes.forEach(hash => oddTree.append(hash));

      const indices = [0, 2, 4];
      const batchProof = generateBatchProof(oddTree, indices);

      expect(verifyBatchProof(batchProof)).toBe(true);
    });

    test('should maintain consistency across tree modifications', () => {
      const indices = [0, 2];
      const batchProof1 = generateBatchProof(tree, indices);

      // Add more entries
      tree.append(sha256('new1'));
      tree.append(sha256('new2'));

      // Old proof should still verify against old root
      expect(verifyBatchProof(batchProof1)).toBe(true);

      // But won't verify against new root
      const batchProof2 = generateBatchProof(tree, indices);
      expect(batchProof2.root).not.toBe(batchProof1.root);
    });
  });
});
