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
 * Rate limit tier for subscription levels
 */
export type RateLimitTier = 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';

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
    /** Rate limit tier (FREE, STARTER, PRO, ENTERPRISE) */
    tier?: RateLimitTier;
    /** Maximum requests per time window (overrides tier) */
    max?: number;
    /** Time window in string format (e.g., '1 second') */
    timeWindow?: string;
    /** Daily request limit (overrides tier) */
    dailyLimit?: number;
    /** Enable per-endpoint rate limits (stricter for writes, lenient for reads) */
    enableEndpointLimits?: boolean;
  };
  /** Enable request logging */
  logging?: boolean;
  /** Storage backend: 'memory' or 'postgres' */
  storage?: 'memory' | 'postgres';
  /** Validation configuration */
  validation?: {
    /** Maximum size for entry data in bytes (default: 1MB) */
    maxEntrySize?: number;
    /** Maximum length for ledger names (default: 255 chars) */
    maxNameLength?: number;
    /** Maximum length for descriptions (default: 1000 chars) */
    maxDescriptionLength?: number;
    /** Maximum size for batch payloads in bytes (default: 10MB) */
    maxBatchSize?: number;
  };
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
  schema?: Record<string, unknown>;
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
  schema?: Record<string, unknown>;
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
    status: string;
    type?: string;
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
 * List entries response
 */
export interface ListEntriesResponse<T = unknown> {
  entries: Array<{
    id: string;
    position: string;
    data: T;
    hash: string;
    createdAt: string;
  }>;
  total: string;
  offset: string;
  limit: number;
}

/**
 * List ledgers response
 */
export interface ListLedgersResponse {
  ledgers: Array<{
    id: string;
    name: string;
    description?: string;
    rootHash: string;
    entryCount: string;
    createdAt: string;
    lastEntryAt?: string;
  }>;
  total: number;
  offset: number;
  limit: number;
}

/**
 * Request body for batch appending entries
 */
export interface BatchAppendRequest<T = unknown> {
  entries: Array<{
    data: T;
    idempotencyKey?: string;
    metadata?: Record<string, unknown>;
  }>;
}

/**
 * Response for batch append
 */
export interface BatchAppendResponse<T = unknown> {
  results: Array<{
    success: boolean;
    entry?: {
      id: string;
      position: string;
      data: T;
      hash: string;
      createdAt: string;
    };
    proof?: MerkleProof;
    error?: {
      code: string;
      message: string;
    };
  }>;
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
  previousRoot: string;
  newRoot: string;
}

/**
 * Public root response (no authentication required)
 * Allows anyone to verify the current state of a ledger
 */
export interface PublicRootResponse {
  ledgerId: string;
  rootHash: string;
  entryCount: string;
  timestamp: string;
  /** Optional signature if signing key is configured */
  signature?: string;
}

/**
 * Public historical roots response
 */
export interface PublicRootsResponse {
  ledgerId: string;
  roots: Array<{
    rootHash: string;
    entryCount: string;
    timestamp: string;
    signature?: string;
  }>;
  total: number;
  offset: number;
  limit: number;
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

  listLedgers(options?: {
    offset?: number;
    limit?: number;
  }): Promise<{
    ledgers: CoreLedgerMetadata[];
    total: number;
  }>;

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

  listEntries<T = unknown>(
    ledgerId: string,
    options?: {
      offset?: bigint;
      limit?: number;
    }
  ): Promise<{
    entries: CoreLedgerEntry<T>[];
    total: bigint;
  }>;

  getProof(ledgerId: string, entryId: string): Promise<MerkleProof | null>;

  getCurrentRoot(ledgerId: string): Promise<{
    rootHash: string;
    entryCount: bigint;
    lastEntryAt?: Date;
  } | null>;
}
