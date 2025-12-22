/**
 * State Transitions Tests
 *
 * Tests for Merkle tree state transitions and lifecycle.
 */

import { MerkleTree } from '../src/core/merkle';
import { sha256 } from '../src/core/hash';

describe('State Transitions Tests', () => {
  describe('Empty to Single Entry', () => {
    it('should transition from empty to size 1', () => {
      const tree = new MerkleTree();
      expect(tree.size).toBe(0);
      tree.append(sha256('first'));
      expect(tree.size).toBe(1);
    });

    it('should have different root after first append', () => {
      const tree = new MerkleTree();
      const emptyRoot = tree.root;
      tree.append(sha256('first'));
      expect(tree.root).not.toBe(emptyRoot);
    });

    it('should enable proof generation after first append', () => {
      const tree = new MerkleTree();
      expect(() => tree.getProof(0)).toThrow();
      tree.append(sha256('first'));
      expect(tree.getProof(0)).toBeDefined();
    });

    it('should return leaves after first append', () => {
      const tree = new MerkleTree();
      expect(tree.getLeaves()).toEqual([]);
      const hash = sha256('first');
      tree.append(hash);
      expect(tree.getLeaves()).toEqual([hash]);
    });
  });

  describe('Single to Multiple Entries', () => {
    it('should grow from 1 to 2', () => {
      const tree = new MerkleTree();
      tree.append(sha256('a'));
      expect(tree.size).toBe(1);
      tree.append(sha256('b'));
      expect(tree.size).toBe(2);
    });

    it('should grow from 1 to 10', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 10; i++) {
        tree.append(sha256(`e${i}`));
        expect(tree.size).toBe(i + 1);
      }
    });

    it('should maintain valid proofs during growth', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 20; i++) {
        tree.append(sha256(`e${i}`));
        for (let j = 0; j <= i; j++) {
          expect(MerkleTree.verify(tree.getProof(j)!)).toBe(true);
        }
      }
    });

    it('should update root on each append', () => {
      const tree = new MerkleTree();
      const roots: string[] = [];
      for (let i = 0; i < 10; i++) {
        tree.append(sha256(`e${i}`));
        roots.push(tree.root);
      }
      expect(new Set(roots).size).toBe(10);
    });
  });

  describe('Power of Two Transitions', () => {
    it('should transition 1 -> 2', () => {
      const tree = new MerkleTree();
      tree.append(sha256('a'));
      const proof1 = tree.getProof(0)!;
      tree.append(sha256('b'));
      const proof2 = tree.getProof(0)!;
      expect(proof2.proof.length).toBeGreaterThanOrEqual(proof1.proof.length);
    });

    it('should transition 2 -> 3', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 2; i++) tree.append(sha256(`e${i}`));
      const root2 = tree.root;
      tree.append(sha256('e2'));
      expect(tree.root).not.toBe(root2);
    });

    it('should transition 4 -> 5', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 4; i++) tree.append(sha256(`e${i}`));
      const pathLen4 = tree.getProof(0)!.proof.length;
      tree.append(sha256('e4'));
      const pathLen5 = tree.getProof(0)!.proof.length;
      expect(pathLen5).toBeGreaterThanOrEqual(pathLen4);
    });

    it('should transition 8 -> 9', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 8; i++) tree.append(sha256(`e${i}`));
      expect(tree.getProof(0)!.proof.length).toBe(3);
      tree.append(sha256('e8'));
      expect(tree.size).toBe(9);
    });

    it('should transition 16 -> 17', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 16; i++) tree.append(sha256(`e${i}`));
      const root16 = tree.root;
      tree.append(sha256('e16'));
      expect(tree.root).not.toBe(root16);
      expect(tree.size).toBe(17);
    });

    it('should transition 32 -> 33', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 32; i++) tree.append(sha256(`e${i}`));
      tree.append(sha256('e32'));
      expect(tree.size).toBe(33);
      expect(MerkleTree.verify(tree.getProof(32)!)).toBe(true);
    });

    it('should transition 64 -> 65', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 64; i++) tree.append(sha256(`e${i}`));
      tree.append(sha256('e64'));
      expect(tree.size).toBe(65);
    });

    it('should transition 128 -> 129', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 128; i++) tree.append(sha256(`e${i}`));
      tree.append(sha256('e128'));
      expect(tree.size).toBe(129);
    });

    it('should transition 256 -> 257', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 256; i++) tree.append(sha256(`e${i}`));
      tree.append(sha256('e256'));
      expect(tree.size).toBe(257);
    });
  });

  describe('Root Evolution', () => {
    it('should have unique roots for first 50 appends', () => {
      const tree = new MerkleTree();
      const roots = new Set<string>();
      roots.add(tree.root);
      for (let i = 0; i < 50; i++) {
        tree.append(sha256(`e${i}`));
        roots.add(tree.root);
      }
      expect(roots.size).toBe(51);
    });

    it('should have stable root between appends', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 10; i++) tree.append(sha256(`e${i}`));
      const root1 = tree.root;
      const root2 = tree.root;
      const root3 = tree.root;
      expect(root1).toBe(root2);
      expect(root2).toBe(root3);
    });

    it('should have consistent root across operations', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 10; i++) tree.append(sha256(`e${i}`));
      const root = tree.root;
      tree.getLeaves();
      expect(tree.root).toBe(root);
      tree.getProof(5);
      expect(tree.root).toBe(root);
    });
  });

  describe('Proof Evolution', () => {
    it('should update existing proofs after append', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 5; i++) tree.append(sha256(`e${i}`));
      const proof5 = tree.getProof(0)!;
      tree.append(sha256('e5'));
      const proof6 = tree.getProof(0)!;
      expect(proof6.root).not.toBe(proof5.root);
    });

    it('should maintain leaf in proof after append', () => {
      const tree = new MerkleTree();
      const hash = sha256('first');
      tree.append(hash);
      const proof1 = tree.getProof(0)!;
      tree.append(sha256('second'));
      const proof2 = tree.getProof(0)!;
      expect(proof2.leaf).toBe(proof1.leaf);
      expect(proof2.leaf).toBe(hash);
    });

    it('should grow proof path during transitions', () => {
      const tree = new MerkleTree();
      const pathLengths: number[] = [];
      for (let i = 0; i < 20; i++) {
        tree.append(sha256(`e${i}`));
        pathLengths.push(tree.getProof(0)!.proof.length);
      }
      // Path length should generally increase
      expect(pathLengths[19]).toBeGreaterThanOrEqual(pathLengths[0]);
    });
  });

  describe('Leaves Evolution', () => {
    it('should accumulate leaves correctly', () => {
      const tree = new MerkleTree();
      const hashes: string[] = [];
      for (let i = 0; i < 20; i++) {
        const hash = sha256(`e${i}`);
        hashes.push(hash);
        tree.append(hash);
        expect(tree.getLeaves()).toEqual(hashes);
      }
    });

    it('should preserve order during growth', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 50; i++) tree.append(sha256(`e${i}`));
      const leaves = tree.getLeaves();
      for (let i = 0; i < 50; i++) {
        expect(leaves[i]).toBe(sha256(`e${i}`));
      }
    });
  });

  describe('Import State Transitions', () => {
    it('should match appended tree state', () => {
      const hashes = Array.from({ length: 20 }, (_, i) => sha256(`e${i}`));

      const appendTree = new MerkleTree();
      hashes.forEach(h => appendTree.append(h));

      const importTree = MerkleTree.import({ leaves: hashes });

      expect(importTree.size).toBe(appendTree.size);
      expect(importTree.root).toBe(appendTree.root);
    });

    it('should continue growth after import', () => {
      const initial = [sha256('a'), sha256('b')];
      const tree = MerkleTree.import({ leaves: initial });
      expect(tree.size).toBe(2);
      tree.append(sha256('c'));
      expect(tree.size).toBe(3);
    });

    it('should have valid proofs after import + append', () => {
      const initial = Array.from({ length: 10 }, (_, i) => sha256(`e${i}`));
      const tree = MerkleTree.import({ leaves: initial });
      tree.append(sha256('e10'));
      for (let i = 0; i <= 10; i++) {
        expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
      }
    });
  });

  describe('Batch Transitions', () => {
    it('should handle rapid sequential appends', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 100; i++) {
        tree.append(sha256(`rapid${i}`));
      }
      expect(tree.size).toBe(100);
    });

    it('should handle interleaved appends and reads', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 50; i++) {
        tree.append(sha256(`e${i}`));
        expect(tree.size).toBe(i + 1);
        expect(tree.getLeaves().length).toBe(i + 1);
        expect(tree.getProof(i)).not.toBeNull();
      }
    });

    it('should handle alternating proof requests', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 30; i++) {
        tree.append(sha256(`e${i}`));
        for (let j = 0; j <= i; j++) {
          const proof = tree.getProof(j)!;
          expect(MerkleTree.verify(proof)).toBe(true);
        }
      }
    });
  });

  describe('Large Scale Transitions', () => {
    it('should grow to 500 entries', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 500; i++) tree.append(sha256(`e${i}`));
      expect(tree.size).toBe(500);
    });

    it('should grow to 1000 entries', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 1000; i++) tree.append(sha256(`e${i}`));
      expect(tree.size).toBe(1000);
    });

    it('should verify random proofs in large tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 1000; i++) tree.append(sha256(`e${i}`));
      const indices = [0, 1, 100, 500, 750, 999];
      for (const idx of indices) {
        expect(MerkleTree.verify(tree.getProof(idx)!)).toBe(true);
      }
    });
  });

  describe('State Immutability', () => {
    it('should not change previous roots', () => {
      const tree = new MerkleTree();
      const snapshots: { size: number; root: string }[] = [];
      for (let i = 0; i < 20; i++) {
        tree.append(sha256(`e${i}`));
        snapshots.push({ size: tree.size, root: tree.root });
      }
      // Verify snapshots are all different
      const roots = snapshots.map(s => s.root);
      expect(new Set(roots).size).toBe(20);
    });

    it('should not affect tree when proof is mutated', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 10; i++) tree.append(sha256(`e${i}`));
      const proof = tree.getProof(5)!;
      const originalLeaf = proof.leaf;
      proof.leaf = 'mutated';
      expect(tree.getProof(5)!.leaf).toBe(originalLeaf);
    });

    it('should not affect tree when leaves array is mutated', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 10; i++) tree.append(sha256(`e${i}`));
      const leaves = tree.getLeaves();
      const original0 = leaves[0];
      leaves[0] = 'mutated';
      leaves.push('extra');
      expect(tree.getLeaves()[0]).toBe(original0);
      expect(tree.getLeaves().length).toBe(10);
    });
  });
});
