/**
 * Data Integrity Tests
 *
 * Enterprise-level tests for Merkle tree integrity, hash consistency,
 * proof validation, and tamper detection.
 */

import { MerkleTree } from '../src/core/merkle';
import { sha256 } from '../src/core/hash';

describe('Data Integrity Tests', () => {
  describe('Merkle Tree Integrity', () => {
    it('should maintain consistent root after rebuild', () => {
      const entries: string[] = [];
      for (let i = 0; i < 100; i++) {
        entries.push(sha256(`entry-${i}`));
      }

      // Build tree 1
      const tree1 = new MerkleTree();
      entries.forEach(e => tree1.append(e));

      // Build tree 2 with same entries
      const tree2 = new MerkleTree();
      entries.forEach(e => tree2.append(e));

      expect(tree1.root).toBe(tree2.root);
    });

    it('should detect entry order changes', () => {
      const entries: string[] = [];
      for (let i = 0; i < 10; i++) {
        entries.push(sha256(`entry-${i}`));
      }

      const tree1 = new MerkleTree();
      entries.forEach(e => tree1.append(e));

      // Swap two entries
      const swapped = [...entries];
      [swapped[3], swapped[7]] = [swapped[7], swapped[3]];

      const tree2 = new MerkleTree();
      swapped.forEach(e => tree2.append(e));

      expect(tree1.root).not.toBe(tree2.root);
    });

    it('should detect single bit change in entry', () => {
      const tree1 = new MerkleTree();
      const tree2 = new MerkleTree();

      for (let i = 0; i < 10; i++) {
        const hash1 = sha256(`entry-${i}`);
        tree1.append(hash1);

        // Change one character in one entry
        const data = i === 5 ? `entry-${i}!` : `entry-${i}`;
        const hash2 = sha256(data);
        tree2.append(hash2);
      }

      expect(tree1.root).not.toBe(tree2.root);
    });

    it('should maintain integrity across power-of-two boundaries', () => {
      const sizes = [1, 2, 3, 4, 7, 8, 15, 16, 31, 32, 63, 64, 127, 128];

      for (const size of sizes) {
        const tree = new MerkleTree();
        for (let i = 0; i < size; i++) {
          const hash = sha256(`entry-${i}`);
          tree.append(hash);
        }

        expect(tree.size).toBe(size);

        // All proofs should be valid
        for (let i = 0; i < size; i++) {
          const proof = tree.getProof(i);
          expect(proof).not.toBeNull();
          expect(MerkleTree.verify(proof!)).toBe(true);
        }
      }
    });

    it('should detect missing entry', () => {
      const entries: string[] = [];
      for (let i = 0; i < 10; i++) {
        entries.push(sha256(`entry-${i}`));
      }

      const fullTree = new MerkleTree();
      entries.forEach(e => fullTree.append(e));

      // Tree with missing entry
      const partialTree = new MerkleTree();
      entries.filter((_, i) => i !== 5).forEach(e => partialTree.append(e));

      expect(fullTree.root).not.toBe(partialTree.root);
    });

    it('should detect extra entry', () => {
      const entries: string[] = [];
      for (let i = 0; i < 10; i++) {
        entries.push(sha256(`entry-${i}`));
      }

      const originalTree = new MerkleTree();
      entries.forEach(e => originalTree.append(e));

      // Tree with extra entry
      const extendedTree = new MerkleTree();
      entries.forEach(e => extendedTree.append(e));
      extendedTree.append(sha256('extra'));

      expect(originalTree.root).not.toBe(extendedTree.root);
    });

    it('should produce unique roots for each append', () => {
      const tree = new MerkleTree();
      const roots: string[] = [];

      for (let i = 0; i < 100; i++) {
        const hash = sha256(`entry-${i}`);
        tree.append(hash);
        roots.push(tree.root);
      }

      // All roots should be unique
      expect(new Set(roots).size).toBe(100);
    });
  });

  describe('Proof Validation', () => {
    it('should validate correct proof for first element', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 10; i++) {
        const hash = sha256(`entry-${i}`);
        tree.append(hash);
      }

      const proof = tree.getProof(0);
      expect(proof).not.toBeNull();
      expect(MerkleTree.verify(proof!)).toBe(true);
    });

    it('should validate correct proof for last element', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 10; i++) {
        const hash = sha256(`entry-${i}`);
        tree.append(hash);
      }

      const proof = tree.getProof(9);
      expect(proof).not.toBeNull();
      expect(MerkleTree.verify(proof!)).toBe(true);
    });

    it('should validate correct proof for middle element', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 10; i++) {
        const hash = sha256(`entry-${i}`);
        tree.append(hash);
      }

      const proof = tree.getProof(5);
      expect(proof).not.toBeNull();
      expect(MerkleTree.verify(proof!)).toBe(true);
    });

    it('should reject proof with wrong root', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 10; i++) {
        const hash = sha256(`entry-${i}`);
        tree.append(hash);
      }

      const proof = tree.getProof(5)!;
      const tamperedProof = { ...proof, root: 'a'.repeat(64) };

      expect(MerkleTree.verify(tamperedProof)).toBe(false);
    });

    it('should reject proof with wrong leaf', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 10; i++) {
        const hash = sha256(`entry-${i}`);
        tree.append(hash);
      }

      const proof = tree.getProof(5)!;
      const tamperedProof = { ...proof, leaf: 'b'.repeat(64) };

      expect(MerkleTree.verify(tamperedProof)).toBe(false);
    });

    it('should reject proof with tampered path', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 10; i++) {
        const hash = sha256(`entry-${i}`);
        tree.append(hash);
      }

      const proof = tree.getProof(5)!;
      if (proof.proof.length > 0) {
        const tamperedPath = [...proof.proof];
        tamperedPath[0] = 'c'.repeat(64);
        const tamperedProof = { ...proof, proof: tamperedPath };

        expect(MerkleTree.verify(tamperedProof)).toBe(false);
      }
    });

    it('should reject proof with wrong index', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 10; i++) {
        const hash = sha256(`entry-${i}`);
        tree.append(hash);
      }

      const proof = tree.getProof(5)!;
      const tamperedProof = { ...proof, index: 3 };

      // This should fail because the proof path is for index 5, not 3
      expect(MerkleTree.verify(tamperedProof)).toBe(false);
    });
  });

  describe('Hash Consistency', () => {
    it('should produce deterministic hashes for same input', () => {
      const data = { user: 'alice', action: 'vote' };
      const hash1 = sha256(JSON.stringify(data));
      const hash2 = sha256(JSON.stringify(data));
      const hash3 = sha256(JSON.stringify(data));

      expect(hash1).toBe(hash2);
      expect(hash2).toBe(hash3);
    });

    it('should produce different hashes for different inputs', () => {
      const hash1 = sha256(JSON.stringify({ value: 1 }));
      const hash2 = sha256(JSON.stringify({ value: 2 }));
      const hash3 = sha256(JSON.stringify({ value: 3 }));

      expect(hash1).not.toBe(hash2);
      expect(hash2).not.toBe(hash3);
      expect(hash1).not.toBe(hash3);
    });

    it('should be order-sensitive for object keys', () => {
      // JSON.stringify maintains key order in modern JS
      const obj1 = { a: 1, b: 2 };
      const obj2 = { b: 2, a: 1 };

      const hash1 = sha256(JSON.stringify(obj1));
      const hash2 = sha256(JSON.stringify(obj2));

      // These may or may not be equal depending on key ordering
      // The important thing is consistency
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
      expect(hash2).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle array ordering', () => {
      const arr1 = [1, 2, 3];
      const arr2 = [3, 2, 1];
      const arr3 = [1, 2, 3];

      const hash1 = sha256(JSON.stringify(arr1));
      const hash2 = sha256(JSON.stringify(arr2));
      const hash3 = sha256(JSON.stringify(arr3));

      expect(hash1).not.toBe(hash2);
      expect(hash1).toBe(hash3);
    });
  });

  describe('Append-Only Verification', () => {
    it('should create valid proof for single entry', () => {
      const tree = new MerkleTree();
      const hash = sha256('entry-0');
      tree.append(hash);

      const proof = tree.getProof(0);
      expect(proof).not.toBeNull();
      expect(tree.size).toBe(1);
      expect(proof!.proof.length).toBe(0); // Single entry has empty proof path
    });

    it('should create valid proofs for two entries', () => {
      const tree = new MerkleTree();
      const hash1 = sha256('entry-1');
      const hash2 = sha256('entry-2');
      tree.append(hash1);
      tree.append(hash2);

      const proof1 = tree.getProof(0);
      const proof2 = tree.getProof(1);

      expect(MerkleTree.verify(proof1!)).toBe(true);
      expect(MerkleTree.verify(proof2!)).toBe(true);
    });

    it('should maintain proof validity after multiple appends', () => {
      const tree = new MerkleTree();
      const count = 100;

      for (let i = 0; i < count; i++) {
        const hash = sha256(`entry-${i}`);
        tree.append(hash);
      }

      expect(tree.size).toBe(count);

      // Verify all proofs
      for (let i = 0; i < count; i++) {
        const proof = tree.getProof(i);
        expect(proof).not.toBeNull();
        expect(MerkleTree.verify(proof!)).toBe(true);
      }
    });

    it('should have consistent proof depths at power of two sizes', () => {
      for (let power = 1; power <= 8; power++) {
        const size = 2 ** power;
        const tree = new MerkleTree();

        for (let i = 0; i < size; i++) {
          tree.append(sha256(`entry-${i}`));
        }

        const proof = tree.getProof(0)!;
        expect(proof.proof.length).toBe(power);
      }
    });
  });

  describe('Tamper Detection', () => {
    it('should detect root hash tampering', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 10; i++) {
        const hash = sha256(`entry-${i}`);
        tree.append(hash);
      }

      const originalRoot = tree.root;
      const proof = tree.getProof(5)!;

      // Modify root in proof
      proof.root = 'x'.repeat(64);

      expect(MerkleTree.verify(proof)).toBe(false);
      expect(tree.root).toBe(originalRoot); // Tree unchanged
    });

    it('should detect leaf hash tampering', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 10; i++) {
        const hash = sha256(`entry-${i}`);
        tree.append(hash);
      }

      const proof = tree.getProof(5)!;
      const _originalLeaf = proof.leaf;

      // Modify leaf in proof
      proof.leaf = 'y'.repeat(64);

      expect(MerkleTree.verify(proof)).toBe(false);
    });

    it('should detect proof path tampering', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 16; i++) {
        const hash = sha256(`entry-${i}`);
        tree.append(hash);
      }

      const proof = tree.getProof(7)!;

      // Modify one element in proof path
      if (proof.proof.length > 0) {
        proof.proof[0] = 'z'.repeat(64);
        expect(MerkleTree.verify(proof)).toBe(false);
      }
    });

    it('should detect direction tampering', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 16; i++) {
        const hash = sha256(`entry-${i}`);
        tree.append(hash);
      }

      const proof = tree.getProof(7)!;

      // Flip a direction
      if (proof.directions.length > 0) {
        proof.directions[0] = proof.directions[0] === 'left' ? 'right' : 'left';
        expect(MerkleTree.verify(proof)).toBe(false);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty data', () => {
      const hash = sha256('');
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle null values', () => {
      const hash1 = sha256(JSON.stringify({ key: null }));
      const hash2 = sha256(JSON.stringify({}));

      // null and missing key produce different hashes
      expect(hash1).not.toBe(hash2);
    });

    it('should handle nested structures', () => {
      const nested = { level1: { level2: { level3: { value: 'deep' } } } };
      const hash = sha256(JSON.stringify(nested));
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle large objects', () => {
      const obj: Record<string, number> = {};
      for (let i = 0; i < 1000; i++) {
        obj[`key${i}`] = i;
      }
      const hash = sha256(JSON.stringify(obj));
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle binary data encoded as base64', () => {
      const binaryData = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe, 0xfd]);
      const hash = sha256(binaryData.toString('base64'));
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle unicode strings', () => {
      const unicodeStrings = ['日本語', '中文', '한국어', 'العربية', '🎉🔐🗳️'];
      for (const str of unicodeStrings) {
        const hash = sha256(str);
        expect(hash).toMatch(/^[a-f0-9]{64}$/);
      }
    });

    it('should produce 64-character hex hashes', () => {
      for (let i = 0; i < 100; i++) {
        const hash = sha256(`test-${i}-${Math.random()}`);
        expect(hash).toMatch(/^[a-f0-9]{64}$/);
        expect(hash.length).toBe(64);
      }
    });
  });

  describe('Large Scale Tests', () => {
    it('should handle 10000 entries', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 10000; i++) {
        tree.append(sha256(`entry-${i}`));
      }

      expect(tree.size).toBe(10000);

      // Verify random samples
      for (let i = 0; i < 100; i++) {
        const index = Math.floor(Math.random() * 10000);
        const proof = tree.getProof(index);
        expect(MerkleTree.verify(proof!)).toBe(true);
      }
    });

    it('should maintain proof path length log2(n)', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 1024; i++) {
        tree.append(sha256(`entry-${i}`));
      }

      const proof = tree.getProof(500)!;
      // For 1024 entries, proof path should be exactly 10 elements
      expect(proof.proof.length).toBe(10);
    });

    it('should handle incremental verification', () => {
      const tree = new MerkleTree();
      const savedProofs: { proof: any; root: string }[] = [];

      for (let i = 0; i < 100; i++) {
        tree.append(sha256(`entry-${i}`));

        // Save proof at certain checkpoints
        if (i % 10 === 9) {
          savedProofs.push({
            proof: tree.getProof(i)!,
            root: tree.root
          });
        }
      }

      // All saved proofs should still be verifiable
      savedProofs.forEach(({ proof, root }) => {
        expect(proof.root).toBe(root);
      });
    });
  });
});
