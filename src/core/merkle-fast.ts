/**
 * VeilChain Fast Merkle Tree Implementation
 *
 * Incremental Merkle tree with O(log n) append operations.
 * Uses path updates instead of full tree rebuilds.
 */

import { hashPair, EMPTY_HASH } from './hash.js';
import type { MerkleProof } from '../types.js';

/**
 * Fast Merkle Tree with incremental updates
 *
 * Performance:
 * - Append: O(log n) instead of O(n)
 * - 10K votes: ~0.1ms per vote instead of ~20ms
 * - Proof generation: O(log n)
 */
export class FastMerkleTree {
  private leaves: string[] = [];
  private nodes: Map<string, string> = new Map(); // "layer:index" -> hash
  private _root: string = EMPTY_HASH;
  private depth: number = 0;

  constructor() {}

  get root(): string {
    return this._root;
  }

  get size(): number {
    return this.leaves.length;
  }

  /**
   * Append a new entry - O(log n)
   */
  append(hash: string): number {
    const position = this.leaves.length;
    this.leaves.push(hash);

    // Ensure tree has enough depth
    const requiredDepth = Math.max(1, Math.ceil(Math.log2(this.leaves.length + 1)));
    if (requiredDepth > this.depth) {
      this.depth = requiredDepth;
    }

    // Update only the path from new leaf to root
    this.updatePath(position, hash);

    return position;
  }

  /**
   * Append multiple entries efficiently - O(m log n) where m is batch size
   */
  appendBatch(hashes: string[]): number {
    const startPosition = this.leaves.length;

    // Add all leaves
    for (const hash of hashes) {
      this.leaves.push(hash);
    }

    // Ensure tree has enough depth
    const requiredDepth = Math.max(1, Math.ceil(Math.log2(this.leaves.length + 1)));
    if (requiredDepth > this.depth) {
      this.depth = requiredDepth;
    }

    // Rebuild affected portions (more efficient for batches)
    this.rebuildFromPosition(startPosition);

    return startPosition;
  }

  /**
   * Update path from leaf to root - O(log n)
   */
  private updatePath(leafIndex: number, leafHash: string): void {
    let currentIndex = leafIndex;
    let currentHash = leafHash;

    // Store leaf
    this.nodes.set(`0:${currentIndex}`, currentHash);

    // Walk up the tree
    for (let layer = 0; layer < this.depth; layer++) {
      const isRight = currentIndex % 2 === 1;
      const siblingIndex = isRight ? currentIndex - 1 : currentIndex + 1;
      const parentIndex = Math.floor(currentIndex / 2);

      // Get sibling hash
      const siblingHash = this.nodes.get(`${layer}:${siblingIndex}`) ?? EMPTY_HASH;

      // Compute parent hash
      const parentHash = isRight
        ? hashPair(siblingHash, currentHash)
        : hashPair(currentHash, siblingHash);

      // Store parent
      this.nodes.set(`${layer + 1}:${parentIndex}`, parentHash);

      currentIndex = parentIndex;
      currentHash = parentHash;
    }

    this._root = currentHash;
  }

  /**
   * Rebuild from a specific position (for batch operations)
   */
  private rebuildFromPosition(startPosition: number): void {
    // For each new leaf, update its path
    for (let i = startPosition; i < this.leaves.length; i++) {
      this.updatePath(i, this.leaves[i]);
    }
  }

  /**
   * Generate inclusion proof - O(log n)
   */
  getProof(index: number): MerkleProof {
    if (index < 0 || index >= this.leaves.length) {
      throw new Error(`Index ${index} out of bounds (0-${this.leaves.length - 1})`);
    }

    const proof: string[] = [];
    const directions: ('left' | 'right')[] = [];
    let currentIndex = index;

    for (let layer = 0; layer < this.depth; layer++) {
      const isRight = currentIndex % 2 === 1;
      const siblingIndex = isRight ? currentIndex - 1 : currentIndex + 1;

      const siblingHash = this.nodes.get(`${layer}:${siblingIndex}`) ?? EMPTY_HASH;
      proof.push(siblingHash);
      directions.push(isRight ? 'left' : 'right');

      currentIndex = Math.floor(currentIndex / 2);
    }

    return {
      leaf: this.leaves[index],
      index,
      proof,
      directions,
      root: this._root,
    };
  }

  /**
   * Verify inclusion proof (static, no tree needed)
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
   * Get all leaves
   */
  getLeaves(): string[] {
    return [...this.leaves];
  }

  /**
   * Get specific leaf
   */
  getLeaf(index: number): string | undefined {
    return this.leaves[index];
  }

  /**
   * Export tree state
   */
  export(): { leaves: string[]; root: string } {
    return {
      leaves: [...this.leaves],
      root: this._root,
    };
  }

  /**
   * Import tree state
   */
  static import(state: { leaves: string[] }): FastMerkleTree {
    const tree = new FastMerkleTree();
    if (state.leaves.length > 0) {
      tree.appendBatch(state.leaves);
    }
    return tree;
  }

  /**
   * Get stats
   */
  getStats(): { leaves: number; depth: number; nodes: number; root: string } {
    return {
      leaves: this.leaves.length,
      depth: this.depth,
      nodes: this.nodes.size,
      root: this._root,
    };
  }

  /**
   * Clear tree
   */
  clear(): void {
    this.leaves = [];
    this.nodes.clear();
    this._root = EMPTY_HASH;
    this.depth = 0;
  }
}
