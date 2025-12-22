/**
 * Advanced Merkle Tree Tests
 *
 * Comprehensive edge cases and advanced scenarios for Merkle tree operations.
 */

import { MerkleTree } from '../src/core/merkle';
import { sha256 } from '../src/core/hash';

describe('Advanced Merkle Tree Tests', () => {
  describe('Tree Construction Variations', () => {
    it('should handle single entry tree', () => {
      const tree = new MerkleTree();
      tree.append(sha256('single'));
      expect(tree.size).toBe(1);
      expect(tree.root).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle two entry tree', () => {
      const tree = new MerkleTree();
      tree.append(sha256('first'));
      tree.append(sha256('second'));
      expect(tree.size).toBe(2);
    });

    it('should handle three entry tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 3; i++) tree.append(sha256(`entry-${i}`));
      expect(tree.size).toBe(3);
    });

    it('should handle four entry tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 4; i++) tree.append(sha256(`entry-${i}`));
      expect(tree.size).toBe(4);
    });

    it('should handle five entry tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 5; i++) tree.append(sha256(`entry-${i}`));
      expect(tree.size).toBe(5);
    });

    it('should handle six entry tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 6; i++) tree.append(sha256(`entry-${i}`));
      expect(tree.size).toBe(6);
    });

    it('should handle seven entry tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 7; i++) tree.append(sha256(`entry-${i}`));
      expect(tree.size).toBe(7);
    });

    it('should handle eight entry tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 8; i++) tree.append(sha256(`entry-${i}`));
      expect(tree.size).toBe(8);
    });

    it('should handle 15 entry tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 15; i++) tree.append(sha256(`entry-${i}`));
      expect(tree.size).toBe(15);
    });

    it('should handle 16 entry tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 16; i++) tree.append(sha256(`entry-${i}`));
      expect(tree.size).toBe(16);
    });

    it('should handle 17 entry tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 17; i++) tree.append(sha256(`entry-${i}`));
      expect(tree.size).toBe(17);
    });

    it('should handle 31 entry tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 31; i++) tree.append(sha256(`entry-${i}`));
      expect(tree.size).toBe(31);
    });

    it('should handle 32 entry tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 32; i++) tree.append(sha256(`entry-${i}`));
      expect(tree.size).toBe(32);
    });

    it('should handle 33 entry tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 33; i++) tree.append(sha256(`entry-${i}`));
      expect(tree.size).toBe(33);
    });

    it('should handle 63 entry tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 63; i++) tree.append(sha256(`entry-${i}`));
      expect(tree.size).toBe(63);
    });

    it('should handle 64 entry tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 64; i++) tree.append(sha256(`entry-${i}`));
      expect(tree.size).toBe(64);
    });

    it('should handle 65 entry tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 65; i++) tree.append(sha256(`entry-${i}`));
      expect(tree.size).toBe(65);
    });

    it('should handle 100 entry tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 100; i++) tree.append(sha256(`entry-${i}`));
      expect(tree.size).toBe(100);
    });

    it('should handle 127 entry tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 127; i++) tree.append(sha256(`entry-${i}`));
      expect(tree.size).toBe(127);
    });

    it('should handle 128 entry tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 128; i++) tree.append(sha256(`entry-${i}`));
      expect(tree.size).toBe(128);
    });

    it('should handle 129 entry tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 129; i++) tree.append(sha256(`entry-${i}`));
      expect(tree.size).toBe(129);
    });

    it('should handle 255 entry tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 255; i++) tree.append(sha256(`entry-${i}`));
      expect(tree.size).toBe(255);
    });

    it('should handle 256 entry tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 256; i++) tree.append(sha256(`entry-${i}`));
      expect(tree.size).toBe(256);
    });

    it('should handle 257 entry tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 257; i++) tree.append(sha256(`entry-${i}`));
      expect(tree.size).toBe(257);
    });

    it('should handle 500 entry tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 500; i++) tree.append(sha256(`entry-${i}`));
      expect(tree.size).toBe(500);
    });

    it('should handle 511 entry tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 511; i++) tree.append(sha256(`entry-${i}`));
      expect(tree.size).toBe(511);
    });

    it('should handle 512 entry tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 512; i++) tree.append(sha256(`entry-${i}`));
      expect(tree.size).toBe(512);
    });

    it('should handle 513 entry tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 513; i++) tree.append(sha256(`entry-${i}`));
      expect(tree.size).toBe(513);
    });

    it('should handle 1000 entry tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 1000; i++) tree.append(sha256(`entry-${i}`));
      expect(tree.size).toBe(1000);
    });

    it('should handle 1023 entry tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 1023; i++) tree.append(sha256(`entry-${i}`));
      expect(tree.size).toBe(1023);
    });

    it('should handle 1024 entry tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 1024; i++) tree.append(sha256(`entry-${i}`));
      expect(tree.size).toBe(1024);
    });

    it('should handle 1025 entry tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 1025; i++) tree.append(sha256(`entry-${i}`));
      expect(tree.size).toBe(1025);
    });
  });

  describe('Proof Path Lengths', () => {
    it('should have path length 0 for 1 entry', () => {
      const tree = new MerkleTree();
      tree.append(sha256('entry'));
      expect(tree.getProof(0)!.proof.length).toBe(0);
    });

    it('should have path length 1 for 2 entries', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 2; i++) tree.append(sha256(`entry-${i}`));
      expect(tree.getProof(0)!.proof.length).toBe(1);
    });

    it('should have path length 2 for 3-4 entries', () => {
      for (let size = 3; size <= 4; size++) {
        const tree = new MerkleTree();
        for (let i = 0; i < size; i++) tree.append(sha256(`entry-${i}`));
        expect(tree.getProof(0)!.proof.length).toBe(2);
      }
    });

    it('should have path length 3 for 5-8 entries', () => {
      for (let size = 5; size <= 8; size++) {
        const tree = new MerkleTree();
        for (let i = 0; i < size; i++) tree.append(sha256(`entry-${i}`));
        expect(tree.getProof(0)!.proof.length).toBe(3);
      }
    });

    it('should have path length 4 for 9-16 entries', () => {
      for (let size = 9; size <= 16; size++) {
        const tree = new MerkleTree();
        for (let i = 0; i < size; i++) tree.append(sha256(`entry-${i}`));
        expect(tree.getProof(0)!.proof.length).toBe(4);
      }
    });

    it('should have path length 5 for 17-32 entries', () => {
      for (let size = 17; size <= 32; size++) {
        const tree = new MerkleTree();
        for (let i = 0; i < size; i++) tree.append(sha256(`entry-${i}`));
        expect(tree.getProof(0)!.proof.length).toBe(5);
      }
    });

    it('should have path length 6 for 33-64 entries', () => {
      for (let size = 33; size <= 64; size++) {
        const tree = new MerkleTree();
        for (let i = 0; i < size; i++) tree.append(sha256(`entry-${i}`));
        expect(tree.getProof(0)!.proof.length).toBe(6);
      }
    });

    it('should have path length 7 for 65-128 entries', () => {
      for (let size = 65; size <= 128; size++) {
        const tree = new MerkleTree();
        for (let i = 0; i < size; i++) tree.append(sha256(`entry-${i}`));
        expect(tree.getProof(0)!.proof.length).toBe(7);
      }
    });

    it('should have path length 8 for 129-256 entries', () => {
      for (let size = 129; size <= 256; size++) {
        const tree = new MerkleTree();
        for (let i = 0; i < size; i++) tree.append(sha256(`entry-${i}`));
        expect(tree.getProof(0)!.proof.length).toBe(8);
      }
    });

    it('should have path length 10 for 1024 entries', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 1024; i++) tree.append(sha256(`entry-${i}`));
      expect(tree.getProof(0)!.proof.length).toBe(10);
    });
  });

  describe('Proof Verification at All Positions', () => {
    it('should verify all proofs in 8-entry tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 8; i++) tree.append(sha256(`entry-${i}`));
      for (let i = 0; i < 8; i++) {
        expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
      }
    });

    it('should verify all proofs in 16-entry tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 16; i++) tree.append(sha256(`entry-${i}`));
      for (let i = 0; i < 16; i++) {
        expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
      }
    });

    it('should verify all proofs in 32-entry tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 32; i++) tree.append(sha256(`entry-${i}`));
      for (let i = 0; i < 32; i++) {
        expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
      }
    });

    it('should verify all proofs in 64-entry tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 64; i++) tree.append(sha256(`entry-${i}`));
      for (let i = 0; i < 64; i++) {
        expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
      }
    });

    it('should verify all proofs in 100-entry tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 100; i++) tree.append(sha256(`entry-${i}`));
      for (let i = 0; i < 100; i++) {
        expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
      }
    });

    it('should verify all proofs in 128-entry tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 128; i++) tree.append(sha256(`entry-${i}`));
      for (let i = 0; i < 128; i++) {
        expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
      }
    });

    it('should verify all proofs in 256-entry tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 256; i++) tree.append(sha256(`entry-${i}`));
      for (let i = 0; i < 256; i++) {
        expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
      }
    });
  });

  describe('Tree Comparison', () => {
    it('should have same root for identical trees', () => {
      const tree1 = new MerkleTree();
      const tree2 = new MerkleTree();
      for (let i = 0; i < 50; i++) {
        const hash = sha256(`entry-${i}`);
        tree1.append(hash);
        tree2.append(hash);
      }
      expect(tree1.root).toBe(tree2.root);
    });

    it('should have different roots for different order', () => {
      const tree1 = new MerkleTree();
      const tree2 = new MerkleTree();
      tree1.append(sha256('a'));
      tree1.append(sha256('b'));
      tree2.append(sha256('b'));
      tree2.append(sha256('a'));
      expect(tree1.root).not.toBe(tree2.root);
    });

    it('should have different roots for different content', () => {
      const tree1 = new MerkleTree();
      const tree2 = new MerkleTree();
      tree1.append(sha256('content1'));
      tree2.append(sha256('content2'));
      expect(tree1.root).not.toBe(tree2.root);
    });

    it('should have different roots for different sizes', () => {
      const tree1 = new MerkleTree();
      const tree2 = new MerkleTree();
      tree1.append(sha256('a'));
      tree2.append(sha256('a'));
      tree2.append(sha256('b'));
      expect(tree1.root).not.toBe(tree2.root);
    });
  });

  describe('Import/Export Consistency', () => {
    it('should export and import 10 entries', () => {
      const tree1 = new MerkleTree();
      for (let i = 0; i < 10; i++) tree1.append(sha256(`entry-${i}`));
      const tree2 = MerkleTree.import({ leaves: tree1.getLeaves() });
      expect(tree1.root).toBe(tree2.root);
    });

    it('should export and import 50 entries', () => {
      const tree1 = new MerkleTree();
      for (let i = 0; i < 50; i++) tree1.append(sha256(`entry-${i}`));
      const tree2 = MerkleTree.import({ leaves: tree1.getLeaves() });
      expect(tree1.root).toBe(tree2.root);
    });

    it('should export and import 100 entries', () => {
      const tree1 = new MerkleTree();
      for (let i = 0; i < 100; i++) tree1.append(sha256(`entry-${i}`));
      const tree2 = MerkleTree.import({ leaves: tree1.getLeaves() });
      expect(tree1.root).toBe(tree2.root);
    });

    it('should export and import 256 entries', () => {
      const tree1 = new MerkleTree();
      for (let i = 0; i < 256; i++) tree1.append(sha256(`entry-${i}`));
      const tree2 = MerkleTree.import({ leaves: tree1.getLeaves() });
      expect(tree1.root).toBe(tree2.root);
    });

    it('should export and import 500 entries', () => {
      const tree1 = new MerkleTree();
      for (let i = 0; i < 500; i++) tree1.append(sha256(`entry-${i}`));
      const tree2 = MerkleTree.import({ leaves: tree1.getLeaves() });
      expect(tree1.root).toBe(tree2.root);
    });

    it('should preserve all leaves on export', () => {
      const tree = new MerkleTree();
      const hashes: string[] = [];
      for (let i = 0; i < 100; i++) {
        const hash = sha256(`entry-${i}`);
        hashes.push(hash);
        tree.append(hash);
      }
      expect(tree.getLeaves()).toEqual(hashes);
    });
  });

  describe('Root Uniqueness', () => {
    it('should produce unique roots for 100 different single-entry trees', () => {
      const roots = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const tree = new MerkleTree();
        tree.append(sha256(`unique-${i}`));
        roots.add(tree.root);
      }
      expect(roots.size).toBe(100);
    });

    it('should produce unique roots during sequential appends', () => {
      const tree = new MerkleTree();
      const roots: string[] = [];
      for (let i = 0; i < 100; i++) {
        tree.append(sha256(`entry-${i}`));
        roots.push(tree.root);
      }
      expect(new Set(roots).size).toBe(100);
    });
  });

  describe('Proof Direction Patterns', () => {
    it('should have correct directions for index 0 in 2-entry tree', () => {
      const tree = new MerkleTree();
      tree.append(sha256('a'));
      tree.append(sha256('b'));
      const proof = tree.getProof(0)!;
      expect(proof.directions).toEqual(['right']);
    });

    it('should have correct directions for index 1 in 2-entry tree', () => {
      const tree = new MerkleTree();
      tree.append(sha256('a'));
      tree.append(sha256('b'));
      const proof = tree.getProof(1)!;
      expect(proof.directions).toEqual(['left']);
    });

    it('should have correct directions for index 0 in 4-entry tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 4; i++) tree.append(sha256(`e${i}`));
      const proof = tree.getProof(0)!;
      expect(proof.directions[0]).toBe('right');
      expect(proof.directions[1]).toBe('right');
    });

    it('should have correct directions for index 3 in 4-entry tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 4; i++) tree.append(sha256(`e${i}`));
      const proof = tree.getProof(3)!;
      expect(proof.directions[0]).toBe('left');
      expect(proof.directions[1]).toBe('left');
    });
  });

  describe('Leaf Correspondence', () => {
    it('should match leaf hash in proof with appended hash', () => {
      const tree = new MerkleTree();
      const hashes: string[] = [];
      for (let i = 0; i < 20; i++) {
        const hash = sha256(`entry-${i}`);
        hashes.push(hash);
        tree.append(hash);
      }
      for (let i = 0; i < 20; i++) {
        const proof = tree.getProof(i)!;
        expect(proof.leaf).toBe(hashes[i]);
      }
    });
  });

  describe('Empty Tree Behavior', () => {
    it('should have size 0 when empty', () => {
      const tree = new MerkleTree();
      expect(tree.size).toBe(0);
    });

    it('should throw for proof on empty tree', () => {
      const tree = new MerkleTree();
      expect(() => tree.getProof(0)).toThrow();
    });

    it('should return empty leaves for empty tree', () => {
      const tree = new MerkleTree();
      expect(tree.getLeaves()).toEqual([]);
    });

    it('should have valid root hash for empty tree', () => {
      const tree = new MerkleTree();
      expect(tree.root).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('Large Index Handling', () => {
    it('should throw for index equal to size', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 10; i++) tree.append(sha256(`e${i}`));
      expect(() => tree.getProof(10)).toThrow();
    });

    it('should throw for index greater than size', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 10; i++) tree.append(sha256(`e${i}`));
      expect(() => tree.getProof(100)).toThrow();
    });

    it('should throw for very large index', () => {
      const tree = new MerkleTree();
      tree.append(sha256('single'));
      expect(() => tree.getProof(1000000)).toThrow();
    });

    it('should throw for negative index', () => {
      const tree = new MerkleTree();
      tree.append(sha256('single'));
      expect(() => tree.getProof(-1)).toThrow();
    });

    it('should throw for -100 index', () => {
      const tree = new MerkleTree();
      tree.append(sha256('single'));
      expect(() => tree.getProof(-100)).toThrow();
    });
  });

  describe('Tampered Proof Detection', () => {
    it('should reject proof with modified leaf', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 16; i++) tree.append(sha256(`e${i}`));
      const proof = { ...tree.getProof(5)!, leaf: 'x'.repeat(64) };
      expect(MerkleTree.verify(proof)).toBe(false);
    });

    it('should reject proof with modified root', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 16; i++) tree.append(sha256(`e${i}`));
      const proof = { ...tree.getProof(5)!, root: 'y'.repeat(64) };
      expect(MerkleTree.verify(proof)).toBe(false);
    });

    it('should reject proof with modified path element', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 16; i++) tree.append(sha256(`e${i}`));
      const original = tree.getProof(5)!;
      const modifiedPath = [...original.proof];
      modifiedPath[0] = 'z'.repeat(64);
      const proof = { ...original, proof: modifiedPath };
      expect(MerkleTree.verify(proof)).toBe(false);
    });

    it('should reject proof with flipped direction', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 16; i++) tree.append(sha256(`e${i}`));
      const original = tree.getProof(5)!;
      const modifiedDirs = [...original.directions];
      modifiedDirs[0] = modifiedDirs[0] === 'left' ? 'right' : 'left';
      const proof = { ...original, directions: modifiedDirs };
      expect(MerkleTree.verify(proof)).toBe(false);
    });

    it('should reject proof with truncated path', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 16; i++) tree.append(sha256(`e${i}`));
      const original = tree.getProof(5)!;
      const proof = {
        ...original,
        proof: original.proof.slice(0, -1),
        directions: original.directions.slice(0, -1)
      };
      expect(MerkleTree.verify(proof)).toBe(false);
    });

    it('should reject proof with extended path', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 16; i++) tree.append(sha256(`e${i}`));
      const original = tree.getProof(5)!;
      const proof = {
        ...original,
        proof: [...original.proof, 'a'.repeat(64)],
        directions: [...original.directions, 'left' as const]
      };
      expect(MerkleTree.verify(proof)).toBe(false);
    });

    it('should reject proof with wrong index', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 16; i++) tree.append(sha256(`e${i}`));
      const proof = { ...tree.getProof(5)!, index: 7 };
      expect(MerkleTree.verify(proof)).toBe(false);
    });
  });

  describe('Consistency After Multiple Operations', () => {
    it('should maintain valid proofs after 100 appends', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 100; i++) {
        tree.append(sha256(`entry-${i}`));
        const proof = tree.getProof(i);
        expect(MerkleTree.verify(proof!)).toBe(true);
      }
    });

    it('should maintain consistent root during proof requests', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 50; i++) tree.append(sha256(`e${i}`));
      const roots = Array.from({ length: 100 }, (_, i) => tree.getProof(i % 50)!.root);
      expect(new Set(roots).size).toBe(1);
    });
  });
});
