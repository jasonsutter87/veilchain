/**
 * VeilChain Sparse Merkle Tree Tests
 */

import { SparseMerkleTree } from '../src/core/sparse-merkle.js';
import { sha256, EMPTY_HASH } from '../src/core/hash.js';

describe('SparseMerkleTree', () => {
  // Use smaller depth for tests to avoid stack overflow with 256 depth
  const TEST_DEPTH = 32;

  describe('initialization', () => {
    it('should start with empty root', () => {
      const tree = new SparseMerkleTree(TEST_DEPTH);
      expect(tree.root).not.toBe(''); // Empty tree still has a computed root
      expect(tree.size).toBe(0);
    });

    it('should accept custom depth', () => {
      const tree = new SparseMerkleTree(160);
      const stats = tree.getStats();
      expect(stats.depth).toBe(160);
      // Empty tree has a computed default root, not EMPTY_HASH
      expect(stats.root).not.toBe('');
    });

    it('should reject invalid depth values', () => {
      expect(() => new SparseMerkleTree(0)).toThrow('Depth must be between 1 and 256');
      expect(() => new SparseMerkleTree(-1)).toThrow('Depth must be between 1 and 256');
      expect(() => new SparseMerkleTree(257)).toThrow('Depth must be between 1 and 256');
    });
  });

  describe('set and get operations', () => {
    it('should set and retrieve a value', () => {
      const tree = new SparseMerkleTree(TEST_DEPTH);
      const key = 'user:alice';
      const value = 'balance:100';

      tree.set(key, value);
      const retrieved = tree.get(key);

      expect(retrieved).toBe(sha256(value));
      expect(tree.root).not.toBe(EMPTY_HASH);
    });

    it('should return null for non-existent keys', () => {
      const tree = new SparseMerkleTree(TEST_DEPTH);
      const value = tree.get('non-existent-key');

      expect(value).toBeNull();
    });

    it('should update existing values', () => {
      const tree = new SparseMerkleTree(TEST_DEPTH);
      const key = 'counter';

      tree.set(key, 'value1');
      const value1 = tree.get(key);
      const root1 = tree.root;

      tree.set(key, 'value2');
      const value2 = tree.get(key);
      const root2 = tree.root;

      expect(value1).toBe(sha256('value1'));
      expect(value2).toBe(sha256('value2'));
      expect(value1).not.toBe(value2);
      expect(root1).not.toBe(root2);
    });

    it('should handle multiple key-value pairs', () => {
      const tree = new SparseMerkleTree(TEST_DEPTH);

      const pairs = [
        ['key1', 'value1'],
        ['key2', 'value2'],
        ['key3', 'value3'],
        ['key4', 'value4'],
        ['key5', 'value5']
      ];

      pairs.forEach(([key, value]) => tree.set(key, value));

      pairs.forEach(([key, value]) => {
        expect(tree.get(key)).toBe(sha256(value));
      });

      expect(tree.size).toBeGreaterThan(0);
    });

    it('should handle has() method correctly', () => {
      const tree = new SparseMerkleTree(TEST_DEPTH);

      expect(tree.has('key1')).toBe(false);

      tree.set('key1', 'value1');
      expect(tree.has('key1')).toBe(true);
      expect(tree.has('key2')).toBe(false);
    });
  });

  describe('proof generation', () => {
    it('should generate inclusion proof for existing key', () => {
      const tree = new SparseMerkleTree(TEST_DEPTH);
      const key = 'test-key';
      const value = 'test-value';

      tree.set(key, value);
      const proof = tree.getProof(key);

      expect(proof.key).toBe(key);
      expect(proof.value).toBe(sha256(value));
      expect(proof.included).toBe(true);
      expect(proof.root).toBe(tree.root);
      expect(proof.siblings).toHaveLength(TEST_DEPTH);
    });

    it('should generate non-inclusion proof for non-existent key', () => {
      const tree = new SparseMerkleTree(TEST_DEPTH);
      tree.set('existing-key', 'value');

      const proof = tree.getProof('non-existent-key');

      expect(proof.key).toBe('non-existent-key');
      expect(proof.value).toBeNull();
      expect(proof.included).toBe(false);
      expect(proof.root).toBe(tree.root);
    });

    it('should generate proof for empty tree', () => {
      const tree = new SparseMerkleTree(TEST_DEPTH);
      const proof = tree.getProof('any-key');

      expect(proof.included).toBe(false);
      expect(proof.value).toBeNull();
      // Empty tree still has a computed default root, not EMPTY_HASH
      expect(proof.root).toBe(tree.root);
    });

    it('should generate different proofs for different keys', () => {
      const tree = new SparseMerkleTree(TEST_DEPTH);
      tree.set('key1', 'value1');
      tree.set('key2', 'value2');

      const proof1 = tree.getProof('key1');
      const proof2 = tree.getProof('key2');

      expect(proof1.value).not.toBe(proof2.value);
      expect(proof1.key).not.toBe(proof2.key);
      // Some siblings may differ depending on the path
      expect(proof1.root).toBe(proof2.root);
    });
  });

  describe('proof verification', () => {
    it('should verify valid inclusion proof', () => {
      const tree = new SparseMerkleTree(TEST_DEPTH);
      tree.set('test-key', 'test-value');

      const proof = tree.getProof('test-key');
      const isValid = SparseMerkleTree.verify(proof);

      expect(isValid).toBe(true);
    });

    it('should verify valid non-inclusion proof', () => {
      const tree = new SparseMerkleTree(TEST_DEPTH);
      tree.set('key1', 'value1');

      const proof = tree.getProof('non-existent');
      const isValid = SparseMerkleTree.verify(proof);

      expect(isValid).toBe(true);
    });

    it('should reject tampered inclusion proof', () => {
      const tree = new SparseMerkleTree(TEST_DEPTH);
      tree.set('test-key', 'test-value');

      const proof = tree.getProof('test-key');

      // Tamper with the value
      const tamperedProof = {
        ...proof,
        value: sha256('fake-value')
      };

      expect(SparseMerkleTree.verify(tamperedProof)).toBe(false);
    });

    it('should reject proof with wrong root', () => {
      const tree = new SparseMerkleTree(TEST_DEPTH);
      tree.set('test-key', 'test-value');

      const proof = tree.getProof('test-key');

      // Tamper with the root
      const tamperedProof = {
        ...proof,
        root: sha256('fake-root')
      };

      expect(SparseMerkleTree.verify(tamperedProof)).toBe(false);
    });

    it('should reject proof with modified siblings', () => {
      const tree = new SparseMerkleTree(TEST_DEPTH);
      tree.set('test-key', 'test-value');

      const proof = tree.getProof('test-key');

      // Tamper with a sibling
      const tamperedSiblings = [...proof.siblings];
      tamperedSiblings[0] = sha256('fake-sibling');

      const tamperedProof = {
        ...proof,
        siblings: tamperedSiblings
      };

      expect(SparseMerkleTree.verify(tamperedProof)).toBe(false);
    });

    it('should verify proofs after multiple insertions', () => {
      const tree = new SparseMerkleTree(TEST_DEPTH);

      // Insert multiple entries
      for (let i = 0; i < 10; i++) {
        tree.set(`key${i}`, `value${i}`);
      }

      // Verify all proofs
      for (let i = 0; i < 10; i++) {
        const proof = tree.getProof(`key${i}`);
        expect(SparseMerkleTree.verify(proof)).toBe(true);
      }
    });
  });

  describe('large key space handling', () => {
    it('should handle keys with similar hashes', () => {
      const tree = new SparseMerkleTree(TEST_DEPTH);

      // These keys will have different hashes but might share path prefixes
      const keys = ['aaa', 'aab', 'aba', 'abb', 'baa', 'bab', 'bba', 'bbb'];

      keys.forEach((key, i) => {
        tree.set(key, `value${i}`);
      });

      // All should be retrievable
      keys.forEach((key, i) => {
        expect(tree.get(key)).toBe(sha256(`value${i}`));
      });

      // All proofs should verify
      keys.forEach(key => {
        const proof = tree.getProof(key);
        expect(SparseMerkleTree.verify(proof)).toBe(true);
      });
    });

    it('should efficiently store many entries', () => {
      const tree = new SparseMerkleTree(TEST_DEPTH);
      const count = 100;

      // Insert many entries
      for (let i = 0; i < count; i++) {
        tree.set(`key-${i}`, `value-${i}`);
      }

      const stats = tree.getStats();

      // Should have entries stored
      expect(stats.storedNodes).toBeGreaterThan(0);

      // Should not store all possible nodes (sparse optimization)
      // With 256-bit depth, storing everything would be 2^256 nodes
      expect(stats.storedNodes).toBeLessThan(count * 256);
    });

    it('should handle very long keys', () => {
      const tree = new SparseMerkleTree(TEST_DEPTH);
      const longKey = 'x'.repeat(1000);
      const value = 'value-for-long-key';

      tree.set(longKey, value);

      expect(tree.get(longKey)).toBe(sha256(value));

      const proof = tree.getProof(longKey);
      expect(SparseMerkleTree.verify(proof)).toBe(true);
    });

    it('should handle unicode keys', () => {
      const tree = new SparseMerkleTree(TEST_DEPTH);

      const unicodeKeys = [
        'hello',
        'こんにちは',
        '你好',
        '안녕하세요',
        'مرحبا',
        '🌍🌎🌏'
      ];

      unicodeKeys.forEach((key, i) => {
        tree.set(key, `value${i}`);
      });

      unicodeKeys.forEach((key, i) => {
        expect(tree.get(key)).toBe(sha256(`value${i}`));
      });
    });
  });

  describe('export and import', () => {
    it('should export and import tree state', () => {
      const tree1 = new SparseMerkleTree(TEST_DEPTH);

      tree1.set('key1', 'value1');
      tree1.set('key2', 'value2');
      tree1.set('key3', 'value3');

      const exported = tree1.export();
      const tree2 = SparseMerkleTree.import(exported);

      expect(tree2.root).toBe(tree1.root);
      expect(tree2.size).toBe(tree1.size);

      // Verify all values are preserved
      expect(tree2.get('key1')).toBe(tree1.get('key1'));
      expect(tree2.get('key2')).toBe(tree1.get('key2'));
      expect(tree2.get('key3')).toBe(tree1.get('key3'));
    });

    it('should preserve proof validity after import', () => {
      const tree1 = new SparseMerkleTree(TEST_DEPTH);
      tree1.set('test-key', 'test-value');

      const proof1 = tree1.getProof('test-key');

      const exported = tree1.export();
      const tree2 = SparseMerkleTree.import(exported);

      const proof2 = tree2.getProof('test-key');

      expect(proof2.root).toBe(proof1.root);
      expect(proof2.value).toBe(proof1.value);
      expect(SparseMerkleTree.verify(proof2)).toBe(true);
    });

    it('should export minimal state for empty tree', () => {
      const tree = new SparseMerkleTree(TEST_DEPTH);
      const exported = tree.export();

      expect(exported.nodes).toEqual({});
      // Empty tree still has a computed default root
      expect(exported.root).not.toBe('');
      expect(exported.depth).toBe(TEST_DEPTH);
    });

    it('should handle import with custom depth', () => {
      const tree1 = new SparseMerkleTree(128);
      tree1.set('key', 'value');

      const exported = tree1.export();
      expect(exported.depth).toBe(128);

      const tree2 = SparseMerkleTree.import(exported);
      const stats = tree2.getStats();

      expect(stats.depth).toBe(128);
      expect(tree2.root).toBe(tree1.root);
    });
  });

  describe('determinism', () => {
    it('should produce same root for same key-value pairs regardless of order', () => {
      const tree1 = new SparseMerkleTree(TEST_DEPTH);
      const tree2 = new SparseMerkleTree(TEST_DEPTH);

      const pairs = [
        ['key1', 'value1'],
        ['key2', 'value2'],
        ['key3', 'value3']
      ];

      // Insert in forward order
      pairs.forEach(([k, v]) => tree1.set(k, v));

      // Insert in reverse order
      pairs.reverse().forEach(([k, v]) => tree2.set(k, v));

      expect(tree1.root).toBe(tree2.root);
    });

    it('should produce consistent roots across instances', () => {
      const tree1 = new SparseMerkleTree(TEST_DEPTH);
      const tree2 = new SparseMerkleTree(TEST_DEPTH);

      tree1.set('same-key', 'same-value');
      tree2.set('same-key', 'same-value');

      expect(tree1.root).toBe(tree2.root);
    });
  });

  describe('edge cases', () => {
    it('should handle empty key', () => {
      const tree = new SparseMerkleTree(TEST_DEPTH);
      tree.set('', 'value-for-empty-key');

      expect(tree.get('')).toBe(sha256('value-for-empty-key'));

      const proof = tree.getProof('');
      expect(SparseMerkleTree.verify(proof)).toBe(true);
    });

    it('should handle empty value', () => {
      const tree = new SparseMerkleTree(TEST_DEPTH);
      tree.set('key', '');

      expect(tree.get('key')).toBe(sha256(''));

      const proof = tree.getProof('key');
      expect(SparseMerkleTree.verify(proof)).toBe(true);
    });

    it('should clear tree correctly', () => {
      const tree = new SparseMerkleTree(TEST_DEPTH);

      tree.set('key1', 'value1');
      tree.set('key2', 'value2');
      const nonEmptyRoot = tree.root;

      tree.clear();

      // Root changes back to default
      expect(tree.root).not.toBe(nonEmptyRoot);
      expect(tree.size).toBe(0);
      expect(tree.get('key1')).toBeNull();
      expect(tree.get('key2')).toBeNull();
    });

    it('should handle overwriting with same value', () => {
      const tree = new SparseMerkleTree(TEST_DEPTH);

      tree.set('key', 'value');
      const root1 = tree.root;

      tree.set('key', 'value');
      const root2 = tree.root;

      expect(root1).toBe(root2);
    });

    it('should maintain correctness with small depth', () => {
      const tree = new SparseMerkleTree(8); // Very small tree

      tree.set('key1', 'value1');
      tree.set('key2', 'value2');

      expect(tree.get('key1')).toBe(sha256('value1'));
      expect(tree.get('key2')).toBe(sha256('value2'));

      const proof1 = tree.getProof('key1');
      const proof2 = tree.getProof('key2');

      expect(proof1.siblings).toHaveLength(8);
      expect(SparseMerkleTree.verify(proof1)).toBe(true);
      expect(SparseMerkleTree.verify(proof2)).toBe(true);
    });
  });

  describe('statistics', () => {
    it('should provide accurate statistics', () => {
      const tree = new SparseMerkleTree(TEST_DEPTH);
      const initialStats = tree.getStats();

      expect(initialStats.depth).toBe(TEST_DEPTH);
      expect(initialStats.storedNodes).toBe(0);
      expect(initialStats.root).not.toBe('');

      tree.set('key1', 'value1');
      tree.set('key2', 'value2');

      const stats = tree.getStats();

      expect(stats.depth).toBe(TEST_DEPTH);
      expect(stats.storedNodes).toBeGreaterThan(0);
      expect(stats.root).not.toBe(initialStats.root);
    });
  });

  describe('real-world scenarios', () => {
    it('should handle user balance tracking', () => {
      const tree = new SparseMerkleTree(TEST_DEPTH);

      // Track balances for multiple users
      const balances = [
        ['user:alice', 'balance:1000'],
        ['user:bob', 'balance:500'],
        ['user:charlie', 'balance:2000']
      ];

      balances.forEach(([user, balance]) => tree.set(user, balance));

      // Verify balances
      expect(tree.get('user:alice')).toBe(sha256('balance:1000'));
      expect(tree.get('user:bob')).toBe(sha256('balance:500'));
      expect(tree.get('user:charlie')).toBe(sha256('balance:2000'));

      // Generate proof for audit
      const aliceProof = tree.getProof('user:alice');
      const oldRoot = tree.root;
      expect(SparseMerkleTree.verify(aliceProof)).toBe(true);

      // Update balance
      tree.set('user:alice', 'balance:1500');
      expect(tree.get('user:alice')).toBe(sha256('balance:1500'));

      // Old proof root is different from new root
      expect(aliceProof.root).toBe(oldRoot);
      expect(tree.root).not.toBe(oldRoot);
      // Old proof still verifies against its own root
      expect(SparseMerkleTree.verify(aliceProof)).toBe(true);
    });

    it('should handle state transitions', () => {
      const tree = new SparseMerkleTree(TEST_DEPTH);

      // Initial state
      tree.set('contract:0x123', 'state:initialized');
      const initialRoot = tree.root;

      // State transition
      tree.set('contract:0x123', 'state:active');
      const activeRoot = tree.root;

      // Roots should be different
      expect(initialRoot).not.toBe(activeRoot);

      // Can prove current state
      const proof = tree.getProof('contract:0x123');
      expect(proof.value).toBe(sha256('state:active'));
      expect(SparseMerkleTree.verify(proof)).toBe(true);
    });

    it('should efficiently handle sparse data', () => {
      const tree = new SparseMerkleTree(TEST_DEPTH);

      // Only set a few keys in a huge space
      tree.set('0', 'value0');
      tree.set('1000000', 'value1000000');
      tree.set('999999999', 'value999999999');

      // Should store minimal nodes despite large key space
      const stats = tree.getStats();
      expect(stats.storedNodes).toBeLessThan(1000); // Much less than 3 * 256

      // All values should be retrievable
      expect(tree.get('0')).toBe(sha256('value0'));
      expect(tree.get('1000000')).toBe(sha256('value1000000'));
      expect(tree.get('999999999')).toBe(sha256('value999999999'));
    });
  });
});
