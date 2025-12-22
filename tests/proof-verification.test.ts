/**
 * Proof Verification Tests
 *
 * Comprehensive tests for Merkle proof verification scenarios.
 */

import { MerkleTree } from '../src/core/merkle';
import { sha256 } from '../src/core/hash';

describe('Proof Verification Tests', () => {
  describe('Valid Proof Verification', () => {
    it('should verify proof for single entry', () => {
      const tree = new MerkleTree();
      tree.append(sha256('single'));
      expect(MerkleTree.verify(tree.getProof(0)!)).toBe(true);
    });

    it('should verify proof for first of two entries', () => {
      const tree = new MerkleTree();
      tree.append(sha256('first'));
      tree.append(sha256('second'));
      expect(MerkleTree.verify(tree.getProof(0)!)).toBe(true);
    });

    it('should verify proof for second of two entries', () => {
      const tree = new MerkleTree();
      tree.append(sha256('first'));
      tree.append(sha256('second'));
      expect(MerkleTree.verify(tree.getProof(1)!)).toBe(true);
    });

    it('should verify proof for first of 8 entries', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 8; i++) tree.append(sha256(`e${i}`));
      expect(MerkleTree.verify(tree.getProof(0)!)).toBe(true);
    });

    it('should verify proof for last of 8 entries', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 8; i++) tree.append(sha256(`e${i}`));
      expect(MerkleTree.verify(tree.getProof(7)!)).toBe(true);
    });

    it('should verify proof for middle of 8 entries', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 8; i++) tree.append(sha256(`e${i}`));
      expect(MerkleTree.verify(tree.getProof(4)!)).toBe(true);
    });

    it('should verify proof for first of 16 entries', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 16; i++) tree.append(sha256(`e${i}`));
      expect(MerkleTree.verify(tree.getProof(0)!)).toBe(true);
    });

    it('should verify proof for last of 16 entries', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 16; i++) tree.append(sha256(`e${i}`));
      expect(MerkleTree.verify(tree.getProof(15)!)).toBe(true);
    });

    it('should verify proof for index 7 of 16 entries', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 16; i++) tree.append(sha256(`e${i}`));
      expect(MerkleTree.verify(tree.getProof(7)!)).toBe(true);
    });

    it('should verify proof for index 8 of 16 entries', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 16; i++) tree.append(sha256(`e${i}`));
      expect(MerkleTree.verify(tree.getProof(8)!)).toBe(true);
    });

    it('should verify proof for first of 100 entries', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 100; i++) tree.append(sha256(`e${i}`));
      expect(MerkleTree.verify(tree.getProof(0)!)).toBe(true);
    });

    it('should verify proof for last of 100 entries', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 100; i++) tree.append(sha256(`e${i}`));
      expect(MerkleTree.verify(tree.getProof(99)!)).toBe(true);
    });

    it('should verify proof for middle of 100 entries', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 100; i++) tree.append(sha256(`e${i}`));
      expect(MerkleTree.verify(tree.getProof(50)!)).toBe(true);
    });

    it('should verify proof for index 63 of 100 entries', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 100; i++) tree.append(sha256(`e${i}`));
      expect(MerkleTree.verify(tree.getProof(63)!)).toBe(true);
    });

    it('should verify proof for index 64 of 100 entries', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 100; i++) tree.append(sha256(`e${i}`));
      expect(MerkleTree.verify(tree.getProof(64)!)).toBe(true);
    });
  });

  describe('Invalid Proof Rejection', () => {
    it('should reject null proof', () => {
      expect(MerkleTree.verify(null as any)).toBe(false);
    });

    it('should reject undefined proof', () => {
      expect(MerkleTree.verify(undefined as any)).toBe(false);
    });

    it('should reject empty object', () => {
      expect(MerkleTree.verify({} as any)).toBe(false);
    });

    it('should reject proof missing leaf', () => {
      const tree = new MerkleTree();
      tree.append(sha256('test'));
      const proof = tree.getProof(0)!;
      const invalid = { ...proof, leaf: undefined } as any;
      expect(MerkleTree.verify(invalid)).toBe(false);
    });

    it('should reject proof missing root', () => {
      const tree = new MerkleTree();
      tree.append(sha256('test'));
      const proof = tree.getProof(0)!;
      const invalid = { ...proof, root: undefined } as any;
      expect(MerkleTree.verify(invalid)).toBe(false);
    });

    it('should reject proof with wrong leaf', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 8; i++) tree.append(sha256(`e${i}`));
      const proof = { ...tree.getProof(4)!, leaf: 'x'.repeat(64) };
      expect(MerkleTree.verify(proof)).toBe(false);
    });

    it('should reject proof with wrong root', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 8; i++) tree.append(sha256(`e${i}`));
      const proof = { ...tree.getProof(4)!, root: 'y'.repeat(64) };
      expect(MerkleTree.verify(proof)).toBe(false);
    });

    it('should reject proof with modified first path element', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 8; i++) tree.append(sha256(`e${i}`));
      const orig = tree.getProof(4)!;
      const path = [...orig.proof];
      path[0] = 'z'.repeat(64);
      expect(MerkleTree.verify({ ...orig, proof: path })).toBe(false);
    });

    it('should reject proof with modified last path element', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 8; i++) tree.append(sha256(`e${i}`));
      const orig = tree.getProof(4)!;
      const path = [...orig.proof];
      path[path.length - 1] = 'z'.repeat(64);
      expect(MerkleTree.verify({ ...orig, proof: path })).toBe(false);
    });

    it('should reject proof with flipped first direction', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 8; i++) tree.append(sha256(`e${i}`));
      const orig = tree.getProof(4)!;
      const dirs = [...orig.directions];
      dirs[0] = dirs[0] === 'left' ? 'right' : 'left';
      expect(MerkleTree.verify({ ...orig, directions: dirs })).toBe(false);
    });

    it('should reject proof with flipped last direction', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 8; i++) tree.append(sha256(`e${i}`));
      const orig = tree.getProof(4)!;
      const dirs = [...orig.directions];
      dirs[dirs.length - 1] = dirs[dirs.length - 1] === 'left' ? 'right' : 'left';
      expect(MerkleTree.verify({ ...orig, directions: dirs })).toBe(false);
    });

    it('should reject proof with wrong index', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 8; i++) tree.append(sha256(`e${i}`));
      const proof = { ...tree.getProof(4)!, index: 5 };
      expect(MerkleTree.verify(proof)).toBe(false);
    });

    it('should reject proof with truncated path', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 8; i++) tree.append(sha256(`e${i}`));
      const orig = tree.getProof(4)!;
      expect(MerkleTree.verify({
        ...orig,
        proof: orig.proof.slice(0, -1),
        directions: orig.directions.slice(0, -1)
      })).toBe(false);
    });

    it('should reject proof with extended path', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 8; i++) tree.append(sha256(`e${i}`));
      const orig = tree.getProof(4)!;
      expect(MerkleTree.verify({
        ...orig,
        proof: [...orig.proof, 'a'.repeat(64)],
        directions: [...orig.directions, 'left' as const]
      })).toBe(false);
    });

    it('should reject proof from different tree', () => {
      const tree1 = new MerkleTree();
      const tree2 = new MerkleTree();
      for (let i = 0; i < 8; i++) {
        tree1.append(sha256(`a${i}`));
        tree2.append(sha256(`b${i}`));
      }
      const proof = { ...tree1.getProof(4)!, root: tree2.getProof(0)!.root };
      expect(MerkleTree.verify(proof)).toBe(false);
    });
  });

  describe('Proof Cross-Verification', () => {
    it('should not verify proof for wrong entry in same tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 8; i++) tree.append(sha256(`e${i}`));
      const proof0 = tree.getProof(0)!;
      const proof1 = tree.getProof(1)!;
      // Mix leaf from 0 with path from 1
      const mixed = { ...proof1, leaf: proof0.leaf };
      expect(MerkleTree.verify(mixed)).toBe(false);
    });

    it('should verify that each entry has unique proof', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 8; i++) tree.append(sha256(`e${i}`));
      const proofs = [];
      for (let i = 0; i < 8; i++) {
        proofs.push(JSON.stringify(tree.getProof(i)));
      }
      expect(new Set(proofs).size).toBe(8);
    });

    it('should have same root in all proofs', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 16; i++) tree.append(sha256(`e${i}`));
      const roots = [];
      for (let i = 0; i < 16; i++) {
        roots.push(tree.getProof(i)!.root);
      }
      expect(new Set(roots).size).toBe(1);
    });
  });

  describe('Proof After Tree Modification', () => {
    it('should have different root after append', () => {
      const tree = new MerkleTree();
      tree.append(sha256('first'));
      const root1 = tree.getProof(0)!.root;
      tree.append(sha256('second'));
      const root2 = tree.getProof(0)!.root;
      expect(root1).not.toBe(root2);
    });

    it('should still verify old entry after append', () => {
      const tree = new MerkleTree();
      tree.append(sha256('first'));
      tree.append(sha256('second'));
      expect(MerkleTree.verify(tree.getProof(0)!)).toBe(true);
    });

    it('should verify all entries after multiple appends', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 50; i++) {
        tree.append(sha256(`entry-${i}`));
        for (let j = 0; j <= i; j++) {
          expect(MerkleTree.verify(tree.getProof(j)!)).toBe(true);
        }
      }
    });
  });

  describe('Proof Immutability', () => {
    it('should return new proof object each time', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 8; i++) tree.append(sha256(`e${i}`));
      const p1 = tree.getProof(4)!;
      const p2 = tree.getProof(4)!;
      expect(p1).not.toBe(p2);
    });

    it('should not affect tree when proof is modified', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 8; i++) tree.append(sha256(`e${i}`));
      const p1 = tree.getProof(4)!;
      const original = p1.leaf;
      p1.leaf = 'modified';
      const p2 = tree.getProof(4)!;
      expect(p2.leaf).toBe(original);
    });
  });

  describe('Empty Proof Handling', () => {
    it('should accept single-element tree proof with empty path', () => {
      const tree = new MerkleTree();
      tree.append(sha256('only'));
      const proof = tree.getProof(0)!;
      expect(proof.proof.length).toBe(0);
      expect(proof.directions.length).toBe(0);
      expect(MerkleTree.verify(proof)).toBe(true);
    });

    it('should verify leaf equals root for single entry', () => {
      const tree = new MerkleTree();
      const hash = sha256('only');
      tree.append(hash);
      const proof = tree.getProof(0)!;
      expect(proof.leaf).toBe(hash);
    });
  });

  describe('Stress Testing Verification', () => {
    it('should verify 1000 proofs from 1000-entry tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 1000; i++) tree.append(sha256(`e${i}`));
      for (let i = 0; i < 1000; i++) {
        expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
      }
    });

    it('should verify random samples from large tree', () => {
      const tree = new MerkleTree();
      const size = 5000;
      for (let i = 0; i < size; i++) tree.append(sha256(`e${i}`));
      for (let i = 0; i < 100; i++) {
        const idx = Math.floor(Math.random() * size);
        expect(MerkleTree.verify(tree.getProof(idx)!)).toBe(true);
      }
    });

    it('should handle 10000 verifications quickly', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 100; i++) tree.append(sha256(`e${i}`));
      const proof = tree.getProof(50)!;
      const start = Date.now();
      for (let i = 0; i < 10000; i++) {
        MerkleTree.verify(proof);
      }
      expect(Date.now() - start).toBeLessThan(2000);
    });
  });

  describe('Boundary Index Verification', () => {
    it('should verify index 0 in 1-entry tree', () => {
      const tree = new MerkleTree();
      tree.append(sha256('e'));
      expect(MerkleTree.verify(tree.getProof(0)!)).toBe(true);
    });

    it('should verify index 1 in 2-entry tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 2; i++) tree.append(sha256(`e${i}`));
      expect(MerkleTree.verify(tree.getProof(1)!)).toBe(true);
    });

    it('should verify index 3 in 4-entry tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 4; i++) tree.append(sha256(`e${i}`));
      expect(MerkleTree.verify(tree.getProof(3)!)).toBe(true);
    });

    it('should verify index 7 in 8-entry tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 8; i++) tree.append(sha256(`e${i}`));
      expect(MerkleTree.verify(tree.getProof(7)!)).toBe(true);
    });

    it('should verify index 15 in 16-entry tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 16; i++) tree.append(sha256(`e${i}`));
      expect(MerkleTree.verify(tree.getProof(15)!)).toBe(true);
    });

    it('should verify index 31 in 32-entry tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 32; i++) tree.append(sha256(`e${i}`));
      expect(MerkleTree.verify(tree.getProof(31)!)).toBe(true);
    });

    it('should verify index 63 in 64-entry tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 64; i++) tree.append(sha256(`e${i}`));
      expect(MerkleTree.verify(tree.getProof(63)!)).toBe(true);
    });

    it('should verify index 127 in 128-entry tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 128; i++) tree.append(sha256(`e${i}`));
      expect(MerkleTree.verify(tree.getProof(127)!)).toBe(true);
    });

    it('should verify index 255 in 256-entry tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 256; i++) tree.append(sha256(`e${i}`));
      expect(MerkleTree.verify(tree.getProof(255)!)).toBe(true);
    });

    it('should verify index 511 in 512-entry tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 512; i++) tree.append(sha256(`e${i}`));
      expect(MerkleTree.verify(tree.getProof(511)!)).toBe(true);
    });
  });

  describe('Non-Power-of-Two Verification', () => {
    it('should verify all in 3-entry tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 3; i++) tree.append(sha256(`e${i}`));
      for (let i = 0; i < 3; i++) expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
    });

    it('should verify all in 5-entry tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 5; i++) tree.append(sha256(`e${i}`));
      for (let i = 0; i < 5; i++) expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
    });

    it('should verify all in 7-entry tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 7; i++) tree.append(sha256(`e${i}`));
      for (let i = 0; i < 7; i++) expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
    });

    it('should verify all in 9-entry tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 9; i++) tree.append(sha256(`e${i}`));
      for (let i = 0; i < 9; i++) expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
    });

    it('should verify all in 15-entry tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 15; i++) tree.append(sha256(`e${i}`));
      for (let i = 0; i < 15; i++) expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
    });

    it('should verify all in 17-entry tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 17; i++) tree.append(sha256(`e${i}`));
      for (let i = 0; i < 17; i++) expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
    });

    it('should verify all in 33-entry tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 33; i++) tree.append(sha256(`e${i}`));
      for (let i = 0; i < 33; i++) expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
    });

    it('should verify all in 65-entry tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 65; i++) tree.append(sha256(`e${i}`));
      for (let i = 0; i < 65; i++) expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
    });

    it('should verify all in 100-entry tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 100; i++) tree.append(sha256(`e${i}`));
      for (let i = 0; i < 100; i++) expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
    });

    it('should verify all in 200-entry tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 200; i++) tree.append(sha256(`e${i}`));
      for (let i = 0; i < 200; i++) expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
    });
  });
});
