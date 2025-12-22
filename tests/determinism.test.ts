/**
 * Determinism Tests
 *
 * Tests to verify deterministic behavior across all operations.
 */

import { MerkleTree } from '../src/core/merkle';
import { sha256 } from '../src/core/hash';

describe('Determinism Tests', () => {
  describe('Hash Determinism', () => {
    it('should produce same hash for same input', () => {
      expect(sha256('test')).toBe(sha256('test'));
    });

    it('should produce same hash 100 times', () => {
      const expected = sha256('determinism');
      for (let i = 0; i < 100; i++) {
        expect(sha256('determinism')).toBe(expected);
      }
    });

    it('should produce same hash in different contexts', () => {
      const input = 'context-test';
      const hash1 = sha256(input);
      const arr = [sha256(input)];
      const obj = { hash: sha256(input) };
      expect(arr[0]).toBe(hash1);
      expect(obj.hash).toBe(hash1);
    });
  });

  describe('Tree Root Determinism', () => {
    it('should produce same root for same inputs', () => {
      const build = () => {
        const t = new MerkleTree();
        t.append(sha256('a'));
        t.append(sha256('b'));
        return t.root;
      };
      expect(build()).toBe(build());
    });

    it('should produce same root 50 times', () => {
      const build = () => {
        const t = new MerkleTree();
        for (let i = 0; i < 10; i++) t.append(sha256(`e${i}`));
        return t.root;
      };
      const expected = build();
      for (let i = 0; i < 50; i++) {
        expect(build()).toBe(expected);
      }
    });

    it('should produce same root via append vs import', () => {
      const leaves = Array.from({ length: 20 }, (_, i) => sha256(`e${i}`));

      const appendTree = new MerkleTree();
      leaves.forEach(l => appendTree.append(l));

      const importTree = MerkleTree.import({ leaves });

      expect(importTree.root).toBe(appendTree.root);
    });
  });

  describe('Proof Determinism', () => {
    it('should produce same proof for same tree state', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 10; i++) tree.append(sha256(`e${i}`));

      const p1 = JSON.stringify(tree.getProof(5));
      const p2 = JSON.stringify(tree.getProof(5));
      expect(p1).toBe(p2);
    });

    it('should produce same proof 50 times', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 10; i++) tree.append(sha256(`e${i}`));

      const expected = JSON.stringify(tree.getProof(5));
      for (let i = 0; i < 50; i++) {
        expect(JSON.stringify(tree.getProof(5))).toBe(expected);
      }
    });
  });

  describe('Leaves Determinism', () => {
    it('should return same leaves for same tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 10; i++) tree.append(sha256(`e${i}`));

      const l1 = tree.getLeaves();
      const l2 = tree.getLeaves();
      expect(l1).toEqual(l2);
    });

    it('should preserve leaf order', () => {
      const tree = new MerkleTree();
      const hashes = [];
      for (let i = 0; i < 20; i++) {
        const h = sha256(`e${i}`);
        hashes.push(h);
        tree.append(h);
      }
      expect(tree.getLeaves()).toEqual(hashes);
    });
  });

  describe('Cross-Instance Determinism', () => {
    it('should match across instances', () => {
      const build = () => {
        const t = new MerkleTree();
        for (let i = 0; i < 50; i++) t.append(sha256(`entry-${i}`));
        return { root: t.root, leaves: t.getLeaves() };
      };

      const r1 = build();
      const r2 = build();
      expect(r1.root).toBe(r2.root);
      expect(r1.leaves).toEqual(r2.leaves);
    });

    it('should match proofs across instances', () => {
      const build = () => {
        const t = new MerkleTree();
        for (let i = 0; i < 20; i++) t.append(sha256(`e${i}`));
        return t.getProof(10);
      };

      const p1 = build();
      const p2 = build();
      expect(p1!.root).toBe(p2!.root);
      expect(p1!.leaf).toBe(p2!.leaf);
      expect(p1!.proof).toEqual(p2!.proof);
      expect(p1!.directions).toEqual(p2!.directions);
    });
  });
});
