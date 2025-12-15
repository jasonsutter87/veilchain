/**
 * VeilChain Batch Proof Generation
 *
 * Generates efficient batch proofs for multiple entries at once.
 * Optimizes by sharing common proof nodes across multiple entries.
 */

import { MerkleTree } from './merkle.js';
import { hashPair } from './hash.js';
import type { BatchProof, MerkleProof } from '../types.js';

/**
 * Generate a batch proof for multiple entries
 *
 * This function creates an optimized proof that verifies multiple entries
 * simultaneously by sharing common nodes in the proof path. This is more
 * efficient than generating individual proofs for each entry.
 *
 * The optimization works by:
 * 1. Collecting all individual proofs for the given indices
 * 2. Finding common nodes across all proof paths
 * 3. Creating a unified proof with a mapping showing which nodes apply to which leaves
 *
 * @param tree - The Merkle tree containing the entries
 * @param indices - Array of entry indices to prove
 * @returns Optimized batch proof
 *
 * @example
 * ```typescript
 * const tree = new MerkleTree();
 * tree.append(hash1);
 * tree.append(hash2);
 * tree.append(hash3);
 *
 * const batchProof = generateBatchProof(tree, [0, 2]);
 * console.log('Proving entries 0 and 2 together');
 * ```
 */
export function generateBatchProof(tree: MerkleTree, indices: number[]): BatchProof {
  if (indices.length === 0) {
    throw new Error('Cannot generate batch proof for empty indices array');
  }

  // Validate all indices
  for (const index of indices) {
    if (index < 0 || index >= tree.size) {
      throw new Error(`Index ${index} out of bounds (0-${tree.size - 1})`);
    }
  }

  // Sort indices for consistent ordering
  const sortedIndices = [...indices].sort((a, b) => a - b);

  // Check for duplicates
  for (let i = 1; i < sortedIndices.length; i++) {
    if (sortedIndices[i] === sortedIndices[i - 1]) {
      throw new Error(`Duplicate index found: ${sortedIndices[i]}`);
    }
  }

  // Generate individual proofs
  const individualProofs: MerkleProof[] = sortedIndices.map(index => tree.getProof(index));

  // Collect all leaves
  const leaves = individualProofs.map(p => p.leaf);

  // Build optimized proof by deduplicating common nodes
  const proofSet = new Set<string>();
  const proofMap: number[][] = [];
  const directions: ('left' | 'right')[][] = [];

  for (const proof of individualProofs) {
    const leafProofMap: number[] = [];
    const leafDirections: ('left' | 'right')[] = [];

    for (let i = 0; i < proof.proof.length; i++) {
      const hash = proof.proof[i];
      const direction = proof.directions[i];

      // Add to proof set if not already present
      if (!proofSet.has(hash)) {
        proofSet.add(hash);
      }

      // Map this proof node to the shared proof array
      const sharedProof = Array.from(proofSet);
      const proofIndex = sharedProof.indexOf(hash);
      leafProofMap.push(proofIndex);
      leafDirections.push(direction);
    }

    proofMap.push(leafProofMap);
    directions.push(leafDirections);
  }

  return {
    leaves,
    indices: sortedIndices,
    proof: Array.from(proofSet),
    proofMap,
    directions,
    root: tree.root
  };
}

/**
 * Verify a batch proof
 *
 * Verifies that all entries in the batch proof are valid members of the
 * Merkle tree with the specified root hash.
 *
 * The verification process:
 * 1. For each leaf in the batch
 * 2. Walk up the tree using the proof map and directions
 * 3. Combine with sibling hashes to compute the root
 * 4. Verify all computed roots match the provided root
 *
 * All entries must verify successfully for the batch proof to be valid.
 *
 * @param proof - The batch proof to verify
 * @returns True if all entries in the batch are valid
 *
 * @example
 * ```typescript
 * const batchProof = generateBatchProof(tree, [0, 1, 2]);
 * const isValid = verifyBatchProof(batchProof);
 * console.log(isValid); // true
 * ```
 */
export function verifyBatchProof(proof: BatchProof): boolean {
  if (proof.leaves.length !== proof.indices.length) {
    return false;
  }

  if (proof.leaves.length !== proof.proofMap.length) {
    return false;
  }

  if (proof.leaves.length !== proof.directions.length) {
    return false;
  }

  // Verify each leaf in the batch
  for (let i = 0; i < proof.leaves.length; i++) {
    const leaf = proof.leaves[i];
    const leafProofMap = proof.proofMap[i];
    const leafDirections = proof.directions[i];

    if (leafProofMap.length !== leafDirections.length) {
      return false;
    }

    let currentHash = leaf;

    // Walk up the tree using the proof map
    for (let j = 0; j < leafProofMap.length; j++) {
      const proofIndex = leafProofMap[j];
      const sibling = proof.proof[proofIndex];
      const direction = leafDirections[j];

      if (direction === 'left') {
        currentHash = hashPair(sibling, currentHash);
      } else {
        currentHash = hashPair(currentHash, sibling);
      }
    }

    // Verify this leaf computes to the root
    if (currentHash !== proof.root) {
      return false;
    }
  }

  return true;
}

/**
 * Calculate the space savings of a batch proof vs individual proofs
 *
 * @param batchProof - The batch proof
 * @returns Object with statistics about space savings
 */
export function getBatchProofStats(batchProof: BatchProof): {
  numEntries: number;
  sharedProofNodes: number;
  individualProofNodes: number;
  spaceSavingsPercent: number;
} {
  const numEntries = batchProof.leaves.length;
  const sharedProofNodes = batchProof.proof.length;

  // Calculate what individual proofs would have cost
  let totalIndividualNodes = 0;
  for (const leafProofMap of batchProof.proofMap) {
    totalIndividualNodes += leafProofMap.length;
  }

  const spaceSavingsPercent = totalIndividualNodes > 0
    ? ((totalIndividualNodes - sharedProofNodes) / totalIndividualNodes) * 100
    : 0;

  return {
    numEntries,
    sharedProofNodes,
    individualProofNodes: totalIndividualNodes,
    spaceSavingsPercent
  };
}
