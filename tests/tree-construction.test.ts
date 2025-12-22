/**
 * Tree Construction Tests
 *
 * Comprehensive tests for various tree construction scenarios.
 */

import { MerkleTree } from '../src/core/merkle';
import { sha256 } from '../src/core/hash';

describe('Tree Construction Tests', () => {
  describe('Empty Tree', () => {
    it('should create empty tree', () => {
      const tree = new MerkleTree();
      expect(tree.size).toBe(0);
    });

    it('should have valid root for empty tree', () => {
      const tree = new MerkleTree();
      expect(tree.root).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should have empty leaves for empty tree', () => {
      const tree = new MerkleTree();
      expect(tree.getLeaves()).toEqual([]);
    });

    it('should throw for proof on empty tree', () => {
      const tree = new MerkleTree();
      expect(() => tree.getProof(0)).toThrow();
    });

    it('should be ready for appends', () => {
      const tree = new MerkleTree();
      expect(() => tree.append(sha256('test'))).not.toThrow();
    });
  });

  describe('Single Element Tree', () => {
    it('should build with one element', () => {
      const tree = new MerkleTree();
      tree.append(sha256('single'));
      expect(tree.size).toBe(1);
    });

    it('should have valid root with one element', () => {
      const tree = new MerkleTree();
      tree.append(sha256('single'));
      expect(tree.root).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should return correct leaf', () => {
      const tree = new MerkleTree();
      const hash = sha256('single');
      tree.append(hash);
      expect(tree.getLeaves()).toEqual([hash]);
    });

    it('should generate valid proof', () => {
      const tree = new MerkleTree();
      tree.append(sha256('single'));
      const proof = tree.getProof(0);
      expect(proof).not.toBeNull();
      expect(MerkleTree.verify(proof!)).toBe(true);
    });
  });

  describe('Two Element Tree', () => {
    it('should build with two elements', () => {
      const tree = new MerkleTree();
      tree.append(sha256('a'));
      tree.append(sha256('b'));
      expect(tree.size).toBe(2);
    });

    it('should compute correct root', () => {
      const tree = new MerkleTree();
      tree.append(sha256('a'));
      tree.append(sha256('b'));
      expect(tree.root).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should return both leaves in order', () => {
      const tree = new MerkleTree();
      const hashA = sha256('a');
      const hashB = sha256('b');
      tree.append(hashA);
      tree.append(hashB);
      expect(tree.getLeaves()).toEqual([hashA, hashB]);
    });

    it('should generate valid proof for first element', () => {
      const tree = new MerkleTree();
      tree.append(sha256('a'));
      tree.append(sha256('b'));
      expect(MerkleTree.verify(tree.getProof(0)!)).toBe(true);
    });

    it('should generate valid proof for second element', () => {
      const tree = new MerkleTree();
      tree.append(sha256('a'));
      tree.append(sha256('b'));
      expect(MerkleTree.verify(tree.getProof(1)!)).toBe(true);
    });
  });

  describe('Power of Two Trees', () => {
    it('should build 4-element tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 4; i++) tree.append(sha256(`e${i}`));
      expect(tree.size).toBe(4);
    });

    it('should build 8-element tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 8; i++) tree.append(sha256(`e${i}`));
      expect(tree.size).toBe(8);
    });

    it('should build 16-element tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 16; i++) tree.append(sha256(`e${i}`));
      expect(tree.size).toBe(16);
    });

    it('should build 32-element tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 32; i++) tree.append(sha256(`e${i}`));
      expect(tree.size).toBe(32);
    });

    it('should build 64-element tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 64; i++) tree.append(sha256(`e${i}`));
      expect(tree.size).toBe(64);
    });

    it('should build 128-element tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 128; i++) tree.append(sha256(`e${i}`));
      expect(tree.size).toBe(128);
    });

    it('should build 256-element tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 256; i++) tree.append(sha256(`e${i}`));
      expect(tree.size).toBe(256);
    });

    it('should build 512-element tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 512; i++) tree.append(sha256(`e${i}`));
      expect(tree.size).toBe(512);
    });

    it('should build 1024-element tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 1024; i++) tree.append(sha256(`e${i}`));
      expect(tree.size).toBe(1024);
    });
  });

  describe('Non-Power of Two Trees', () => {
    it('should build 3-element tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 3; i++) tree.append(sha256(`e${i}`));
      expect(tree.size).toBe(3);
    });

    it('should build 5-element tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 5; i++) tree.append(sha256(`e${i}`));
      expect(tree.size).toBe(5);
    });

    it('should build 7-element tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 7; i++) tree.append(sha256(`e${i}`));
      expect(tree.size).toBe(7);
    });

    it('should build 9-element tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 9; i++) tree.append(sha256(`e${i}`));
      expect(tree.size).toBe(9);
    });

    it('should build 15-element tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 15; i++) tree.append(sha256(`e${i}`));
      expect(tree.size).toBe(15);
    });

    it('should build 17-element tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 17; i++) tree.append(sha256(`e${i}`));
      expect(tree.size).toBe(17);
    });

    it('should build 31-element tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 31; i++) tree.append(sha256(`e${i}`));
      expect(tree.size).toBe(31);
    });

    it('should build 33-element tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 33; i++) tree.append(sha256(`e${i}`));
      expect(tree.size).toBe(33);
    });

    it('should build 100-element tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 100; i++) tree.append(sha256(`e${i}`));
      expect(tree.size).toBe(100);
    });

    it('should build 999-element tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 999; i++) tree.append(sha256(`e${i}`));
      expect(tree.size).toBe(999);
    });
  });

  describe('Import Construction', () => {
    it('should import empty array', () => {
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
      const leaves = [sha256('a'), sha256('b'), sha256('c')];
      const tree = MerkleTree.import({ leaves });
      expect(tree.size).toBe(3);
      expect(tree.getLeaves()).toEqual(leaves);
    });

    it('should import 100 leaves', () => {
      const leaves = Array.from({ length: 100 }, (_, i) => sha256(`e${i}`));
      const tree = MerkleTree.import({ leaves });
      expect(tree.size).toBe(100);
    });

    it('should import 1000 leaves', () => {
      const leaves = Array.from({ length: 1000 }, (_, i) => sha256(`e${i}`));
      const tree = MerkleTree.import({ leaves });
      expect(tree.size).toBe(1000);
    });

    it('should match append construction', () => {
      const leaves = Array.from({ length: 50 }, (_, i) => sha256(`e${i}`));

      const appendTree = new MerkleTree();
      leaves.forEach(l => appendTree.append(l));

      const importTree = MerkleTree.import({ leaves });

      expect(importTree.root).toBe(appendTree.root);
      expect(importTree.size).toBe(appendTree.size);
    });

    it('should allow append after import', () => {
      const initial = [sha256('a'), sha256('b')];
      const tree = MerkleTree.import({ leaves: initial });
      tree.append(sha256('c'));
      expect(tree.size).toBe(3);
    });

    it('should verify proofs after import', () => {
      const leaves = Array.from({ length: 20 }, (_, i) => sha256(`e${i}`));
      const tree = MerkleTree.import({ leaves });
      for (let i = 0; i < 20; i++) {
        expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
      }
    });
  });

  describe('Sequential Construction', () => {
    it('should build sequentially from 1 to 100', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 100; i++) {
        tree.append(sha256(`e${i}`));
        expect(tree.size).toBe(i + 1);
      }
    });

    it('should maintain valid proofs during construction', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 50; i++) {
        tree.append(sha256(`e${i}`));
        for (let j = 0; j <= i; j++) {
          expect(MerkleTree.verify(tree.getProof(j)!)).toBe(true);
        }
      }
    });

    it('should track root changes during construction', () => {
      const tree = new MerkleTree();
      const roots = new Set<string>();
      for (let i = 0; i < 100; i++) {
        tree.append(sha256(`e${i}`));
        roots.add(tree.root);
      }
      expect(roots.size).toBe(100);
    });

    it('should return correct indices during construction', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 100; i++) {
        const idx = tree.append(sha256(`e${i}`));
        expect(idx).toBe(i);
      }
    });
  });

  describe('Duplicate Hash Construction', () => {
    it('should accept duplicate hashes', () => {
      const tree = new MerkleTree();
      const hash = sha256('duplicate');
      tree.append(hash);
      tree.append(hash);
      expect(tree.size).toBe(2);
    });

    it('should build with all same hashes', () => {
      const tree = new MerkleTree();
      const hash = sha256('same');
      for (let i = 0; i < 10; i++) tree.append(hash);
      expect(tree.size).toBe(10);
    });

    it('should verify proofs with duplicates', () => {
      const tree = new MerkleTree();
      const hash = sha256('duplicate');
      for (let i = 0; i < 10; i++) tree.append(hash);
      for (let i = 0; i < 10; i++) {
        expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
      }
    });

    it('should differentiate proof indices with duplicates', () => {
      const tree = new MerkleTree();
      const hash = sha256('same');
      tree.append(hash);
      tree.append(hash);
      const proof0 = tree.getProof(0)!;
      const proof1 = tree.getProof(1)!;
      expect(proof0.index).toBe(0);
      expect(proof1.index).toBe(1);
    });
  });

  describe('Mixed Content Construction', () => {
    it('should handle mixed content hashes', () => {
      const tree = new MerkleTree();
      tree.append(sha256('simple'));
      tree.append(sha256('with spaces'));
      tree.append(sha256('unicode: 中文'));
      tree.append(sha256('emoji: 🔐'));
      tree.append(sha256('')); // empty
      expect(tree.size).toBe(5);
    });

    it('should verify proofs for mixed content', () => {
      const tree = new MerkleTree();
      const contents = ['simple', 'spaces here', '中文', '🔐', '', '\n\t'];
      contents.forEach(c => tree.append(sha256(c)));
      for (let i = 0; i < contents.length; i++) {
        expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
      }
    });
  });

  describe('Large Tree Construction', () => {
    it('should build 500-element tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 500; i++) tree.append(sha256(`e${i}`));
      expect(tree.size).toBe(500);
    });

    it('should build 1000-element tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 1000; i++) tree.append(sha256(`e${i}`));
      expect(tree.size).toBe(1000);
    });

    it('should build 2000-element tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 2000; i++) tree.append(sha256(`e${i}`));
      expect(tree.size).toBe(2000);
    });

    it('should verify random proofs in large tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 1000; i++) tree.append(sha256(`e${i}`));
      const indices = [0, 100, 500, 750, 999];
      for (const idx of indices) {
        expect(MerkleTree.verify(tree.getProof(idx)!)).toBe(true);
      }
    });
  });
});
