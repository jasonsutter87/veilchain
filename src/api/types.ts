/**
 * VeilChain REST API Type Definitions
 */

import type { FastifyRequest } from 'fastify';
import type {
  MerkleProof,
  LedgerEntry as CoreLedgerEntry,
  LedgerMetadata as CoreLedgerMetadata
} from '../types.js';

// Re-export core types for use in API
export type { MerkleProof, LedgerEntry, LedgerMetadata } from '../types.js';

/**
 * API configuration options
 */
export interface ApiConfig {
  /** Port to listen on */
  port: number;
  /** Host to bind to */
  host: string;
  /** API key for authentication */
  apiKey?: string;
  /** Enable CORS */
  cors?: boolean;
  /** Rate limit configuration */
  rateLimit?: {
    max: number;
    timeWindow: string;
  };
  /** Enable request logging */
  logging?: boolean;
}

/**
 * Request body for creating a ledger
 */
export interface CreateLedgerRequest {
  name: string;
  description?: string;
  schema?: Record<string, unknown>;
}

/**
 * Response for ledger creation
 */
export interface CreateLedgerResponse {
  id: string;
  name: string;
  description?: string;
  rootHash: string;
  createdAt: string;
  entryCount: string;
}

/**
 * Response for ledger metadata
 */
export interface GetLedgerResponse {
  id: string;
  name: string;
  description?: string;
  rootHash: string;
  entryCount: string;
  createdAt: string;
  lastEntryAt?: string;
}

/**
 * Request body for appending an entry
 */
export interface AppendEntryRequest<T = unknown> {
  data: T;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Response for entry append
 */
export interface AppendEntryResponse<T = unknown> {
  entry: {
    id: string;
    position: string;
    data: T;
    hash: string;
    createdAt: string;
  };
  proof: MerkleProof;
  previousRoot: string;
  newRoot: string;
}

/**
 * Response for entry retrieval
 */
export interface GetEntryResponse<T = unknown> {
  id: string;
  position: string;
  data: T;
  hash: string;
  createdAt: string;
  proof?: MerkleProof;
}

/**
 * Response for root hash
 */
export interface GetRootResponse {
  rootHash: string;
  entryCount: string;
  lastEntryAt?: string;
}

/**
 * Response for proof retrieval
 */
export interface GetProofResponse {
  proof: MerkleProof;
  entry: {
    id: string;
    position: string;
    hash: string;
  };
}

/**
 * Request body for proof verification
 */
export interface VerifyProofRequest {
  proof: MerkleProof;
}

/**
 * Response for proof verification
 */
export interface VerifyProofResponse {
  valid: boolean;
  leaf: string;
  root: string;
  index: number;
  proofLength: number;
  error?: string;
}

/**
 * Health check response
 */
export interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  version: string;
  uptime: number;
  timestamp: string;
  storage?: {
    status: 'ok' | 'error';
    ledgers: number;
    totalEntries: number;
  };
}

/**
 * Error response
 */
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Authenticated request with API key
 */
export interface AuthenticatedRequest extends FastifyRequest {
  apiKey?: string;
}

/**
 * Ledger service interface for API routes
 */
export interface LedgerService {
  createLedger(options: {
    name: string;
    description?: string;
    schema?: Record<string, unknown>;
  }): Promise<CoreLedgerMetadata>;

  getLedger(ledgerId: string): Promise<CoreLedgerMetadata | null>;

  appendEntry<T = unknown>(
    ledgerId: string,
    data: T,
    options?: {
      idempotencyKey?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<{
    entry: CoreLedgerEntry<T>;
    proof: MerkleProof;
    previousRoot: string;
    newRoot: string;
  }>;

  getEntry<T = unknown>(
    ledgerId: string,
    entryId: string,
    includeProof?: boolean
  ): Promise<CoreLedgerEntry<T> | null>;

  getProof(ledgerId: string, entryId: string): Promise<MerkleProof | null>;

  getCurrentRoot(ledgerId: string): Promise<{
    rootHash: string;
    entryCount: bigint;
    lastEntryAt?: Date;
  } | null>;
}
