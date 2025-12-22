/**
 * API Contract Tests
 *
 * Enterprise-level tests for API contracts, response schemas,
 * proof validation, and format verification.
 */

import { MerkleTree } from '../src/core/merkle';
import { sha256, isValidHash } from '../src/core/hash';

describe('API Contract Tests', () => {
  describe('Response Schema Validation', () => {
    it('should return valid proof schema', () => {
      const tree = new MerkleTree();
      const hash = sha256('test');
      tree.append(hash);
      tree.append(sha256('test2'));

      const proof = tree.getProof(0);

      expect(proof).toMatchObject({
        leaf: expect.any(String),
        index: expect.any(Number),
        proof: expect.any(Array),
        directions: expect.any(Array),
        root: expect.any(String)
      });

      expect(proof!.leaf).toMatch(/^[a-f0-9]{64}$/);
      expect(proof!.root).toMatch(/^[a-f0-9]{64}$/);
      expect(proof!.index).toBeGreaterThanOrEqual(0);
      proof!.proof.forEach(h => expect(h).toMatch(/^[a-f0-9]{64}$/));
      proof!.directions.forEach(d => expect(['left', 'right']).toContain(d));
    });

    it('should return proof with correct index', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 10; i++) {
        tree.append(sha256(`entry-${i}`));
      }

      for (let i = 0; i < 10; i++) {
        const proof = tree.getProof(i);
        expect(proof!.index).toBe(i);
      }
    });

    it('should return proof with matching leaf hash', () => {
      const tree = new MerkleTree();
      const hashes: string[] = [];
      for (let i = 0; i < 10; i++) {
        const hash = sha256(`entry-${i}`);
        hashes.push(hash);
        tree.append(hash);
      }

      for (let i = 0; i < 10; i++) {
        const proof = tree.getProof(i);
        expect(proof!.leaf).toBe(hashes[i]);
      }
    });
  });

  describe('Error Response Validation', () => {
    it('should return null for proof of non-existent entry', () => {
      const tree = new MerkleTree();
      tree.append('a'.repeat(64));

      const proof = tree.getProof(999);
      expect(proof).toBeNull();
    });

    it('should return null for negative index', () => {
      const tree = new MerkleTree();
      tree.append('a'.repeat(64));

      const proof = tree.getProof(-1);
      expect(proof).toBeNull();
    });

    it('should return null for index equal to size', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 5; i++) {
        tree.append(sha256(`entry-${i}`));
      }

      const proof = tree.getProof(5);
      expect(proof).toBeNull();
    });

    it('should return null for empty tree', () => {
      const tree = new MerkleTree();
      const proof = tree.getProof(0);
      expect(proof).toBeNull();
    });
  });

  describe('Hash Format Validation', () => {
    it('should generate valid 64-char hex hashes', () => {
      for (let i = 0; i < 100; i++) {
        const hash = sha256(`test-${i}-${Math.random()}`);
        expect(hash).toMatch(/^[a-f0-9]{64}$/);
        expect(hash.length).toBe(64);
      }
    });

    it('should validate correct hash format', () => {
      const validHash = 'a'.repeat(64);
      expect(isValidHash(validHash)).toBe(true);
    });

    it('should reject invalid hash formats', () => {
      const invalidHashes = [
        'g'.repeat(64),  // Invalid hex
        'a'.repeat(63),  // Too short
        'a'.repeat(65),  // Too long
        '',              // Empty
        '   ' + 'a'.repeat(61) // Whitespace prefix
      ];

      for (const invalid of invalidHashes) {
        expect(isValidHash(invalid)).toBe(false);
      }
    });

    it('should handle uppercase hex in validation', () => {
      const upperHash = 'A'.repeat(64);
      const mixedHash = 'aAbBcCdDeEfF'.repeat(5) + 'aaaa';
      expect(isValidHash(upperHash)).toBe(true);
      expect(isValidHash(mixedHash)).toBe(true);
    });
  });

  describe('Proof Path Validation', () => {
    it('should return empty proof path for single entry', () => {
      const tree = new MerkleTree();
      tree.append(sha256('single'));

      const proof = tree.getProof(0);
      expect(proof!.proof.length).toBe(0);
      expect(proof!.directions.length).toBe(0);
    });

    it('should return proof path length of 1 for two entries', () => {
      const tree = new MerkleTree();
      tree.append(sha256('entry-0'));
      tree.append(sha256('entry-1'));

      const proof0 = tree.getProof(0);
      const proof1 = tree.getProof(1);

      expect(proof0!.proof.length).toBe(1);
      expect(proof1!.proof.length).toBe(1);
    });

    it('should have consistent proof path length log2(n) for power of 2', () => {
      for (let power = 1; power <= 8; power++) {
        const size = 2 ** power;
        const tree = new MerkleTree();

        for (let i = 0; i < size; i++) {
          tree.append(sha256(`entry-${i}`));
        }

        const proof = tree.getProof(0);
        expect(proof!.proof.length).toBe(power);
      }
    });

    it('should have correct directions in proof', () => {
      const tree = new MerkleTree();
      tree.append(sha256('entry-0'));
      tree.append(sha256('entry-1'));

      const proof0 = tree.getProof(0);
      const proof1 = tree.getProof(1);

      expect(proof0!.directions[0]).toBe('right');
      expect(proof1!.directions[0]).toBe('left');
    });
  });

  describe('Root Hash Consistency', () => {
    it('should maintain consistent root across proof requests', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 100; i++) {
        tree.append(sha256(`entry-${i}`));
      }

      const roots = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const proof = tree.getProof(i);
        roots.add(proof!.root);
      }

      expect(roots.size).toBe(1);
    });

    it('should update root after append', () => {
      const tree = new MerkleTree();
      tree.append(sha256('entry-0'));
      const root1 = tree.getProof(0)!.root;

      tree.append(sha256('entry-1'));
      const root2 = tree.getProof(0)!.root;

      expect(root1).not.toBe(root2);
    });

    it('should produce unique roots for each tree size', () => {
      const tree = new MerkleTree();
      const roots: string[] = [];

      for (let i = 0; i < 50; i++) {
        tree.append(sha256(`entry-${i}`));
        roots.push(tree.getProof(0)!.root);
      }

      expect(new Set(roots).size).toBe(50);
    });
  });

  describe('Proof Verification Contract', () => {
    it('should verify valid proof returns true', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 10; i++) {
        tree.append(sha256(`entry-${i}`));
      }

      for (let i = 0; i < 10; i++) {
        const proof = tree.getProof(i)!;
        expect(MerkleTree.verify(proof)).toBe(true);
      }
    });

    it('should reject proof with wrong root', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 10; i++) {
        tree.append(sha256(`entry-${i}`));
      }

      const proof = tree.getProof(5)!;
      const tamperedProof = { ...proof, root: 'x'.repeat(64) };

      expect(MerkleTree.verify(tamperedProof)).toBe(false);
    });

    it('should reject proof with wrong leaf', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 10; i++) {
        tree.append(sha256(`entry-${i}`));
      }

      const proof = tree.getProof(5)!;
      const tamperedProof = { ...proof, leaf: 'y'.repeat(64) };

      expect(MerkleTree.verify(tamperedProof)).toBe(false);
    });
  });

  describe('Data Type Handling in Hash', () => {
    it('should produce valid hash for string data', () => {
      const hash = sha256('hello world');
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should produce valid hash for JSON data', () => {
      const data = {
        string: 'hello',
        number: 42,
        float: 3.14159,
        boolean: true,
        null: null,
        array: [1, 2, 3],
        nested: { a: { b: { c: 'deep' } } }
      };

      const hash = sha256(JSON.stringify(data));
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should produce valid hash for binary-safe strings', () => {
      const binaryData = Buffer.from([0x00, 0x01, 0x02, 0xff]).toString('base64');
      const hash = sha256(binaryData);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should produce valid hash for unicode data', () => {
      const unicodeData = {
        emoji: '🔐🗳️✅',
        chinese: '中文测试',
        arabic: 'العربية',
        mixed: 'Hello 世界 🌍'
      };

      const hash = sha256(JSON.stringify(unicodeData));
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle empty string', () => {
      const hash = sha256('');
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle very long strings', () => {
      const longString = 'x'.repeat(100000);
      const hash = sha256(longString);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('Determinism Contract', () => {
    it('should produce same hash for same input', () => {
      const data = 'test-data-123';
      const hash1 = sha256(data);
      const hash2 = sha256(data);
      const hash3 = sha256(data);

      expect(hash1).toBe(hash2);
      expect(hash2).toBe(hash3);
    });

    it('should produce different hashes for different inputs', () => {
      const hash1 = sha256('input1');
      const hash2 = sha256('input2');
      const hash3 = sha256('input3');

      expect(hash1).not.toBe(hash2);
      expect(hash2).not.toBe(hash3);
      expect(hash1).not.toBe(hash3);
    });

    it('should be case-sensitive', () => {
      const hash1 = sha256('Test');
      const hash2 = sha256('test');
      const hash3 = sha256('TEST');

      expect(hash1).not.toBe(hash2);
      expect(hash2).not.toBe(hash3);
      expect(hash1).not.toBe(hash3);
    });

    it('should distinguish whitespace differences', () => {
      const hash1 = sha256('hello world');
      const hash2 = sha256('hello  world');
      const hash3 = sha256('hello\tworld');

      expect(hash1).not.toBe(hash2);
      expect(hash2).not.toBe(hash3);
      expect(hash1).not.toBe(hash3);
    });
  });

  describe('Tree Size Contract', () => {
    it('should report correct size after appends', () => {
      const tree = new MerkleTree();
      expect(tree.size).toBe(0);

      for (let i = 0; i < 100; i++) {
        tree.append(sha256(`entry-${i}`));
        expect(tree.size).toBe(i + 1);
      }
    });

    it('should not change size after proof requests', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 50; i++) {
        tree.append(sha256(`entry-${i}`));
      }

      const sizeBefore = tree.size;
      for (let i = 0; i < 50; i++) {
        tree.getProof(i);
      }
      const sizeAfter = tree.size;

      expect(sizeBefore).toBe(sizeAfter);
    });

    it('should handle large tree sizes', () => {
      const tree = new MerkleTree();
      const count = 10000;

      for (let i = 0; i < count; i++) {
        tree.append(sha256(`entry-${i}`));
      }

      expect(tree.size).toBe(count);
    });
  });

  describe('BigInt Position Handling', () => {
    it('should handle position as BigInt conceptually', () => {
      // Verify that positions in a sequence work correctly
      const tree = new MerkleTree();
      for (let i = 0; i < 100; i++) {
        tree.append(sha256(`entry-${i}`));
      }

      // All positions 0-99 should have valid proofs
      for (let i = 0; i < 100; i++) {
        const proof = tree.getProof(i);
        expect(proof).not.toBeNull();
        expect(proof!.index).toBe(i);
      }
    });
  });

  describe('Proof Immutability Contract', () => {
    it('should return independent proof objects', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 10; i++) {
        tree.append(sha256(`entry-${i}`));
      }

      const proof1 = tree.getProof(5)!;
      const originalLeaf = proof1.leaf;

      // Mutate proof1
      proof1.leaf = 'x'.repeat(64);

      // Get another proof for same index
      const proof2 = tree.getProof(5)!;

      expect(proof2.leaf).toBe(originalLeaf);
      expect(proof2.leaf).not.toBe(proof1.leaf);
    });
  });

  describe('Import/Export Contract', () => {
    it('should rebuild tree from leaves with same root', () => {
      const tree1 = new MerkleTree();
      const leaves: string[] = [];
      for (let i = 0; i < 100; i++) {
        const hash = sha256(`entry-${i}`);
        leaves.push(hash);
        tree1.append(hash);
      }

      const tree2 = MerkleTree.import({ leaves });

      const proof1 = tree1.getProof(50)!;
      const proof2 = tree2.getProof(50)!;

      expect(proof1.root).toBe(proof2.root);
    });

    it('should export leaves in order', () => {
      const tree = new MerkleTree();
      const inputLeaves: string[] = [];
      for (let i = 0; i < 50; i++) {
        const hash = sha256(`entry-${i}`);
        inputLeaves.push(hash);
        tree.append(hash);
      }

      const exportedLeaves = tree.getLeaves();
      expect(exportedLeaves).toEqual(inputLeaves);
    });
  });
});
