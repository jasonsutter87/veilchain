/**
 * Error Handling & Recovery Tests
 *
 * Enterprise-level tests for error scenarios, recovery mechanisms,
 * and graceful degradation with MerkleTree and hashing.
 */

import { MerkleTree } from '../src/core/merkle';
import { sha256 } from '../src/core/hash';
import { IdempotencyService, MemoryIdempotencyStorage } from '../src/services/idempotency';

describe('Error Handling Tests', () => {
  describe('Invalid Input Handling', () => {
    it('should handle null input to hash function', () => {
      const hash = sha256(JSON.stringify(null));
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle undefined string input to hash function', () => {
      const hash = sha256('undefined');
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle empty object input', () => {
      const hash = sha256(JSON.stringify({}));
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle empty array input', () => {
      const hash = sha256(JSON.stringify([]));
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle NaN input', () => {
      const hash = sha256(JSON.stringify({ value: NaN }));
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle Infinity input', () => {
      const hash = sha256(JSON.stringify({ value: Infinity }));
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle function values gracefully', () => {
      const data = { fn: function() {} };
      const hash = sha256(JSON.stringify(data));
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle Symbol values gracefully', () => {
      const data = { sym: Symbol('test') };
      const hash = sha256(JSON.stringify(data));
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle BigInt values when stringified', () => {
      const big = BigInt(9007199254740991);
      const hash = sha256(JSON.stringify({ big: big.toString() }));
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('Merkle Tree Edge Cases', () => {
    it('should handle empty tree getRoot', () => {
      const tree = new MerkleTree();
      const root = tree.root;
      expect(root).toBeDefined();
    });

    it('should throw on empty tree getProof', () => {
      const tree = new MerkleTree();
      expect(() => tree.getProof(0)).toThrow();
    });

    it('should throw for index out of bounds', () => {
      const tree = new MerkleTree();
      tree.append(sha256('test'));

      expect(() => tree.getProof(-1)).toThrow();
      expect(() => tree.getProof(1)).toThrow();
      expect(() => tree.getProof(100)).toThrow();
    });

    it('should throw for very large index', () => {
      const tree = new MerkleTree();
      tree.append(sha256('test'));

      expect(() => tree.getProof(Number.MAX_SAFE_INTEGER)).toThrow();
    });

    it('should handle float index', () => {
      const tree = new MerkleTree();
      tree.append(sha256('test'));

      const proof = tree.getProof(0.5);
      expect(proof).not.toBeNull();
    });

    it('should handle invalid hash format', () => {
      const tree = new MerkleTree();

      tree.append('abc');
      expect(tree.size).toBe(1);

      tree.append('a'.repeat(100));
      expect(tree.size).toBe(2);

      tree.append('xyz123');
      expect(tree.size).toBe(3);
    });
  });

  describe('Idempotency Error Handling', () => {
    it('should return null for non-existent key', async () => {
      const idempotencyStorage = new MemoryIdempotencyStorage();
      const service = new IdempotencyService(idempotencyStorage);

      const result = await service.get('ledger-1', 'non-existent-key');
      expect(result).toBeNull();

      service.destroy();
    });

    it('should handle delete of non-existent key', async () => {
      const idempotencyStorage = new MemoryIdempotencyStorage();
      const service = new IdempotencyService(idempotencyStorage);

      await service.delete('ledger-1', 'non-existent-key');

      service.destroy();
    });

    it('should handle empty idempotency key', async () => {
      const idempotencyStorage = new MemoryIdempotencyStorage();
      const service = new IdempotencyService(idempotencyStorage);

      await service.set('ledger-1', '', { value: 'test' });
      const result = await service.get<{ value: string }>('ledger-1', '');

      expect(result?.value).toBe('test');

      service.destroy();
    });

    it('should handle very long idempotency key', async () => {
      const idempotencyStorage = new MemoryIdempotencyStorage();
      const service = new IdempotencyService(idempotencyStorage);

      const longKey = 'k'.repeat(10000);

      await service.set('ledger-1', longKey, { value: 'test' });
      const result = await service.get<{ value: string }>('ledger-1', longKey);

      expect(result?.value).toBe('test');

      service.destroy();
    });

    it('should handle overwriting existing key', async () => {
      const idempotencyStorage = new MemoryIdempotencyStorage();
      const service = new IdempotencyService(idempotencyStorage);

      await service.set('ledger-1', 'key', { value: 'first' });
      await service.set('ledger-1', 'key', { value: 'second' });

      const result = await service.get<{ value: string }>('ledger-1', 'key');
      expect(result?.value).toBe('second');

      service.destroy();
    });

    it('should handle special characters in key', async () => {
      const idempotencyStorage = new MemoryIdempotencyStorage();
      const service = new IdempotencyService(idempotencyStorage);

      const specialKey = '!@#$%^&*()_+-=[]{}|;:,.<>?';

      await service.set('ledger-1', specialKey, { value: 'test' });
      const result = await service.get<{ value: string }>('ledger-1', specialKey);

      expect(result?.value).toBe('test');

      service.destroy();
    });

    it('should properly cleanup service on destroy', async () => {
      const idempotencyStorage = new MemoryIdempotencyStorage();
      const service = new IdempotencyService(idempotencyStorage);

      await service.set('ledger-1', 'key', { value: 'test' });

      service.destroy();
    });

    it('should clear all keys for a ledger', async () => {
      const idempotencyStorage = new MemoryIdempotencyStorage();
      const service = new IdempotencyService(idempotencyStorage);

      await service.set('ledger-1', 'key1', { value: 'test1' });
      await service.set('ledger-1', 'key2', { value: 'test2' });
      await service.set('ledger-2', 'key1', { value: 'other' });

      service.clearLedger('ledger-1');

      expect(await service.get('ledger-1', 'key1')).toBeNull();
      expect(await service.get('ledger-1', 'key2')).toBeNull();
      expect(await service.get('ledger-2', 'key1')).not.toBeNull();

      service.destroy();
    });
  });

  describe('Proof Verification Edge Cases', () => {
    it('should handle empty proof array', () => {
      const proof = {
        leaf: 'a'.repeat(64),
        index: 0,
        proof: [],
        directions: [],
        root: 'a'.repeat(64)
      };

      const result = MerkleTree.verify(proof);
      expect(result).toBe(true);
    });

    it('should handle mismatched proof/directions length', () => {
      const proof = {
        leaf: 'a'.repeat(64),
        index: 0,
        proof: ['b'.repeat(64), 'c'.repeat(64)],
        directions: ['left'] as ('left' | 'right')[],
        root: 'd'.repeat(64)
      };

      const result = MerkleTree.verify(proof);
      expect(result).toBe(false);
    });

    it('should handle invalid direction values', () => {
      const proof = {
        leaf: 'a'.repeat(64),
        index: 0,
        proof: ['b'.repeat(64)],
        directions: ['up' as any],
        root: 'c'.repeat(64)
      };

      const result = MerkleTree.verify(proof);
      expect(typeof result).toBe('boolean');
    });

    it('should handle proof with undefined values', () => {
      const proof = {
        leaf: undefined as any,
        index: 0,
        proof: [],
        directions: [],
        root: 'a'.repeat(64)
      };

      const result = MerkleTree.verify(proof);
      expect(result).toBe(false);
    });

    it('should throw for null proof object', () => {
      expect(() => MerkleTree.verify(null as any)).toThrow();
    });
  });

  describe('Boundary Conditions', () => {
    it('should handle arrays with holes', () => {
      const sparseArray = [1, , , 4];

      const hash = sha256(JSON.stringify(sparseArray));
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle deeply nested structures', () => {
      let deep: any = { value: 'bottom' };
      for (let i = 0; i < 50; i++) {
        deep = { nested: deep };
      }

      const hash = sha256(JSON.stringify(deep));
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle large arrays', () => {
      const largeArray = Array.from({ length: 10000 }, (_, i) => i);

      const hash = sha256(JSON.stringify(largeArray));
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle objects with many keys', () => {
      const manyKeys: Record<string, number> = {};
      for (let i = 0; i < 1000; i++) {
        manyKeys[`key_${i}`] = i;
      }

      const hash = sha256(JSON.stringify(manyKeys));
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('Recovery Scenarios', () => {
    it('should maintain tree consistency after invalid operations', () => {
      const tree = new MerkleTree();

      for (let i = 0; i < 10; i++) {
        tree.append(sha256(`entry-${i}`));
      }

      const beforeCount = tree.size;

      // Try invalid operations (should throw)
      try { tree.getProof(-1); } catch (e) { /* expected */ }
      try { tree.getProof(999); } catch (e) { /* expected */ }
      try { tree.getProof(NaN); } catch (e) { /* expected */ }

      const afterCount = tree.size;

      expect(beforeCount).toBe(afterCount);
    });

    it('should handle proof generation after failed verification attempts', () => {
      const tree = new MerkleTree();

      for (let i = 0; i < 10; i++) {
        tree.append(sha256(`entry-${i}`));
      }

      // Try invalid verifications (may throw)
      try { MerkleTree.verify(null as any); } catch (e) { /* expected */ }
      MerkleTree.verify({ leaf: '', index: 0, proof: [], directions: [], root: '' });

      // Tree should still work
      const proof = tree.getProof(5);
      expect(proof).toBeDefined();
      expect(MerkleTree.verify(proof!)).toBe(true);
    });
  });

  describe('Concurrent Error Handling', () => {
    it('should throw for multiple invalid operations', () => {
      const tree = new MerkleTree();

      for (let i = 0; i < 10; i++) {
        tree.append(sha256(`entry-${i}`));
      }

      for (let i = 0; i < 10; i++) {
        expect(() => tree.getProof(999)).toThrow();
      }
    });

    it('should isolate errors between operations', () => {
      const tree = new MerkleTree();

      for (let i = 0; i < 10; i++) {
        tree.append(sha256(`entry-${i}`));
      }

      // Invalid operations throw
      expect(() => tree.getProof(999)).toThrow();
      expect(() => tree.getProof(-1)).toThrow();
      expect(() => tree.getProof(1000)).toThrow();

      // Valid operations succeed
      const proof5 = tree.getProof(5);
      const proof3 = tree.getProof(3);

      expect(proof5).toBeDefined();
      expect(proof3).toBeDefined();
      expect(MerkleTree.verify(proof5!)).toBe(true);
      expect(MerkleTree.verify(proof3!)).toBe(true);
    });
  });
});

describe('Timeout Simulation Tests', () => {
  it('should handle slow hash computations', () => {
    const largeData = { content: 'x'.repeat(1000000) };

    const start = Date.now();
    const hash = sha256(JSON.stringify(largeData));
    const duration = Date.now() - start;

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(duration).toBeLessThan(5000);
  });

  it('should handle slow proof generation', () => {
    const tree = new MerkleTree();

    for (let i = 0; i < 10000; i++) {
      tree.append(`hash-${i}`.padEnd(64, '0'));
    }

    const start = Date.now();
    const proof = tree.getProof(5000);
    const duration = Date.now() - start;

    expect(proof).not.toBeNull();
    expect(duration).toBeLessThan(1000);
  });

  it('should handle slow proof verification', () => {
    const tree = new MerkleTree();

    for (let i = 0; i < 10000; i++) {
      tree.append(`hash-${i}`.padEnd(64, '0'));
    }

    const proof = tree.getProof(5000)!;

    const start = Date.now();
    const result = MerkleTree.verify(proof);
    const duration = Date.now() - start;

    expect(result).toBe(true);
    expect(duration).toBeLessThan(100);
  });
});

describe('Edge Case Data Types', () => {
  it('should handle Date objects', () => {
    const hash = sha256(JSON.stringify({ date: new Date().toISOString() }));
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should handle regular expressions', () => {
    const hash = sha256(JSON.stringify({ regex: /test/g.toString() }));
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should handle Map-like objects', () => {
    const mapData = Object.fromEntries(new Map([['a', 1], ['b', 2]]));
    const hash = sha256(JSON.stringify(mapData));
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should handle unicode strings', () => {
    const unicodeData = {
      emoji: '🔐🗳️✅',
      chinese: '中文测试',
      arabic: 'العربية',
      mixed: 'Hello 世界 🌍'
    };

    const hash = sha256(JSON.stringify(unicodeData));
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should handle special float values', () => {
    const specialFloats = [
      Number.MAX_VALUE,
      Number.MIN_VALUE,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      Number.NaN,
      -0,
      Number.EPSILON
    ];

    for (const value of specialFloats) {
      const hash = sha256(JSON.stringify({ value }));
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    }
  });
});
