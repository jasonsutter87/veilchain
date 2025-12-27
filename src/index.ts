/**
 * VeilChain - Merkle Tree Ledger Service
 *
 * Bitcoin-grade immutability without the blockchain baggage.
 *
 * @packageDocumentation
 */

// Core exports
export { MerkleTree } from './core/merkle.js';
export { FastMerkleTree } from './core/merkle-fast.js';
export { SparseMerkleTree } from './core/sparse-merkle.js';
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
export {
  generateConsistencyProof,
  verifyConsistencyProof,
  verifyTreeConsistency,
  describeConsistencyProof
} from './core/consistency.js';
export {
  generateBatchProof,
  verifyBatchProof,
  getBatchProofStats
} from './core/batch-proof.js';
export {
  canonicalJsonStringify,
  canonicalJsonParse,
  canonicalCborEncode,
  canonicalCborDecode,
  serialize,
  deserialize,
  hashCanonical,
  serializeMerkleProof,
  deserializeMerkleProof,
  serializeBatchProof,
  deserializeBatchProof,
  serializeConsistencyProof,
  deserializeConsistencyProof,
  serializeSparseMerkleProof,
  deserializeSparseMerkleProof,
  createCompactProof,
  parseCompactProof,
  getProofSize,
  compareSerializationSizes
} from './core/serializer.js';
export type { SerializationFormat, ProofSerializeOptions } from './core/serializer.js';

// Storage exports
export { MemoryStorage } from './storage/memory.js';

// Service exports
export { LedgerService, IdempotencyService } from './services/index.js';
export type { LedgerEvents, LedgerEventEmitter } from './services/index.js';
export {
  IntegrityMonitor,
  createIntegrityMonitor
} from './services/integrity.js';
export type {
  IntegrityAlert,
  AlertSeverity,
  IntegrityMonitorConfig
} from './services/integrity.js';
export {
  RootPublisher,
  createRootPublisher
} from './services/rootPublisher.js';
export type {
  PublishedRoot,
  PublisherTarget,
  RootPublisherConfig
} from './services/rootPublisher.js';

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
  SparseMerkleProof,
  SparseMerkleTreeState,
  BatchProof,
  ConsistencyProof,
  IntegrityCheckResult
} from './types.js';
export { GENESIS_HASH } from './types.js';

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
