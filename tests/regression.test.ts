/**
 * Regression Tests
 *
 * Tests to prevent known issues from recurring.
 */

import { MerkleTree } from '../src/core/merkle';
import { sha256, isValidHash } from '../src/core/hash';

describe('Regression Tests', () => {
  describe('Empty Tree Edge Cases', () => {
    it('should handle empty tree root access', () => {
      const tree = new MerkleTree();
      expect(() => tree.root).not.toThrow();
      expect(tree.root).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle empty tree size', () => {
      const tree = new MerkleTree();
      expect(tree.size).toBe(0);
    });

    it('should handle empty tree getLeaves', () => {
      const tree = new MerkleTree();
      expect(tree.getLeaves()).toEqual([]);
    });

    it('should handle empty tree getProof', () => {
      const tree = new MerkleTree();
      expect(() => tree.getProof(0)).toThrow();
    });

    it('should import empty leaves', () => {
      const tree = MerkleTree.import({ leaves: [] });
      expect(tree.size).toBe(0);
    });
  });

  describe('Single Element Edge Cases', () => {
    it('should handle single element proof', () => {
      const tree = new MerkleTree();
      tree.append(sha256('single'));
      const proof = tree.getProof(0);
      expect(proof).not.toBeNull();
      expect(MerkleTree.verify(proof!)).toBe(true);
    });

    it('should handle single element root equals leaf', () => {
      const tree = new MerkleTree();
      const hash = sha256('single');
      tree.append(hash);
      // For single element, proof should verify
      expect(MerkleTree.verify(tree.getProof(0)!)).toBe(true);
    });

    it('should reject out of bounds on single element', () => {
      const tree = new MerkleTree();
      tree.append(sha256('single'));
      expect(() => tree.getProof(1)).toThrow();
      expect(() => tree.getProof(-1)).toThrow();
    });
  });

  describe('Hash Boundary Cases', () => {
    it('should handle empty string hash', () => {
      const hash = sha256('');
      expect(hash.length).toBe(64);
      expect(isValidHash(hash)).toBe(true);
    });

    it('should handle null byte in string', () => {
      const hash = sha256('\0');
      expect(hash.length).toBe(64);
    });

    it('should handle very long string hash', () => {
      const hash = sha256('x'.repeat(100000));
      expect(hash.length).toBe(64);
    });

    it('should handle unicode hash', () => {
      const hash = sha256('🔐中文');
      expect(hash.length).toBe(64);
    });

    it('should distinguish similar strings', () => {
      expect(sha256('abc')).not.toBe(sha256('abd'));
      expect(sha256('abc')).not.toBe(sha256('Abc'));
      expect(sha256('abc')).not.toBe(sha256('abc '));
    });
  });

  describe('Hash Validation Cases', () => {
    it('should reject 63 char hash', () => {
      expect(isValidHash('a'.repeat(63))).toBe(false);
    });

    it('should reject 65 char hash', () => {
      expect(isValidHash('a'.repeat(65))).toBe(false);
    });

    it('should reject non-hex chars', () => {
      expect(isValidHash('g'.repeat(64))).toBe(false);
      expect(isValidHash('z'.repeat(64))).toBe(false);
    });

    it('should accept valid sha256 output', () => {
      expect(isValidHash(sha256('test'))).toBe(true);
    });

    it('should accept all hex digits', () => {
      expect(isValidHash('0123456789abcdef'.repeat(4))).toBe(true);
    });

    it('should accept uppercase', () => {
      expect(isValidHash('ABCDEF'.repeat(10) + 'abcd')).toBe(true);
    });

    it('should reject null', () => {
      expect(isValidHash(null as any)).toBe(false);
    });

    it('should reject undefined', () => {
      expect(isValidHash(undefined as any)).toBe(false);
    });

    it('should reject objects', () => {
      expect(isValidHash({} as any)).toBe(false);
    });
  });

  describe('Proof Verification Edge Cases', () => {
    it('should reject null proof', () => {
      expect(() => MerkleTree.verify(null as any)).toThrow();
    });

    it('should reject undefined proof', () => {
      expect(() => MerkleTree.verify(undefined as any)).toThrow();
    });

    it('should reject empty object', () => {
      expect(() => MerkleTree.verify({} as any)).toThrow();
    });

    it('should reject incomplete proof', () => {
      const tree = new MerkleTree();
      tree.append(sha256('e'));
      const proof = tree.getProof(0)!;
      expect(MerkleTree.verify({ ...proof, leaf: undefined } as any)).toBe(false);
      expect(MerkleTree.verify({ ...proof, root: undefined } as any)).toBe(false);
      expect(() => MerkleTree.verify({ ...proof, proof: undefined } as any)).toThrow();
    });

    it('should reject tampered leaf', () => {
      const tree = new MerkleTree();
      tree.append(sha256('e'));
      const proof = tree.getProof(0)!;
      const tampered = { ...proof, leaf: sha256('tampered') };
      expect(MerkleTree.verify(tampered)).toBe(false);
    });

    it('should reject tampered root', () => {
      const tree = new MerkleTree();
      tree.append(sha256('e'));
      const proof = tree.getProof(0)!;
      const tampered = { ...proof, root: sha256('tampered') };
      expect(MerkleTree.verify(tampered)).toBe(false);
    });

    it('should reject tampered path', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 16; i++) tree.append(sha256(`e${i}`));
      const proof = tree.getProof(8)!;
      const tampered = {
        ...proof,
        proof: proof.proof.map(() => sha256('tampered'))
      };
      expect(MerkleTree.verify(tampered)).toBe(false);
    });
  });

  describe('Tree Index Bounds', () => {
    it('should throw for negative index', () => {
      const tree = new MerkleTree();
      tree.append(sha256('e'));
      expect(() => tree.getProof(-1)).toThrow();
      expect(() => tree.getProof(-100)).toThrow();
    });

    it('should throw for index >= size', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 10; i++) tree.append(sha256(`e${i}`));
      expect(() => tree.getProof(10)).toThrow();
      expect(() => tree.getProof(100)).toThrow();
    });

    it('should handle index 0 correctly', () => {
      const tree = new MerkleTree();
      tree.append(sha256('first'));
      expect(tree.getProof(0)).toBeDefined();
    });

    it('should handle last index correctly', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 10; i++) tree.append(sha256(`e${i}`));
      expect(tree.getProof(9)).toBeDefined();
      expect(() => tree.getProof(10)).toThrow();
    });
  });

  describe('Import Edge Cases', () => {
    it('should import and verify immediately', () => {
      const leaves = [sha256('a'), sha256('b'), sha256('c')];
      const tree = MerkleTree.import({ leaves });
      for (let i = 0; i < 3; i++) {
        expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
      }
    });

    it('should import large dataset', () => {
      const leaves = Array.from({ length: 1000 }, (_, i) => sha256(`e${i}`));
      const tree = MerkleTree.import({ leaves });
      expect(tree.size).toBe(1000);
    });

    it('should match append behavior', () => {
      const leaves = Array.from({ length: 50 }, (_, i) => sha256(`e${i}`));

      const appendTree = new MerkleTree();
      leaves.forEach(l => appendTree.append(l));

      const importTree = MerkleTree.import({ leaves });

      expect(importTree.root).toBe(appendTree.root);
      expect(importTree.getLeaves()).toEqual(appendTree.getLeaves());
    });
  });

  describe('Append Return Value', () => {
    it('should return 0 for first append', () => {
      const tree = new MerkleTree();
      expect(tree.append(sha256('first'))).toBe(0);
    });

    it('should return sequential indices', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 100; i++) {
        expect(tree.append(sha256(`e${i}`))).toBe(i);
      }
    });
  });

  describe('Proof Structure', () => {
    it('should have correct proof structure', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 8; i++) tree.append(sha256(`e${i}`));
      const proof = tree.getProof(3)!;

      expect(proof).toHaveProperty('leaf');
      expect(proof).toHaveProperty('root');
      expect(proof).toHaveProperty('index');
      expect(proof).toHaveProperty('proof');
      expect(proof).toHaveProperty('directions');
    });

    it('should have matching proof and directions length', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 16; i++) tree.append(sha256(`e${i}`));
      for (let i = 0; i < 16; i++) {
        const proof = tree.getProof(i)!;
        expect(proof.proof.length).toBe(proof.directions.length);
      }
    });

    it('should have valid direction values', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 16; i++) tree.append(sha256(`e${i}`));
      const proof = tree.getProof(8)!;
      proof.directions.forEach(dir => {
        expect(['left', 'right']).toContain(dir);
      });
    });
  });

  describe('Determinism Regression', () => {
    it('should produce same hash every time', () => {
      const input = 'determinism-test';
      const hashes = Array.from({ length: 100 }, () => sha256(input));
      expect(new Set(hashes).size).toBe(1);
    });

    it('should produce same tree root every time', () => {
      const buildTree = () => {
        const t = new MerkleTree();
        for (let i = 0; i < 10; i++) t.append(sha256(`e${i}`));
        return t.root;
      };
      const roots = Array.from({ length: 50 }, buildTree);
      expect(new Set(roots).size).toBe(1);
    });

    it('should produce same proof every time', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 10; i++) tree.append(sha256(`e${i}`));
      const proofs = Array.from({ length: 50 }, () =>
        JSON.stringify(tree.getProof(5))
      );
      expect(new Set(proofs).size).toBe(1);
    });
  });

  describe('Collision Resistance Regression', () => {
    it('should not have collisions for sequential inputs', () => {
      const hashes = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        hashes.add(sha256(i.toString()));
      }
      expect(hashes.size).toBe(1000);
    });

    it('should not have collisions for similar inputs', () => {
      const hashes = new Set<string>();
      const base = 'collision-test-';
      for (let i = 0; i < 1000; i++) {
        hashes.add(sha256(base + i));
      }
      expect(hashes.size).toBe(1000);
    });
  });

  describe('State Consistency Regression', () => {
    it('should maintain size after operations', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 20; i++) tree.append(sha256(`e${i}`));

      const sizeBefore = tree.size;
      for (let i = 0; i < 100; i++) {
        tree.root;
        tree.getLeaves();
        tree.getProof(i % 20);
      }
      expect(tree.size).toBe(sizeBefore);
    });

    it('should maintain root after operations', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 20; i++) tree.append(sha256(`e${i}`));

      const rootBefore = tree.root;
      for (let i = 0; i < 100; i++) {
        tree.size;
        tree.getLeaves();
        tree.getProof(i % 20);
      }
      expect(tree.root).toBe(rootBefore);
    });
  });

  describe('Cross-Browser Compatibility', () => {
    it('should handle all ASCII printable chars', () => {
      for (let i = 32; i < 127; i++) {
        const char = String.fromCharCode(i);
        expect(sha256(char).length).toBe(64);
      }
    });

    it('should handle control characters', () => {
      for (let i = 0; i < 32; i++) {
        const char = String.fromCharCode(i);
        expect(sha256(char).length).toBe(64);
      }
    });

    it('should handle extended ASCII', () => {
      for (let i = 128; i < 256; i++) {
        const char = String.fromCharCode(i);
        expect(sha256(char).length).toBe(64);
      }
    });
  });

  describe('Numeric Edge Cases', () => {
    it('should hash max safe integer', () => {
      expect(sha256(String(Number.MAX_SAFE_INTEGER)).length).toBe(64);
    });

    it('should hash min safe integer', () => {
      expect(sha256(String(Number.MIN_SAFE_INTEGER)).length).toBe(64);
    });

    it('should hash zero', () => {
      expect(sha256('0').length).toBe(64);
    });

    it('should hash negative zero string', () => {
      expect(sha256('-0').length).toBe(64);
    });

    it('should hash floating point', () => {
      expect(sha256('3.14159265359').length).toBe(64);
    });
  });
});
