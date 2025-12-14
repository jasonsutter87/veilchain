/**
 * VeilChain Merkle Tree Implementation
 *
 * A sparse Merkle tree optimized for append-only ledger operations.
 * Provides O(log n) proof generation and verification.
 */

import { sha256, hashPair, EMPTY_HASH } from './hash.js';
import type { MerkleProof, MerkleNode } from '../types.js';

/**
 * Sparse Merkle Tree for append-only ledger
 *
 * Properties:
 * - Append-only: entries can only be added, never modified or removed
 * - Efficient proofs: O(log n) proof size
 * - Deterministic: same entries always produce same root
 */
export class MerkleTree {
  private leaves: string[] = [];
  private layers: string[][] = [];

  constructor() {
    this.rebuild();
  }

  /**
   * Get the current root hash of the tree
   * Returns EMPTY_HASH if tree is empty
   */
  get root(): string {
    if (this.layers.length === 0 || this.layers[this.layers.length - 1].length === 0) {
      return EMPTY_HASH;
    }
    return this.layers[this.layers.length - 1][0];
  }

  /**
   * Get the number of entries in the tree
   */
  get size(): number {
    return this.leaves.length;
  }

  /**
   * Append a new entry to the tree
   * @param hash - The hash of the entry to append
   * @returns The position (index) of the new entry
   */
  append(hash: string): number {
    const position = this.leaves.length;
    this.leaves.push(hash);
    this.rebuild();
    return position;
  }

  /**
   * Append multiple entries efficiently
   * @param hashes - Array of entry hashes to append
   * @returns Starting position of the batch
   */
  appendBatch(hashes: string[]): number {
    const startPosition = this.leaves.length;
    this.leaves.push(...hashes);
    this.rebuild();
    return startPosition;
  }

  /**
   * Generate a proof of inclusion for an entry
   * @param index - The position of the entry
   * @returns Merkle proof object
   */
  getProof(index: number): MerkleProof {
    if (index < 0 || index >= this.leaves.length) {
      throw new Error(`Index ${index} out of bounds (0-${this.leaves.length - 1})`);
    }

    const proof: string[] = [];
    const directions: ('left' | 'right')[] = [];
    let currentIndex = index;

    // Walk up the tree, collecting sibling hashes
    for (let layer = 0; layer < this.layers.length - 1; layer++) {
      const currentLayer = this.layers[layer];
      const isRightNode = currentIndex % 2 === 1;
      const siblingIndex = isRightNode ? currentIndex - 1 : currentIndex + 1;

      if (siblingIndex < currentLayer.length) {
        proof.push(currentLayer[siblingIndex]);
        directions.push(isRightNode ? 'left' : 'right');
      } else {
        // No sibling (odd number of nodes), use empty hash
        proof.push(EMPTY_HASH);
        directions.push('right');
      }

      currentIndex = Math.floor(currentIndex / 2);
    }

    return {
      leaf: this.leaves[index],
      index,
      proof,
      directions,
      root: this.root
    };
  }

  /**
   * Verify a proof of inclusion
   * @param proof - The Merkle proof to verify
   * @returns True if the proof is valid
   */
  static verify(proof: MerkleProof): boolean {
    let currentHash = proof.leaf;

    for (let i = 0; i < proof.proof.length; i++) {
      const sibling = proof.proof[i];
      const direction = proof.directions[i];

      if (direction === 'left') {
        currentHash = hashPair(sibling, currentHash);
      } else {
        currentHash = hashPair(currentHash, sibling);
      }
    }

    return currentHash === proof.root;
  }

  /**
   * Get all leaves (entry hashes)
   */
  getLeaves(): string[] {
    return [...this.leaves];
  }

  /**
   * Get a specific leaf by index
   */
  getLeaf(index: number): string | undefined {
    return this.leaves[index];
  }

  /**
   * Export tree state for persistence
   */
  export(): { leaves: string[]; root: string } {
    return {
      leaves: [...this.leaves],
      root: this.root
    };
  }

  /**
   * Import tree state from persistence
   */
  static import(state: { leaves: string[] }): MerkleTree {
    const tree = new MerkleTree();
    tree.leaves = [...state.leaves];
    tree.rebuild();
    return tree;
  }

  /**
   * Rebuild all layers of the tree from leaves
   * Called after any modification to leaves
   */
  private rebuild(): void {
    if (this.leaves.length === 0) {
      this.layers = [];
      return;
    }

    this.layers = [this.leaves];

    while (this.layers[this.layers.length - 1].length > 1) {
      const currentLayer = this.layers[this.layers.length - 1];
      const nextLayer: string[] = [];

      for (let i = 0; i < currentLayer.length; i += 2) {
        const left = currentLayer[i];
        const right = currentLayer[i + 1] ?? EMPTY_HASH;
        nextLayer.push(hashPair(left, right));
      }

      this.layers.push(nextLayer);
    }
  }

  /**
   * Get tree statistics for debugging/monitoring
   */
  getStats(): { leaves: number; layers: number; root: string } {
    return {
      leaves: this.leaves.length,
      layers: this.layers.length,
      root: this.root
    };
  }
}
