/**
 * Consistency Proof Tests
 *
 * Tests for proving that a Merkle tree is append-only
 */

import { MerkleTree } from '../src/core/merkle.js';
import { sha256 } from '../src/core/hash.js';
import {
  generateConsistencyProof,
  verifyConsistencyProof,
  verifyTreeConsistency,
  describeConsistencyProof
} from '../src/core/consistency.js';

describe('Consistency Proof Generation', () => {
  let tree: MerkleTree;
  const testData = ['entry1', 'entry2', 'entry3', 'entry4', 'entry5', 'entry6', 'entry7', 'entry8'];
  const testHashes = testData.map(d => sha256(d));

  beforeEach(() => {
    tree = new MerkleTree();
  });

  describe('generateConsistencyProof', () => {
    test('should generate proof for append-only tree', () => {
      // Build initial tree
      tree.append(testHashes[0]);
      tree.append(testHashes[1]);
      const oldRoot = tree.root;
      const oldSize = tree.size;

      // Append more entries
      tree.append(testHashes[2]);
      tree.append(testHashes[3]);

      const proof = generateConsistencyProof(oldRoot, oldSize, tree);

      expect(proof.oldRoot).toBe(oldRoot);
      expect(proof.oldSize).toBe(oldSize);
      expect(proof.newRoot).toBe(tree.root);
      expect(proof.newSize).toBe(tree.size);
      expect(proof.proof.length).toBeGreaterThan(0);
    });

    test('should generate proof for empty old tree', () => {
      tree.append(testHashes[0]);
      tree.append(testHashes[1]);

      const proof = generateConsistencyProof('', 0, tree);

      expect(proof.oldSize).toBe(0);
      expect(proof.newSize).toBe(2);
      expect(proof.proof).toEqual([]);
    });

    test('should generate proof for same-size trees', () => {
      tree.append(testHashes[0]);
      tree.append(testHashes[1]);
      const root = tree.root;
      const size = tree.size;

      const proof = generateConsistencyProof(root, size, tree);

      expect(proof.oldRoot).toBe(root);
      expect(proof.newRoot).toBe(root);
      expect(proof.oldSize).toBe(size);
      expect(proof.newSize).toBe(size);
    });

    test('should throw error if old size exceeds new size', () => {
      tree.append(testHashes[0]);
      const oldRoot = tree.root;

      expect(() => generateConsistencyProof(oldRoot, 5, tree)).toThrow(
        'cannot be greater than new size'
      );
    });

    test('should throw error for negative old size', () => {
      tree.append(testHashes[0]);

      expect(() => generateConsistencyProof('', -1, tree)).toThrow(
        'Old size cannot be negative'
      );
    });

    test('should throw error if tree was modified', () => {
      tree.append(testHashes[0]);
      tree.append(testHashes[1]);
      const oldRoot = tree.root;
      const oldSize = tree.size;

      // Create new tree with different history
      const modifiedTree = new MerkleTree();
      modifiedTree.append(testHashes[2]); // Different first entry!
      modifiedTree.append(testHashes[3]);
      modifiedTree.append(testHashes[4]);
      modifiedTree.append(testHashes[5]);

      expect(() => generateConsistencyProof(oldRoot, oldSize, modifiedTree)).toThrow(
        'modified, not just appended'
      );
    });

    test('should handle single entry trees', () => {
      tree.append(testHashes[0]);
      const oldRoot = tree.root;
      const oldSize = tree.size;

      tree.append(testHashes[1]);

      const proof = generateConsistencyProof(oldRoot, oldSize, tree);

      expect(proof.oldSize).toBe(1);
      expect(proof.newSize).toBe(2);
      expect(verifyConsistencyProof(proof)).toBe(true);
    });
  });

  describe('verifyConsistencyProof', () => {
    test('should verify valid consistency proof', () => {
      tree.append(testHashes[0]);
      tree.append(testHashes[1]);
      const oldRoot = tree.root;
      const oldSize = tree.size;

      tree.append(testHashes[2]);
      tree.append(testHashes[3]);

      const proof = generateConsistencyProof(oldRoot, oldSize, tree);
      const isValid = verifyConsistencyProof(proof);

      expect(isValid).toBe(true);
    });

    test('should verify proof for empty old tree', () => {
      tree.append(testHashes[0]);

      const proof = generateConsistencyProof('', 0, tree);
      const isValid = verifyConsistencyProof(proof);

      expect(isValid).toBe(true);
    });

    test('should verify proof for same-size trees', () => {
      tree.append(testHashes[0]);
      tree.append(testHashes[1]);
      const root = tree.root;
      const size = tree.size;

      const proof = generateConsistencyProof(root, size, tree);
      const isValid = verifyConsistencyProof(proof);

      expect(isValid).toBe(true);
    });

    test('should reject proof with negative old size', () => {
      tree.append(testHashes[0]);
      const proof = generateConsistencyProof('', 0, tree);
      proof.oldSize = -1;

      const isValid = verifyConsistencyProof(proof);
      expect(isValid).toBe(false);
    });

    test('should reject proof where old size exceeds new size', () => {
      tree.append(testHashes[0]);
      tree.append(testHashes[1]);
      const oldRoot = tree.root;

      tree.append(testHashes[2]);
      const proof = generateConsistencyProof(oldRoot, 2, tree);

      // Tamper with sizes
      proof.oldSize = 10;
      proof.newSize = 5;

      const isValid = verifyConsistencyProof(proof);
      expect(isValid).toBe(false);
    });

    test('should reject proof with tampered old root', () => {
      tree.append(testHashes[0]);
      const oldRoot = tree.root;

      tree.append(testHashes[1]);
      const proof = generateConsistencyProof(oldRoot, 1, tree);

      // Tamper with old root
      proof.oldRoot = sha256('tampered');

      const isValid = verifyConsistencyProof(proof);
      expect(isValid).toBe(false);
    });

    test('should reject proof with tampered new root', () => {
      tree.append(testHashes[0]);
      const oldRoot = tree.root;

      tree.append(testHashes[1]);
      const proof = generateConsistencyProof(oldRoot, 1, tree);

      // Tamper with new root
      proof.newRoot = sha256('tampered');

      const isValid = verifyConsistencyProof(proof);
      expect(isValid).toBe(false);
    });

    test('should reject proof with missing roots in proof array', () => {
      tree.append(testHashes[0]);
      const oldRoot = tree.root;

      tree.append(testHashes[1]);
      const proof = generateConsistencyProof(oldRoot, 1, tree);

      // Remove roots from proof
      proof.proof = [];

      const isValid = verifyConsistencyProof(proof);
      expect(isValid).toBe(false);
    });
  });

  describe('verifyTreeConsistency', () => {
    test('should verify consistent tree states', () => {
      tree.append(testHashes[0]);
      tree.append(testHashes[1]);
      const oldRoot = tree.root;
      const oldSize = tree.size;

      tree.append(testHashes[2]);
      tree.append(testHashes[3]);
      const newRoot = tree.root;
      const newSize = tree.size;

      const isValid = verifyTreeConsistency(oldRoot, oldSize, newRoot, newSize, tree);
      expect(isValid).toBe(true);
    });

    test('should reject if current tree does not match new state', () => {
      tree.append(testHashes[0]);
      const oldRoot = tree.root;
      const oldSize = tree.size;

      tree.append(testHashes[1]);
      const newRoot = sha256('wrong'); // Wrong root
      const newSize = tree.size;

      const isValid = verifyTreeConsistency(oldRoot, oldSize, newRoot, newSize, tree);
      expect(isValid).toBe(false);
    });

    test('should reject if tree was modified not appended', () => {
      tree.append(testHashes[0]);
      const oldRoot = tree.root;
      const oldSize = tree.size;

      const modifiedTree = new MerkleTree();
      modifiedTree.append(testHashes[1]); // Different history

      const isValid = verifyTreeConsistency(
        oldRoot,
        oldSize,
        modifiedTree.root,
        modifiedTree.size,
        modifiedTree
      );
      expect(isValid).toBe(false);
    });
  });

  describe('describeConsistencyProof', () => {
    test('should generate human-readable description', () => {
      tree.append(testHashes[0]);
      tree.append(testHashes[1]);
      const oldRoot = tree.root;
      const oldSize = tree.size;

      tree.append(testHashes[2]);

      const proof = generateConsistencyProof(oldRoot, oldSize, tree);
      const description = describeConsistencyProof(proof);

      expect(description).toContain('Consistency Proof');
      expect(description).toContain(oldRoot);
      expect(description).toContain(tree.root);
      expect(description).toContain('2 entries'); // old size
      expect(description).toContain('3 entries'); // new size
      expect(description).toContain('VALID');
    });

    test('should show invalid for tampered proof', () => {
      tree.append(testHashes[0]);
      const oldRoot = tree.root;

      tree.append(testHashes[1]);
      const proof = generateConsistencyProof(oldRoot, 1, tree);

      // Tamper with proof
      proof.newRoot = sha256('tampered');

      const description = describeConsistencyProof(proof);
      expect(description).toContain('INVALID');
    });
  });

  describe('Real-world Scenarios', () => {
    test('should prove append-only ledger growth', () => {
      // Initial ledger state
      tree.append(testHashes[0]);
      tree.append(testHashes[1]);
      tree.append(testHashes[2]);
      const snapshot1Root = tree.root;
      const snapshot1Size = tree.size;

      // Daily append operations
      tree.append(testHashes[3]);
      tree.append(testHashes[4]);
      const snapshot2Root = tree.root;
      const snapshot2Size = tree.size;

      // More append operations
      tree.append(testHashes[5]);
      tree.append(testHashes[6]);
      tree.append(testHashes[7]);

      // Verify consistency between snapshots
      const proof1to2 = generateConsistencyProof(snapshot1Root, snapshot1Size, tree);
      const proof2to3 = generateConsistencyProof(snapshot2Root, snapshot2Size, tree);

      expect(verifyConsistencyProof(proof1to2)).toBe(true);
      expect(verifyConsistencyProof(proof2to3)).toBe(true);
    });

    test('should detect unauthorized modifications', () => {
      // Original ledger
      const originalTree = new MerkleTree();
      originalTree.append(testHashes[0]);
      originalTree.append(testHashes[1]);
      const originalRoot = originalTree.root;
      const originalSize = originalTree.size;

      // Attacker tries to modify history
      const attackerTree = new MerkleTree();
      attackerTree.append(sha256('modified')); // Changed first entry!
      attackerTree.append(testHashes[1]);
      attackerTree.append(testHashes[2]); // Added new entry to make size different

      // Consistency proof should fail
      expect(() => {
        generateConsistencyProof(originalRoot, originalSize, attackerTree);
      }).toThrow('modified, not just appended');
    });

    test('should handle multiple incremental proofs', () => {
      const snapshots: Array<{ root: string; size: number }> = [];

      // Take snapshots at different sizes
      for (let i = 0; i < testHashes.length; i++) {
        tree.append(testHashes[i]);
        snapshots.push({ root: tree.root, size: tree.size });
      }

      // Verify consistency between all snapshots
      for (let i = 0; i < snapshots.length - 1; i++) {
        const oldSnapshot = snapshots[i];
        const proof = generateConsistencyProof(oldSnapshot.root, oldSnapshot.size, tree);

        expect(verifyConsistencyProof(proof)).toBe(true);
        expect(proof.oldSize).toBe(oldSnapshot.size);
        expect(proof.newSize).toBe(tree.size);
      }
    });
  });
});
