/**
 * VeilChain Merkle Tree Tests
 */

import { MerkleTree } from '../src/core/merkle.js';
import { sha256, hashPair, isValidHash, EMPTY_HASH } from '../src/core/hash.js';
import {
  serializeProof,
  deserializeProof,
  verifyProofDetailed
} from '../src/core/proof.js';

describe('Hash Utilities', () => {
  describe('sha256', () => {
    it('should produce consistent hashes', () => {
      const hash1 = sha256('hello');
      const hash2 = sha256('hello');
      expect(hash1).toBe(hash2);
    });

    it('should produce 64-character hex strings', () => {
      const hash = sha256('test');
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should produce different hashes for different inputs', () => {
      const hash1 = sha256('hello');
      const hash2 = sha256('world');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('hashPair', () => {
    it('should produce different results for different order', () => {
      const a = sha256('a');
      const b = sha256('b');
      // Order matters in Merkle trees - position is significant
      const hash1 = hashPair(a, b);
      const hash2 = hashPair(b, a);
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('isValidHash', () => {
    it('should validate correct hashes', () => {
      const hash = sha256('test');
      expect(isValidHash(hash)).toBe(true);
    });

    it('should reject invalid hashes', () => {
      expect(isValidHash('not-a-hash')).toBe(false);
      expect(isValidHash('abc')).toBe(false);
      expect(isValidHash('')).toBe(false);
    });
  });
});

describe('MerkleTree', () => {
  describe('initialization', () => {
    it('should start with empty root', () => {
      const tree = new MerkleTree();
      expect(tree.root).toBe(EMPTY_HASH);
      expect(tree.size).toBe(0);
    });
  });

  describe('append', () => {
    it('should append entries and update root', () => {
      const tree = new MerkleTree();
      const hash1 = sha256('entry1');

      const position = tree.append(hash1);
      expect(position).toBe(0);
      expect(tree.size).toBe(1);
      expect(tree.root).not.toBe(EMPTY_HASH);
    });

    it('should change root on each append', () => {
      const tree = new MerkleTree();
      const roots: string[] = [];

      for (let i = 0; i < 5; i++) {
        tree.append(sha256(`entry${i}`));
        roots.push(tree.root);
      }

      // All roots should be unique
      const uniqueRoots = new Set(roots);
      expect(uniqueRoots.size).toBe(5);
    });

    it('should handle batch appends', () => {
      const tree = new MerkleTree();
      const hashes = [1, 2, 3, 4, 5].map(i => sha256(`entry${i}`));

      const startPos = tree.appendBatch(hashes);
      expect(startPos).toBe(0);
      expect(tree.size).toBe(5);
    });
  });

  describe('proofs', () => {
    it('should generate valid proofs for single entry', () => {
      const tree = new MerkleTree();
      const hash = sha256('entry');
      tree.append(hash);

      const proof = tree.getProof(0);
      expect(proof.leaf).toBe(hash);
      expect(proof.index).toBe(0);
      expect(MerkleTree.verify(proof)).toBe(true);
    });

    it('should generate valid proofs for multiple entries', () => {
      const tree = new MerkleTree();
      const hashes = [1, 2, 3, 4, 5, 6, 7, 8].map(i => sha256(`entry${i}`));
      hashes.forEach(h => tree.append(h));

      // Verify proof for each entry
      for (let i = 0; i < hashes.length; i++) {
        const proof = tree.getProof(i);
        expect(proof.leaf).toBe(hashes[i]);
        expect(proof.index).toBe(i);
        expect(MerkleTree.verify(proof)).toBe(true);
      }
    });

    it('should reject tampered proofs', () => {
      const tree = new MerkleTree();
      tree.append(sha256('entry1'));
      tree.append(sha256('entry2'));

      const proof = tree.getProof(0);

      // Tamper with the leaf
      const tamperedProof = { ...proof, leaf: sha256('fake') };
      expect(MerkleTree.verify(tamperedProof)).toBe(false);

      // Tamper with the root
      const tamperedRoot = { ...proof, root: sha256('fake-root') };
      expect(MerkleTree.verify(tamperedRoot)).toBe(false);
    });

    it('should throw for out-of-bounds index', () => {
      const tree = new MerkleTree();
      tree.append(sha256('entry'));

      expect(() => tree.getProof(-1)).toThrow();
      expect(() => tree.getProof(1)).toThrow();
      expect(() => tree.getProof(100)).toThrow();
    });
  });

  describe('determinism', () => {
    it('should produce same root for same entries', () => {
      const tree1 = new MerkleTree();
      const tree2 = new MerkleTree();

      const hashes = [1, 2, 3].map(i => sha256(`entry${i}`));

      hashes.forEach(h => tree1.append(h));
      hashes.forEach(h => tree2.append(h));

      expect(tree1.root).toBe(tree2.root);
    });

    it('should produce different root for different order', () => {
      const tree1 = new MerkleTree();
      const tree2 = new MerkleTree();

      tree1.append(sha256('a'));
      tree1.append(sha256('b'));

      tree2.append(sha256('b'));
      tree2.append(sha256('a'));

      expect(tree1.root).not.toBe(tree2.root);
    });
  });

  describe('import/export', () => {
    it('should correctly export and import state', () => {
      const tree1 = new MerkleTree();
      const hashes = [1, 2, 3, 4, 5].map(i => sha256(`entry${i}`));
      hashes.forEach(h => tree1.append(h));

      const exported = tree1.export();
      const tree2 = MerkleTree.import(exported);

      expect(tree2.root).toBe(tree1.root);
      expect(tree2.size).toBe(tree1.size);

      // Verify proofs work on imported tree
      for (let i = 0; i < hashes.length; i++) {
        const proof = tree2.getProof(i);
        expect(MerkleTree.verify(proof)).toBe(true);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle power-of-2 sizes', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 8; i++) {
        tree.append(sha256(`entry${i}`));
      }
      expect(tree.size).toBe(8);

      const proof = tree.getProof(4);
      expect(MerkleTree.verify(proof)).toBe(true);
    });

    it('should handle non-power-of-2 sizes', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 7; i++) {
        tree.append(sha256(`entry${i}`));
      }
      expect(tree.size).toBe(7);

      const proof = tree.getProof(6);
      expect(MerkleTree.verify(proof)).toBe(true);
    });

    it('should handle large trees', () => {
      const tree = new MerkleTree();
      const size = 1000;

      for (let i = 0; i < size; i++) {
        tree.append(sha256(`entry${i}`));
      }

      expect(tree.size).toBe(size);

      // Spot check some proofs
      for (const idx of [0, 100, 500, 999]) {
        const proof = tree.getProof(idx);
        expect(MerkleTree.verify(proof)).toBe(true);
      }
    });
  });
});

describe('Proof Serialization', () => {
  it('should serialize and deserialize proofs', () => {
    const tree = new MerkleTree();
    tree.append(sha256('entry1'));
    tree.append(sha256('entry2'));
    tree.append(sha256('entry3'));

    const proof = tree.getProof(1);
    const serialized = serializeProof(proof);
    const deserialized = deserializeProof(serialized);

    expect(deserialized).toEqual(proof);
    expect(MerkleTree.verify(deserialized)).toBe(true);
  });

  it('should produce compact serialization', () => {
    const tree = new MerkleTree();
    for (let i = 0; i < 100; i++) {
      tree.append(sha256(`entry${i}`));
    }

    const proof = tree.getProof(50);
    const serialized = serializeProof(proof);

    // Serialized version should use short keys
    expect(serialized).toHaveProperty('v'); // version
    expect(serialized).toHaveProperty('l'); // leaf
    expect(serialized).toHaveProperty('p'); // proof
    expect(serialized).toHaveProperty('d'); // directions as numbers
    expect(serialized).toHaveProperty('r'); // root
  });
});

describe('Proof Verification', () => {
  it('should provide detailed verification results', () => {
    const tree = new MerkleTree();
    tree.append(sha256('entry'));

    const proof = tree.getProof(0);
    const result = verifyProofDetailed(proof);

    expect(result.valid).toBe(true);
    expect(result.leaf).toBe(proof.leaf);
    expect(result.root).toBe(proof.root);
    expect(result.index).toBe(0);
  });

  it('should detect invalid proofs with helpful errors', () => {
    const invalidProof = {
      leaf: 'not-a-valid-hash',
      index: 0,
      proof: [],
      directions: [],
      root: sha256('root')
    };

    const result = verifyProofDetailed(invalidProof);
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });
});
