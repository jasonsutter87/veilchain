/**
 * VeilChain SDK Type Definitions
 *
 * API request/response types for the SDK client.
 */

import type {
  LedgerMetadata,
  LedgerEntry,
  MerkleProof,
  AppendResult
} from '../types.js';

/**
 * SDK client configuration
 */
export interface VeilChainClientConfig {
  /** API base URL (e.g., https://api.veilchain.com) */
  baseUrl: string;
  /** API key for authentication */
  apiKey: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Maximum retry attempts for failed requests (default: 3) */
  maxRetries?: number;
  /** Retry delay in milliseconds (default: 1000) */
  retryDelay?: number;
  /** Custom headers to include in all requests */
  headers?: Record<string, string>;
}

/**
 * API response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  metadata?: {
    requestId?: string;
    timestamp?: string;
  };
}

/**
 * Ledger list response
 */
export interface ListLedgersResponse {
  ledgers: LedgerMetadata[];
  total: number;
  offset: number;
  limit: number;
}

/**
 * Entry list response
 */
export interface ListEntriesResponse<T = unknown> {
  entries: LedgerEntry<T>[];
  total: number;
  offset: number;
  limit: number;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  offset?: number;
  limit?: number;
}

/**
 * Proof request options
 */
export interface GetProofOptions {
  /** Include the full entry data in the response */
  includeEntry?: boolean;
  /** Serialize the proof for compact storage */
  serialize?: boolean;
}

/**
 * Ledger creation response
 */
export interface CreateLedgerResponse {
  ledger: LedgerMetadata;
}

/**
 * Entry append response
 */
export interface AppendEntryResponse<T = unknown> {
  result: AppendResult<T>;
}

/**
 * Proof response
 */
export interface GetProofResponse {
  proof: MerkleProof;
  entry?: LedgerEntry;
  serialized?: string;
}

/**
 * Batch append request
 */
export interface BatchAppendRequest {
  entries: Array<{
    data: unknown;
    idempotencyKey?: string;
  }>;
}

/**
 * Batch append response
 */
export interface BatchAppendResponse<T = unknown> {
  results: AppendResult<T>[];
  failed: Array<{
    index: number;
    error: string;
  }>;
}

/**
 * Health check response
 */
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  timestamp: string;
}

/**
 * Request options for internal use
 */
export interface RequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
  timeout?: number;
  skipRetry?: boolean;
}
