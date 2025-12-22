/**
 * Hash Edge Cases Tests
 *
 * Comprehensive edge case testing for hash function.
 */

import { sha256, isValidHash } from '../src/core/hash';

describe('Hash Edge Cases Tests', () => {
  describe('Empty and Minimal Input', () => {
    it('should hash empty string', () => {
      const hash = sha256('');
      expect(hash.length).toBe(64);
      expect(isValidHash(hash)).toBe(true);
    });

    it('should hash single character', () => {
      expect(sha256('a').length).toBe(64);
      expect(sha256('z').length).toBe(64);
      expect(sha256('0').length).toBe(64);
    });

    it('should hash single space', () => {
      expect(sha256(' ').length).toBe(64);
    });

    it('should hash single newline', () => {
      expect(sha256('\n').length).toBe(64);
    });

    it('should hash single tab', () => {
      expect(sha256('\t').length).toBe(64);
    });

    it('should hash null byte', () => {
      expect(sha256('\0').length).toBe(64);
    });
  });

  describe('Whitespace Variations', () => {
    it('should distinguish space from empty', () => {
      expect(sha256(' ')).not.toBe(sha256(''));
    });

    it('should distinguish different whitespace chars', () => {
      expect(sha256(' ')).not.toBe(sha256('\t'));
      expect(sha256('\t')).not.toBe(sha256('\n'));
      expect(sha256('\n')).not.toBe(sha256('\r'));
    });

    it('should distinguish whitespace counts', () => {
      expect(sha256(' ')).not.toBe(sha256('  '));
      expect(sha256('  ')).not.toBe(sha256('   '));
    });

    it('should hash carriage return', () => {
      expect(sha256('\r').length).toBe(64);
    });

    it('should hash CRLF', () => {
      expect(sha256('\r\n').length).toBe(64);
    });

    it('should hash form feed', () => {
      expect(sha256('\f').length).toBe(64);
    });

    it('should hash vertical tab', () => {
      expect(sha256('\v').length).toBe(64);
    });

    it('should hash non-breaking space', () => {
      expect(sha256('\u00A0').length).toBe(64);
    });
  });

  describe('Unicode Edge Cases', () => {
    it('should hash emoji', () => {
      expect(sha256('🔐').length).toBe(64);
      expect(sha256('👍').length).toBe(64);
      expect(sha256('🚀').length).toBe(64);
    });

    it('should hash Chinese characters', () => {
      expect(sha256('中文').length).toBe(64);
    });

    it('should hash Japanese characters', () => {
      expect(sha256('日本語').length).toBe(64);
    });

    it('should hash Korean characters', () => {
      expect(sha256('한글').length).toBe(64);
    });

    it('should hash Arabic characters', () => {
      expect(sha256('العربية').length).toBe(64);
    });

    it('should hash Hebrew characters', () => {
      expect(sha256('עברית').length).toBe(64);
    });

    it('should hash Greek characters', () => {
      expect(sha256('ελληνικά').length).toBe(64);
    });

    it('should hash Cyrillic characters', () => {
      expect(sha256('русский').length).toBe(64);
    });

    it('should hash combining characters', () => {
      expect(sha256('é').length).toBe(64); // e + combining acute
      expect(sha256('ñ').length).toBe(64);
    });

    it('should hash zero-width joiner', () => {
      expect(sha256('\u200D').length).toBe(64);
    });

    it('should hash BOM', () => {
      expect(sha256('\uFEFF').length).toBe(64);
    });

    it('should hash RTL override', () => {
      expect(sha256('\u202E').length).toBe(64);
    });

    it('should hash surrogate pairs', () => {
      expect(sha256('𝄞').length).toBe(64); // Musical G clef
    });

    it('should hash multiple emoji', () => {
      expect(sha256('🔐🗝️🔒').length).toBe(64);
    });
  });

  describe('Numeric Edge Cases', () => {
    it('should hash zero', () => {
      expect(sha256('0').length).toBe(64);
    });

    it('should hash negative zero string', () => {
      expect(sha256('-0').length).toBe(64);
    });

    it('should hash MAX_SAFE_INTEGER', () => {
      expect(sha256(String(Number.MAX_SAFE_INTEGER)).length).toBe(64);
    });

    it('should hash MIN_SAFE_INTEGER', () => {
      expect(sha256(String(Number.MIN_SAFE_INTEGER)).length).toBe(64);
    });

    it('should hash very small decimal', () => {
      expect(sha256('0.0000000000001').length).toBe(64);
    });

    it('should hash scientific notation', () => {
      expect(sha256('1e100').length).toBe(64);
      expect(sha256('1e-100').length).toBe(64);
    });

    it('should hash Infinity string', () => {
      expect(sha256('Infinity').length).toBe(64);
    });

    it('should hash -Infinity string', () => {
      expect(sha256('-Infinity').length).toBe(64);
    });

    it('should hash NaN string', () => {
      expect(sha256('NaN').length).toBe(64);
    });
  });

  describe('Special Characters', () => {
    it('should hash all ASCII punctuation', () => {
      const punctuation = '!\"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~';
      expect(sha256(punctuation).length).toBe(64);
    });

    it('should hash backslash', () => {
      expect(sha256('\\').length).toBe(64);
    });

    it('should hash forward slash', () => {
      expect(sha256('/').length).toBe(64);
    });

    it('should hash quotes', () => {
      expect(sha256('"').length).toBe(64);
      expect(sha256("'").length).toBe(64);
      expect(sha256('`').length).toBe(64);
    });

    it('should hash smart quotes', () => {
      expect(sha256('\u201C').length).toBe(64); // "
      expect(sha256('\u201D').length).toBe(64); // "
      expect(sha256('\u2018').length).toBe(64); // '
      expect(sha256('\u2019').length).toBe(64); // '
    });

    it('should hash dashes', () => {
      expect(sha256('-').length).toBe(64);
      expect(sha256('–').length).toBe(64); // en-dash
      expect(sha256('—').length).toBe(64); // em-dash
    });

    it('should hash angle brackets', () => {
      expect(sha256('<').length).toBe(64);
      expect(sha256('>').length).toBe(64);
    });
  });

  describe('Long Strings', () => {
    it('should hash 100 character string', () => {
      expect(sha256('a'.repeat(100)).length).toBe(64);
    });

    it('should hash 1000 character string', () => {
      expect(sha256('a'.repeat(1000)).length).toBe(64);
    });

    it('should hash 10000 character string', () => {
      expect(sha256('a'.repeat(10000)).length).toBe(64);
    });

    it('should hash 100000 character string', () => {
      expect(sha256('a'.repeat(100000)).length).toBe(64);
    });

    it('should hash 1MB string', () => {
      expect(sha256('a'.repeat(1000000)).length).toBe(64);
    });
  });

  describe('Pattern Strings', () => {
    it('should hash repeating pattern', () => {
      expect(sha256('ab'.repeat(1000)).length).toBe(64);
    });

    it('should hash alternating binary', () => {
      expect(sha256('01'.repeat(1000)).length).toBe(64);
    });

    it('should hash sequential numbers', () => {
      expect(sha256('0123456789'.repeat(100)).length).toBe(64);
    });

    it('should hash hex pattern', () => {
      expect(sha256('deadbeef'.repeat(100)).length).toBe(64);
    });

    it('should hash base64-like pattern', () => {
      expect(sha256('SGVsbG8gV29ybGQ='.repeat(100)).length).toBe(64);
    });
  });

  describe('JSON Strings', () => {
    it('should hash empty JSON object', () => {
      expect(sha256('{}').length).toBe(64);
    });

    it('should hash empty JSON array', () => {
      expect(sha256('[]').length).toBe(64);
    });

    it('should hash simple JSON', () => {
      expect(sha256('{"key":"value"}').length).toBe(64);
    });

    it('should hash JSON with escaped quotes', () => {
      expect(sha256('{"key":"value with \\"quotes\\""}').length).toBe(64);
    });

    it('should hash JSON with unicode', () => {
      expect(sha256('{"key":"\\u0000"}').length).toBe(64);
    });

    it('should hash nested JSON', () => {
      expect(sha256('{"a":{"b":{"c":"d"}}}').length).toBe(64);
    });
  });

  describe('Control Characters', () => {
    it('should hash all control characters', () => {
      for (let i = 0; i < 32; i++) {
        expect(sha256(String.fromCharCode(i)).length).toBe(64);
      }
    });

    it('should hash DEL character', () => {
      expect(sha256('\x7F').length).toBe(64);
    });

    it('should hash bell character', () => {
      expect(sha256('\x07').length).toBe(64);
    });

    it('should hash backspace', () => {
      expect(sha256('\x08').length).toBe(64);
    });

    it('should hash escape character', () => {
      expect(sha256('\x1B').length).toBe(64);
    });
  });

  describe('Hash Format Validation', () => {
    it('should always produce lowercase hex', () => {
      for (let i = 0; i < 100; i++) {
        const hash = sha256(`test-${i}`);
        expect(hash).toMatch(/^[a-f0-9]{64}$/);
      }
    });

    it('should always produce exactly 64 chars', () => {
      const inputs = ['', 'a', 'ab', 'a'.repeat(1000000)];
      for (const input of inputs) {
        expect(sha256(input).length).toBe(64);
      }
    });
  });

  describe('isValidHash Edge Cases', () => {
    it('should accept 64 lowercase hex', () => {
      expect(isValidHash('a'.repeat(64))).toBe(true);
    });

    it('should accept 64 uppercase hex', () => {
      expect(isValidHash('A'.repeat(64))).toBe(true);
    });

    it('should accept mixed case', () => {
      expect(isValidHash('aA'.repeat(32))).toBe(true);
    });

    it('should accept all digits', () => {
      expect(isValidHash('0'.repeat(64))).toBe(true);
    });

    it('should reject 63 chars', () => {
      expect(isValidHash('a'.repeat(63))).toBe(false);
    });

    it('should reject 65 chars', () => {
      expect(isValidHash('a'.repeat(65))).toBe(false);
    });

    it('should reject empty string', () => {
      expect(isValidHash('')).toBe(false);
    });

    it('should reject non-hex characters', () => {
      expect(isValidHash('g'.repeat(64))).toBe(false);
      expect(isValidHash('x'.repeat(64))).toBe(false);
    });

    it('should reject spaces', () => {
      expect(isValidHash(' '.repeat(64))).toBe(false);
    });

    it('should reject with leading space', () => {
      expect(isValidHash(' ' + 'a'.repeat(63))).toBe(false);
    });

    it('should reject with trailing space', () => {
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

    it('should reject boolean', () => {
      expect(isValidHash(true as any)).toBe(false);
    });
  });

  describe('Determinism', () => {
    it('should produce same hash for same input', () => {
      const input = 'determinism-test';
      const hash1 = sha256(input);
      const hash2 = sha256(input);
      expect(hash1).toBe(hash2);
    });

    it('should produce same hash 1000 times', () => {
      const input = 'consistency-test';
      const expected = sha256(input);
      for (let i = 0; i < 1000; i++) {
        expect(sha256(input)).toBe(expected);
      }
    });
  });

  describe('Collision Resistance', () => {
    it('should produce unique hashes for similar inputs', () => {
      const hashes = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        hashes.add(sha256(`similar-${i}`));
      }
      expect(hashes.size).toBe(1000);
    });

    it('should distinguish single character differences', () => {
      expect(sha256('test')).not.toBe(sha256('Test'));
      expect(sha256('abc')).not.toBe(sha256('abd'));
      expect(sha256('hello')).not.toBe(sha256('hello '));
    });
  });
});
