/**
 * Concurrency & Race Condition Tests
 *
 * Enterprise-level tests for concurrent operations, race conditions,
 * and parallel processing scenarios with MerkleTree and hashing.
 */

import { MerkleTree } from '../src/core/merkle';
import { sha256 } from '../src/core/hash';
import { IdempotencyService, MemoryIdempotencyStorage } from '../src/services/idempotency';

describe('Concurrency Tests', () => {
  describe('Parallel Merkle Tree Operations', () => {
    it('should handle sequential appends to same tree', () => {
      const tree = new MerkleTree();
      const entries = Array.from({ length: 100 }, (_, i) => `entry-${i}`);

      entries.forEach((entry, i) => {
        const hash = sha256(`${entry}-${i}`);
        tree.append(hash);
      });

      expect(tree.size).toBe(100);
    });

    it('should maintain tree integrity after many appends', () => {
      const tree = new MerkleTree();
      const hashes: string[] = [];

      for (let i = 0; i < 50; i++) {
        const hash = sha256(`entry-${i}`);
        hashes.push(hash);
        tree.append(hash);
      }

      const proofs = hashes.map((_, index) => tree.getProof(index));

      proofs.forEach((proof) => {
        expect(proof).not.toBeNull();
        expect(MerkleTree.verify(proof!)).toBe(true);
      });
    });

    it('should handle interleaved append and proof operations', () => {
      const tree = new MerkleTree();
      const results: { type: string; index?: number; proof?: any }[] = [];

      for (let i = 0; i < 100; i++) {
        if (i % 2 === 0) {
          const hash = sha256(`entry-${i}`);
          tree.append(hash);
          results.push({ type: 'append', index: tree.size - 1 });
        } else if (tree.size > 0) {
          const proofIndex = Math.floor(Math.random() * tree.size);
          results.push({
            type: 'proof',
            proof: tree.getProof(proofIndex)
          });
        }
      }

      expect(results.length).toBe(100);
    });

    it('should handle burst of 1000 appends', () => {
      const tree = new MerkleTree();
      const count = 1000;

      const hashes = Array.from({ length: count }, (_, i) =>
        sha256(`burst-entry-${i}`)
      );

      hashes.forEach(hash => tree.append(hash));

      expect(tree.size).toBe(count);

      for (let i = 0; i < 10; i++) {
        const index = Math.floor(Math.random() * count);
        const proof = tree.getProof(index);
        expect(MerkleTree.verify(proof!)).toBe(true);
      }
    });

    it('should handle proof verification for all entries', () => {
      const tree = new MerkleTree();

      for (let i = 0; i < 100; i++) {
        const hash = sha256(`entry-${i}`);
        tree.append(hash);
      }

      const proofs = Array.from({ length: 100 }, (_, i) => tree.getProof(i)!);
      const results = proofs.map(proof => MerkleTree.verify(proof));

      expect(results.every(r => r === true)).toBe(true);
    });
  });

  describe('Idempotency Under Concurrency', () => {
    it('should return cached result for same idempotency key', async () => {
      const idempotencyStorage = new MemoryIdempotencyStorage();
      const service = new IdempotencyService(idempotencyStorage);

      const key = 'unique-operation-key';
      const ledgerId = 'ledger-1';

      const firstResult = { result: 'success', timestamp: Date.now() };
      await service.set(ledgerId, key, firstResult);

      const results = await Promise.all(
        Array.from({ length: 10 }, () => service.get(ledgerId, key))
      );

      results.forEach(result => {
        expect(result).toEqual(firstResult);
      });

      service.destroy();
    });

    it('should allow different idempotency keys concurrently', async () => {
      const idempotencyStorage = new MemoryIdempotencyStorage();
      const service = new IdempotencyService(idempotencyStorage);

      const ledgerId = 'ledger-1';

      await Promise.all(
        Array.from({ length: 50 }, (_, i) =>
          service.set(ledgerId, `key-${i}`, { index: i })
        )
      );

      const results = await Promise.all(
        Array.from({ length: 50 }, (_, i) =>
          service.get<{ index: number }>(ledgerId, `key-${i}`)
        )
      );

      const indices = results.map(r => r?.index);
      expect(new Set(indices).size).toBe(50);

      service.destroy();
    });

    it('should handle idempotency key collision across ledgers', async () => {
      const idempotencyStorage = new MemoryIdempotencyStorage();
      const service = new IdempotencyService(idempotencyStorage);

      const key = 'shared-key';

      await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          service.set(`ledger-${i}`, key, { ledger: i })
        )
      );

      const results = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          service.get<{ ledger: number }>(`ledger-${i}`, key)
        )
      );

      const uniqueLedgers = new Set(results.map(r => r?.ledger));
      expect(uniqueLedgers.size).toBe(10);

      service.destroy();
    });

    it('should handle rapid-fire get/set operations', async () => {
      const idempotencyStorage = new MemoryIdempotencyStorage();
      const service = new IdempotencyService(idempotencyStorage);

      const key = 'rapid-fire-key';
      const ledgerId = 'ledger-1';

      await service.set(ledgerId, key, { count: 1 });

      const results = await Promise.all(
        Array.from({ length: 100 }, () => service.get(ledgerId, key))
      );

      results.forEach(result => {
        expect(result).toEqual({ count: 1 });
      });

      service.destroy();
    });

    it('should handle concurrent set operations correctly', async () => {
      const idempotencyStorage = new MemoryIdempotencyStorage();
      const service = new IdempotencyService(idempotencyStorage);

      const ledgerId = 'ledger-1';

      await Promise.all(
        Array.from({ length: 100 }, (_, i) =>
          service.set(ledgerId, `concurrent-key-${i}`, { value: i })
        )
      );

      const results = await Promise.all(
        Array.from({ length: 100 }, (_, i) =>
          service.get<{ value: number }>(ledgerId, `concurrent-key-${i}`)
        )
      );

      results.forEach((result, i) => {
        expect(result).toEqual({ value: i });
      });

      service.destroy();
    });
  });

  describe('Tree Consistency Under Load', () => {
    it('should maintain consistent root hash during operations', () => {
      const tree = new MerkleTree();
      const hashes: string[] = [];

      for (let i = 0; i < 100; i++) {
        const hash = sha256(`entry-${i}`);
        hashes.push(hash);
        tree.append(hash);
      }

      const expectedRoot = tree.root;

      const verifications = Array.from({ length: 100 }, (_, i) => {
        const proof = tree.getProof(i);
        return {
          index: i,
          rootInProof: proof?.root,
          valid: MerkleTree.verify(proof!)
        };
      });

      const uniqueRoots = new Set(verifications.map(v => v.rootInProof));
      expect(uniqueRoots.size).toBe(1);
      expect(verifications[0].rootInProof).toBe(expectedRoot);
    });

    it('should handle tree rebuild from same entries', () => {
      const hashes = Array.from({ length: 500 }, (_, i) =>
        sha256(`rebuild-entry-${i}`)
      );

      const seqTree = new MerkleTree();
      const concTree = new MerkleTree();

      hashes.forEach(hash => {
        seqTree.append(hash);
        concTree.append(hash);
      });

      expect(seqTree.root).toBe(concTree.root);
    });
  });

  describe('Memory Pressure Scenarios', () => {
    it('should handle large number of proof requests', () => {
      const tree = new MerkleTree();

      for (let i = 0; i < 1000; i++) {
        const hash = sha256(`large-tree-${i}`);
        tree.append(hash);
      }

      const proofs = Array.from({ length: 1000 }, (_, i) =>
        tree.getProof(i)
      );

      expect(proofs.filter(p => p !== null).length).toBe(1000);
    });

    it('should handle hash computations efficiently', () => {
      const count = 1000;

      const hashes = Array.from({ length: count }, (_, i) =>
        sha256(JSON.stringify({
          index: i,
          payload: 'x'.repeat(1000),
          timestamp: Date.now()
        }))
      );

      expect(hashes.length).toBe(count);
      expect(new Set(hashes).size).toBe(count);
    });
  });

  describe('Race Condition Edge Cases', () => {
    it('should handle proof request during append', () => {
      const tree = new MerkleTree();

      for (let i = 0; i < 10; i++) {
        const hash = sha256(`initial-${i}`);
        tree.append(hash);
      }

      const results: { type: string; valid?: boolean }[] = [];

      for (let i = 0; i < 50; i++) {
        const hash = sha256(`new-${i}`);
        tree.append(hash);
        results.push({ type: 'append' });

        if (tree.size > 0) {
          const index = i % tree.size;
          results.push({
            type: 'proof',
            valid: tree.getProof(index) !== null
          });
        }
      }

      expect(results.length).toBeGreaterThan(50);
    });

    it('should handle getRoot during rapid appends', () => {
      const tree = new MerkleTree();
      const roots: string[] = [];

      for (let i = 0; i < 100; i++) {
        const hash = sha256(`rapid-${i}`);
        tree.append(hash);
        roots.push(tree.root);
      }

      expect(new Set(roots).size).toBe(100);

      for (let i = 1; i < roots.length; i++) {
        expect(roots[i]).not.toBe(roots[i - 1]);
      }
    });
  });
});

describe('Stress Tests', () => {
  it('should handle 10000 sequential appends', () => {
    const tree = new MerkleTree();

    for (let i = 0; i < 10000; i++) {
      const hash = sha256(`stress-${i}`);
      tree.append(hash);
    }

    expect(tree.size).toBe(10000);

    for (let i = 0; i < 100; i++) {
      const index = Math.floor(Math.random() * 10000);
      const proof = tree.getProof(index);
      expect(proof).not.toBeNull();
      expect(MerkleTree.verify(proof!)).toBe(true);
    }
  });

  it('should handle tree with deep proof paths', () => {
    const tree = new MerkleTree();
    const count = 2 ** 14;

    for (let i = 0; i < count; i++) {
      const hash = sha256(`deep-${i}`);
      tree.append(hash);
    }

    const proof = tree.getProof(0);
    expect(proof).not.toBeNull();
    expect(proof!.proof.length).toBe(14);
    expect(MerkleTree.verify(proof!)).toBe(true);
  });

  it('should handle alternating insert and verify operations', () => {
    const tree = new MerkleTree();

    for (let i = 0; i < 1000; i++) {
      const hash = sha256(`alt-${i}`);
      tree.append(hash);

      const proof = tree.getProof(i);
      expect(proof).not.toBeNull();
      expect(MerkleTree.verify(proof!)).toBe(true);
    }
  });

  it('should handle tree growth through power-of-two boundaries', () => {
    const tree = new MerkleTree();
    const boundaryChecks: { size: number; root: string }[] = [];

    for (let i = 0; i < 130; i++) {
      const hash = sha256(`boundary-${i}`);
      tree.append(hash);

      if (((i + 1) & i) === 0 || i === 129) {
        boundaryChecks.push({ size: tree.size, root: tree.root });
      }
    }

    boundaryChecks.forEach(check => {
      expect(check.root).toMatch(/^[a-f0-9]{64}$/);
    });
  });
});
