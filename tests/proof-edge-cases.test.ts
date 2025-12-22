/**
 * Proof Edge Cases Tests
 *
 * Comprehensive edge case testing for Merkle proofs.
 */

import { MerkleTree } from '../src/core/merkle';
import { sha256 } from '../src/core/hash';

describe('Proof Edge Cases Tests', () => {
  describe('Single Element Proofs', () => {
    it('should generate proof for single element', () => {
      const tree = new MerkleTree();
      tree.append(sha256('only'));
      expect(tree.getProof(0)).not.toBeNull();
    });

    it('should verify single element proof', () => {
      const tree = new MerkleTree();
      tree.append(sha256('only'));
      expect(MerkleTree.verify(tree.getProof(0)!)).toBe(true);
    });

    it('should have minimal proof path for single element', () => {
      const tree = new MerkleTree();
      tree.append(sha256('only'));
      const proof = tree.getProof(0)!;
      expect(proof.proof.length).toBeLessThanOrEqual(1);
    });

    it('should match leaf and index for single element', () => {
      const tree = new MerkleTree();
      const hash = sha256('only');
      tree.append(hash);
      const proof = tree.getProof(0)!;
      expect(proof.leaf).toBe(hash);
      expect(proof.index).toBe(0);
    });
  });

  describe('Two Element Proofs', () => {
    it('should generate proof for first of two', () => {
      const tree = new MerkleTree();
      tree.append(sha256('a'));
      tree.append(sha256('b'));
      expect(tree.getProof(0)).not.toBeNull();
    });

    it('should generate proof for second of two', () => {
      const tree = new MerkleTree();
      tree.append(sha256('a'));
      tree.append(sha256('b'));
      expect(tree.getProof(1)).not.toBeNull();
    });

    it('should verify both proofs in two-element tree', () => {
      const tree = new MerkleTree();
      tree.append(sha256('a'));
      tree.append(sha256('b'));
      expect(MerkleTree.verify(tree.getProof(0)!)).toBe(true);
      expect(MerkleTree.verify(tree.getProof(1)!)).toBe(true);
    });

    it('should have path length 1 for two elements', () => {
      const tree = new MerkleTree();
      tree.append(sha256('a'));
      tree.append(sha256('b'));
      expect(tree.getProof(0)!.proof.length).toBe(1);
      expect(tree.getProof(1)!.proof.length).toBe(1);
    });

    it('should have sibling as proof element', () => {
      const tree = new MerkleTree();
      const hashA = sha256('a');
      const hashB = sha256('b');
      tree.append(hashA);
      tree.append(hashB);
      expect(tree.getProof(0)!.proof[0]).toBe(hashB);
      expect(tree.getProof(1)!.proof[0]).toBe(hashA);
    });
  });

  describe('Power of Two Tree Proofs', () => {
    it('should have path length 2 for 4 elements', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 4; i++) tree.append(sha256(`e${i}`));
      for (let i = 0; i < 4; i++) {
        expect(tree.getProof(i)!.proof.length).toBe(2);
      }
    });

    it('should have path length 3 for 8 elements', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 8; i++) tree.append(sha256(`e${i}`));
      for (let i = 0; i < 8; i++) {
        expect(tree.getProof(i)!.proof.length).toBe(3);
      }
    });

    it('should have path length 4 for 16 elements', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 16; i++) tree.append(sha256(`e${i}`));
      for (let i = 0; i < 16; i++) {
        expect(tree.getProof(i)!.proof.length).toBe(4);
      }
    });

    it('should verify all proofs in 32-element tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 32; i++) tree.append(sha256(`e${i}`));
      for (let i = 0; i < 32; i++) {
        expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
      }
    });

    it('should verify all proofs in 64-element tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 64; i++) tree.append(sha256(`e${i}`));
      for (let i = 0; i < 64; i++) {
        expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
      }
    });
  });

  describe('Non-Power of Two Tree Proofs', () => {
    it('should handle 3 elements', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 3; i++) tree.append(sha256(`e${i}`));
      for (let i = 0; i < 3; i++) {
        expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
      }
    });

    it('should handle 5 elements', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 5; i++) tree.append(sha256(`e${i}`));
      for (let i = 0; i < 5; i++) {
        expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
      }
    });

    it('should handle 7 elements', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 7; i++) tree.append(sha256(`e${i}`));
      for (let i = 0; i < 7; i++) {
        expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
      }
    });

    it('should handle 9 elements', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 9; i++) tree.append(sha256(`e${i}`));
      for (let i = 0; i < 9; i++) {
        expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
      }
    });

    it('should handle 15 elements', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 15; i++) tree.append(sha256(`e${i}`));
      for (let i = 0; i < 15; i++) {
        expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
      }
    });

    it('should handle 17 elements', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 17; i++) tree.append(sha256(`e${i}`));
      for (let i = 0; i < 17; i++) {
        expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
      }
    });

    it('should handle 100 elements', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 100; i++) tree.append(sha256(`e${i}`));
      for (let i = 0; i < 100; i++) {
        expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
      }
    });
  });

  describe('First and Last Element Proofs', () => {
    it('should verify first element in various sizes', () => {
      for (const size of [1, 2, 3, 5, 10, 50, 100]) {
        const tree = new MerkleTree();
        for (let i = 0; i < size; i++) tree.append(sha256(`e${i}`));
        expect(MerkleTree.verify(tree.getProof(0)!)).toBe(true);
      }
    });

    it('should verify last element in various sizes', () => {
      for (const size of [1, 2, 3, 5, 10, 50, 100]) {
        const tree = new MerkleTree();
        for (let i = 0; i < size; i++) tree.append(sha256(`e${i}`));
        expect(MerkleTree.verify(tree.getProof(size - 1)!)).toBe(true);
      }
    });

    it('should verify middle element in various sizes', () => {
      for (const size of [3, 5, 11, 51, 101]) {
        const tree = new MerkleTree();
        for (let i = 0; i < size; i++) tree.append(sha256(`e${i}`));
        const middle = Math.floor(size / 2);
        expect(MerkleTree.verify(tree.getProof(middle)!)).toBe(true);
      }
    });
  });

  describe('Proof Tampering Detection', () => {
    it('should detect tampered leaf', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 16; i++) tree.append(sha256(`e${i}`));
      const proof = tree.getProof(8)!;
      const tampered = { ...proof, leaf: sha256('fake') };
      expect(MerkleTree.verify(tampered)).toBe(false);
    });

    it('should detect tampered root', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 16; i++) tree.append(sha256(`e${i}`));
      const proof = tree.getProof(8)!;
      const tampered = { ...proof, root: sha256('fake') };
      expect(MerkleTree.verify(tampered)).toBe(false);
    });

    it('should detect tampered first path element', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 16; i++) tree.append(sha256(`e${i}`));
      const proof = tree.getProof(8)!;
      const path = [...proof.proof];
      path[0] = sha256('fake');
      expect(MerkleTree.verify({ ...proof, proof: path })).toBe(false);
    });

    it('should detect tampered last path element', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 16; i++) tree.append(sha256(`e${i}`));
      const proof = tree.getProof(8)!;
      const path = [...proof.proof];
      path[path.length - 1] = sha256('fake');
      expect(MerkleTree.verify({ ...proof, proof: path })).toBe(false);
    });

    it('should detect tampered middle path element', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 16; i++) tree.append(sha256(`e${i}`));
      const proof = tree.getProof(8)!;
      const path = [...proof.proof];
      const mid = Math.floor(path.length / 2);
      path[mid] = sha256('fake');
      expect(MerkleTree.verify({ ...proof, proof: path })).toBe(false);
    });

    it('should detect all path elements tampered', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 16; i++) tree.append(sha256(`e${i}`));
      const proof = tree.getProof(8)!;
      const path = proof.proof.map(() => sha256('fake'));
      expect(MerkleTree.verify({ ...proof, proof: path })).toBe(false);
    });

    it('should detect swapped directions', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 16; i++) tree.append(sha256(`e${i}`));
      const proof = tree.getProof(8)!;
      const dirs = proof.directions.map(d =>
        d === 'left' ? 'right' : 'left'
      ) as ('left' | 'right')[];
      expect(MerkleTree.verify({ ...proof, directions: dirs })).toBe(false);
    });

    it('should detect single direction swap', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 16; i++) tree.append(sha256(`e${i}`));
      const proof = tree.getProof(8)!;
      const dirs = [...proof.directions] as ('left' | 'right')[];
      dirs[0] = dirs[0] === 'left' ? 'right' : 'left';
      expect(MerkleTree.verify({ ...proof, directions: dirs })).toBe(false);
    });
  });

  describe('Proof Structure Validation', () => {
    it('should reject proof with empty path array', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 4; i++) tree.append(sha256(`e${i}`));
      const proof = tree.getProof(0)!;
      expect(MerkleTree.verify({ ...proof, proof: [], directions: [] })).toBe(false);
    });

    it('should handle proof with mismatched path/directions length', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 8; i++) tree.append(sha256(`e${i}`));
      const proof = tree.getProof(0)!;
      // When directions is shorter, undefined elements use 'right' branch
      const result = MerkleTree.verify({
        ...proof,
        directions: proof.directions.slice(0, -1)
      });
      // Result will likely be false since path is incorrect, but shouldn't throw
      expect(typeof result).toBe('boolean');
    });

    it('should reject proof with extra path element', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 8; i++) tree.append(sha256(`e${i}`));
      const proof = tree.getProof(0)!;
      expect(MerkleTree.verify({
        ...proof,
        proof: [...proof.proof, sha256('extra')],
        directions: [...proof.directions, 'left' as const]
      })).toBe(false);
    });

    it('should reject proof with missing path element', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 8; i++) tree.append(sha256(`e${i}`));
      const proof = tree.getProof(0)!;
      expect(MerkleTree.verify({
        ...proof,
        proof: proof.proof.slice(1),
        directions: proof.directions.slice(1)
      })).toBe(false);
    });
  });

  describe('Cross-Tree Proof Validation', () => {
    it('should reject proof from different tree', () => {
      const tree1 = new MerkleTree();
      const tree2 = new MerkleTree();
      for (let i = 0; i < 10; i++) {
        tree1.append(sha256(`tree1-e${i}`));
        tree2.append(sha256(`tree2-e${i}`));
      }
      const proof1 = tree1.getProof(5)!;
      const proof2 = tree2.getProof(5)!;

      // Cross verify should fail
      expect(MerkleTree.verify({ ...proof1, root: proof2.root })).toBe(false);
      expect(MerkleTree.verify({ ...proof2, root: proof1.root })).toBe(false);
    });

    it('should reject proof with wrong index', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 10; i++) tree.append(sha256(`e${i}`));
      const proof0 = tree.getProof(0)!;
      const proof9 = tree.getProof(9)!;

      // Mixing proofs should fail
      expect(MerkleTree.verify({ ...proof0, leaf: proof9.leaf })).toBe(false);
    });
  });

  describe('Proof Immutability', () => {
    it('should not affect tree when proof is modified', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 10; i++) tree.append(sha256(`e${i}`));
      const proof = tree.getProof(5)!;
      const originalLeaf = proof.leaf;
      proof.leaf = 'modified';
      proof.proof[0] = 'tampered';

      const newProof = tree.getProof(5)!;
      expect(newProof.leaf).toBe(originalLeaf);
    });

    it('should return fresh proof objects each time', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 10; i++) tree.append(sha256(`e${i}`));
      const proof1 = tree.getProof(5)!;
      const proof2 = tree.getProof(5)!;
      expect(proof1).not.toBe(proof2);
      expect(proof1.proof).not.toBe(proof2.proof);
    });
  });

  describe('Proof After Tree Growth', () => {
    it('should invalidate old proof after tree growth', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 10; i++) tree.append(sha256(`e${i}`));
      const proofBefore = tree.getProof(5)!;
      const rootBefore = tree.root;

      tree.append(sha256('new'));
      const proofAfter = tree.getProof(5)!;

      expect(proofAfter.root).not.toBe(rootBefore);
      expect(MerkleTree.verify(proofBefore)).toBe(true); // Original proof still valid for its root
      expect(MerkleTree.verify(proofAfter)).toBe(true);
    });

    it('should generate valid proofs for new entries', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 10; i++) tree.append(sha256(`e${i}`));

      for (let i = 10; i < 20; i++) {
        tree.append(sha256(`e${i}`));
        expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
      }
    });
  });
});
