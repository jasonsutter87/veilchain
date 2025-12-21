/**
 * VeilChain JavaScript/TypeScript SDK
 *
 * Official SDK for interacting with VeilChain - the append-only Merkle tree ledger service.
 *
 * @packageDocumentation
 *
 * @example Quick Start
 * ```typescript
 * import { VeilChain } from '@veilchain/sdk';
 *
 * const client = new VeilChain({
 *   baseUrl: 'https://api.veilchain.io',
 *   apiKey: 'vc_live_your_api_key'
 * });
 *
 * // Create a ledger
 * const ledger = await client.createLedger({ name: 'audit-log' });
 *
 * // Append an entry
 * const result = await client.appendEntry(ledger.id, {
 *   action: 'user_login',
 *   userId: 'user-123',
 *   timestamp: new Date().toISOString()
 * });
 *
 * // Verify the entry is in the ledger
 * const verified = await client.verifyProofLocal(result.proof);
 * console.log('Entry verified:', verified.valid);
 * ```
 *
 * @example Standalone Verification (Browser/Offline)
 * ```typescript
 * import { verifyProof, hashData } from '@veilchain/sdk/verify';
 *
 * // Verify a proof without network access
 * const result = await verifyProof(proof);
 * if (result.valid) {
 *   console.log('Proof is cryptographically valid!');
 * }
 * ```
 */

// Main client
export { VeilChain } from './client.js';

// Type exports
export type {
  // Configuration
  VeilChainConfig,

  // Ledger types
  Ledger,
  LedgerEntry,
  CreateLedgerOptions,
  ListLedgersOptions,
  ListLedgersResult,

  // Entry types
  AppendEntryOptions,
  AppendEntryResult,
  ListEntriesOptions,
  ListEntriesResult,

  // Proof types
  MerkleProof,
  CompactProof,
  VerifyProofResult,

  // Public API types
  PublicRoot,
  HistoricalRoot,

  // Error types
  ApiError,
} from './types.js';

export { VeilChainError } from './types.js';

// Verification utilities (also available via '@veilchain/sdk/verify')
export {
  verifyProof,
  parseCompactProof,
  toCompactProof,
  hashData,
  verifyData,
  verifyDataWithProof,
} from './verify.js';
