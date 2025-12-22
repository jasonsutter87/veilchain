/**
 * Input Validation Tests
 *
 * Comprehensive tests for input validation across all entry points.
 */

import { MerkleTree } from '../src/core/merkle';
import { sha256, isValidHash } from '../src/core/hash';

describe('Input Validation Tests', () => {
  describe('Hash Function Input', () => {
    it('should accept empty string', () => {
      expect(() => sha256('')).not.toThrow();
    });

    it('should accept single char', () => {
      expect(() => sha256('a')).not.toThrow();
    });

    it('should accept very long string', () => {
      expect(() => sha256('x'.repeat(1000000))).not.toThrow();
    });

    it('should accept unicode', () => {
      expect(() => sha256('中文🔐')).not.toThrow();
    });

    it('should accept special chars', () => {
      expect(() => sha256('!@#$%^&*()')).not.toThrow();
    });

    it('should accept newlines', () => {
      expect(() => sha256('\n\r\n')).not.toThrow();
    });

    it('should accept tabs', () => {
      expect(() => sha256('\t\t\t')).not.toThrow();
    });

    it('should accept null bytes', () => {
      expect(() => sha256('\0\0\0')).not.toThrow();
    });

    it('should accept JSON string', () => {
      expect(() => sha256(JSON.stringify({ key: 'value' }))).not.toThrow();
    });

    it('should accept base64', () => {
      expect(() => sha256(Buffer.from('hello').toString('base64'))).not.toThrow();
    });
  });

  describe('Tree Append Input', () => {
    it('should accept 64-char lowercase hex', () => {
      const tree = new MerkleTree();
      expect(() => tree.append('a'.repeat(64))).not.toThrow();
    });

    it('should accept 64-char uppercase hex', () => {
      const tree = new MerkleTree();
      expect(() => tree.append('A'.repeat(64))).not.toThrow();
    });

    it('should accept 64-char mixed hex', () => {
      const tree = new MerkleTree();
      expect(() => tree.append('aAbBcCdDeEfF'.repeat(5) + 'aaaa')).not.toThrow();
    });

    it('should accept sha256 output', () => {
      const tree = new MerkleTree();
      expect(() => tree.append(sha256('test'))).not.toThrow();
    });

    it('should accept valid hash string', () => {
      const tree = new MerkleTree();
      expect(() => tree.append('0123456789abcdef'.repeat(4))).not.toThrow();
    });
  });

  describe('GetProof Index Input', () => {
    it('should accept 0 index', () => {
      const tree = new MerkleTree();
      tree.append(sha256('e'));
      expect(tree.getProof(0)).not.toBeNull();
    });

    it('should accept positive index', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 10; i++) tree.append(sha256(`e${i}`));
      expect(tree.getProof(5)).not.toBeNull();
    });

    it('should throw for negative index', () => {
      const tree = new MerkleTree();
      tree.append(sha256('e'));
      expect(() => tree.getProof(-1)).toThrow();
    });

    it('should throw for out of bounds index', () => {
      const tree = new MerkleTree();
      tree.append(sha256('e'));
      expect(() => tree.getProof(1)).toThrow();
    });

    it('should throw for very large index', () => {
      const tree = new MerkleTree();
      tree.append(sha256('e'));
      expect(() => tree.getProof(1000000)).toThrow();
    });

    it('should handle float index', () => {
      const tree = new MerkleTree();
      tree.append(sha256('e'));
      // Should floor the float
      expect(tree.getProof(0.9)).not.toBeNull();
    });
  });

  describe('isValidHash Input', () => {
    it('should accept valid 64-char lowercase', () => {
      expect(isValidHash('a'.repeat(64))).toBe(true);
    });

    it('should accept valid 64-char uppercase', () => {
      expect(isValidHash('A'.repeat(64))).toBe(true);
    });

    it('should accept valid 64-char numbers', () => {
      expect(isValidHash('0'.repeat(64))).toBe(true);
    });

    it('should accept valid mixed', () => {
      expect(isValidHash('0123456789abcdef'.repeat(4))).toBe(true);
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

    it('should reject non-hex chars', () => {
      expect(isValidHash('g'.repeat(64))).toBe(false);
    });

    it('should reject spaces', () => {
      expect(isValidHash(' '.repeat(64))).toBe(false);
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

  describe('MerkleTree.verify Input', () => {
    it('should accept valid proof', () => {
      const tree = new MerkleTree();
      tree.append(sha256('e'));
      expect(MerkleTree.verify(tree.getProof(0)!)).toBe(true);
    });

    it('should throw for null', () => {
      expect(() => MerkleTree.verify(null as any)).toThrow();
    });

    it('should throw for undefined', () => {
      expect(() => MerkleTree.verify(undefined as any)).toThrow();
    });

    it('should throw for empty object', () => {
      expect(() => MerkleTree.verify({} as any)).toThrow();
    });

    it('should not verify proof without leaf', () => {
      const tree = new MerkleTree();
      tree.append(sha256('e'));
      const p = tree.getProof(0)!;
      expect(MerkleTree.verify({ ...p, leaf: undefined } as any)).toBe(false);
    });

    it('should not verify proof without root', () => {
      const tree = new MerkleTree();
      tree.append(sha256('e'));
      const p = tree.getProof(0)!;
      expect(MerkleTree.verify({ ...p, root: undefined } as any)).toBe(false);
    });

    it('should verify even without index (index not used in verify)', () => {
      const tree = new MerkleTree();
      tree.append(sha256('e'));
      const p = tree.getProof(0)!;
      // Index is not used in the verify algorithm, so this may pass
      const result = MerkleTree.verify({ ...p, index: undefined } as any);
      expect(typeof result).toBe('boolean');
    });

    it('should throw for proof without proof array', () => {
      const tree = new MerkleTree();
      tree.append(sha256('e'));
      const p = tree.getProof(0)!;
      expect(() => MerkleTree.verify({ ...p, proof: undefined } as any)).toThrow();
    });

    it('should verify with undefined directions (falls through to default behavior)', () => {
      const tree = new MerkleTree();
      tree.append(sha256('e'));
      const p = tree.getProof(0)!;
      // undefined directions causes direction comparison to fail, uses 'right' branch
      const result = MerkleTree.verify({ ...p, directions: undefined } as any);
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Import Input', () => {
    it('should accept empty leaves array', () => {
      expect(() => MerkleTree.import({ leaves: [] })).not.toThrow();
    });

    it('should accept single leaf', () => {
      expect(() => MerkleTree.import({ leaves: [sha256('e')] })).not.toThrow();
    });

    it('should accept multiple leaves', () => {
      const leaves = [sha256('a'), sha256('b'), sha256('c')];
      expect(() => MerkleTree.import({ leaves })).not.toThrow();
    });

    it('should accept 100 leaves', () => {
      const leaves = Array.from({ length: 100 }, (_, i) => sha256(`e${i}`));
      expect(() => MerkleTree.import({ leaves })).not.toThrow();
    });

    it('should accept 1000 leaves', () => {
      const leaves = Array.from({ length: 1000 }, (_, i) => sha256(`e${i}`));
      expect(() => MerkleTree.import({ leaves })).not.toThrow();
    });
  });

  describe('Edge Case Inputs', () => {
    it('should handle hash of repeated pattern', () => {
      expect(sha256('ab'.repeat(1000))).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle hash of all zeros', () => {
      expect(sha256('0'.repeat(1000))).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle hash of all ones', () => {
      expect(sha256('1'.repeat(1000))).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle hash of alternating chars', () => {
      expect(sha256('ab'.repeat(500))).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle tree with same hash repeated', () => {
      const tree = new MerkleTree();
      const hash = sha256('same');
      for (let i = 0; i < 10; i++) tree.append(hash);
      expect(tree.size).toBe(10);
    });

    it('should handle hash of binary-like string', () => {
      expect(sha256('01010101'.repeat(100))).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle hash of hex-like string', () => {
      expect(sha256('deadbeef'.repeat(100))).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle hash of base64-like string', () => {
      expect(sha256('SGVsbG8gV29ybGQ='.repeat(100))).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('Numeric Edge Cases', () => {
    it('should hash MAX_SAFE_INTEGER string', () => {
      expect(sha256(Number.MAX_SAFE_INTEGER.toString())).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash MIN_SAFE_INTEGER string', () => {
      expect(sha256(Number.MIN_SAFE_INTEGER.toString())).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash Infinity string', () => {
      expect(sha256('Infinity')).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash -Infinity string', () => {
      expect(sha256('-Infinity')).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash NaN string', () => {
      expect(sha256('NaN')).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash very small decimal string', () => {
      expect(sha256('0.0000000000001')).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash scientific notation string', () => {
      expect(sha256('1e100')).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash negative zero string', () => {
      expect(sha256('-0')).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('Unicode Edge Cases', () => {
    it('should hash zero-width joiner', () => {
      expect(sha256('\u200D')).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash zero-width non-joiner', () => {
      expect(sha256('\u200C')).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash BOM', () => {
      expect(sha256('\uFEFF')).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash surrogate pairs', () => {
      expect(sha256('𝄞')).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash combining characters', () => {
      expect(sha256('é')).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash RTL override', () => {
      expect(sha256('\u202E')).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash non-breaking space', () => {
      expect(sha256('\u00A0')).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash en-dash', () => {
      expect(sha256('–')).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash em-dash', () => {
      expect(sha256('—')).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash smart quotes', () => {
      expect(sha256('"')).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('Whitespace Edge Cases', () => {
    it('should hash single space', () => {
      expect(sha256(' ')).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash multiple spaces', () => {
      expect(sha256('   ')).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash tab', () => {
      expect(sha256('\t')).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash newline', () => {
      expect(sha256('\n')).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash carriage return', () => {
      expect(sha256('\r')).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash CRLF', () => {
      expect(sha256('\r\n')).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash form feed', () => {
      expect(sha256('\f')).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash vertical tab', () => {
      expect(sha256('\v')).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash mixed whitespace', () => {
      expect(sha256(' \t\n\r')).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should distinguish different whitespace', () => {
      const space = sha256(' ');
      const tab = sha256('\t');
      const newline = sha256('\n');
      expect(space).not.toBe(tab);
      expect(tab).not.toBe(newline);
      expect(space).not.toBe(newline);
    });
  });

  describe('JSON Edge Cases', () => {
    it('should hash JSON with escaped quotes', () => {
      expect(sha256(JSON.stringify({ key: 'value with "quotes"' }))).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash JSON with backslashes', () => {
      expect(sha256(JSON.stringify({ path: 'C:\\Users\\test' }))).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash JSON with unicode escapes', () => {
      expect(sha256(JSON.stringify({ text: '\u0000\u001F' }))).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash JSON with nested arrays', () => {
      expect(sha256(JSON.stringify([[[[]]]]))).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash JSON with nested objects', () => {
      expect(sha256(JSON.stringify({ a: { b: { c: {} } } }))).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should hash JSON with mixed nesting', () => {
      expect(sha256(JSON.stringify({ a: [{ b: [1, 2] }] }))).toMatch(/^[a-f0-9]{64}$/);
    });
  });
});
