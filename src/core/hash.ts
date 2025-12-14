/**
 * VeilChain Hash Utilities
 *
 * Provides consistent SHA-256 hashing for all Merkle tree operations.
 * Uses Node.js native crypto for security and performance.
 */

import { createHash } from 'crypto';

/**
 * Computes SHA-256 hash of the input data
 * @param data - String or Buffer to hash
 * @returns Hex-encoded hash string
 */
export function sha256(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Computes SHA-256 hash and returns as Buffer
 * @param data - String or Buffer to hash
 * @returns Hash as Buffer
 */
export function sha256Buffer(data: string | Buffer): Buffer {
  return createHash('sha256').update(data).digest();
}

/**
 * Combines and hashes two child hashes to create parent hash
 * Order matters - left||right produces different hash than right||left
 * @param left - Left child hash (hex string)
 * @param right - Right child hash (hex string)
 * @returns Parent hash (hex string)
 */
export function hashPair(left: string, right: string): string {
  return sha256(left + right);
}

/**
 * Hashes an entry's data for storage in the Merkle tree
 *
 * This function creates a cryptographic hash of ledger entry data, including
 * the position to prevent reordering attacks. The hash includes:
 * - Position: Ensures entries cannot be reordered without detection
 * - Data: The actual entry payload
 * - Timestamp: When the entry was created
 *
 * The output is deterministic for the same inputs and creates a unique
 * identifier for the entry in the Merkle tree.
 *
 * @param data - The entry data (will be JSON stringified)
 * @param position - The entry's position in the ledger (0-indexed)
 * @returns SHA-256 hash of the entry as hex string (64 characters)
 *
 * @example
 * ```typescript
 * const hash = hashEntry({ user: 'alice', action: 'login' }, 0n);
 * console.log(hash); // "a1b2c3d4..."
 * ```
 */
export function hashEntry(data: unknown, position: bigint): string {
  const canonical = JSON.stringify({
    position: position.toString(),
    data: data,
    timestamp: Date.now()
  });
  return sha256(canonical);
}

/**
 * Generates a unique entry ID from the hash
 * @param hash - The entry hash
 * @returns Short entry ID (first 16 chars of hash)
 */
export function hashToEntryId(hash: string): string {
  return `ent_${hash.substring(0, 16)}`;
}

/**
 * Validates that a string is a valid hex hash
 * @param hash - String to validate
 * @returns True if valid SHA-256 hex hash
 */
export function isValidHash(hash: string): boolean {
  return /^[a-f0-9]{64}$/i.test(hash);
}

/**
 * Empty hash constant - represents an empty node in sparse Merkle tree
 */
export const EMPTY_HASH = sha256('');
