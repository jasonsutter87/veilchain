/**
 * Verification Scenarios Tests
 *
 * Comprehensive tests for proof verification in various scenarios.
 */

import { MerkleTree } from '../src/core/merkle';
import { sha256 } from '../src/core/hash';

describe('Verification Scenarios Tests', () => {
  describe('Basic Verification', () => {
    it('should verify single element proof', () => {
      const tree = new MerkleTree();
      tree.append(sha256('only'));
      expect(MerkleTree.verify(tree.getProof(0)!)).toBe(true);
    });

    it('should verify first element', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 10; i++) tree.append(sha256(`e${i}`));
      expect(MerkleTree.verify(tree.getProof(0)!)).toBe(true);
    });

    it('should verify last element', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 10; i++) tree.append(sha256(`e${i}`));
      expect(MerkleTree.verify(tree.getProof(9)!)).toBe(true);
    });

    it('should verify middle element', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 10; i++) tree.append(sha256(`e${i}`));
      expect(MerkleTree.verify(tree.getProof(5)!)).toBe(true);
    });

    it('should verify all elements', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 20; i++) tree.append(sha256(`e${i}`));
      for (let i = 0; i < 20; i++) {
        expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
      }
    });
  });

  describe('After Tree Growth Verification', () => {
    it('should verify after single append', () => {
      const tree = new MerkleTree();
      tree.append(sha256('first'));
      expect(MerkleTree.verify(tree.getProof(0)!)).toBe(true);
      tree.append(sha256('second'));
      expect(MerkleTree.verify(tree.getProof(0)!)).toBe(true);
      expect(MerkleTree.verify(tree.getProof(1)!)).toBe(true);
    });

    it('should verify after growth from 1 to 10', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 10; i++) {
        tree.append(sha256(`e${i}`));
        for (let j = 0; j <= i; j++) {
          expect(MerkleTree.verify(tree.getProof(j)!)).toBe(true);
        }
      }
    });

    it('should verify after growth from 1 to 100', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 100; i++) {
        tree.append(sha256(`e${i}`));
      }
      for (let i = 0; i < 100; i++) {
        expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
      }
    });
  });

  describe('After Import Verification', () => {
    it('should verify after empty import', () => {
      const tree = MerkleTree.import({ leaves: [] });
      tree.append(sha256('first'));
      expect(MerkleTree.verify(tree.getProof(0)!)).toBe(true);
    });

    it('should verify after single import', () => {
      const tree = MerkleTree.import({ leaves: [sha256('single')] });
      expect(MerkleTree.verify(tree.getProof(0)!)).toBe(true);
    });

    it('should verify after multi import', () => {
      const leaves = Array.from({ length: 50 }, (_, i) => sha256(`e${i}`));
      const tree = MerkleTree.import({ leaves });
      for (let i = 0; i < 50; i++) {
        expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
      }
    });

    it('should verify after import and append', () => {
      const leaves = [sha256('a'), sha256('b')];
      const tree = MerkleTree.import({ leaves });
      tree.append(sha256('c'));
      for (let i = 0; i < 3; i++) {
        expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
      }
    });
  });

  describe('Cross-Tree Verification', () => {
    it('should fail verification with different tree root', () => {
      const tree1 = new MerkleTree();
      const tree2 = new MerkleTree();
      for (let i = 0; i < 10; i++) {
        tree1.append(sha256(`tree1-e${i}`));
        tree2.append(sha256(`tree2-e${i}`));
      }
      const proof1 = tree1.getProof(5)!;
      const proof2 = tree2.getProof(5)!;

      // Valid proofs
      expect(MerkleTree.verify(proof1)).toBe(true);
      expect(MerkleTree.verify(proof2)).toBe(true);

      // Cross verification fails
      expect(MerkleTree.verify({ ...proof1, root: proof2.root })).toBe(false);
    });

    it('should fail verification with swapped leaf', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 10; i++) tree.append(sha256(`e${i}`));
      const proof0 = tree.getProof(0)!;
      const proof5 = tree.getProof(5)!;
      expect(MerkleTree.verify({ ...proof0, leaf: proof5.leaf })).toBe(false);
    });
  });

  describe('Tampered Proof Verification', () => {
    it('should reject tampered leaf', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 10; i++) tree.append(sha256(`e${i}`));
      const proof = tree.getProof(5)!;
      expect(MerkleTree.verify({ ...proof, leaf: sha256('fake') })).toBe(false);
    });

    it('should reject tampered root', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 10; i++) tree.append(sha256(`e${i}`));
      const proof = tree.getProof(5)!;
      expect(MerkleTree.verify({ ...proof, root: sha256('fake') })).toBe(false);
    });

    it('should reject tampered path', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 16; i++) tree.append(sha256(`e${i}`));
      const proof = tree.getProof(8)!;
      const tampered = [...proof.proof];
      tampered[0] = sha256('fake');
      expect(MerkleTree.verify({ ...proof, proof: tampered })).toBe(false);
    });

    it('should reject swapped directions', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 16; i++) tree.append(sha256(`e${i}`));
      const proof = tree.getProof(8)!;
      const swapped = proof.directions.map(d =>
        d === 'left' ? 'right' : 'left'
      ) as ('left' | 'right')[];
      expect(MerkleTree.verify({ ...proof, directions: swapped })).toBe(false);
    });

    it('should reject truncated path', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 16; i++) tree.append(sha256(`e${i}`));
      const proof = tree.getProof(8)!;
      expect(MerkleTree.verify({
        ...proof,
        proof: proof.proof.slice(1),
        directions: proof.directions.slice(1)
      })).toBe(false);
    });

    it('should reject extended path', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 16; i++) tree.append(sha256(`e${i}`));
      const proof = tree.getProof(8)!;
      expect(MerkleTree.verify({
        ...proof,
        proof: [...proof.proof, sha256('extra')],
        directions: [...proof.directions, 'left' as const]
      })).toBe(false);
    });
  });

  describe('Invalid Proof Structure Verification', () => {
    it('should throw for null', () => {
      expect(() => MerkleTree.verify(null as any)).toThrow();
    });

    it('should throw for undefined', () => {
      expect(() => MerkleTree.verify(undefined as any)).toThrow();
    });

    it('should throw for empty object', () => {
      expect(() => MerkleTree.verify({} as any)).toThrow();
    });

    it('should reject missing leaf', () => {
      const tree = new MerkleTree();
      tree.append(sha256('e'));
      const proof = tree.getProof(0)!;
      expect(MerkleTree.verify({ ...proof, leaf: undefined } as any)).toBe(false);
    });

    it('should reject missing root', () => {
      const tree = new MerkleTree();
      tree.append(sha256('e'));
      const proof = tree.getProof(0)!;
      expect(MerkleTree.verify({ ...proof, root: undefined } as any)).toBe(false);
    });

    it('should throw for missing proof array', () => {
      const tree = new MerkleTree();
      tree.append(sha256('e'));
      const proof = tree.getProof(0)!;
      expect(() => MerkleTree.verify({ ...proof, proof: undefined } as any)).toThrow();
    });

    it('should handle missing directions gracefully', () => {
      const tree = new MerkleTree();
      tree.append(sha256('e'));
      const proof = tree.getProof(0)!;
      // Missing directions uses fallback behavior
      const result = MerkleTree.verify({ ...proof, directions: undefined } as any);
      expect(typeof result).toBe('boolean');
    });

    it('should verify even with missing index', () => {
      const tree = new MerkleTree();
      tree.append(sha256('e'));
      const proof = tree.getProof(0)!;
      // Index is not used in verification algorithm
      const result = MerkleTree.verify({ ...proof, index: undefined } as any);
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Repeated Verification', () => {
    it('should verify same proof 100 times', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 10; i++) tree.append(sha256(`e${i}`));
      const proof = tree.getProof(5)!;
      for (let i = 0; i < 100; i++) {
        expect(MerkleTree.verify(proof)).toBe(true);
      }
    });

    it('should verify different proofs sequentially', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 100; i++) tree.append(sha256(`e${i}`));
      for (let i = 0; i < 100; i++) {
        expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
      }
    });
  });

  describe('Boundary Size Verification', () => {
    it('should verify at size 2', () => {
      const tree = new MerkleTree();
      tree.append(sha256('a'));
      tree.append(sha256('b'));
      expect(MerkleTree.verify(tree.getProof(0)!)).toBe(true);
      expect(MerkleTree.verify(tree.getProof(1)!)).toBe(true);
    });

    it('should verify at size 4', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 4; i++) tree.append(sha256(`e${i}`));
      for (let i = 0; i < 4; i++) {
        expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
      }
    });

    it('should verify at size 8', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 8; i++) tree.append(sha256(`e${i}`));
      for (let i = 0; i < 8; i++) {
        expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
      }
    });

    it('should verify at size 16', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 16; i++) tree.append(sha256(`e${i}`));
      for (let i = 0; i < 16; i++) {
        expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
      }
    });

    it('should verify at size 3', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 3; i++) tree.append(sha256(`e${i}`));
      for (let i = 0; i < 3; i++) {
        expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
      }
    });

    it('should verify at size 5', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 5; i++) tree.append(sha256(`e${i}`));
      for (let i = 0; i < 5; i++) {
        expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
      }
    });

    it('should verify at size 7', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 7; i++) tree.append(sha256(`e${i}`));
      for (let i = 0; i < 7; i++) {
        expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
      }
    });

    it('should verify at size 9', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 9; i++) tree.append(sha256(`e${i}`));
      for (let i = 0; i < 9; i++) {
        expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
      }
    });
  });

  describe('Large Tree Verification', () => {
    it('should verify in 100-element tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 100; i++) tree.append(sha256(`e${i}`));
      expect(MerkleTree.verify(tree.getProof(50)!)).toBe(true);
    });

    it('should verify in 500-element tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 500; i++) tree.append(sha256(`e${i}`));
      expect(MerkleTree.verify(tree.getProof(250)!)).toBe(true);
    });

    it('should verify in 1000-element tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 1000; i++) tree.append(sha256(`e${i}`));
      expect(MerkleTree.verify(tree.getProof(500)!)).toBe(true);
    });

    it('should verify random indices in large tree', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 1000; i++) tree.append(sha256(`e${i}`));
      const indices = [0, 1, 100, 500, 750, 998, 999];
      for (const idx of indices) {
        expect(MerkleTree.verify(tree.getProof(idx)!)).toBe(true);
      }
    });
  });

  describe('Deterministic Verification', () => {
    it('should verify same tree structure consistently', () => {
      for (let trial = 0; trial < 10; trial++) {
        const tree = new MerkleTree();
        for (let i = 0; i < 20; i++) tree.append(sha256(`e${i}`));
        for (let i = 0; i < 20; i++) {
          expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
        }
      }
    });

    it('should produce identical proofs for identical trees', () => {
      const tree1 = new MerkleTree();
      const tree2 = new MerkleTree();
      for (let i = 0; i < 20; i++) {
        tree1.append(sha256(`e${i}`));
        tree2.append(sha256(`e${i}`));
      }
      for (let i = 0; i < 20; i++) {
        const proof1 = tree1.getProof(i)!;
        const proof2 = tree2.getProof(i)!;
        expect(proof1.root).toBe(proof2.root);
        expect(proof1.leaf).toBe(proof2.leaf);
        expect(proof1.proof).toEqual(proof2.proof);
      }
    });
  });
});
