/**
 * VeilChain Proof Utilities
 *
 * Handles proof serialization, verification, and formatting
 * for external consumption and anchoring.
 */

import { MerkleTree } from './merkle.js';
import { sha256, isValidHash } from './hash.js';
import type { MerkleProof, SerializedProof, ProofVerificationResult } from '../types.js';

/**
 * Serialize a proof for external storage/transmission
 * @param proof - The Merkle proof to serialize
 * @returns Compact serialized proof
 */
export function serializeProof(proof: MerkleProof): SerializedProof {
  return {
    v: 1, // Version for future compatibility
    l: proof.leaf,
    i: proof.index,
    p: proof.proof,
    d: proof.directions.map(d => d === 'left' ? 0 : 1),
    r: proof.root
  };
}

/**
 * Deserialize a proof from external format
 * @param serialized - The serialized proof
 * @returns Full Merkle proof object
 */
export function deserializeProof(serialized: SerializedProof): MerkleProof {
  if (serialized.v !== 1) {
    throw new Error(`Unsupported proof version: ${serialized.v}`);
  }

  return {
    leaf: serialized.l,
    index: serialized.i,
    proof: serialized.p,
    directions: serialized.d.map(d => d === 0 ? 'left' : 'right'),
    root: serialized.r
  };
}

/**
 * Verify a proof with detailed result
 * @param proof - The proof to verify (full or serialized)
 * @returns Detailed verification result
 */
export function verifyProofDetailed(
  proof: MerkleProof | SerializedProof
): ProofVerificationResult {
  try {
    // Deserialize if needed
    const fullProof = 'v' in proof ? deserializeProof(proof) : proof;

    // Validate proof structure
    if (!isValidHash(fullProof.leaf)) {
      return { valid: false, error: 'Invalid leaf hash format' };
    }

    if (!isValidHash(fullProof.root)) {
      return { valid: false, error: 'Invalid root hash format' };
    }

    if (fullProof.proof.length !== fullProof.directions.length) {
      return { valid: false, error: 'Proof and directions length mismatch' };
    }

    for (const hash of fullProof.proof) {
      if (!isValidHash(hash)) {
        return { valid: false, error: 'Invalid hash in proof path' };
      }
    }

    // Verify the proof
    const valid = MerkleTree.verify(fullProof);

    return {
      valid,
      leaf: fullProof.leaf,
      root: fullProof.root,
      index: fullProof.index,
      proofLength: fullProof.proof.length
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Create a consistency proof between two tree states
 * Proves that the old tree is a prefix of the new tree
 * @param oldRoot - The old root hash
 * @param oldSize - The old tree size
 * @param newTree - The current tree
 * @returns Consistency proof or null if inconsistent
 */
export function createConsistencyProof(
  oldRoot: string,
  oldSize: number,
  newTree: MerkleTree
): { valid: boolean; proof?: string[] } {
  if (oldSize > newTree.size) {
    return { valid: false };
  }

  if (oldSize === 0) {
    return { valid: true, proof: [] };
  }

  // Rebuild the old tree from current leaves
  const oldLeaves = newTree.getLeaves().slice(0, oldSize);
  const reconstructedTree = MerkleTree.import({ leaves: oldLeaves });

  if (reconstructedTree.root !== oldRoot) {
    return { valid: false };
  }

  // The new tree contains the old tree as a prefix
  return { valid: true, proof: [oldRoot, newTree.root] };
}

/**
 * Generate a compact proof string for display/sharing
 * @param proof - The proof to format
 * @returns Human-readable proof string
 */
export function formatProofForDisplay(proof: MerkleProof): string {
  const lines = [
    `Merkle Proof`,
    `============`,
    `Entry Hash: ${proof.leaf}`,
    `Position:   ${proof.index}`,
    `Root Hash:  ${proof.root}`,
    `Path Length: ${proof.proof.length}`,
    ``,
    `Verification Path:`,
  ];

  for (let i = 0; i < proof.proof.length; i++) {
    const dir = proof.directions[i] === 'left' ? 'L' : 'R';
    lines.push(`  [${i}] ${dir}: ${proof.proof[i]}`);
  }

  return lines.join('\n');
}

/**
 * Create a proof bundle for external anchoring
 * Contains all information needed to verify independently
 */
export function createAnchorBundle(
  tree: MerkleTree,
  metadata?: Record<string, unknown>
): {
  version: number;
  timestamp: string;
  root: string;
  size: number;
  metadata?: Record<string, unknown>;
  signature?: string;
} {
  return {
    version: 1,
    timestamp: new Date().toISOString(),
    root: tree.root,
    size: tree.size,
    metadata
  };
}
