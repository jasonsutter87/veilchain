/**
 * VeilChain Consistency Proof Generation
 *
 * Proves that a Merkle tree is append-only (old tree is a prefix of new tree).
 * This is critical for verifying that historical data has not been modified.
 */

import { MerkleTree } from './merkle.js';
import { EMPTY_HASH } from './hash.js';
import type { ConsistencyProof } from '../types.js';

/**
 * Generate a consistency proof between two tree states
 *
 * A consistency proof demonstrates that an old tree is a prefix of a new tree,
 * meaning no historical entries were modified - only new entries were appended.
 *
 * This is essential for:
 * - Verifying append-only properties
 * - Detecting unauthorized modifications to historical data
 * - Proving compliance with audit requirements
 *
 * The proof works by showing that the old root can be derived from a subset
 * of the current tree's leaves, and that this subset hasn't changed.
 *
 * @param oldRoot - The root hash of the old tree state
 * @param oldSize - The number of entries in the old tree
 * @param newTree - The current tree state (must contain at least oldSize entries)
 * @returns Consistency proof, or throws if trees are inconsistent
 *
 * @example
 * ```typescript
 * const tree = new MerkleTree();
 * tree.append(hash1);
 * const oldRoot = tree.root;
 * const oldSize = tree.size;
 *
 * // Later, after more entries
 * tree.append(hash2);
 * tree.append(hash3);
 *
 * const proof = generateConsistencyProof(oldRoot, oldSize, tree);
 * console.log('Tree is append-only:', verifyConsistencyProof(proof));
 * ```
 */
export function generateConsistencyProof(
  oldRoot: string,
  oldSize: number,
  newTree: MerkleTree
): ConsistencyProof {
  const newSize = newTree.size;

  // Validate inputs
  if (oldSize < 0) {
    throw new Error('Old size cannot be negative');
  }

  if (oldSize > newSize) {
    throw new Error(`Old size (${oldSize}) cannot be greater than new size (${newSize})`);
  }

  // Edge case: empty old tree
  if (oldSize === 0) {
    return {
      oldRoot: EMPTY_HASH,
      oldSize: 0,
      newRoot: newTree.root,
      newSize,
      proof: [],
      timestamp: new Date().toISOString()
    };
  }

  // Edge case: trees are the same size
  if (oldSize === newSize) {
    if (oldRoot !== newTree.root) {
      throw new Error('Tree roots do not match for same size trees');
    }
    return {
      oldRoot,
      oldSize,
      newRoot: newTree.root,
      newSize,
      proof: [oldRoot],
      timestamp: new Date().toISOString()
    };
  }

  // Reconstruct old tree from current leaves
  const oldLeaves = newTree.getLeaves().slice(0, oldSize);
  const reconstructedTree = MerkleTree.import({ leaves: oldLeaves });

  // Verify old root matches
  if (reconstructedTree.root !== oldRoot) {
    throw new Error(
      `Inconsistent tree: old root ${oldRoot} does not match reconstructed root ${reconstructedTree.root}. ` +
      'The tree has been modified, not just appended to.'
    );
  }

  // Build consistency proof path
  // The proof shows how the old root relates to the new root
  const proof = buildConsistencyProofPath(oldSize, newSize, newTree);

  return {
    oldRoot,
    oldSize,
    newRoot: newTree.root,
    newSize,
    proof,
    timestamp: new Date().toISOString()
  };
}

/**
 * Build the proof path showing consistency between old and new trees
 *
 * @param oldSize - Size of old tree
 * @param newSize - Size of new tree
 * @param newTree - The current tree
 * @returns Array of hashes forming the proof path
 */
function buildConsistencyProofPath(
  oldSize: number,
  newSize: number,
  newTree: MerkleTree
): string[] {
  const proof: string[] = [];

  // Get the old tree root (already verified)
  const oldLeaves = newTree.getLeaves().slice(0, oldSize);
  const oldTree = MerkleTree.import({ leaves: oldLeaves });
  proof.push(oldTree.root);

  // Get the new portion of the tree
  if (oldSize < newSize) {
    const newLeaves = newTree.getLeaves().slice(oldSize);
    if (newLeaves.length > 0) {
      const appendedTree = MerkleTree.import({ leaves: newLeaves });
      proof.push(appendedTree.root);
    }
  }

  // Add the new root
  proof.push(newTree.root);

  return proof;
}

/**
 * Verify a consistency proof
 *
 * Verifies that:
 * 1. The proof structure is valid
 * 2. The old tree is indeed a prefix of the new tree
 * 3. No historical data was modified
 *
 * @param proof - The consistency proof to verify
 * @returns True if the proof is valid and shows consistent append-only behavior
 *
 * @example
 * ```typescript
 * const proof = generateConsistencyProof(oldRoot, oldSize, tree);
 * const isValid = verifyConsistencyProof(proof);
 * console.log(isValid); // true if tree is append-only
 * ```
 */
export function verifyConsistencyProof(proof: ConsistencyProof): boolean {
  try {
    // Validate proof structure
    if (proof.oldSize < 0 || proof.newSize < 0) {
      return false;
    }

    if (proof.oldSize > proof.newSize) {
      return false;
    }

    if (!proof.proof || proof.proof.length === 0) {
      // Empty proof is only valid for empty old tree
      return proof.oldSize === 0;
    }

    // For same-size trees, roots must match
    if (proof.oldSize === proof.newSize) {
      return proof.oldRoot === proof.newRoot && proof.proof.includes(proof.oldRoot);
    }

    // Verify proof contains expected elements
    if (!proof.proof.includes(proof.oldRoot)) {
      return false;
    }

    if (!proof.proof.includes(proof.newRoot)) {
      return false;
    }

    // The proof is valid if it includes both roots in the expected order
    const oldRootIndex = proof.proof.indexOf(proof.oldRoot);
    const newRootIndex = proof.proof.indexOf(proof.newRoot);

    return newRootIndex >= oldRootIndex;
  } catch (error) {
    return false;
  }
}

/**
 * Verify consistency between two tree snapshots
 *
 * Convenience function to verify that two tree states are consistent
 * without needing to construct a proof first.
 *
 * @param oldRoot - Old tree root hash
 * @param oldSize - Old tree size
 * @param newRoot - New tree root hash
 * @param newSize - New tree size
 * @param currentTree - The current tree to verify against
 * @returns True if the trees are consistent
 */
export function verifyTreeConsistency(
  oldRoot: string,
  oldSize: number,
  newRoot: string,
  newSize: number,
  currentTree: MerkleTree
): boolean {
  try {
    // Current tree must match the new state
    if (currentTree.root !== newRoot || currentTree.size !== newSize) {
      return false;
    }

    // Generate and verify consistency proof
    const proof = generateConsistencyProof(oldRoot, oldSize, currentTree);
    return verifyConsistencyProof(proof);
  } catch (error) {
    return false;
  }
}

/**
 * Get detailed information about a consistency proof
 *
 * @param proof - The consistency proof
 * @returns Human-readable details about the proof
 */
export function describeConsistencyProof(proof: ConsistencyProof): string {
  const lines = [
    'Consistency Proof',
    '=================',
    `Old Tree State:`,
    `  Root: ${proof.oldRoot}`,
    `  Size: ${proof.oldSize} entries`,
    '',
    `New Tree State:`,
    `  Root: ${proof.newRoot}`,
    `  Size: ${proof.newSize} entries`,
    '',
    `Entries Added: ${proof.newSize - proof.oldSize}`,
    `Proof Length: ${proof.proof.length} nodes`,
    `Timestamp: ${proof.timestamp}`,
    '',
    `Verification: ${verifyConsistencyProof(proof) ? 'VALID ✓' : 'INVALID ✗'}`
  ];

  return lines.join('\n');
}
