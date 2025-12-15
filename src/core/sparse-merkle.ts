/**
 * VeilChain Sparse Merkle Tree Implementation
 *
 * A sparse Merkle tree optimized for large key spaces with lazy evaluation.
 * Supports O(log n) proof size regardless of tree size, with efficient
 * storage for billions of potential entries using a 256-bit key space.
 *
 * Key features:
 * - Efficient SMT with lazy evaluation (only stores non-empty nodes)
 * - O(log n) proof size where n is tree depth (256 bits)
 * - Support for billions of entries with minimal storage
 * - Empty node optimization (default hash for missing branches)
 * - Both inclusion and non-inclusion proofs
 */

import { sha256, hashPair, EMPTY_HASH } from './hash.js';
import type { SparseMerkleProof, SparseMerkleTreeState } from '../types.js';

/**
 * Sparse Merkle Tree for efficient key-value storage with cryptographic proofs
 *
 * Unlike a regular Merkle tree which stores data in leaves, a Sparse Merkle Tree
 * uses a fixed depth (256 for SHA-256 keys) and stores key-value pairs at positions
 * determined by hashing the key. Empty positions use a default empty hash, making
 * the tree "sparse" - most nodes are empty and don't need to be stored.
 *
 * Properties:
 * - Fixed depth: 256 levels (for 256-bit key space)
 * - Lazy evaluation: Only stores nodes that have been set
 * - Efficient proofs: O(depth) = O(256) = constant size proofs
 * - Deterministic: Same key-value pairs always produce same root
 * - Non-inclusion proofs: Can prove a key does NOT exist
 */
export class SparseMerkleTree {
  private nodes: Map<string, string> = new Map();
  private leaves: Map<string, string> = new Map(); // keyHash path -> valueHash
  private depth: number;
  private defaultHashes: string[];
  private cachedRoot: string | null = null;

  /**
   * Create a new Sparse Merkle Tree
   * @param depth - Tree depth (default 256 for 256-bit key space)
   */
  constructor(depth: number = 256) {
    if (depth <= 0 || depth > 256) {
      throw new Error('Depth must be between 1 and 256');
    }
    this.depth = depth;

    // Precompute default hashes for each level (optimization)
    // defaultHashes[i] is the hash of a subtree with depth i containing only empty nodes
    this.defaultHashes = [EMPTY_HASH];
    for (let i = 1; i <= depth; i++) {
      this.defaultHashes.push(hashPair(this.defaultHashes[i - 1], this.defaultHashes[i - 1]));
    }
  }

  /**
   * Get the current root hash of the tree
   */
  get root(): string {
    if (this.cachedRoot !== null) {
      return this.cachedRoot;
    }

    // If tree is empty, return the default hash for the full depth
    if (this.leaves.size === 0) {
      this.cachedRoot = this.defaultHashes[this.depth];
      return this.cachedRoot;
    }

    // Compute root from stored leaves
    this.cachedRoot = this.computeRoot();
    return this.cachedRoot;
  }

  /**
   * Compute the root hash from all leaves
   */
  private computeRoot(): string {
    // Build the tree bottom-up, level by level
    // This is more efficient than recursive top-down approach

    // Start with leaf level
    const currentLevel = new Map<string, string>();

    // Copy all leaves
    this.leaves.forEach((value, path) => {
      currentLevel.set(path, value);
    });

    // Build up from leaves to root
    for (let level = this.depth - 1; level >= 0; level--) {
      const nextLevel = new Map<string, string>();

      // Get all paths at this level
      const pathsAtLevel = new Set<string>();
      currentLevel.forEach((_, path) => {
        const parentPath = path.substring(0, level);
        pathsAtLevel.add(parentPath);
      });

      // Compute hash for each path
      pathsAtLevel.forEach(path => {
        const leftPath = path + '0';
        const rightPath = path + '1';

        const leftHash = currentLevel.get(leftPath) || this.defaultHashes[this.depth - level - 1];
        const rightHash = currentLevel.get(rightPath) || this.defaultHashes[this.depth - level - 1];

        const hash = hashPair(leftHash, rightHash);
        nextLevel.set(path, hash);
      });

      // Move to next level
      currentLevel.clear();
      nextLevel.forEach((value, key) => {
        currentLevel.set(key, value);
      });
    }

    // Root is the only entry at level 0
    return currentLevel.get('') || this.defaultHashes[this.depth];
  }

  /**
   * Hash a key to get its path in the tree
   * @param key - The key to hash
   * @returns SHA-256 hash of the key
   */
  private hashKey(key: string): string {
    return sha256(key);
  }

  /**
   * Get the bit at a specific position in a hash
   * @param hash - Hex hash string
   * @param position - Bit position (0 = leftmost bit)
   * @returns 0 or 1
   */
  private getBit(hash: string, position: number): number {
    if (position < 0 || position >= this.depth) {
      throw new Error(`Bit position ${position} out of range [0, ${this.depth})`);
    }

    // Convert hex hash to binary path
    // Each hex char represents 4 bits
    const charIndex = Math.floor(position / 4);
    const bitInChar = position % 4;
    const hexChar = hash[charIndex];
    const value = parseInt(hexChar, 16);

    // Extract the specific bit (MSB first)
    return (value >> (3 - bitInChar)) & 1;
  }

  /**
   * Get the path to a leaf for a given key hash
   * @param keyHash - The hashed key
   * @returns Binary path string
   */
  private getPathForKey(keyHash: string): string {
    let path = '';
    for (let i = 0; i < this.depth; i++) {
      path += this.getBit(keyHash, i).toString();
    }
    return path;
  }

  /**
   * Insert or update a key-value pair in the tree
   * @param key - The key to set
   * @param value - The value to store
   */
  set(key: string, value: string): void {
    const keyHash = this.hashKey(key);
    const valueHash = sha256(value);
    const path = this.getPathForKey(keyHash);

    // Store the leaf value
    this.leaves.set(path, valueHash);

    // Invalidate cached root
    this.cachedRoot = null;
  }

  /**
   * Get the value for a key
   * @param key - The key to look up
   * @returns The value hash, or null if key doesn't exist
   */
  get(key: string): string | null {
    const keyHash = this.hashKey(key);
    const path = this.getPathForKey(keyHash);
    const valueHash = this.leaves.get(path);

    return valueHash || null;
  }

  /**
   * Generate a proof of inclusion or non-inclusion for a key
   * @param key - The key to prove
   * @returns Sparse Merkle proof
   */
  getProof(key: string): SparseMerkleProof {
    const keyHash = this.hashKey(key);
    const value = this.get(key);
    const path = this.getPathForKey(keyHash);
    const siblings: string[] = [];

    // Build level-by-level map for efficient sibling lookup
    const levelMaps: Map<string, string>[] = [];

    // Start with leaves
    const leafMap = new Map<string, string>();
    this.leaves.forEach((v, p) => {
      leafMap.set(p, v);
    });
    levelMaps.push(leafMap);

    // Build up to root
    for (let level = this.depth - 1; level >= 0; level--) {
      const currentLevel = new Map<string, string>();
      const prevLevel = levelMaps[levelMaps.length - 1];

      // Get all paths that exist at this level
      const pathsAtLevel = new Set<string>();
      prevLevel.forEach((_, p) => {
        const parentPath = p.substring(0, level);
        pathsAtLevel.add(parentPath);
      });

      // Compute hashes for existing paths
      pathsAtLevel.forEach(p => {
        const leftPath = p + '0';
        const rightPath = p + '1';

        const leftHash = prevLevel.get(leftPath) || this.defaultHashes[this.depth - level - 1];
        const rightHash = prevLevel.get(rightPath) || this.defaultHashes[this.depth - level - 1];

        const hash = hashPair(leftHash, rightHash);
        currentLevel.set(p, hash);
      });

      levelMaps.push(currentLevel);
    }

    // Collect sibling hashes along the path
    for (let level = 0; level < this.depth; level++) {
      const currentPath = path.substring(0, level);
      const bit = path[level];
      const siblingPath = currentPath + (bit === '0' ? '1' : '0');

      // Get sibling from the appropriate level map
      const levelMap = levelMaps[this.depth - level - 1];
      const siblingHash = levelMap.get(siblingPath) || this.defaultHashes[this.depth - level - 1];

      siblings.push(siblingHash);
    }

    return {
      key,
      value,
      siblings,
      root: this.root,
      included: value !== null
    };
  }

  /**
   * Verify a Sparse Merkle proof
   * @param proof - The proof to verify
   * @returns True if the proof is valid
   */
  static verify(proof: SparseMerkleProof): boolean {
    const keyHash = sha256(proof.key);
    let currentHash: string;

    if (proof.included && proof.value !== null) {
      // For inclusion proofs, start with the hash of the value
      currentHash = proof.value;
    } else {
      // For non-inclusion proofs, start with empty hash
      currentHash = EMPTY_HASH;
    }

    // Build path for the key
    const depth = proof.siblings.length;

    // Walk up the tree from leaf to root, combining with siblings
    for (let i = depth - 1; i >= 0; i--) {
      const sibling = proof.siblings[i];
      const bit = SparseMerkleTree.getBitStatic(keyHash, i, depth);

      // Determine left and right based on the bit
      if (bit === 0) {
        // Current node is on the left
        currentHash = hashPair(currentHash, sibling);
      } else {
        // Current node is on the right
        currentHash = hashPair(sibling, currentHash);
      }
    }

    return currentHash === proof.root;
  }

  /**
   * Static version of getBit for proof verification
   */
  private static getBitStatic(hash: string, position: number, depth: number): number {
    if (position < 0 || position >= depth) {
      throw new Error(`Bit position ${position} out of range [0, ${depth})`);
    }

    const charIndex = Math.floor(position / 4);
    const bitInChar = position % 4;
    const hexChar = hash[charIndex];
    const value = parseInt(hexChar, 16);
    return (value >> (3 - bitInChar)) & 1;
  }

  /**
   * Export the tree state for persistence
   * @returns Serialized tree state
   */
  export(): SparseMerkleTreeState {
    const nodes: Record<string, string> = {};
    this.leaves.forEach((value, key) => {
      nodes[key] = value;
    });

    return {
      nodes,
      root: this.root,
      depth: this.depth
    };
  }

  /**
   * Import a tree state from persistence
   * @param state - Serialized tree state
   * @returns New SparseMerkleTree instance
   */
  static import(state: SparseMerkleTreeState): SparseMerkleTree {
    const tree = new SparseMerkleTree(state.depth);

    // Restore leaves
    Object.entries(state.nodes).forEach(([key, value]) => {
      tree.leaves.set(key, value);
    });

    // Root will be computed on first access
    return tree;
  }

  /**
   * Get statistics about the tree
   * @returns Tree statistics
   */
  getStats(): {
    depth: number;
    storedNodes: number;
    root: string;
  } {
    return {
      depth: this.depth,
      storedNodes: this.leaves.size,
      root: this.root
    };
  }

  /**
   * Clear all data from the tree
   */
  clear(): void {
    this.nodes.clear();
    this.leaves.clear();
    this.cachedRoot = null;
  }

  /**
   * Check if a key exists in the tree
   * @param key - The key to check
   * @returns True if the key exists
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Get all stored keys (note: only keys that have been set)
   * This is not efficient for large trees and is mainly for debugging
   * @returns Array of all keys
   */
  keys(): string[] {
    const keys: string[] = [];
    // This would require maintaining a separate key index in production
    // For now, we return an empty array as keys are hashed
    return keys;
  }

  /**
   * Get the number of non-empty leaves stored
   * @returns Count of stored leaves
   */
  get size(): number {
    return this.leaves.size;
  }
}
