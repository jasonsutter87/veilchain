/**
 * Tree Operations Tests
 *
 * Comprehensive tests for Merkle tree operations, appends, and state management.
 */

import { MerkleTree } from '../src/core/merkle';
import { sha256 } from '../src/core/hash';

describe('Tree Operations Tests', () => {
  describe('Append Operations', () => {
    it('should append to empty tree', () => {
      const tree = new MerkleTree();
      tree.append(sha256('first'));
      expect(tree.size).toBe(1);
    });

    it('should append second entry', () => {
      const tree = new MerkleTree();
      tree.append(sha256('first'));
      tree.append(sha256('second'));
      expect(tree.size).toBe(2);
    });

    it('should append 10 entries', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 10; i++) tree.append(sha256(`e${i}`));
      expect(tree.size).toBe(10);
    });

    it('should append 100 entries', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 100; i++) tree.append(sha256(`e${i}`));
      expect(tree.size).toBe(100);
    });

    it('should append 1000 entries', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 1000; i++) tree.append(sha256(`e${i}`));
      expect(tree.size).toBe(1000);
    });

    it('should return correct index on append', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 10; i++) {
        const index = tree.append(sha256(`e${i}`));
        expect(index).toBe(i);
      }
    });

    it('should update root on each append', () => {
      const tree = new MerkleTree();
      const roots: string[] = [];
      for (let i = 0; i < 20; i++) {
        tree.append(sha256(`e${i}`));
        roots.push(tree.root);
      }
      expect(new Set(roots).size).toBe(20);
    });

    it('should handle duplicate hash values', () => {
      const tree = new MerkleTree();
      const hash = sha256('duplicate');
      tree.append(hash);
      tree.append(hash);
      expect(tree.size).toBe(2);
    });

    it('should append with different hash lengths', () => {
      const tree = new MerkleTree();
      tree.append('a'.repeat(64));
      tree.append('b'.repeat(64));
      expect(tree.size).toBe(2);
    });
  });

  describe('Size Property', () => {
    it('should be 0 for empty tree', () => {
      const tree = new MerkleTree();
      expect(tree.size).toBe(0);
    });

    it('should be 1 after first append', () => {
      const tree = new MerkleTree();
      tree.append(sha256('e'));
      expect(tree.size).toBe(1);
    });

    it('should increment correctly', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 50; i++) {
        expect(tree.size).toBe(i);
        tree.append(sha256(`e${i}`));
        expect(tree.size).toBe(i + 1);
      }
    });

    it('should not change on proof request', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 10; i++) tree.append(sha256(`e${i}`));
      const sizeBefore = tree.size;
      for (let i = 0; i < 10; i++) tree.getProof(i);
      expect(tree.size).toBe(sizeBefore);
    });

    it('should not change on getLeaves', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 10; i++) tree.append(sha256(`e${i}`));
      const sizeBefore = tree.size;
      tree.getLeaves();
      expect(tree.size).toBe(sizeBefore);
    });
  });

  describe('Root Property', () => {
    it('should have valid root for empty tree', () => {
      const tree = new MerkleTree();
      expect(tree.root).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should have valid root after append', () => {
      const tree = new MerkleTree();
      tree.append(sha256('e'));
      expect(tree.root).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should change root after each append', () => {
      const tree = new MerkleTree();
      let prevRoot = tree.root;
      for (let i = 0; i < 10; i++) {
        tree.append(sha256(`e${i}`));
        expect(tree.root).not.toBe(prevRoot);
        prevRoot = tree.root;
      }
    });

    it('should be consistent on multiple reads', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 10; i++) tree.append(sha256(`e${i}`));
      const root1 = tree.root;
      const root2 = tree.root;
      const root3 = tree.root;
      expect(root1).toBe(root2);
      expect(root2).toBe(root3);
    });

    it('should match proof root', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 10; i++) tree.append(sha256(`e${i}`));
      for (let i = 0; i < 10; i++) {
        expect(tree.getProof(i)!.root).toBe(tree.root);
      }
    });
  });

  describe('GetLeaves Operation', () => {
    it('should return empty array for empty tree', () => {
      const tree = new MerkleTree();
      expect(tree.getLeaves()).toEqual([]);
    });

    it('should return single leaf', () => {
      const tree = new MerkleTree();
      const hash = sha256('single');
      tree.append(hash);
      expect(tree.getLeaves()).toEqual([hash]);
    });

    it('should return leaves in order', () => {
      const tree = new MerkleTree();
      const hashes = [];
      for (let i = 0; i < 10; i++) {
        const h = sha256(`e${i}`);
        hashes.push(h);
        tree.append(h);
      }
      expect(tree.getLeaves()).toEqual(hashes);
    });

    it('should return correct count of leaves', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 100; i++) tree.append(sha256(`e${i}`));
      expect(tree.getLeaves().length).toBe(100);
    });

    it('should preserve leaves after multiple calls', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 10; i++) tree.append(sha256(`e${i}`));
      const leaves1 = tree.getLeaves();
      const leaves2 = tree.getLeaves();
      expect(leaves1).toEqual(leaves2);
    });
  });

  describe('GetProof Operation', () => {
    it('should return null for empty tree', () => {
      const tree = new MerkleTree();
      expect(tree.getProof(0)).toBeNull();
    });

    it('should return proof for valid index', () => {
      const tree = new MerkleTree();
      tree.append(sha256('e'));
      expect(tree.getProof(0)).not.toBeNull();
    });

    it('should return null for index out of bounds', () => {
      const tree = new MerkleTree();
      tree.append(sha256('e'));
      expect(tree.getProof(1)).toBeNull();
    });

    it('should return null for negative index', () => {
      const tree = new MerkleTree();
      tree.append(sha256('e'));
      expect(tree.getProof(-1)).toBeNull();
    });

    it('should return proof with correct leaf', () => {
      const tree = new MerkleTree();
      const hash = sha256('test');
      tree.append(hash);
      expect(tree.getProof(0)!.leaf).toBe(hash);
    });

    it('should return proof with correct index', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 10; i++) tree.append(sha256(`e${i}`));
      for (let i = 0; i < 10; i++) {
        expect(tree.getProof(i)!.index).toBe(i);
      }
    });

    it('should return proof with correct root', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 10; i++) tree.append(sha256(`e${i}`));
      const root = tree.root;
      for (let i = 0; i < 10; i++) {
        expect(tree.getProof(i)!.root).toBe(root);
      }
    });
  });

  describe('Import Operation', () => {
    it('should import empty leaves', () => {
      const tree = MerkleTree.import({ leaves: [] });
      expect(tree.size).toBe(0);
    });

    it('should import single leaf', () => {
      const hash = sha256('single');
      const tree = MerkleTree.import({ leaves: [hash] });
      expect(tree.size).toBe(1);
      expect(tree.getLeaves()).toEqual([hash]);
    });

    it('should import multiple leaves', () => {
      const hashes = [sha256('a'), sha256('b'), sha256('c')];
      const tree = MerkleTree.import({ leaves: hashes });
      expect(tree.size).toBe(3);
      expect(tree.getLeaves()).toEqual(hashes);
    });

    it('should produce same root as append', () => {
      const hashes = [];
      for (let i = 0; i < 50; i++) hashes.push(sha256(`e${i}`));

      const appendTree = new MerkleTree();
      hashes.forEach(h => appendTree.append(h));

      const importTree = MerkleTree.import({ leaves: hashes });

      expect(importTree.root).toBe(appendTree.root);
    });

    it('should allow append after import', () => {
      const hashes = [sha256('a'), sha256('b')];
      const tree = MerkleTree.import({ leaves: hashes });
      tree.append(sha256('c'));
      expect(tree.size).toBe(3);
    });

    it('should verify proofs after import', () => {
      const hashes = [];
      for (let i = 0; i < 20; i++) hashes.push(sha256(`e${i}`));
      const tree = MerkleTree.import({ leaves: hashes });
      for (let i = 0; i < 20; i++) {
        expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
      }
    });
  });

  describe('Verify Static Method', () => {
    it('should verify valid proof', () => {
      const tree = new MerkleTree();
      tree.append(sha256('test'));
      expect(MerkleTree.verify(tree.getProof(0)!)).toBe(true);
    });

    it('should reject null proof', () => {
      expect(MerkleTree.verify(null as any)).toBe(false);
    });

    it('should reject undefined proof', () => {
      expect(MerkleTree.verify(undefined as any)).toBe(false);
    });

    it('should reject empty object', () => {
      expect(MerkleTree.verify({} as any)).toBe(false);
    });

    it('should reject proof with wrong leaf', () => {
      const tree = new MerkleTree();
      tree.append(sha256('test'));
      const proof = { ...tree.getProof(0)!, leaf: 'x'.repeat(64) };
      expect(MerkleTree.verify(proof)).toBe(false);
    });

    it('should reject proof with wrong root', () => {
      const tree = new MerkleTree();
      tree.append(sha256('test'));
      const proof = { ...tree.getProof(0)!, root: 'x'.repeat(64) };
      expect(MerkleTree.verify(proof)).toBe(false);
    });
  });

  describe('Tree State Consistency', () => {
    it('should maintain state across operations', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 50; i++) {
        tree.append(sha256(`e${i}`));
        expect(tree.size).toBe(i + 1);
        expect(tree.getLeaves().length).toBe(i + 1);
        expect(tree.getProof(i)).not.toBeNull();
      }
    });

    it('should not mutate on getProof', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 10; i++) tree.append(sha256(`e${i}`));
      const rootBefore = tree.root;
      const sizeBefore = tree.size;
      for (let i = 0; i < 100; i++) tree.getProof(i % 10);
      expect(tree.root).toBe(rootBefore);
      expect(tree.size).toBe(sizeBefore);
    });

    it('should not mutate on getLeaves', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 10; i++) tree.append(sha256(`e${i}`));
      const rootBefore = tree.root;
      const sizeBefore = tree.size;
      for (let i = 0; i < 100; i++) tree.getLeaves();
      expect(tree.root).toBe(rootBefore);
      expect(tree.size).toBe(sizeBefore);
    });

    it('should not affect tree when proof is modified', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 10; i++) tree.append(sha256(`e${i}`));
      const proof = tree.getProof(5)!;
      const originalLeaf = proof.leaf;
      proof.leaf = 'modified';
      expect(tree.getProof(5)!.leaf).toBe(originalLeaf);
    });

    it('should not affect tree when leaves array is modified', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 10; i++) tree.append(sha256(`e${i}`));
      const leaves = tree.getLeaves();
      const original0 = leaves[0];
      leaves[0] = 'modified';
      expect(tree.getLeaves()[0]).toBe(original0);
    });
  });

  describe('Determinism', () => {
    it('should produce same tree for same inputs', () => {
      const hashes = [];
      for (let i = 0; i < 20; i++) hashes.push(sha256(`e${i}`));

      const tree1 = new MerkleTree();
      const tree2 = new MerkleTree();
      hashes.forEach(h => {
        tree1.append(h);
        tree2.append(h);
      });

      expect(tree1.root).toBe(tree2.root);
      expect(tree1.getLeaves()).toEqual(tree2.getLeaves());
    });

    it('should produce different tree for different inputs', () => {
      const tree1 = new MerkleTree();
      const tree2 = new MerkleTree();
      tree1.append(sha256('a'));
      tree2.append(sha256('b'));
      expect(tree1.root).not.toBe(tree2.root);
    });

    it('should produce different tree for different order', () => {
      const tree1 = new MerkleTree();
      const tree2 = new MerkleTree();
      tree1.append(sha256('a'));
      tree1.append(sha256('b'));
      tree2.append(sha256('b'));
      tree2.append(sha256('a'));
      expect(tree1.root).not.toBe(tree2.root);
    });
  });

  describe('Edge Cases', () => {
    it('should handle 64-char hash', () => {
      const tree = new MerkleTree();
      tree.append('a'.repeat(64));
      expect(tree.size).toBe(1);
    });

    it('should handle mixed case hash', () => {
      const tree = new MerkleTree();
      tree.append('aAbBcCdDeEfF'.repeat(5) + 'aaaa');
      expect(tree.size).toBe(1);
    });

    it('should handle sequential appends and verifies', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 100; i++) {
        tree.append(sha256(`e${i}`));
        expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
      }
    });
  });
});
