/**
 * VeilChain Standalone Proof Verification
 *
 * This module provides offline proof verification without network dependencies.
 * It can be used in browsers, Node.js, or any JavaScript environment.
 */

import type { MerkleProof, CompactProof, VerifyProofResult } from './types.js';

/**
 * Convert a hex string to Uint8Array
 */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Convert Uint8Array to hex string
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Compute SHA-256 hash using Web Crypto API
 * Works in both browsers and Node.js 18+
 */
async function sha256(data: Uint8Array): Promise<string> {
  // Create a new ArrayBuffer copy to avoid SharedArrayBuffer type issues
  const buffer = new ArrayBuffer(data.length);
  new Uint8Array(buffer).set(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return bytesToHex(new Uint8Array(hashBuffer));
}

/**
 * Compute SHA-256 hash of two concatenated hashes
 */
async function hashPair(left: string, right: string): Promise<string> {
  const combined = new Uint8Array(64);
  combined.set(hexToBytes(left), 0);
  combined.set(hexToBytes(right), 32);
  return sha256(combined);
}

/**
 * Verify a Merkle inclusion proof
 *
 * This function verifies that a leaf is included in a Merkle tree by
 * recomputing the root hash from the leaf and proof path.
 *
 * @param proof - The Merkle proof to verify
 * @returns Promise resolving to verification result
 *
 * @example
 * ```typescript
 * import { verifyProof } from '@veilchain/sdk/verify';
 *
 * const proof = {
 *   leaf: 'a1b2c3...',
 *   index: 5,
 *   proof: ['hash1', 'hash2', 'hash3'],
 *   directions: ['left', 'right', 'left'],
 *   root: 'expectedRootHash...'
 * };
 *
 * const result = await verifyProof(proof);
 * if (result.valid) {
 *   console.log('Proof is valid!');
 * }
 * ```
 */
export async function verifyProof(proof: MerkleProof): Promise<VerifyProofResult> {
  try {
    // Validate input
    if (!proof.leaf || proof.leaf.length !== 64) {
      return {
        valid: false,
        leaf: proof.leaf || '',
        root: proof.root || '',
        index: proof.index || 0,
        proofLength: proof.proof?.length || 0,
        error: 'Invalid leaf hash: must be 64 character hex string',
      };
    }

    if (!proof.root || proof.root.length !== 64) {
      return {
        valid: false,
        leaf: proof.leaf,
        root: proof.root || '',
        index: proof.index || 0,
        proofLength: proof.proof?.length || 0,
        error: 'Invalid root hash: must be 64 character hex string',
      };
    }

    if (proof.proof.length !== proof.directions.length) {
      return {
        valid: false,
        leaf: proof.leaf,
        root: proof.root,
        index: proof.index,
        proofLength: proof.proof.length,
        error: 'Proof and directions arrays must have the same length',
      };
    }

    // Compute root from leaf and proof path
    let currentHash = proof.leaf;

    for (let i = 0; i < proof.proof.length; i++) {
      const siblingHash = proof.proof[i];
      const direction = proof.directions[i];

      if (direction === 'left') {
        // Sibling is on the left, current is on the right
        currentHash = await hashPair(siblingHash, currentHash);
      } else {
        // Sibling is on the right, current is on the left
        currentHash = await hashPair(currentHash, siblingHash);
      }
    }

    const valid = currentHash === proof.root;

    return {
      valid,
      leaf: proof.leaf,
      root: proof.root,
      index: proof.index,
      proofLength: proof.proof.length,
      error: valid ? undefined : 'Computed root does not match expected root',
    };
  } catch (error) {
    return {
      valid: false,
      leaf: proof.leaf || '',
      root: proof.root || '',
      index: proof.index || 0,
      proofLength: proof.proof?.length || 0,
      error: error instanceof Error ? error.message : 'Verification failed',
    };
  }
}

/**
 * Parse a compact proof into a full MerkleProof
 *
 * @param compact - The compact proof format
 * @returns Full MerkleProof object
 *
 * @example
 * ```typescript
 * import { parseCompactProof, verifyProof } from '@veilchain/sdk/verify';
 *
 * const compact = { v: 1, l: '...', r: '...', i: 5, p: '...', d: '010' };
 * const proof = parseCompactProof(compact);
 * const result = await verifyProof(proof);
 * ```
 */
export function parseCompactProof(compact: CompactProof): MerkleProof {
  // Split concatenated proof hashes (each is 64 chars for SHA256)
  const proofHashes: string[] = [];
  for (let i = 0; i < compact.p.length; i += 64) {
    proofHashes.push(compact.p.slice(i, i + 64));
  }

  // Parse directions from binary string
  const directions = compact.d.split('').map(d =>
    d === '0' ? 'left' : 'right'
  ) as Array<'left' | 'right'>;

  return {
    leaf: compact.l,
    index: compact.i,
    proof: proofHashes,
    directions,
    root: compact.r,
  };
}

/**
 * Convert a MerkleProof to compact format
 *
 * @param proof - The full Merkle proof
 * @returns Compact proof format
 */
export function toCompactProof(proof: MerkleProof): CompactProof {
  return {
    v: 1,
    l: proof.leaf,
    r: proof.root,
    i: proof.index,
    p: proof.proof.join(''),
    d: proof.directions.map(d => d === 'left' ? '0' : '1').join(''),
  };
}

/**
 * Hash arbitrary data to create a leaf hash
 *
 * @param data - The data to hash (will be JSON stringified if object)
 * @returns Promise resolving to SHA-256 hash as hex string
 *
 * @example
 * ```typescript
 * import { hashData } from '@veilchain/sdk/verify';
 *
 * const hash = await hashData({ vote: 'yes', voter: 'alice' });
 * console.log(hash); // '5a3b...'
 * ```
 */
export async function hashData(data: unknown): Promise<string> {
  const serialized = typeof data === 'string' ? data : JSON.stringify(data);
  const encoder = new TextEncoder();
  const bytes = encoder.encode(serialized);
  return sha256(bytes);
}

/**
 * Verify that data matches a given hash
 *
 * @param data - The data to verify
 * @param expectedHash - The expected hash
 * @returns Promise resolving to true if hashes match
 *
 * @example
 * ```typescript
 * import { verifyData } from '@veilchain/sdk/verify';
 *
 * const isValid = await verifyData({ vote: 'yes' }, '5a3b...');
 * ```
 */
export async function verifyData(data: unknown, expectedHash: string): Promise<boolean> {
  const actualHash = await hashData(data);
  return actualHash === expectedHash;
}

/**
 * Verify a proof against known data
 *
 * This combines data verification with proof verification to ensure
 * both the data matches the leaf hash AND the leaf is in the tree.
 *
 * @param data - The original data
 * @param proof - The Merkle proof
 * @returns Promise resolving to verification result
 *
 * @example
 * ```typescript
 * import { verifyDataWithProof } from '@veilchain/sdk/verify';
 *
 * const vote = { vote: 'yes', voter: 'alice' };
 * const proof = { leaf: '...', index: 5, proof: [...], directions: [...], root: '...' };
 *
 * const result = await verifyDataWithProof(vote, proof);
 * if (result.valid) {
 *   console.log('Vote is verified in the ledger!');
 * }
 * ```
 */
export async function verifyDataWithProof(
  data: unknown,
  proof: MerkleProof
): Promise<VerifyProofResult & { dataMatch: boolean }> {
  const dataHash = await hashData(data);
  const dataMatch = dataHash === proof.leaf;

  if (!dataMatch) {
    return {
      valid: false,
      dataMatch: false,
      leaf: proof.leaf,
      root: proof.root,
      index: proof.index,
      proofLength: proof.proof.length,
      error: 'Data hash does not match proof leaf',
    };
  }

  const proofResult = await verifyProof(proof);
  return {
    ...proofResult,
    dataMatch: true,
  };
}
