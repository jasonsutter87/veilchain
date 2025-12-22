/**
 * Boundary Conditions Tests
 *
 * Tests for boundary conditions and edge cases across all components.
 */

import { MerkleTree } from '../src/core/merkle';
import { sha256 } from '../src/core/hash';

describe('Boundary Conditions Tests', () => {
  describe('Power of Two Boundaries', () => {
    it('should handle 1 entry (2^0)', () => {
      const tree = new MerkleTree();
      tree.append(sha256('e'));
      expect(tree.size).toBe(1);
      expect(MerkleTree.verify(tree.getProof(0)!)).toBe(true);
    });

    it('should handle 2 entries (2^1)', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 2; i++) tree.append(sha256(`e${i}`));
      expect(tree.size).toBe(2);
      for (let i = 0; i < 2; i++) expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
    });

    it('should handle 4 entries (2^2)', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 4; i++) tree.append(sha256(`e${i}`));
      expect(tree.size).toBe(4);
      for (let i = 0; i < 4; i++) expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
    });

    it('should handle 8 entries (2^3)', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 8; i++) tree.append(sha256(`e${i}`));
      expect(tree.size).toBe(8);
      for (let i = 0; i < 8; i++) expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
    });

    it('should handle 16 entries (2^4)', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 16; i++) tree.append(sha256(`e${i}`));
      expect(tree.size).toBe(16);
      for (let i = 0; i < 16; i++) expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
    });

    it('should handle 32 entries (2^5)', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 32; i++) tree.append(sha256(`e${i}`));
      expect(tree.size).toBe(32);
      for (let i = 0; i < 32; i++) expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
    });

    it('should handle 64 entries (2^6)', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 64; i++) tree.append(sha256(`e${i}`));
      expect(tree.size).toBe(64);
      for (let i = 0; i < 64; i++) expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
    });

    it('should handle 128 entries (2^7)', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 128; i++) tree.append(sha256(`e${i}`));
      expect(tree.size).toBe(128);
      for (let i = 0; i < 128; i++) expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
    });

    it('should handle 256 entries (2^8)', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 256; i++) tree.append(sha256(`e${i}`));
      expect(tree.size).toBe(256);
      for (let i = 0; i < 256; i++) expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
    });

    it('should handle 512 entries (2^9)', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 512; i++) tree.append(sha256(`e${i}`));
      expect(tree.size).toBe(512);
      expect(MerkleTree.verify(tree.getProof(0)!)).toBe(true);
      expect(MerkleTree.verify(tree.getProof(255)!)).toBe(true);
      expect(MerkleTree.verify(tree.getProof(511)!)).toBe(true);
    });

    it('should handle 1024 entries (2^10)', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 1024; i++) tree.append(sha256(`e${i}`));
      expect(tree.size).toBe(1024);
      expect(MerkleTree.verify(tree.getProof(0)!)).toBe(true);
      expect(MerkleTree.verify(tree.getProof(511)!)).toBe(true);
      expect(MerkleTree.verify(tree.getProof(1023)!)).toBe(true);
    });
  });

  describe('Just Before Power of Two', () => {
    it('should handle 1 entry (2^1-1)', () => {
      const tree = new MerkleTree();
      tree.append(sha256('e'));
      expect(tree.size).toBe(1);
    });

    it('should handle 3 entries (2^2-1)', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 3; i++) tree.append(sha256(`e${i}`));
      expect(tree.size).toBe(3);
      for (let i = 0; i < 3; i++) expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
    });

    it('should handle 7 entries (2^3-1)', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 7; i++) tree.append(sha256(`e${i}`));
      expect(tree.size).toBe(7);
      for (let i = 0; i < 7; i++) expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
    });

    it('should handle 15 entries (2^4-1)', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 15; i++) tree.append(sha256(`e${i}`));
      expect(tree.size).toBe(15);
      for (let i = 0; i < 15; i++) expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
    });

    it('should handle 31 entries (2^5-1)', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 31; i++) tree.append(sha256(`e${i}`));
      expect(tree.size).toBe(31);
      for (let i = 0; i < 31; i++) expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
    });

    it('should handle 63 entries (2^6-1)', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 63; i++) tree.append(sha256(`e${i}`));
      expect(tree.size).toBe(63);
      for (let i = 0; i < 63; i++) expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
    });

    it('should handle 127 entries (2^7-1)', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 127; i++) tree.append(sha256(`e${i}`));
      expect(tree.size).toBe(127);
      for (let i = 0; i < 127; i++) expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
    });

    it('should handle 255 entries (2^8-1)', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 255; i++) tree.append(sha256(`e${i}`));
      expect(tree.size).toBe(255);
      for (let i = 0; i < 255; i++) expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
    });

    it('should handle 511 entries (2^9-1)', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 511; i++) tree.append(sha256(`e${i}`));
      expect(tree.size).toBe(511);
      expect(MerkleTree.verify(tree.getProof(0)!)).toBe(true);
      expect(MerkleTree.verify(tree.getProof(510)!)).toBe(true);
    });

    it('should handle 1023 entries (2^10-1)', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 1023; i++) tree.append(sha256(`e${i}`));
      expect(tree.size).toBe(1023);
      expect(MerkleTree.verify(tree.getProof(0)!)).toBe(true);
      expect(MerkleTree.verify(tree.getProof(1022)!)).toBe(true);
    });
  });

  describe('Just After Power of Two', () => {
    it('should handle 3 entries (2^1+1)', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 3; i++) tree.append(sha256(`e${i}`));
      expect(tree.size).toBe(3);
      for (let i = 0; i < 3; i++) expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
    });

    it('should handle 5 entries (2^2+1)', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 5; i++) tree.append(sha256(`e${i}`));
      expect(tree.size).toBe(5);
      for (let i = 0; i < 5; i++) expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
    });

    it('should handle 9 entries (2^3+1)', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 9; i++) tree.append(sha256(`e${i}`));
      expect(tree.size).toBe(9);
      for (let i = 0; i < 9; i++) expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
    });

    it('should handle 17 entries (2^4+1)', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 17; i++) tree.append(sha256(`e${i}`));
      expect(tree.size).toBe(17);
      for (let i = 0; i < 17; i++) expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
    });

    it('should handle 33 entries (2^5+1)', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 33; i++) tree.append(sha256(`e${i}`));
      expect(tree.size).toBe(33);
      for (let i = 0; i < 33; i++) expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
    });

    it('should handle 65 entries (2^6+1)', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 65; i++) tree.append(sha256(`e${i}`));
      expect(tree.size).toBe(65);
      for (let i = 0; i < 65; i++) expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
    });

    it('should handle 129 entries (2^7+1)', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 129; i++) tree.append(sha256(`e${i}`));
      expect(tree.size).toBe(129);
      for (let i = 0; i < 129; i++) expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
    });

    it('should handle 257 entries (2^8+1)', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 257; i++) tree.append(sha256(`e${i}`));
      expect(tree.size).toBe(257);
      for (let i = 0; i < 257; i++) expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
    });

    it('should handle 513 entries (2^9+1)', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 513; i++) tree.append(sha256(`e${i}`));
      expect(tree.size).toBe(513);
      expect(MerkleTree.verify(tree.getProof(0)!)).toBe(true);
      expect(MerkleTree.verify(tree.getProof(512)!)).toBe(true);
    });

    it('should handle 1025 entries (2^10+1)', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 1025; i++) tree.append(sha256(`e${i}`));
      expect(tree.size).toBe(1025);
      expect(MerkleTree.verify(tree.getProof(0)!)).toBe(true);
      expect(MerkleTree.verify(tree.getProof(1024)!)).toBe(true);
    });
  });

  describe('Index Boundary Conditions', () => {
    it('should access first index', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 10; i++) tree.append(sha256(`e${i}`));
      expect(tree.getProof(0)).not.toBeNull();
    });

    it('should access last index', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 10; i++) tree.append(sha256(`e${i}`));
      expect(tree.getProof(9)).not.toBeNull();
    });

    it('should throw at size boundary', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 10; i++) tree.append(sha256(`e${i}`));
      expect(() => tree.getProof(10)).toThrow();
    });

    it('should throw for negative', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 10; i++) tree.append(sha256(`e${i}`));
      expect(() => tree.getProof(-1)).toThrow();
    });

    it('should handle middle index', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 100; i++) tree.append(sha256(`e${i}`));
      expect(tree.getProof(50)).not.toBeNull();
    });

    it('should handle quarter index', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 100; i++) tree.append(sha256(`e${i}`));
      expect(tree.getProof(25)).not.toBeNull();
    });

    it('should handle three-quarter index', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 100; i++) tree.append(sha256(`e${i}`));
      expect(tree.getProof(75)).not.toBeNull();
    });
  });

  describe('String Length Boundaries', () => {
    it('should hash 0-length string', () => {
      expect(sha256('')).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash 1-char string', () => {
      expect(sha256('a')).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash 10-char string', () => {
      expect(sha256('a'.repeat(10))).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash 100-char string', () => {
      expect(sha256('a'.repeat(100))).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash 1000-char string', () => {
      expect(sha256('a'.repeat(1000))).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash 10000-char string', () => {
      expect(sha256('a'.repeat(10000))).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash 100000-char string', () => {
      expect(sha256('a'.repeat(100000))).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash 55-char string (SHA256 block boundary)', () => {
      expect(sha256('a'.repeat(55))).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash 56-char string (SHA256 block boundary)', () => {
      expect(sha256('a'.repeat(56))).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash 64-char string (SHA256 block size)', () => {
      expect(sha256('a'.repeat(64))).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash 63-char string', () => {
      expect(sha256('a'.repeat(63))).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash 65-char string', () => {
      expect(sha256('a'.repeat(65))).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('Proof Path Length Boundaries', () => {
    it('should have 0-length path for 1 entry', () => {
      const tree = new MerkleTree();
      tree.append(sha256('e'));
      expect(tree.getProof(0)!.proof.length).toBe(0);
    });

    it('should have 1-length path for 2 entries', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 2; i++) tree.append(sha256(`e${i}`));
      expect(tree.getProof(0)!.proof.length).toBe(1);
    });

    it('should have 2-length path for 3-4 entries', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 4; i++) tree.append(sha256(`e${i}`));
      expect(tree.getProof(0)!.proof.length).toBe(2);
    });

    it('should have 3-length path for 5-8 entries', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 8; i++) tree.append(sha256(`e${i}`));
      expect(tree.getProof(0)!.proof.length).toBe(3);
    });

    it('should have 4-length path for 9-16 entries', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 16; i++) tree.append(sha256(`e${i}`));
      expect(tree.getProof(0)!.proof.length).toBe(4);
    });

    it('should have 5-length path for 17-32 entries', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 32; i++) tree.append(sha256(`e${i}`));
      expect(tree.getProof(0)!.proof.length).toBe(5);
    });

    it('should have 10-length path for 1024 entries', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 1024; i++) tree.append(sha256(`e${i}`));
      expect(tree.getProof(0)!.proof.length).toBe(10);
    });
  });

  describe('Empty State Boundaries', () => {
    it('should have size 0 when empty', () => {
      const tree = new MerkleTree();
      expect(tree.size).toBe(0);
    });

    it('should have valid root when empty', () => {
      const tree = new MerkleTree();
      expect(tree.root).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should have empty leaves when empty', () => {
      const tree = new MerkleTree();
      expect(tree.getLeaves()).toEqual([]);
    });

    it('should throw on proof when empty', () => {
      const tree = new MerkleTree();
      expect(() => tree.getProof(0)).toThrow();
    });

    it('should transition from empty to non-empty', () => {
      const tree = new MerkleTree();
      expect(tree.size).toBe(0);
      tree.append(sha256('first'));
      expect(tree.size).toBe(1);
    });
  });

  describe('Root Transitions', () => {
    it('should change root from empty to single', () => {
      const tree = new MerkleTree();
      const emptyRoot = tree.root;
      tree.append(sha256('e'));
      expect(tree.root).not.toBe(emptyRoot);
    });

    it('should change root from single to double', () => {
      const tree = new MerkleTree();
      tree.append(sha256('e0'));
      const singleRoot = tree.root;
      tree.append(sha256('e1'));
      expect(tree.root).not.toBe(singleRoot);
    });

    it('should change root at power of 2 boundary', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 8; i++) tree.append(sha256(`e${i}`));
      const beforeRoot = tree.root;
      tree.append(sha256('e8'));
      expect(tree.root).not.toBe(beforeRoot);
    });

    it('should maintain unique roots during growth', () => {
      const tree = new MerkleTree();
      const roots = new Set<string>();
      for (let i = 0; i < 50; i++) {
        tree.append(sha256(`e${i}`));
        roots.add(tree.root);
      }
      expect(roots.size).toBe(50);
    });
  });
});
