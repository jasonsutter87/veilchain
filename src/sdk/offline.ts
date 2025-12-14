/**
 * VeilChain Offline Proof Verification
 *
 * Provides standalone proof verification without network access.
 * Perfect for:
 * - Client-side verification in browsers
 * - Offline mobile apps
 * - Third-party auditors
 * - Air-gapped systems
 */

import type { MerkleProof, SerializedProof, ProofVerificationResult } from '../types.js';
import { verifyProofDetailed, deserializeProof, serializeProof } from '../core/proof.js';
import { MerkleTree } from '../core/merkle.js';
import { ProofVerificationError } from './errors.js';

/**
 * Verify a Merkle proof offline (no network required)
 *
 * @param proof - The proof to verify (full or serialized format)
 * @returns True if the proof is valid
 * @throws ProofVerificationError if the proof is invalid
 *
 * @example
 * ```typescript
 * import { verifyProofOffline } from '@veilchain/sdk';
 *
 * const proof = {
 *   leaf: '0x123...',
 *   index: 5,
 *   proof: ['0xabc...', '0xdef...'],
 *   directions: ['left', 'right'],
 *   root: '0x789...'
 * };
 *
 * const isValid = verifyProofOffline(proof);
 * console.log('Proof is valid:', isValid);
 * ```
 */
export function verifyProofOffline(proof: MerkleProof | SerializedProof): boolean {
  const result = verifyProofDetailed(proof);

  if (!result.valid) {
    throw new ProofVerificationError(
      result.error || 'Proof verification failed',
      proof
    );
  }

  return true;
}

/**
 * Verify a proof and return detailed results (no throwing)
 *
 * @param proof - The proof to verify
 * @returns Detailed verification result
 *
 * @example
 * ```typescript
 * const result = verifyProofWithDetails(proof);
 * if (!result.valid) {
 *   console.error('Verification failed:', result.error);
 * }
 * ```
 */
export function verifyProofWithDetails(
  proof: MerkleProof | SerializedProof
): ProofVerificationResult {
  return verifyProofDetailed(proof);
}

/**
 * Verify multiple proofs in batch
 *
 * @param proofs - Array of proofs to verify
 * @returns Array of verification results
 *
 * @example
 * ```typescript
 * const results = verifyProofsBatch([proof1, proof2, proof3]);
 * const allValid = results.every(r => r.valid);
 * ```
 */
export function verifyProofsBatch(
  proofs: Array<MerkleProof | SerializedProof>
): ProofVerificationResult[] {
  return proofs.map(proof => verifyProofDetailed(proof));
}

/**
 * Verify that a set of proofs all belong to the same root
 *
 * @param proofs - Array of proofs to verify
 * @returns True if all proofs are valid and share the same root
 *
 * @example
 * ```typescript
 * const isConsistent = verifyProofsConsistency([proof1, proof2, proof3]);
 * ```
 */
export function verifyProofsConsistency(
  proofs: Array<MerkleProof | SerializedProof>
): boolean {
  if (proofs.length === 0) {
    return true;
  }

  const results = verifyProofsBatch(proofs);

  // Check all proofs are valid
  if (!results.every(r => r.valid)) {
    return false;
  }

  // Check all proofs have the same root
  const firstRoot = results[0].root;
  return results.every(r => r.root === firstRoot);
}

/**
 * Convert a proof to compact serialized format
 *
 * @param proof - The proof to serialize
 * @returns Serialized proof object
 *
 * @example
 * ```typescript
 * const serialized = serializeProofForStorage(proof);
 * // Store in database or send over network
 * ```
 */
export function serializeProofForStorage(proof: MerkleProof): SerializedProof {
  return serializeProof(proof);
}

/**
 * Convert a serialized proof back to full format
 *
 * @param serialized - The serialized proof
 * @returns Full Merkle proof object
 *
 * @example
 * ```typescript
 * const proof = deserializeProofFromStorage(serialized);
 * const isValid = verifyProofOffline(proof);
 * ```
 */
export function deserializeProofFromStorage(serialized: SerializedProof): MerkleProof {
  return deserializeProof(serialized);
}

/**
 * Encode a proof as a compact JSON string for sharing
 *
 * @param proof - The proof to encode
 * @returns Base64-encoded JSON string
 *
 * @example
 * ```typescript
 * const encoded = encodeProofToString(proof);
 * // Share via QR code, URL parameter, etc.
 * ```
 */
export function encodeProofToString(proof: MerkleProof | SerializedProof): string {
  const serialized = 'v' in proof ? proof : serializeProof(proof);
  const json = JSON.stringify(serialized);

  // Use base64 encoding for safe URL/QR code usage
  if (typeof Buffer !== 'undefined') {
    // Node.js
    return Buffer.from(json).toString('base64');
  } else {
    // Browser
    return btoa(json);
  }
}

/**
 * Decode a proof from a compact string
 *
 * @param encoded - Base64-encoded proof string
 * @returns Full Merkle proof object
 *
 * @example
 * ```typescript
 * const proof = decodeProofFromString(encodedString);
 * const isValid = verifyProofOffline(proof);
 * ```
 */
export function decodeProofFromString(encoded: string): MerkleProof {
  let json: string;

  if (typeof Buffer !== 'undefined') {
    // Node.js
    json = Buffer.from(encoded, 'base64').toString('utf-8');
  } else {
    // Browser
    json = atob(encoded);
  }

  const serialized = JSON.parse(json) as SerializedProof;
  return deserializeProof(serialized);
}

/**
 * Verify a proof encoded as a string
 *
 * @param encoded - Base64-encoded proof string
 * @returns True if the proof is valid
 *
 * @example
 * ```typescript
 * // Scan QR code or read from URL
 * const encodedProof = getProofFromQRCode();
 * const isValid = verifyEncodedProof(encodedProof);
 * ```
 */
export function verifyEncodedProof(encoded: string): boolean {
  const proof = decodeProofFromString(encoded);
  return verifyProofOffline(proof);
}

/**
 * Extract proof metadata without full verification
 *
 * @param proof - The proof to inspect
 * @returns Proof metadata
 *
 * @example
 * ```typescript
 * const meta = getProofMetadata(proof);
 * console.log(`Proof for entry #${meta.index} with ${meta.pathLength} steps`);
 * ```
 */
export function getProofMetadata(
  proof: MerkleProof | SerializedProof
): {
  index: number;
  pathLength: number;
  leafHash: string;
  rootHash: string;
  treeDepth: number;
} {
  const fullProof = 'v' in proof ? deserializeProof(proof) : proof;

  return {
    index: fullProof.index,
    pathLength: fullProof.proof.length,
    leafHash: fullProof.leaf,
    rootHash: fullProof.root,
    treeDepth: fullProof.proof.length
  };
}

/**
 * Check if two proofs are for the same entry
 *
 * @param proof1 - First proof
 * @param proof2 - Second proof
 * @returns True if both proofs are for the same leaf
 */
export function areProofsForSameEntry(
  proof1: MerkleProof | SerializedProof,
  proof2: MerkleProof | SerializedProof
): boolean {
  const p1 = 'v' in proof1 ? deserializeProof(proof1) : proof1;
  const p2 = 'v' in proof2 ? deserializeProof(proof2) : proof2;

  return p1.leaf === p2.leaf && p1.index === p2.index;
}

/**
 * Rebuild a Merkle tree root from a set of verified proofs
 * Useful for reconstructing tree state from audit logs
 *
 * @param proofs - Array of proofs to reconstruct from
 * @returns Root hash if consistent, null if inconsistent
 */
export function reconstructRootFromProofs(
  proofs: Array<MerkleProof | SerializedProof>
): string | null {
  if (proofs.length === 0) {
    return null;
  }

  // Verify all proofs first
  const results = verifyProofsBatch(proofs);
  if (!results.every(r => r.valid)) {
    return null;
  }

  // Check consistency
  const firstRoot = results[0].root;
  if (!firstRoot) {
    return null;
  }
  const allSameRoot = results.every(r => r.root === firstRoot);

  return allSameRoot ? firstRoot : null;
}

/**
 * Re-export core verification function for convenience
 */
export { MerkleTree };
