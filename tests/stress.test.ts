/**
 * Stress Tests
 *
 * Tests for system behavior under heavy load and extreme conditions.
 */

import { MerkleTree } from '../src/core/merkle';
import { sha256 } from '../src/core/hash';

describe('Stress Tests', () => {
  describe('Large Tree Operations', () => {
    it('should build tree with 1000 entries', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 1000; i++) tree.append(sha256(`e${i}`));
      expect(tree.size).toBe(1000);
    });

    it('should build tree with 5000 entries', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 5000; i++) tree.append(sha256(`e${i}`));
      expect(tree.size).toBe(5000);
    });

    it('should verify proof in 5000-entry tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 5000; i++) tree.append(sha256(`e${i}`));
      expect(MerkleTree.verify(tree.getProof(2500)!)).toBe(true);
    });

    it('should get leaves from large tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 1000; i++) tree.append(sha256(`e${i}`));
      expect(tree.getLeaves().length).toBe(1000);
    });

    it('should verify all proofs in 500-entry tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 500; i++) tree.append(sha256(`e${i}`));
      for (let i = 0; i < 500; i++) {
        expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
      }
    });
  });

  describe('Rapid Operations', () => {
    it('should handle 1000 sequential appends', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 1000; i++) {
        const idx = tree.append(sha256(`rapid${i}`));
        expect(idx).toBe(i);
      }
    });

    it('should handle 1000 proof generations', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 100; i++) tree.append(sha256(`e${i}`));
      for (let i = 0; i < 1000; i++) {
        const proof = tree.getProof(i % 100);
        expect(proof).not.toBeNull();
      }
    });

    it('should handle 1000 verifications', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 100; i++) tree.append(sha256(`e${i}`));
      const proofs = Array.from({ length: 100 }, (_, i) => tree.getProof(i)!);
      for (let i = 0; i < 1000; i++) {
        expect(MerkleTree.verify(proofs[i % 100])).toBe(true);
      }
    });

    it('should handle 1000 getLeaves calls', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 50; i++) tree.append(sha256(`e${i}`));
      for (let i = 0; i < 1000; i++) {
        expect(tree.getLeaves().length).toBe(50);
      }
    });

    it('should handle 1000 root accesses', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 50; i++) tree.append(sha256(`e${i}`));
      const expectedRoot = tree.root;
      for (let i = 0; i < 1000; i++) {
        expect(tree.root).toBe(expectedRoot);
      }
    });
  });

  describe('Hash Stress', () => {
    it('should hash 10000 unique strings', () => {
      const hashes = new Set<string>();
      for (let i = 0; i < 10000; i++) {
        hashes.add(sha256(`unique-${i}`));
      }
      expect(hashes.size).toBe(10000);
    });

    it('should hash very long string', () => {
      const longString = 'x'.repeat(1000000);
      expect(sha256(longString).length).toBe(64);
    });

    it('should hash 1000 times same input', () => {
      const expected = sha256('stress-test');
      for (let i = 0; i < 1000; i++) {
        expect(sha256('stress-test')).toBe(expected);
      }
    });

    it('should handle mixed content hashing', () => {
      const contents = [
        'simple',
        'with spaces',
        'with\nnewlines',
        'with\ttabs',
        '中文',
        '🔐',
        '',
        ' ',
        'a'.repeat(10000)
      ];
      for (const content of contents) {
        expect(sha256(content).length).toBe(64);
      }
    });
  });

  describe('Concurrent-Like Operations', () => {
    it('should handle interleaved append and verify', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 100; i++) {
        tree.append(sha256(`e${i}`));
        for (let j = 0; j <= i; j++) {
          expect(MerkleTree.verify(tree.getProof(j)!)).toBe(true);
        }
      }
    });

    it('should handle interleaved append and getLeaves', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 100; i++) {
        tree.append(sha256(`e${i}`));
        expect(tree.getLeaves().length).toBe(i + 1);
      }
    });

    it('should handle multiple trees simultaneously', () => {
      const trees = Array.from({ length: 10 }, () => new MerkleTree());
      for (let i = 0; i < 100; i++) {
        for (const tree of trees) {
          tree.append(sha256(`e${i}`));
        }
      }
      for (const tree of trees) {
        expect(tree.size).toBe(100);
      }
    });

    it('should handle multiple independent proofs', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 100; i++) tree.append(sha256(`e${i}`));
      const proofs = Array.from({ length: 100 }, (_, i) => tree.getProof(i)!);
      for (const proof of proofs) {
        expect(MerkleTree.verify(proof)).toBe(true);
      }
    });
  });

  describe('Memory Pressure', () => {
    it('should handle many tree instances', () => {
      const trees = [];
      for (let i = 0; i < 100; i++) {
        const tree = new MerkleTree();
        for (let j = 0; j < 10; j++) tree.append(sha256(`tree${i}-e${j}`));
        trees.push(tree);
      }
      expect(trees.length).toBe(100);
      for (const tree of trees) {
        expect(tree.size).toBe(10);
      }
    });

    it('should handle many proof objects', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 100; i++) tree.append(sha256(`e${i}`));
      const proofs = [];
      for (let i = 0; i < 100; i++) {
        for (let j = 0; j < 100; j++) {
          proofs.push(tree.getProof(j)!);
        }
      }
      expect(proofs.length).toBe(10000);
    });

    it('should handle repeated import operations', () => {
      const leaves = Array.from({ length: 100 }, (_, i) => sha256(`e${i}`));
      for (let i = 0; i < 100; i++) {
        const tree = MerkleTree.import({ leaves });
        expect(tree.size).toBe(100);
      }
    });
  });

  describe('Boundary Stress', () => {
    it('should stress test power of two boundaries', () => {
      const tree = new MerkleTree();
      const boundaries = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024];
      for (let i = 0; i < 1024; i++) {
        tree.append(sha256(`e${i}`));
        if (boundaries.includes(i + 1)) {
          for (let j = 0; j <= i; j++) {
            expect(MerkleTree.verify(tree.getProof(j)!)).toBe(true);
          }
        }
      }
    });

    it('should stress test just before power of two', () => {
      for (const size of [3, 7, 15, 31, 63, 127]) {
        const tree = new MerkleTree();
        for (let i = 0; i < size; i++) tree.append(sha256(`e${i}`));
        for (let i = 0; i < size; i++) {
          expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
        }
      }
    });

    it('should stress test just after power of two', () => {
      for (const size of [5, 9, 17, 33, 65, 129]) {
        const tree = new MerkleTree();
        for (let i = 0; i < size; i++) tree.append(sha256(`e${i}`));
        for (let i = 0; i < size; i++) {
          expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
        }
      }
    });
  });

  describe('Sustained Operations', () => {
    it('should maintain consistency over many operations', () => {
      const tree = new MerkleTree();
      for (let round = 0; round < 10; round++) {
        for (let i = 0; i < 100; i++) {
          tree.append(sha256(`round${round}-e${i}`));
        }
        expect(tree.size).toBe((round + 1) * 100);
      }
      expect(tree.size).toBe(1000);
    });

    it('should maintain proof validity over growth', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 500; i++) {
        tree.append(sha256(`e${i}`));
        // Check first and last entries periodically
        if (i > 0 && i % 50 === 0) {
          expect(MerkleTree.verify(tree.getProof(0)!)).toBe(true);
          expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
        }
      }
    });
  });

  describe('Import Stress', () => {
    it('should import 1000 entries', () => {
      const leaves = Array.from({ length: 1000 }, (_, i) => sha256(`e${i}`));
      const tree = MerkleTree.import({ leaves });
      expect(tree.size).toBe(1000);
    });

    it('should import 5000 entries', () => {
      const leaves = Array.from({ length: 5000 }, (_, i) => sha256(`e${i}`));
      const tree = MerkleTree.import({ leaves });
      expect(tree.size).toBe(5000);
    });

    it('should verify after large import', () => {
      const leaves = Array.from({ length: 1000 }, (_, i) => sha256(`e${i}`));
      const tree = MerkleTree.import({ leaves });
      const indices = [0, 100, 500, 999];
      for (const idx of indices) {
        expect(MerkleTree.verify(tree.getProof(idx)!)).toBe(true);
      }
    });
  });

  describe('Edge Case Combinations', () => {
    it('should handle empty then large', () => {
      const tree = new MerkleTree();
      expect(tree.size).toBe(0);
      for (let i = 0; i < 1000; i++) tree.append(sha256(`e${i}`));
      expect(tree.size).toBe(1000);
    });

    it('should handle single then large', () => {
      const tree = new MerkleTree();
      tree.append(sha256('first'));
      for (let i = 1; i < 1000; i++) tree.append(sha256(`e${i}`));
      expect(tree.size).toBe(1000);
      expect(MerkleTree.verify(tree.getProof(0)!)).toBe(true);
    });

    it('should handle alternating sizes', () => {
      for (const size of [1, 10, 100, 1000, 500, 50, 5, 1]) {
        const tree = new MerkleTree();
        for (let i = 0; i < size; i++) tree.append(sha256(`e${i}`));
        expect(tree.size).toBe(size);
      }
    });
  });
});
