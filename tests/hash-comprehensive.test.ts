/**
 * Comprehensive Hash Function Tests
 *
 * Enterprise-level tests for hash function behavior across various inputs.
 */

import { sha256, isValidHash } from '../src/core/hash';

describe('Comprehensive Hash Tests', () => {
  describe('Basic String Hashing', () => {
    it('should hash empty string', () => {
      expect(sha256('')).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash single character', () => {
      expect(sha256('a')).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash two characters', () => {
      expect(sha256('ab')).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash "hello"', () => {
      expect(sha256('hello')).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash "hello world"', () => {
      expect(sha256('hello world')).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash 100 character string', () => {
      expect(sha256('x'.repeat(100))).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash 1000 character string', () => {
      expect(sha256('x'.repeat(1000))).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash 10000 character string', () => {
      expect(sha256('x'.repeat(10000))).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash 100000 character string', () => {
      expect(sha256('x'.repeat(100000))).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('Numeric String Hashing', () => {
    it('should hash "0"', () => {
      expect(sha256('0')).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash "1"', () => {
      expect(sha256('1')).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash "123"', () => {
      expect(sha256('123')).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash large number string', () => {
      expect(sha256('9007199254740991')).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash negative number string', () => {
      expect(sha256('-123')).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash decimal string', () => {
      expect(sha256('3.14159')).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash scientific notation string', () => {
      expect(sha256('1e10')).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('Special Character Hashing', () => {
    it('should hash newline', () => {
      expect(sha256('\n')).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash tab', () => {
      expect(sha256('\t')).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash carriage return', () => {
      expect(sha256('\r')).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash null character', () => {
      expect(sha256('\0')).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash backslash', () => {
      expect(sha256('\\')).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash quote', () => {
      expect(sha256('"')).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash single quote', () => {
      expect(sha256("'")).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash backtick', () => {
      expect(sha256('`')).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash mixed special characters', () => {
      expect(sha256('!@#$%^&*()_+-=[]{}|;:,.<>?')).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('Unicode Hashing', () => {
    it('should hash Chinese characters', () => {
      expect(sha256('中文')).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash Japanese characters', () => {
      expect(sha256('日本語')).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash Korean characters', () => {
      expect(sha256('한국어')).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash Arabic characters', () => {
      expect(sha256('العربية')).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash Hebrew characters', () => {
      expect(sha256('עברית')).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash Russian characters', () => {
      expect(sha256('Русский')).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash Greek characters', () => {
      expect(sha256('Ελληνικά')).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash Thai characters', () => {
      expect(sha256('ภาษาไทย')).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash Hindi characters', () => {
      expect(sha256('हिन्दी')).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash emoji', () => {
      expect(sha256('🔐🗳️✅🎉')).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash mixed unicode', () => {
      expect(sha256('Hello 世界 🌍 مرحبا')).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('JSON Hashing', () => {
    it('should hash empty object', () => {
      expect(sha256(JSON.stringify({}))).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash empty array', () => {
      expect(sha256(JSON.stringify([]))).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash null', () => {
      expect(sha256(JSON.stringify(null))).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash true', () => {
      expect(sha256(JSON.stringify(true))).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash false', () => {
      expect(sha256(JSON.stringify(false))).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash number 0', () => {
      expect(sha256(JSON.stringify(0))).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash number 1', () => {
      expect(sha256(JSON.stringify(1))).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash simple object', () => {
      expect(sha256(JSON.stringify({ key: 'value' }))).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash nested object', () => {
      expect(sha256(JSON.stringify({ a: { b: { c: 'd' } } }))).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash array of numbers', () => {
      expect(sha256(JSON.stringify([1, 2, 3, 4, 5]))).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash array of strings', () => {
      expect(sha256(JSON.stringify(['a', 'b', 'c']))).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash mixed array', () => {
      expect(sha256(JSON.stringify([1, 'a', true, null]))).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash complex object', () => {
      const obj = {
        string: 'hello',
        number: 42,
        boolean: true,
        null: null,
        array: [1, 2, 3],
        nested: { a: 1 }
      };
      expect(sha256(JSON.stringify(obj))).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('Determinism', () => {
    it('should produce same hash for same input - empty string', () => {
      expect(sha256('')).toBe(sha256(''));
    });

    it('should produce same hash for same input - hello', () => {
      expect(sha256('hello')).toBe(sha256('hello'));
    });

    it('should produce same hash for same input - 100 times', () => {
      const input = 'test input for determinism';
      const first = sha256(input);
      for (let i = 0; i < 100; i++) {
        expect(sha256(input)).toBe(first);
      }
    });

    it('should produce same hash for same JSON object', () => {
      const obj = { key: 'value' };
      expect(sha256(JSON.stringify(obj))).toBe(sha256(JSON.stringify(obj)));
    });
  });

  describe('Uniqueness', () => {
    it('should produce different hashes for a vs b', () => {
      expect(sha256('a')).not.toBe(sha256('b'));
    });

    it('should produce different hashes for 0 vs 1', () => {
      expect(sha256('0')).not.toBe(sha256('1'));
    });

    it('should produce different hashes for true vs false', () => {
      expect(sha256('true')).not.toBe(sha256('false'));
    });

    it('should produce different hashes for empty string vs space', () => {
      expect(sha256('')).not.toBe(sha256(' '));
    });

    it('should produce different hashes for different lengths', () => {
      expect(sha256('a')).not.toBe(sha256('aa'));
    });

    it('should produce different hashes for case differences', () => {
      expect(sha256('Hello')).not.toBe(sha256('hello'));
    });

    it('should produce 1000 unique hashes for sequential numbers', () => {
      const hashes = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        hashes.add(sha256(i.toString()));
      }
      expect(hashes.size).toBe(1000);
    });

    it('should produce unique hashes for similar strings', () => {
      const hashes = new Set<string>();
      for (let i = 0; i < 100; i++) {
        hashes.add(sha256(`test-${i}`));
      }
      expect(hashes.size).toBe(100);
    });
  });

  describe('Hash Format', () => {
    it('should always produce 64 character output', () => {
      const inputs = ['', 'a', 'hello', 'x'.repeat(10000)];
      for (const input of inputs) {
        expect(sha256(input).length).toBe(64);
      }
    });

    it('should only contain lowercase hex characters', () => {
      const inputs = ['', 'test', 'UPPERCASE', '12345'];
      for (const input of inputs) {
        expect(sha256(input)).toMatch(/^[a-f0-9]{64}$/);
      }
    });

    it('should not contain uppercase letters', () => {
      for (let i = 0; i < 100; i++) {
        const hash = sha256(`input-${i}`);
        expect(hash).not.toMatch(/[A-F]/);
      }
    });
  });

  describe('isValidHash Function', () => {
    it('should accept valid 64-char lowercase hex', () => {
      expect(isValidHash('a'.repeat(64))).toBe(true);
    });

    it('should accept valid 64-char mixed hex', () => {
      expect(isValidHash('0123456789abcdef'.repeat(4))).toBe(true);
    });

    it('should accept sha256 output', () => {
      expect(isValidHash(sha256('test'))).toBe(true);
    });

    it('should accept uppercase hex', () => {
      expect(isValidHash('A'.repeat(64))).toBe(true);
    });

    it('should accept mixed case hex', () => {
      expect(isValidHash('aAbBcCdDeEfF'.repeat(5) + 'aaaa')).toBe(true);
    });

    it('should reject 63 character string', () => {
      expect(isValidHash('a'.repeat(63))).toBe(false);
    });

    it('should reject 65 character string', () => {
      expect(isValidHash('a'.repeat(65))).toBe(false);
    });

    it('should reject empty string', () => {
      expect(isValidHash('')).toBe(false);
    });

    it('should reject string with invalid characters', () => {
      expect(isValidHash('g'.repeat(64))).toBe(false);
    });

    it('should reject string with spaces', () => {
      expect(isValidHash(' '.repeat(64))).toBe(false);
    });

    it('should reject string with leading space', () => {
      expect(isValidHash(' ' + 'a'.repeat(63))).toBe(false);
    });

    it('should reject string with trailing space', () => {
      expect(isValidHash('a'.repeat(63) + ' ')).toBe(false);
    });

    it('should reject null', () => {
      expect(isValidHash(null as any)).toBe(false);
    });

    it('should reject undefined', () => {
      expect(isValidHash(undefined as any)).toBe(false);
    });

    it('should reject number', () => {
      expect(isValidHash(123 as any)).toBe(false);
    });

    it('should reject object', () => {
      expect(isValidHash({} as any)).toBe(false);
    });

    it('should reject array', () => {
      expect(isValidHash([] as any)).toBe(false);
    });
  });

  describe('Binary Data Handling', () => {
    it('should hash base64 encoded binary', () => {
      const binary = Buffer.from([0x00, 0x01, 0x02, 0xff]).toString('base64');
      expect(sha256(binary)).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash hex encoded binary', () => {
      const binary = Buffer.from([0x00, 0x01, 0x02, 0xff]).toString('hex');
      expect(sha256(binary)).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash all byte values in base64', () => {
      const bytes = new Uint8Array(256);
      for (let i = 0; i < 256; i++) bytes[i] = i;
      const binary = Buffer.from(bytes).toString('base64');
      expect(sha256(binary)).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('Whitespace Sensitivity', () => {
    it('should distinguish leading whitespace', () => {
      expect(sha256('test')).not.toBe(sha256(' test'));
    });

    it('should distinguish trailing whitespace', () => {
      expect(sha256('test')).not.toBe(sha256('test '));
    });

    it('should distinguish internal whitespace', () => {
      expect(sha256('hello world')).not.toBe(sha256('hello  world'));
    });

    it('should distinguish newline vs space', () => {
      expect(sha256('a b')).not.toBe(sha256('a\nb'));
    });

    it('should distinguish tab vs space', () => {
      expect(sha256('a b')).not.toBe(sha256('a\tb'));
    });
  });

  describe('Edge Cases', () => {
    it('should hash string "null"', () => {
      expect(sha256('null')).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash string "undefined"', () => {
      expect(sha256('undefined')).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash string "NaN"', () => {
      expect(sha256('NaN')).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash string "Infinity"', () => {
      expect(sha256('Infinity')).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash string with only spaces', () => {
      expect(sha256('   ')).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash string with only newlines', () => {
      expect(sha256('\n\n\n')).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash string with only tabs', () => {
      expect(sha256('\t\t\t')).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash very long repeated pattern', () => {
      const pattern = 'abc';
      expect(sha256(pattern.repeat(10000))).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('Performance Characteristics', () => {
    it('should hash 1KB quickly', () => {
      const start = Date.now();
      sha256('x'.repeat(1024));
      expect(Date.now() - start).toBeLessThan(100);
    });

    it('should hash 1MB quickly', () => {
      const start = Date.now();
      sha256('x'.repeat(1024 * 1024));
      expect(Date.now() - start).toBeLessThan(1000);
    });

    it('should hash 1000 strings quickly', () => {
      const start = Date.now();
      for (let i = 0; i < 1000; i++) sha256(`input-${i}`);
      expect(Date.now() - start).toBeLessThan(1000);
    });
  });
});
