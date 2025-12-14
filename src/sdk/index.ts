/**
 * VeilChain SDK
 *
 * Complete client library for VeilChain Merkle ledger service.
 *
 * @example Online Usage
 * ```typescript
 * import { VeilChainClient } from '@veilchain/sdk';
 *
 * const client = new VeilChainClient({
 *   apiKey: 'your-api-key',
 *   baseUrl: 'https://api.veilchain.com'
 * });
 *
 * // Create a ledger
 * const ledger = await client.createLedger({ name: 'audit-log' });
 *
 * // Append entries
 * const entry = await client.append(ledger.id, { event: 'login', user: 'alice' });
 *
 * // Get proof
 * const proof = await client.getProof(ledger.id, entry.entry.id);
 * ```
 *
 * @example Offline Verification
 * ```typescript
 * import { verifyProofOffline } from '@veilchain/sdk';
 *
 * // Verify without network access
 * const isValid = verifyProofOffline(proof);
 * ```
 *
 * @packageDocumentation
 */

// Client exports
export { VeilChainClient } from './client.js';

// Offline verification exports
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
} from './offline.js';

// Error exports
export {
  VeilChainError,
  NetworkError,
  AuthenticationError,
  ValidationError,
  NotFoundError,
  ProofVerificationError,
  RateLimitError,
  ServerError,
  isRetryableError,
  parseErrorResponse
} from './errors.js';

// Type exports
export type {
  VeilChainClientConfig,
  ApiResponse,
  ListLedgersResponse,
  ListEntriesResponse,
  PaginationOptions,
  GetProofOptions,
  CreateLedgerResponse,
  AppendEntryResponse,
  GetProofResponse,
  BatchAppendRequest,
  BatchAppendResponse,
  HealthCheckResponse
} from './types.js';

// Re-export core types for convenience
export type {
  MerkleProof,
  SerializedProof,
  ProofVerificationResult,
  LedgerEntry,
  LedgerMetadata,
  CreateLedgerOptions,
  AppendOptions,
  AppendResult
} from '../types.js';
