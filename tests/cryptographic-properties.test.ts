/**
 * Cryptographic Properties Tests
 *
 * Tests for cryptographic properties: collision resistance, avalanche effect, etc.
 */

import { MerkleTree } from '../src/core/merkle';
import { sha256 } from '../src/core/hash';

describe('Cryptographic Properties Tests', () => {
  describe('Collision Resistance', () => {
    it('should produce unique hashes for 100 sequential numbers', () => {
      const hashes = new Set<string>();
      for (let i = 0; i < 100; i++) hashes.add(sha256(i.toString()));
      expect(hashes.size).toBe(100);
    });

    it('should produce unique hashes for 500 sequential numbers', () => {
      const hashes = new Set<string>();
      for (let i = 0; i < 500; i++) hashes.add(sha256(i.toString()));
      expect(hashes.size).toBe(500);
    });

    it('should produce unique hashes for 1000 sequential numbers', () => {
      const hashes = new Set<string>();
      for (let i = 0; i < 1000; i++) hashes.add(sha256(i.toString()));
      expect(hashes.size).toBe(1000);
    });

    it('should produce unique hashes for 5000 sequential numbers', () => {
      const hashes = new Set<string>();
      for (let i = 0; i < 5000; i++) hashes.add(sha256(i.toString()));
      expect(hashes.size).toBe(5000);
    });

    it('should produce unique hashes for prefixed strings', () => {
      const hashes = new Set<string>();
      for (let i = 0; i < 1000; i++) hashes.add(sha256(`prefix-${i}`));
      expect(hashes.size).toBe(1000);
    });

    it('should produce unique hashes for suffixed strings', () => {
      const hashes = new Set<string>();
      for (let i = 0; i < 1000; i++) hashes.add(sha256(`${i}-suffix`));
      expect(hashes.size).toBe(1000);
    });

    it('should produce unique hashes for varying lengths', () => {
      const hashes = new Set<string>();
      for (let len = 1; len <= 500; len++) hashes.add(sha256('x'.repeat(len)));
      expect(hashes.size).toBe(500);
    });

    it('should produce unique hashes for alphabetic variations', () => {
      const hashes = new Set<string>();
      const chars = 'abcdefghijklmnopqrstuvwxyz';
      for (let i = 0; i < 26; i++) {
        for (let j = 0; j < 26; j++) {
          hashes.add(sha256(chars[i] + chars[j]));
        }
      }
      expect(hashes.size).toBe(676);
    });

    it('should produce unique tree roots for different seeds', () => {
      const roots = new Set<string>();
      for (let seed = 0; seed < 100; seed++) {
        const tree = new MerkleTree();
        for (let i = 0; i < 5; i++) tree.append(sha256(`seed${seed}-e${i}`));
        roots.add(tree.root);
      }
      expect(roots.size).toBe(100);
    });

    it('should produce unique tree roots during growth', () => {
      const tree = new MerkleTree();
      const roots = new Set<string>();
      for (let i = 0; i < 200; i++) {
        tree.append(sha256(`e${i}`));
        roots.add(tree.root);
      }
      expect(roots.size).toBe(200);
    });
  });

  describe('Avalanche Effect', () => {
    it('should show significant change for single char difference', () => {
      const h1 = sha256('hello');
      const h2 = sha256('hallo');
      let diffs = 0;
      for (let i = 0; i < 64; i++) if (h1[i] !== h2[i]) diffs++;
      expect(diffs).toBeGreaterThan(20);
    });

    it('should show significant change for appended char', () => {
      const h1 = sha256('test');
      const h2 = sha256('test1');
      let diffs = 0;
      for (let i = 0; i < 64; i++) if (h1[i] !== h2[i]) diffs++;
      expect(diffs).toBeGreaterThan(20);
    });

    it('should show significant change for case difference', () => {
      const h1 = sha256('Hello');
      const h2 = sha256('hello');
      let diffs = 0;
      for (let i = 0; i < 64; i++) if (h1[i] !== h2[i]) diffs++;
      expect(diffs).toBeGreaterThan(20);
    });

    it('should show significant change for sequential numbers', () => {
      const h1 = sha256('1');
      const h2 = sha256('2');
      let diffs = 0;
      for (let i = 0; i < 64; i++) if (h1[i] !== h2[i]) diffs++;
      expect(diffs).toBeGreaterThan(20);
    });

    it('should average ~50% different chars across many pairs', () => {
      let totalDiffs = 0;
      const pairs = 100;
      for (let i = 0; i < pairs; i++) {
        const h1 = sha256(`test-${i}-a`);
        const h2 = sha256(`test-${i}-b`);
        for (let j = 0; j < 64; j++) if (h1[j] !== h2[j]) totalDiffs++;
      }
      const avgDiffs = totalDiffs / pairs;
      expect(avgDiffs).toBeGreaterThan(25);
      expect(avgDiffs).toBeLessThan(45);
    });
  });

  describe('Determinism', () => {
    it('should produce same hash 100 times', () => {
      const first = sha256('deterministic');
      for (let i = 0; i < 100; i++) {
        expect(sha256('deterministic')).toBe(first);
      }
    });

    it('should produce same tree root 50 times', () => {
      const buildTree = () => {
        const t = new MerkleTree();
        for (let i = 0; i < 10; i++) t.append(sha256(`e${i}`));
        return t.root;
      };
      const first = buildTree();
      for (let i = 0; i < 50; i++) {
        expect(buildTree()).toBe(first);
      }
    });

    it('should produce same proof 50 times', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 10; i++) tree.append(sha256(`e${i}`));
      const first = JSON.stringify(tree.getProof(5));
      for (let i = 0; i < 50; i++) {
        expect(JSON.stringify(tree.getProof(5))).toBe(first);
      }
    });
  });

  describe('Preimage Resistance', () => {
    it('should not find matching input in 1000 tries', () => {
      const target = sha256('secret-target');
      for (let i = 0; i < 1000; i++) {
        expect(sha256(`attempt-${i}`)).not.toBe(target);
      }
    });

    it('should not find matching input with random strings', () => {
      const target = sha256('find-me');
      for (let i = 0; i < 1000; i++) {
        const random = Math.random().toString(36).substring(2);
        expect(sha256(random)).not.toBe(target);
      }
    });
  });

  describe('Second Preimage Resistance', () => {
    it('should not find collision for known inputs', () => {
      const inputs = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
      const hashes = inputs.map(i => sha256(i));
      expect(new Set(hashes).size).toBe(inputs.length);
    });

    it('should not find collision in tree leaves', () => {
      const tree = new MerkleTree();
      const hashes: string[] = [];
      for (let i = 0; i < 100; i++) {
        const h = sha256(`leaf-${i}`);
        hashes.push(h);
        tree.append(h);
      }
      expect(new Set(hashes).size).toBe(100);
    });
  });

  describe('Hash Distribution', () => {
    it('should have uniform first character distribution', () => {
      const counts: Record<string, number> = {};
      for (let i = 0; i < 1600; i++) {
        const hash = sha256(`input-${i}`);
        const first = hash[0];
        counts[first] = (counts[first] || 0) + 1;
      }
      const values = Object.values(counts);
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      values.forEach(v => {
        expect(v).toBeGreaterThan(avg * 0.3);
        expect(v).toBeLessThan(avg * 2);
      });
    });

    it('should have uniform last character distribution', () => {
      const counts: Record<string, number> = {};
      for (let i = 0; i < 1600; i++) {
        const hash = sha256(`input-${i}`);
        const last = hash[63];
        counts[last] = (counts[last] || 0) + 1;
      }
      const values = Object.values(counts);
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      values.forEach(v => {
        expect(v).toBeGreaterThan(avg * 0.3);
        expect(v).toBeLessThan(avg * 2);
      });
    });
  });

  describe('Proof Security', () => {
    it('should not verify forged proof', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 16; i++) tree.append(sha256(`e${i}`));
      const proof = tree.getProof(8)!;
      const forged = { ...proof, leaf: sha256('forged') };
      expect(MerkleTree.verify(forged)).toBe(false);
    });

    it('should not verify proof with modified path', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 16; i++) tree.append(sha256(`e${i}`));
      const proof = tree.getProof(8)!;
      const path = [...proof.proof];
      path[0] = sha256('modified');
      const forged = { ...proof, proof: path };
      expect(MerkleTree.verify(forged)).toBe(false);
    });

    it('should not verify proof with extra path element', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 16; i++) tree.append(sha256(`e${i}`));
      const proof = tree.getProof(8)!;
      const forged = {
        ...proof,
        proof: [...proof.proof, sha256('extra')],
        directions: [...proof.directions, 'left' as const]
      };
      expect(MerkleTree.verify(forged)).toBe(false);
    });

    it('should not verify proof with removed path element', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 16; i++) tree.append(sha256(`e${i}`));
      const proof = tree.getProof(8)!;
      const forged = {
        ...proof,
        proof: proof.proof.slice(1),
        directions: proof.directions.slice(1)
      };
      expect(MerkleTree.verify(forged)).toBe(false);
    });

    it('should not verify proof with swapped directions', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 16; i++) tree.append(sha256(`e${i}`));
      const proof = tree.getProof(8)!;
      const dirs = proof.directions.map(d => d === 'left' ? 'right' : 'left') as ('left' | 'right')[];
      const forged = { ...proof, directions: dirs };
      expect(MerkleTree.verify(forged)).toBe(false);
    });

    it('should not verify proof with wrong root', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 16; i++) tree.append(sha256(`e${i}`));
      const proof = tree.getProof(8)!;
      const forged = { ...proof, root: sha256('wrong-root') };
      expect(MerkleTree.verify(forged)).toBe(false);
    });
  });

  describe('Tree Integrity', () => {
    it('should detect any modified entry', () => {
      const tree1 = new MerkleTree();
      const tree2 = new MerkleTree();
      for (let i = 0; i < 100; i++) {
        tree1.append(sha256(`entry-${i}`));
        tree2.append(sha256(i === 50 ? 'modified-50' : `entry-${i}`));
      }
      expect(tree1.root).not.toBe(tree2.root);
    });

    it('should detect missing entry', () => {
      const tree1 = new MerkleTree();
      const tree2 = new MerkleTree();
      for (let i = 0; i < 100; i++) {
        tree1.append(sha256(`entry-${i}`));
        if (i !== 50) tree2.append(sha256(`entry-${i}`));
      }
      expect(tree1.root).not.toBe(tree2.root);
    });

    it('should detect extra entry', () => {
      const tree1 = new MerkleTree();
      const tree2 = new MerkleTree();
      for (let i = 0; i < 100; i++) {
        tree1.append(sha256(`entry-${i}`));
        tree2.append(sha256(`entry-${i}`));
      }
      tree2.append(sha256('extra'));
      expect(tree1.root).not.toBe(tree2.root);
    });

    it('should detect swapped entries', () => {
      const entries = [];
      for (let i = 0; i < 100; i++) entries.push(sha256(`entry-${i}`));

      const tree1 = new MerkleTree();
      entries.forEach(e => tree1.append(e));

      const swapped = [...entries];
      [swapped[10], swapped[90]] = [swapped[90], swapped[10]];
      const tree2 = new MerkleTree();
      swapped.forEach(e => tree2.append(e));

      expect(tree1.root).not.toBe(tree2.root);
    });
  });

  describe('Proof Path Length', () => {
    it('should have log2 path length for power of 2 sizes', () => {
      for (let power = 1; power <= 10; power++) {
        const size = 2 ** power;
        const tree = new MerkleTree();
        for (let i = 0; i < size; i++) tree.append(sha256(`e${i}`));
        expect(tree.getProof(0)!.proof.length).toBe(power);
      }
    });

    it('should have ceiling log2 path length for non-power sizes', () => {
      const sizes = [3, 5, 7, 9, 15, 17, 31, 33, 63, 65];
      for (const size of sizes) {
        const tree = new MerkleTree();
        for (let i = 0; i < size; i++) tree.append(sha256(`e${i}`));
        const expectedLen = Math.ceil(Math.log2(size + 1));
        const actualLen = tree.getProof(0)!.proof.length;
        expect(actualLen).toBeGreaterThanOrEqual(expectedLen - 1);
        expect(actualLen).toBeLessThanOrEqual(expectedLen + 1);
      }
    });
  });

  describe('Hash Format Consistency', () => {
    it('should always produce 64 char output', () => {
      for (let i = 0; i < 100; i++) {
        expect(sha256(`test-${i}`).length).toBe(64);
      }
    });

    it('should always produce lowercase hex', () => {
      for (let i = 0; i < 100; i++) {
        expect(sha256(`test-${i}`)).toMatch(/^[a-f0-9]{64}$/);
      }
    });

    it('should have valid format for tree root', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 50; i++) {
        tree.append(sha256(`e${i}`));
        expect(tree.root).toMatch(/^[a-f0-9]{64}$/);
      }
    });

    it('should have valid format for proof components', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 20; i++) tree.append(sha256(`e${i}`));
      for (let i = 0; i < 20; i++) {
        const proof = tree.getProof(i)!;
        expect(proof.leaf).toMatch(/^[a-f0-9]{64}$/);
        expect(proof.root).toMatch(/^[a-f0-9]{64}$/);
        proof.proof.forEach(p => expect(p).toMatch(/^[a-f0-9]{64}$/));
      }
    });
  });
});
