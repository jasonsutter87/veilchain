/**
 * VeilChain - Merkle Tree Ledger Service
 *
 * Bitcoin-grade immutability without the blockchain baggage.
 *
 * @packageDocumentation
 */

// Core exports
export { MerkleTree } from './core/merkle.js';
export {
  sha256,
  sha256Buffer,
  hashPair,
  hashEntry,
  hashToEntryId,
  isValidHash,
  EMPTY_HASH
} from './core/hash.js';
export {
  serializeProof,
  deserializeProof,
  verifyProofDetailed,
  createConsistencyProof,
  formatProofForDisplay,
  createAnchorBundle
} from './core/proof.js';

// Storage exports
export { MemoryStorage } from './storage/memory.js';

// Type exports
export type {
  MerkleProof,
  SerializedProof,
  ProofVerificationResult,
  LedgerEntry,
  LedgerMetadata,
  CreateLedgerOptions,
  AppendOptions,
  AppendResult,
  MerkleNode,
  StorageBackend,
  AnchorRecord
} from './types.js';

// Version
export const VERSION = '0.1.0';
