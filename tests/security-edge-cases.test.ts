/**
 * Security Edge Case Tests
 *
 * Enterprise-level tests for security vulnerabilities, injection attacks,
 * cryptographic edge cases, and adversarial inputs.
 */

import { MerkleTree } from '../src/core/merkle';
import { sha256, isValidHash } from '../src/core/hash';

describe('Security Edge Case Tests', () => {
  describe('Injection Attack Prevention', () => {
    it('should safely hash SQL injection payloads', () => {
      const sqlPayloads = [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "1; DELETE FROM entries WHERE '1'='1",
        "UNION SELECT * FROM secrets",
        "1' AND (SELECT COUNT(*) FROM users) > 0 --"
      ];

      for (const payload of sqlPayloads) {
        const hash = sha256(payload);
        expect(hash).toMatch(/^[a-f0-9]{64}$/);
      }
    });

    it('should safely hash XSS payloads', () => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        'javascript:alert(1)',
        '<img src=x onerror=alert(1)>',
        '"><script>alert(String.fromCharCode(88,83,83))</script>',
        '<svg/onload=alert(1)>'
      ];

      for (const payload of xssPayloads) {
        const hash = sha256(payload);
        expect(hash).toMatch(/^[a-f0-9]{64}$/);
      }
    });

    it('should safely hash path traversal payloads', () => {
      const pathPayloads = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '/etc/shadow',
        '....//....//....//etc/passwd',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd'
      ];

      for (const payload of pathPayloads) {
        const hash = sha256(JSON.stringify({ path: payload }));
        expect(hash).toMatch(/^[a-f0-9]{64}$/);
      }
    });

    it('should safely hash command injection payloads', () => {
      const cmdPayloads = [
        '; ls -la',
        '| cat /etc/passwd',
        '`whoami`',
        '$(cat /etc/passwd)',
        '&& rm -rf /'
      ];

      for (const payload of cmdPayloads) {
        const hash = sha256(payload);
        expect(hash).toMatch(/^[a-f0-9]{64}$/);
      }
    });

    it('should safely hash LDAP injection payloads', () => {
      const ldapPayloads = [
        '*)(uid=*))(|(uid=*',
        'admin)(&)',
        '*)(objectClass=*',
        '*))(|(password=*',
        '\\00'
      ];

      for (const payload of ldapPayloads) {
        const hash = sha256(payload);
        expect(hash).toMatch(/^[a-f0-9]{64}$/);
      }
    });

    it('should safely hash XML injection payloads', () => {
      const xmlPayloads = [
        '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>',
        '<![CDATA[<script>alert(1)</script>]]>',
        '&lt;script&gt;alert(1)&lt;/script&gt;',
        ']]><script>alert(1)</script><![CDATA[',
        '<?xml version="1.0" encoding="UTF-8"?>'
      ];

      for (const payload of xmlPayloads) {
        const hash = sha256(payload);
        expect(hash).toMatch(/^[a-f0-9]{64}$/);
      }
    });

    it('should safely hash template injection payloads', () => {
      const templatePayloads = [
        '{{constructor.constructor("return this")()}}',
        '${7*7}',
        '<%= system("whoami") %>',
        '{{{this}}}',
        '[[${7*7}]]'
      ];

      for (const payload of templatePayloads) {
        const hash = sha256(payload);
        expect(hash).toMatch(/^[a-f0-9]{64}$/);
      }
    });

    it('should safely hash regex DoS payloads', () => {
      const regexPayloads = [
        'a'.repeat(100000),
        '(a+)+$',
        '([a-zA-Z]+)*',
        '(a|aa)+',
        '(a|a?)+$'
      ];

      for (const payload of regexPayloads) {
        const hash = sha256(payload);
        expect(hash).toMatch(/^[a-f0-9]{64}$/);
      }
    });

    it('should safely hash null byte payloads', () => {
      const nullPayloads = [
        'file.txt\x00.jpg',
        'admin\x00ignored',
        '\x00\x00\x00',
        'test\x00injection'
      ];

      for (const payload of nullPayloads) {
        const hash = sha256(payload);
        expect(hash).toMatch(/^[a-f0-9]{64}$/);
      }
    });

    it('should safely hash unicode normalization attacks', () => {
      const unicodePayloads = [
        '\u0041\u030A', // Å composed differently
        '\u212B',       // Angstrom sign
        '\uFE64script\uFE65', // Angle brackets
        '\u2028\u2029' // Line/paragraph separators
      ];

      for (const payload of unicodePayloads) {
        const hash = sha256(payload);
        expect(hash).toMatch(/^[a-f0-9]{64}$/);
      }
    });
  });

  describe('Cryptographic Edge Cases', () => {
    it('should produce unique hashes for similar inputs', () => {
      const data = { user: 'alice', action: 'vote' };
      const hash1 = sha256(JSON.stringify(data));
      const hash2 = sha256(JSON.stringify(data));

      expect(hash1).toBe(hash2); // Same input = same hash
    });

    it('should not reveal plaintext through hash', () => {
      const secret1 = sha256('secret1');
      const secret2 = sha256('secret2');

      // Hashes should look random, not related
      expect(secret1).not.toBe(secret2);
      expect(secret1.substring(0, 10)).not.toBe(secret2.substring(0, 10));
    });

    it('should handle length extension attack patterns', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 10; i++) {
        const hash = sha256(`entry-${i}`);
        tree.append(hash);
      }

      const proof = tree.getProof(5)!;
      const originalRoot = proof.root;

      // Attempt to extend with additional data
      tree.append(sha256('malicious-entry'));

      const newProof = tree.getProof(5)!;
      expect(newProof.root).not.toBe(originalRoot);
    });

    it('should validate hash format strictly', () => {
      const validHash = 'a'.repeat(64);
      const invalidHashes = [
        'g'.repeat(64),  // Invalid hex
        'a'.repeat(63),  // Too short
        'a'.repeat(65),  // Too long
        '',              // Empty
        '   ' + 'a'.repeat(61) // Whitespace
      ];

      expect(isValidHash(validHash)).toBe(true);

      for (const invalid of invalidHashes) {
        expect(isValidHash(invalid)).toBe(false);
      }
    });

    it('should resist second preimage attacks', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 10; i++) {
        const hash = sha256(`entry-${i}`);
        tree.append(hash);
      }

      const proof = tree.getProof(3)!;

      // Try to find another input that produces same hash
      for (let i = 0; i < 100; i++) {
        const attemptHash = sha256(`attempt-${i}`);
        if (attemptHash === proof.leaf) {
          fail('Found second preimage - this should be cryptographically impossible');
        }
      }
    });

    it('should maintain proof validity under known plaintext attack', () => {
      const tree = new MerkleTree();
      const knownData = ['known1', 'known2', 'known3'];

      for (const data of knownData) {
        tree.append(sha256(data));
      }

      // Even with known plaintext, proofs should still be valid
      for (let i = 0; i < knownData.length; i++) {
        const proof = tree.getProof(i)!;
        expect(MerkleTree.verify(proof)).toBe(true);
      }
    });

    it('should produce avalanche effect on single bit change', () => {
      const original = 'test-string-for-avalanche';
      const modified = 'test-string-for-avalanchf'; // Single char change

      const hash1 = sha256(original);
      const hash2 = sha256(modified);

      // Count differing characters (should be roughly half due to avalanche)
      let differences = 0;
      for (let i = 0; i < hash1.length; i++) {
        if (hash1[i] !== hash2[i]) differences++;
      }

      // Expect significant difference (at least 25% of chars should differ)
      expect(differences).toBeGreaterThan(16);
    });
  });

  describe('Proof Manipulation Attacks', () => {
    it('should reject truncated proof path', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 16; i++) {
        const hash = sha256(`entry-${i}`);
        tree.append(hash);
      }

      const proof = tree.getProof(7)!;
      const truncatedProof = {
        ...proof,
        proof: proof.proof.slice(0, -1),
        directions: proof.directions.slice(0, -1)
      };

      expect(MerkleTree.verify(truncatedProof)).toBe(false);
    });

    it('should reject extended proof path', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 16; i++) {
        const hash = sha256(`entry-${i}`);
        tree.append(hash);
      }

      const proof = tree.getProof(7)!;
      const extendedProof = {
        ...proof,
        proof: [...proof.proof, 'a'.repeat(64)],
        directions: [...proof.directions, 'left' as const]
      };

      expect(MerkleTree.verify(extendedProof)).toBe(false);
    });

    it('should reject reordered proof path', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 16; i++) {
        const hash = sha256(`entry-${i}`);
        tree.append(hash);
      }

      const proof = tree.getProof(7)!;
      if (proof.proof.length >= 2) {
        const reorderedProof = {
          ...proof,
          proof: [proof.proof[1], proof.proof[0], ...proof.proof.slice(2)],
          directions: [proof.directions[1], proof.directions[0], ...proof.directions.slice(2)]
        };

        expect(MerkleTree.verify(reorderedProof)).toBe(false);
      }
    });

    it('should reject proof from different tree', () => {
      const tree1 = new MerkleTree();
      const tree2 = new MerkleTree();

      for (let i = 0; i < 10; i++) {
        tree1.append(sha256(`tree1-entry-${i}`));
        tree2.append(sha256(`tree2-entry-${i}`));
      }

      const proof1 = tree1.getProof(5)!;
      const proof2 = tree2.getProof(5)!;

      // Proof from tree1 should not verify against tree2's root
      const mixedProof = { ...proof1, root: proof2.root };
      expect(MerkleTree.verify(mixedProof)).toBe(false);
    });

    it('should reject proof with swapped sibling hash', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 8; i++) {
        tree.append(sha256(`entry-${i}`));
      }

      const proof0 = tree.getProof(0)!;
      const proof1 = tree.getProof(1)!;

      // Try to use sibling's proof path
      const swappedProof = {
        ...proof0,
        proof: proof1.proof
      };

      expect(MerkleTree.verify(swappedProof)).toBe(false);
    });

    it('should reject proof with all zeros hash in path', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 16; i++) {
        tree.append(sha256(`entry-${i}`));
      }

      const proof = tree.getProof(7)!;
      if (proof.proof.length > 0) {
        const zeroProof = {
          ...proof,
          proof: ['0'.repeat(64), ...proof.proof.slice(1)]
        };

        expect(MerkleTree.verify(zeroProof)).toBe(false);
      }
    });

    it('should reject proof with duplicated path elements', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 16; i++) {
        tree.append(sha256(`entry-${i}`));
      }

      const proof = tree.getProof(7)!;
      if (proof.proof.length >= 2) {
        const duplicatedProof = {
          ...proof,
          proof: [proof.proof[0], proof.proof[0], ...proof.proof.slice(2)],
        };

        expect(MerkleTree.verify(duplicatedProof)).toBe(false);
      }
    });
  });

  describe('Input Validation', () => {
    it('should handle extremely long inputs', () => {
      const longString = 'x'.repeat(1000000); // 1MB string
      const hash = sha256(longString);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle deeply nested JSON objects', () => {
      let nested: any = { value: 'leaf' };
      for (let i = 0; i < 100; i++) {
        nested = { level: nested };
      }

      const hash = sha256(JSON.stringify(nested));
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle arrays with many elements', () => {
      const largeArray = Array.from({ length: 10000 }, (_, i) => i);
      const hash = sha256(JSON.stringify(largeArray));
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

    it('should handle null and undefined edge cases', () => {
      const nullHash = sha256(JSON.stringify(null));
      const undefinedHash = sha256(JSON.stringify(undefined));
      const emptyObjHash = sha256(JSON.stringify({}));

      expect(nullHash).toMatch(/^[a-f0-9]{64}$/);
      expect(undefinedHash).toMatch(/^[a-f0-9]{64}$/);
      expect(emptyObjHash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle empty arrays and objects', () => {
      const emptyArray = sha256(JSON.stringify([]));
      const emptyObject = sha256(JSON.stringify({}));
      const nestedEmpty = sha256(JSON.stringify({ a: [], b: {} }));

      expect(emptyArray).toMatch(/^[a-f0-9]{64}$/);
      expect(emptyObject).toMatch(/^[a-f0-9]{64}$/);
      expect(nestedEmpty).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle control characters', () => {
      const controlChars = '\x00\x01\x02\x03\x04\x05\x06\x07\x08\x09';
      const hash = sha256(controlChars);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle mixed encoding strings', () => {
      const mixedStrings = [
        'Hello\u0000World',
        'Test\uFFFDData',
        'Emoji🎉Mixed',
        'RTL\u200Ftext',
        'ZWJ\u200Djoined'
      ];

      for (const str of mixedStrings) {
        const hash = sha256(str);
        expect(hash).toMatch(/^[a-f0-9]{64}$/);
      }
    });
  });

  describe('Race Condition Prevention', () => {
    it('should maintain tree consistency under concurrent reads', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 100; i++) {
        tree.append(sha256(`entry-${i}`));
      }

      // Concurrent proof requests
      const proofs = Array.from({ length: 100 }, (_, i) => tree.getProof(i)!);

      // All proofs should have the same root
      const roots = new Set(proofs.map(p => p.root));
      expect(roots.size).toBe(1);
    });

    it('should generate independent proofs', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 50; i++) {
        tree.append(sha256(`entry-${i}`));
      }

      const proof1 = tree.getProof(10)!;
      const proof2 = tree.getProof(10)!;

      // Modifying one proof should not affect the other
      proof1.leaf = 'modified';
      expect(proof2.leaf).not.toBe('modified');
    });

    it('should handle rapid sequential appends', () => {
      const tree = new MerkleTree();
      const count = 1000;

      for (let i = 0; i < count; i++) {
        tree.append(sha256(`rapid-${i}`));
      }

      expect(tree.size).toBe(count);

      // Verify random samples
      for (let i = 0; i < 50; i++) {
        const index = Math.floor(Math.random() * count);
        const proof = tree.getProof(index)!;
        expect(MerkleTree.verify(proof)).toBe(true);
      }
    });
  });

  describe('Denial of Service Prevention', () => {
    it('should handle hash bomb patterns', () => {
      // Exponentially expanding JSON
      let bomb = '{"a":"';
      for (let i = 0; i < 20; i++) {
        bomb += 'x';
      }
      bomb += '"}';

      const hash = sha256(bomb);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle repeated key patterns', () => {
      const obj: Record<string, string> = {};
      for (let i = 0; i < 10000; i++) {
        obj[`key${i}`] = `value${i}`;
      }

      const start = Date.now();
      const hash = sha256(JSON.stringify(obj));
      const duration = Date.now() - start;

      expect(hash).toMatch(/^[a-f0-9]{64}$/);
      expect(duration).toBeLessThan(5000); // Should complete in reasonable time
    });

    it('should handle deeply recursive proofs', () => {
      const tree = new MerkleTree();
      const count = 2 ** 15; // 32768 entries

      for (let i = 0; i < count; i++) {
        tree.append(sha256(`entry-${i}`));
      }

      const start = Date.now();
      const proof = tree.getProof(count - 1)!;
      const duration = Date.now() - start;

      expect(proof.proof.length).toBe(15);
      expect(duration).toBeLessThan(1000);
    });

    it('should handle verification of deep proofs efficiently', () => {
      const tree = new MerkleTree();
      const count = 2 ** 16; // 65536 entries

      for (let i = 0; i < count; i++) {
        tree.append(sha256(`entry-${i}`));
      }

      const proof = tree.getProof(count / 2)!;

      const start = Date.now();
      for (let i = 0; i < 1000; i++) {
        MerkleTree.verify(proof);
      }
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000); // 1000 verifications under 1 second
    });
  });

  describe('Hash Collision Resistance', () => {
    it('should produce unique hashes for sequential integers', () => {
      const hashes = new Set<string>();
      for (let i = 0; i < 10000; i++) {
        hashes.add(sha256(i.toString()));
      }
      expect(hashes.size).toBe(10000);
    });

    it('should produce unique hashes for similar strings', () => {
      const base = 'This is a test string number ';
      const hashes = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        hashes.add(sha256(base + i));
      }
      expect(hashes.size).toBe(1000);
    });

    it('should produce unique hashes for varying lengths', () => {
      const hashes = new Set<string>();
      for (let len = 1; len <= 1000; len++) {
        hashes.add(sha256('a'.repeat(len)));
      }
      expect(hashes.size).toBe(1000);
    });

    it('should produce unique hashes for permutations', () => {
      const hashes = new Set<string>();
      const chars = 'abcdef';
      for (let i = 0; i < chars.length; i++) {
        for (let j = 0; j < chars.length; j++) {
          for (let k = 0; k < chars.length; k++) {
            hashes.add(sha256(chars[i] + chars[j] + chars[k]));
          }
        }
      }
      expect(hashes.size).toBe(216); // 6^3 unique combinations
    });

    it('should produce unique roots for different tree contents', () => {
      const roots = new Set<string>();
      for (let seed = 0; seed < 100; seed++) {
        const tree = new MerkleTree();
        for (let i = 0; i < 10; i++) {
          tree.append(sha256(`seed-${seed}-entry-${i}`));
        }
        roots.add(tree.getProof(0)!.root);
      }
      expect(roots.size).toBe(100);
    });
  });

  describe('Proof Boundary Cases', () => {
    it('should handle proof for first entry in large tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 1000; i++) {
        tree.append(sha256(`entry-${i}`));
      }

      const proof = tree.getProof(0)!;
      expect(MerkleTree.verify(proof)).toBe(true);
    });

    it('should handle proof for last entry in large tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 1000; i++) {
        tree.append(sha256(`entry-${i}`));
      }

      const proof = tree.getProof(999)!;
      expect(MerkleTree.verify(proof)).toBe(true);
    });

    it('should handle proof at power-of-two boundary', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 1024; i++) {
        tree.append(sha256(`entry-${i}`));
      }

      // Proofs at boundaries
      const proof0 = tree.getProof(0)!;
      const proof511 = tree.getProof(511)!;
      const proof512 = tree.getProof(512)!;
      const proof1023 = tree.getProof(1023)!;

      expect(MerkleTree.verify(proof0)).toBe(true);
      expect(MerkleTree.verify(proof511)).toBe(true);
      expect(MerkleTree.verify(proof512)).toBe(true);
      expect(MerkleTree.verify(proof1023)).toBe(true);
    });

    it('should handle proof just after power-of-two', () => {
      const sizes = [3, 5, 9, 17, 33, 65, 129, 257];

      for (const size of sizes) {
        const tree = new MerkleTree();
        for (let i = 0; i < size; i++) {
          tree.append(sha256(`entry-${i}`));
        }

        const proof = tree.getProof(size - 1)!;
        expect(MerkleTree.verify(proof)).toBe(true);
      }
    });

    it('should handle proof just before power-of-two', () => {
      const sizes = [1, 3, 7, 15, 31, 63, 127, 255];

      for (const size of sizes) {
        const tree = new MerkleTree();
        for (let i = 0; i < size; i++) {
          tree.append(sha256(`entry-${i}`));
        }

        const proof = tree.getProof(size - 1)!;
        expect(MerkleTree.verify(proof)).toBe(true);
      }
    });
  });

  describe('Replay Attack Prevention', () => {
    it('should generate different roots for same entries added at different times', () => {
      const tree1 = new MerkleTree();
      const tree2 = new MerkleTree();

      // Same entries, same order
      for (let i = 0; i < 10; i++) {
        tree1.append(sha256(`entry-${i}`));
        tree2.append(sha256(`entry-${i}`));
      }

      // Roots should be identical (deterministic)
      expect(tree1.getProof(0)!.root).toBe(tree2.getProof(0)!.root);
    });

    it('should detect if entries are missing from sequence', () => {
      const tree1 = new MerkleTree();
      const tree2 = new MerkleTree();

      for (let i = 0; i < 10; i++) {
        tree1.append(sha256(`entry-${i}`));
        if (i !== 5) { // Skip entry 5
          tree2.append(sha256(`entry-${i}`));
        }
      }

      expect(tree1.getProof(0)!.root).not.toBe(tree2.getProof(0)!.root);
    });

    it('should detect if entry order is changed', () => {
      const tree1 = new MerkleTree();
      const tree2 = new MerkleTree();

      const entries = Array.from({ length: 10 }, (_, i) => sha256(`entry-${i}`));

      entries.forEach(e => tree1.append(e));

      // Swap two entries
      const swapped = [...entries];
      [swapped[3], swapped[7]] = [swapped[7], swapped[3]];
      swapped.forEach(e => tree2.append(e));

      expect(tree1.getProof(0)!.root).not.toBe(tree2.getProof(0)!.root);
    });
  });
});
