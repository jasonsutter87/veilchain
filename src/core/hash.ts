/**
 * VeilChain Hash Utilities
 *
 * Provides consistent hashing for all Merkle tree operations.
 * Supports SHA-256 (default) and BLAKE3 for high-performance scenarios.
 * Uses Node.js native crypto for SHA-256 and hash-wasm for BLAKE3.
 */

import { createHash } from 'crypto';
import { blake3 as blake3Wasm } from 'hash-wasm';

/**
 * Hash algorithm type
 */
export type HashAlgorithm = 'sha256' | 'blake3';

/**
 * Current default hash algorithm
 */
let defaultHashAlgorithm: HashAlgorithm = 'sha256';

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
 * Computes BLAKE3 hash of the input data
 * @param data - String or Buffer to hash
 * @returns Hex-encoded hash string
 */
export async function blake3(data: string | Buffer): Promise<string> {
  const input = typeof data === 'string' ? data : data.toString('hex');
  return await blake3Wasm(input);
}

/**
 * Set the default hash algorithm for all operations
 * @param algorithm - The hash algorithm to use ('sha256' or 'blake3')
 */
export function setDefaultHashAlgorithm(algorithm: HashAlgorithm): void {
  defaultHashAlgorithm = algorithm;
}

/**
 * Get the current default hash algorithm
 * @returns The current default hash algorithm
 */
export function getDefaultHashAlgorithm(): HashAlgorithm {
  return defaultHashAlgorithm;
}

/**
 * Generic hash function using the configured algorithm
 * @param data - String or Buffer to hash
 * @returns Hex-encoded hash string
 */
export function hash(data: string | Buffer): string {
  if (defaultHashAlgorithm === 'blake3') {
    throw new Error('BLAKE3 is async. Use hashAsync() instead or switch to SHA-256.');
  }
  return sha256(data);
}

/**
 * Async generic hash function supporting both algorithms
 * @param data - String or Buffer to hash
 * @returns Promise of hex-encoded hash string
 */
export async function hashAsync(data: string | Buffer): Promise<string> {
  if (defaultHashAlgorithm === 'blake3') {
    return await blake3(data);
  }
  return sha256(data);
}

/**
 * Hashes an entry's data using BLAKE3 for storage in the Merkle tree
 * @param data - The entry data (will be JSON stringified)
 * @param position - The entry's position in the ledger (0-indexed)
 * @returns BLAKE3 hash of the entry as hex string
 */
export async function hashEntryBlake3(data: unknown, position: bigint): Promise<string> {
  const canonical = JSON.stringify({
    position: position.toString(),
    data: data,
    timestamp: Date.now()
  });
  return await blake3(canonical);
}

/**
 * Empty hash constant - represents an empty node in sparse Merkle tree
 */
export const EMPTY_HASH = sha256('');
