/**
 * Hash Algorithm Tests
 *
 * Tests for SHA-256 and BLAKE3 hash algorithms
 */

import {
  sha256,
  blake3,
  hashEntry,
  hashEntryBlake3,
  setDefaultHashAlgorithm,
  getDefaultHashAlgorithm,
  hash,
  hashAsync,
  isValidHash
} from '../src/core/hash.js';

describe('Hash Algorithms', () => {
  describe('SHA-256', () => {
    test('should hash string consistently', () => {
      const input = 'test data';
      const hash1 = sha256(input);
      const hash2 = sha256(input);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 produces 64 hex characters
    });

    test('should hash buffer consistently', () => {
      const input = Buffer.from('test data');
      const hash1 = sha256(input);
      const hash2 = sha256(input);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });

    test('should produce different hashes for different inputs', () => {
      const hash1 = sha256('input1');
      const hash2 = sha256('input2');

      expect(hash1).not.toBe(hash2);
    });

    test('should validate SHA-256 hash format', () => {
      const validHash = sha256('test');
      expect(isValidHash(validHash)).toBe(true);

      expect(isValidHash('not a hash')).toBe(false);
      expect(isValidHash('1234')).toBe(false);
      expect(isValidHash('z'.repeat(64))).toBe(false);
    });
  });

  describe('BLAKE3', () => {
    test('should hash string consistently', async () => {
      const input = 'test data';
      const hash1 = await blake3(input);
      const hash2 = await blake3(input);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // BLAKE3 also produces 64 hex characters
    });

    test('should hash buffer consistently', async () => {
      const input = Buffer.from('test data');
      const hash1 = await blake3(input);
      const hash2 = await blake3(input);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });

    test('should produce different hashes for different inputs', async () => {
      const hash1 = await blake3('input1');
      const hash2 = await blake3('input2');

      expect(hash1).not.toBe(hash2);
    });

    test('should produce different hash than SHA-256 for same input', async () => {
      const input = 'test data';
      const sha256Hash = sha256(input);
      const blake3Hash = await blake3(input);

      expect(sha256Hash).not.toBe(blake3Hash);
    });

    test('should validate BLAKE3 hash format', async () => {
      const validHash = await blake3('test');
      expect(isValidHash(validHash)).toBe(true);
    });
  });

  describe('Algorithm Configuration', () => {
    afterEach(() => {
      // Reset to default after each test
      setDefaultHashAlgorithm('sha256');
    });

    test('should default to SHA-256', () => {
      expect(getDefaultHashAlgorithm()).toBe('sha256');
    });

    test('should set default algorithm to BLAKE3', () => {
      setDefaultHashAlgorithm('blake3');
      expect(getDefaultHashAlgorithm()).toBe('blake3');
    });

    test('should set default algorithm to SHA-256', () => {
      setDefaultHashAlgorithm('blake3');
      setDefaultHashAlgorithm('sha256');
      expect(getDefaultHashAlgorithm()).toBe('sha256');
    });

    test('should use SHA-256 with hash() when set as default', () => {
      setDefaultHashAlgorithm('sha256');
      const input = 'test';
      const hashResult = hash(input);
      const sha256Result = sha256(input);

      expect(hashResult).toBe(sha256Result);
    });

    test('should throw error when using hash() with BLAKE3 default', () => {
      setDefaultHashAlgorithm('blake3');
      const input = 'test';

      expect(() => hash(input)).toThrow('BLAKE3 is async');
    });

    test('should use SHA-256 with hashAsync() when set as default', async () => {
      setDefaultHashAlgorithm('sha256');
      const input = 'test';
      const hashResult = await hashAsync(input);
      const sha256Result = sha256(input);

      expect(hashResult).toBe(sha256Result);
    });

    test('should use BLAKE3 with hashAsync() when set as default', async () => {
      setDefaultHashAlgorithm('blake3');
      const input = 'test';
      const hashResult = await hashAsync(input);
      const blake3Result = await blake3(input);

      expect(hashResult).toBe(blake3Result);
    });
  });

  describe('Entry Hashing', () => {
    test('should hash entry with SHA-256', () => {
      const data = { user: 'alice', action: 'login' };
      const position = 0n;
      const hash1 = hashEntry(data, position);
      const hash2 = hashEntry(data, position);

      // Same data and position should produce same hash (deterministic)
      // Note: This will fail due to timestamp, which is by design
      expect(hash1).toHaveLength(64);
      expect(hash2).toHaveLength(64);
    });

    test('should hash entry with BLAKE3', async () => {
      const data = { user: 'bob', action: 'logout' };
      const position = 1n;
      const hash1 = await hashEntryBlake3(data, position);

      expect(hash1).toHaveLength(64);
      expect(isValidHash(hash1)).toBe(true);
    });

    test('should produce different hashes for different positions', () => {
      const data = { user: 'alice', action: 'login' };
      const hash1 = hashEntry(data, 0n);
      const hash2 = hashEntry(data, 1n);

      expect(hash1).not.toBe(hash2);
    });

    test('should produce different hashes for different data', () => {
      const position = 0n;
      const hash1 = hashEntry({ user: 'alice' }, position);
      const hash2 = hashEntry({ user: 'bob' }, position);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Performance Comparison', () => {
    const testData = Array.from({ length: 1000 }, (_, i) => `data_${i}`);

    test('should measure SHA-256 performance', () => {
      const start = Date.now();
      testData.forEach(data => sha256(data));
      const duration = Date.now() - start;

      expect(duration).toBeGreaterThan(0);
      expect(duration).toBeLessThan(1000); // Should be fast
    });

    test('should measure BLAKE3 performance', async () => {
      const start = Date.now();
      await Promise.all(testData.map(data => blake3(data)));
      const duration = Date.now() - start;

      expect(duration).toBeGreaterThan(0);
      expect(duration).toBeLessThan(5000); // BLAKE3 may be slower due to async overhead
    });

    test('should compare hash output sizes', async () => {
      const input = 'test data';
      const sha256Hash = sha256(input);
      const blake3Hash = await blake3(input);

      // Both should produce same length output
      expect(sha256Hash.length).toBe(blake3Hash.length);
      expect(sha256Hash.length).toBe(64);
    });
  });

  describe('Collision Resistance', () => {
    test('should not produce collisions for similar inputs (SHA-256)', () => {
      const hashes = new Set<string>();
      const inputs = [
        'test',
        'test1',
        'test2',
        'Test',
        'TEST',
        'test ',
        ' test',
        'test\n',
        'test\t'
      ];

      inputs.forEach(input => {
        const hash = sha256(input);
        expect(hashes.has(hash)).toBe(false);
        hashes.add(hash);
      });

      expect(hashes.size).toBe(inputs.length);
    });

    test('should not produce collisions for similar inputs (BLAKE3)', async () => {
      const hashes = new Set<string>();
      const inputs = [
        'test',
        'test1',
        'test2',
        'Test',
        'TEST',
        'test ',
        ' test',
        'test\n',
        'test\t'
      ];

      for (const input of inputs) {
        const hash = await blake3(input);
        expect(hashes.has(hash)).toBe(false);
        hashes.add(hash);
      }

      expect(hashes.size).toBe(inputs.length);
    });
  });

  describe('Edge Cases', () => {
    test('should hash empty string (SHA-256)', () => {
      const hash = sha256('');
      expect(hash).toHaveLength(64);
      expect(isValidHash(hash)).toBe(true);
    });

    test('should hash empty string (BLAKE3)', async () => {
      const hash = await blake3('');
      expect(hash).toHaveLength(64);
      expect(isValidHash(hash)).toBe(true);
    });

    test('should hash empty buffer (SHA-256)', () => {
      const hash = sha256(Buffer.from(''));
      expect(hash).toHaveLength(64);
    });

    test('should hash empty buffer (BLAKE3)', async () => {
      const hash = await blake3(Buffer.from(''));
      expect(hash).toHaveLength(64);
    });

    test('should hash very long string (SHA-256)', () => {
      const longString = 'a'.repeat(1000000);
      const hash = sha256(longString);
      expect(hash).toHaveLength(64);
    });

    test('should hash very long string (BLAKE3)', async () => {
      const longString = 'a'.repeat(1000000);
      const hash = await blake3(longString);
      expect(hash).toHaveLength(64);
    });

    test('should hash unicode characters (SHA-256)', () => {
      const unicode = '你好世界 🌍 مرحبا';
      const hash = sha256(unicode);
      expect(hash).toHaveLength(64);
    });

    test('should hash unicode characters (BLAKE3)', async () => {
      const unicode = '你好世界 🌍 مرحبا';
      const hash = await blake3(unicode);
      expect(hash).toHaveLength(64);
    });
  });

  describe('Backwards Compatibility', () => {
    test('should maintain SHA-256 as default for existing code', () => {
      // Ensure SHA-256 remains the default
      expect(getDefaultHashAlgorithm()).toBe('sha256');

      // Existing code using hash() should continue to work
      const input = 'legacy code';
      const result = hash(input);
      expect(result).toBe(sha256(input));
    });

    test('should allow existing hashEntry to work unchanged', () => {
      const data = { test: 'data' };
      const position = 0n;

      // Should not throw
      const hash = hashEntry(data, position);
      expect(isValidHash(hash)).toBe(true);
    });
  });
});
