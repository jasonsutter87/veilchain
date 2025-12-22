/**
 * API Edge Cases Tests
 *
 * Tests for API and interface edge cases.
 */

import { MerkleTree } from '../src/core/merkle';
import { sha256, isValidHash } from '../src/core/hash';

describe('API Edge Cases Tests', () => {
  describe('Constructor Edge Cases', () => {
    it('should create tree with no arguments', () => {
      const tree = new MerkleTree();
      expect(tree).toBeDefined();
    });

    it('should create multiple independent trees', () => {
      const tree1 = new MerkleTree();
      const tree2 = new MerkleTree();
      tree1.append(sha256('a'));
      expect(tree1.size).toBe(1);
      expect(tree2.size).toBe(0);
    });

    it('should allow many tree instances', () => {
      const trees = Array.from({ length: 100 }, () => new MerkleTree());
      expect(trees.length).toBe(100);
    });
  });

  describe('Append Return Value', () => {
    it('should return 0 for first append', () => {
      const tree = new MerkleTree();
      expect(tree.append(sha256('first'))).toBe(0);
    });

    it('should return 1 for second append', () => {
      const tree = new MerkleTree();
      tree.append(sha256('first'));
      expect(tree.append(sha256('second'))).toBe(1);
    });

    it('should return sequential indices', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 50; i++) {
        expect(tree.append(sha256(`e${i}`))).toBe(i);
      }
    });
  });

  describe('Size Property Edge Cases', () => {
    it('should be 0 initially', () => {
      expect(new MerkleTree().size).toBe(0);
    });

    it('should be read-only', () => {
      const tree = new MerkleTree();
      expect(() => {
        (tree as any).size = 100;
      }).toThrow();
    });

    it('should not change on read operations', () => {
      const tree = new MerkleTree();
      tree.append(sha256('e'));
      const size = tree.size;
      tree.root;
      tree.getLeaves();
      tree.getProof(0);
      expect(tree.size).toBe(size);
    });
  });

  describe('Root Property Edge Cases', () => {
    it('should be valid hash format', () => {
      const tree = new MerkleTree();
      expect(isValidHash(tree.root)).toBe(true);
    });

    it('should be read-only', () => {
      const tree = new MerkleTree();
      expect(() => {
        (tree as any).root = 'x'.repeat(64);
      }).toThrow();
    });

    it('should be consistent across reads', () => {
      const tree = new MerkleTree();
      tree.append(sha256('e'));
      const r1 = tree.root;
      const r2 = tree.root;
      const r3 = tree.root;
      expect(r1).toBe(r2);
      expect(r2).toBe(r3);
    });
  });

  describe('GetLeaves Edge Cases', () => {
    it('should return empty array for empty tree', () => {
      expect(new MerkleTree().getLeaves()).toEqual([]);
    });

    it('should return copy, not reference', () => {
      const tree = new MerkleTree();
      tree.append(sha256('e'));
      const leaves1 = tree.getLeaves();
      const leaves2 = tree.getLeaves();
      expect(leaves1).not.toBe(leaves2);
    });

    it('should not affect tree when result is mutated', () => {
      const tree = new MerkleTree();
      tree.append(sha256('e'));
      const leaves = tree.getLeaves();
      leaves[0] = 'modified';
      leaves.push('extra');
      expect(tree.getLeaves()[0]).not.toBe('modified');
      expect(tree.getLeaves().length).toBe(1);
    });
  });

  describe('GetProof Edge Cases', () => {
    it('should throw for empty tree', () => {
      expect(() => new MerkleTree().getProof(0)).toThrow();
    });

    it('should throw for negative index', () => {
      const tree = new MerkleTree();
      tree.append(sha256('e'));
      expect(() => tree.getProof(-1)).toThrow();
    });

    it('should throw for out of bounds', () => {
      const tree = new MerkleTree();
      tree.append(sha256('e'));
      expect(() => tree.getProof(1)).toThrow();
    });

    it('should return new object each call', () => {
      const tree = new MerkleTree();
      tree.append(sha256('e'));
      const p1 = tree.getProof(0);
      const p2 = tree.getProof(0);
      expect(p1).not.toBe(p2);
    });

    it('should not affect tree when result is mutated', () => {
      const tree = new MerkleTree();
      tree.append(sha256('e'));
      const proof = tree.getProof(0)!;
      const originalLeaf = proof.leaf;
      proof.leaf = 'mutated';
      expect(tree.getProof(0)!.leaf).toBe(originalLeaf);
    });
  });

  describe('Static Verify Edge Cases', () => {
    it('should throw for null', () => {
      expect(() => MerkleTree.verify(null as any)).toThrow();
    });

    it('should throw for undefined', () => {
      expect(() => MerkleTree.verify(undefined as any)).toThrow();
    });

    it('should throw for empty object', () => {
      expect(() => MerkleTree.verify({} as any)).toThrow();
    });

    it('should throw for partial proof', () => {
      const tree = new MerkleTree();
      tree.append(sha256('e'));
      const proof = tree.getProof(0)!;
      expect(() => MerkleTree.verify({ leaf: proof.leaf } as any)).toThrow();
    });

    it('should be stateless', () => {
      const tree = new MerkleTree();
      tree.append(sha256('e'));
      const proof = tree.getProof(0)!;
      expect(MerkleTree.verify(proof)).toBe(true);
      expect(MerkleTree.verify(proof)).toBe(true);
    });
  });

  describe('Static Import Edge Cases', () => {
    it('should handle empty leaves', () => {
      const tree = MerkleTree.import({ leaves: [] });
      expect(tree.size).toBe(0);
    });

    it('should return new tree instance', () => {
      const leaves = [sha256('a')];
      const tree1 = MerkleTree.import({ leaves });
      const tree2 = MerkleTree.import({ leaves });
      expect(tree1).not.toBe(tree2);
    });

    it('should not modify input array', () => {
      const leaves = [sha256('a'), sha256('b')];
      const original = [...leaves];
      MerkleTree.import({ leaves });
      expect(leaves).toEqual(original);
    });
  });

  describe('Hash Function Edge Cases', () => {
    it('should handle empty string', () => {
      expect(sha256('').length).toBe(64);
    });

    it('should be pure function', () => {
      const input = 'test';
      expect(sha256(input)).toBe(sha256(input));
    });

    it('should not modify input', () => {
      const input = 'test';
      const copy = input;
      sha256(input);
      expect(input).toBe(copy);
    });
  });

  describe('IsValidHash Edge Cases', () => {
    it('should return false for empty string', () => {
      expect(isValidHash('')).toBe(false);
    });

    it('should return true for valid hash', () => {
      expect(isValidHash(sha256('test'))).toBe(true);
    });

    it('should be pure function', () => {
      const hash = sha256('test');
      expect(isValidHash(hash)).toBe(isValidHash(hash));
    });
  });

  describe('Type Safety', () => {
    it('should handle hash as string', () => {
      const tree = new MerkleTree();
      const hash: string = sha256('test');
      tree.append(hash);
      expect(tree.size).toBe(1);
    });

    it('should return proof with correct types', () => {
      const tree = new MerkleTree();
      tree.append(sha256('e'));
      const proof = tree.getProof(0)!;
      expect(typeof proof.leaf).toBe('string');
      expect(typeof proof.root).toBe('string');
      expect(typeof proof.index).toBe('number');
      expect(Array.isArray(proof.proof)).toBe(true);
      expect(Array.isArray(proof.directions)).toBe(true);
    });
  });

  describe('Chaining Operations', () => {
    it('should allow chained appends', () => {
      const tree = new MerkleTree();
      tree.append(sha256('a'));
      tree.append(sha256('b'));
      tree.append(sha256('c'));
      expect(tree.size).toBe(3);
    });

    it('should allow intermixed operations', () => {
      const tree = new MerkleTree();
      tree.append(sha256('a'));
      const proof1 = tree.getProof(0);
      tree.append(sha256('b'));
      const leaves = tree.getLeaves();
      tree.append(sha256('c'));
      const root = tree.root;
      expect(proof1).not.toBeNull();
      expect(leaves.length).toBe(2);
      expect(isValidHash(root)).toBe(true);
    });
  });

  describe('Concurrent-Safe Behavior', () => {
    it('should handle rapid operations', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 1000; i++) {
        tree.append(sha256(`rapid-${i}`));
      }
      expect(tree.size).toBe(1000);
    });

    it('should handle interleaved read/write', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 100; i++) {
        tree.append(sha256(`e${i}`));
        tree.root;
        tree.getLeaves();
        if (i > 0) tree.getProof(Math.floor(i / 2));
      }
      expect(tree.size).toBe(100);
    });
  });
});
