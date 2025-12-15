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

// Service exports
export { LedgerService, IdempotencyService } from './services/index.js';
export type { LedgerEvents, LedgerEventEmitter } from './services/index.js';

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
  StorageBackend
} from './types.js';

// SDK exports
export { VeilChainClient } from './sdk/client.js';
export {
  verifyProofOffline,
  verifyProofWithDetails,
  verifyProofsBatch,
  verifyProofsConsistency,
  serializeProofForStorage,
  deserializeProofFromStorage,
  encodeProofToString,
  decodeProofFromString,
  verifyEncodedProof,
  getProofMetadata,
  areProofsForSameEntry,
  reconstructRootFromProofs
} from './sdk/offline.js';
export {
  VeilChainError,
  NetworkError,
  AuthenticationError,
  ValidationError,
  NotFoundError,
  ProofVerificationError,
  RateLimitError,
  ServerError,
  isRetryableError
} from './sdk/errors.js';
export type {
  VeilChainClientConfig,
  ApiResponse,
  ListLedgersResponse,
  ListEntriesResponse,
  PaginationOptions,
  GetProofOptions
} from './sdk/types.js';

// Version
export const VERSION = '0.1.0';
