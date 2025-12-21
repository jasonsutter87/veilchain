/**
 * VeilChain SDK Client
 *
 * Main client for interacting with the VeilChain API.
 */

import type {
  VeilChainConfig,
  Ledger,
  LedgerEntry,
  MerkleProof,
  CreateLedgerOptions,
  AppendEntryOptions,
  AppendEntryResult,
  ListEntriesOptions,
  ListEntriesResult,
  ListLedgersOptions,
  ListLedgersResult,
  VerifyProofResult,
  PublicRoot,
  HistoricalRoot,
} from './types.js';
import { VeilChainError } from './types.js';
import { verifyProof as localVerifyProof } from './verify.js';

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Partial<VeilChainConfig> = {
  timeout: 30000,
  retries: 3,
};

/**
 * VeilChain SDK Client
 *
 * @example
 * ```typescript
 * import { VeilChain } from '@veilchain/sdk';
 *
 * const client = new VeilChain({
 *   baseUrl: 'https://api.veilchain.io',
 *   apiKey: 'vc_live_...'
 * });
 *
 * // Create a ledger
 * const ledger = await client.createLedger({ name: 'votes' });
 *
 * // Append an entry
 * const result = await client.appendEntry(ledger.id, { vote: 'yes' });
 *
 * // Verify the entry
 * const verified = await client.verifyProof(result.proof);
 * ```
 */
export class VeilChain {
  private readonly config: Required<Pick<VeilChainConfig, 'baseUrl' | 'timeout' | 'retries'>> & VeilChainConfig;
  private readonly fetchImpl: typeof fetch;

  constructor(config: VeilChainConfig) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    } as Required<Pick<VeilChainConfig, 'baseUrl' | 'timeout' | 'retries'>> & VeilChainConfig;

    // Use provided fetch or global fetch
    this.fetchImpl = config.fetch || globalThis.fetch;

    if (!this.fetchImpl) {
      throw new VeilChainError('No fetch implementation available. Please provide one via config.fetch');
    }
  }

  /**
   * Make an authenticated API request
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options?: { skipAuth?: boolean }
  ): Promise<T> {
    const url = `${this.config.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (!options?.skipAuth) {
      if (this.config.token) {
        headers['Authorization'] = `Bearer ${this.config.token}`;
      } else if (this.config.apiKey) {
        headers['X-API-Key'] = this.config.apiKey;
      }
    }

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.config.retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        const response = await this.fetchImpl(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          throw new VeilChainError(
            errorBody.error?.message || `HTTP ${response.status}`,
            {
              status: response.status,
              code: errorBody.error?.code,
              details: errorBody.error?.details,
            }
          );
        }

        return await response.json();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on client errors (4xx)
        if (error instanceof VeilChainError && error.status && error.status >= 400 && error.status < 500) {
          throw error;
        }

        // Wait before retry with exponential backoff
        if (attempt < this.config.retries) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100));
        }
      }
    }

    throw lastError || new VeilChainError('Request failed after retries');
  }

  // ============================================================
  // Ledger Operations
  // ============================================================

  /**
   * Create a new ledger
   *
   * @param options - Ledger creation options
   * @returns The created ledger
   *
   * @example
   * ```typescript
   * const ledger = await client.createLedger({
   *   name: 'election-2024',
   *   description: 'Presidential election votes'
   * });
   * ```
   */
  async createLedger(options: CreateLedgerOptions): Promise<Ledger> {
    return this.request<Ledger>('POST', '/v1/ledgers', options);
  }

  /**
   * Get a ledger by ID
   *
   * @param ledgerId - The ledger ID
   * @returns The ledger metadata or null if not found
   */
  async getLedger(ledgerId: string): Promise<Ledger | null> {
    try {
      return await this.request<Ledger>('GET', `/v1/ledgers/${ledgerId}`);
    } catch (error) {
      if (error instanceof VeilChainError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * List all ledgers
   *
   * @param options - Pagination options
   * @returns Paginated list of ledgers
   */
  async listLedgers(options?: ListLedgersOptions): Promise<ListLedgersResult> {
    const params = new URLSearchParams();
    if (options?.offset) params.set('offset', options.offset.toString());
    if (options?.limit) params.set('limit', options.limit.toString());

    const query = params.toString();
    return this.request<ListLedgersResult>('GET', `/v1/ledgers${query ? `?${query}` : ''}`);
  }

  /**
   * Delete a ledger (soft delete)
   *
   * @param ledgerId - The ledger ID to delete
   */
  async deleteLedger(ledgerId: string): Promise<void> {
    await this.request<void>('DELETE', `/v1/ledgers/${ledgerId}`);
  }

  // ============================================================
  // Entry Operations
  // ============================================================

  /**
   * Append an entry to a ledger
   *
   * @param ledgerId - The target ledger ID
   * @param data - The entry data
   * @param options - Append options (idempotency key, metadata)
   * @returns The created entry with proof
   *
   * @example
   * ```typescript
   * const result = await client.appendEntry('ledger-123', {
   *   vote: 'yes',
   *   timestamp: Date.now()
   * }, {
   *   idempotencyKey: 'vote-alice-2024'
   * });
   *
   * console.log('Entry ID:', result.entry.id);
   * console.log('New root:', result.newRoot);
   * ```
   */
  async appendEntry<T = unknown>(
    ledgerId: string,
    data: T,
    options?: AppendEntryOptions
  ): Promise<AppendEntryResult<T>> {
    return this.request<AppendEntryResult<T>>('POST', `/v1/ledgers/${ledgerId}/entries`, {
      data,
      ...options,
    });
  }

  /**
   * Get an entry by ID
   *
   * @param ledgerId - The ledger ID
   * @param entryId - The entry ID
   * @param includeProof - Whether to include the Merkle proof
   * @returns The entry or null if not found
   */
  async getEntry<T = unknown>(
    ledgerId: string,
    entryId: string,
    includeProof = false
  ): Promise<LedgerEntry<T> | null> {
    try {
      const params = includeProof ? '?proof=true' : '';
      return await this.request<LedgerEntry<T>>('GET', `/v1/ledgers/${ledgerId}/entries/${entryId}${params}`);
    } catch (error) {
      if (error instanceof VeilChainError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * List entries in a ledger
   *
   * @param ledgerId - The ledger ID
   * @param options - Pagination options
   * @returns Paginated list of entries
   */
  async listEntries<T = unknown>(
    ledgerId: string,
    options?: ListEntriesOptions
  ): Promise<ListEntriesResult<T>> {
    const params = new URLSearchParams();
    if (options?.offset) params.set('offset', options.offset.toString());
    if (options?.limit) params.set('limit', options.limit.toString());

    const query = params.toString();
    return this.request<ListEntriesResult<T>>('GET', `/v1/ledgers/${ledgerId}/entries${query ? `?${query}` : ''}`);
  }

  // ============================================================
  // Proof Operations
  // ============================================================

  /**
   * Get an inclusion proof for an entry
   *
   * @param ledgerId - The ledger ID
   * @param entryId - The entry ID
   * @returns The Merkle proof
   */
  async getProof(ledgerId: string, entryId: string): Promise<MerkleProof> {
    const response = await this.request<{ proof: MerkleProof }>('GET', `/v1/ledgers/${ledgerId}/proof/${entryId}`);
    return response.proof;
  }

  /**
   * Verify a proof locally (offline)
   *
   * This verifies the proof cryptographically without network access.
   *
   * @param proof - The Merkle proof to verify
   * @returns Verification result
   */
  async verifyProofLocal(proof: MerkleProof): Promise<VerifyProofResult> {
    return localVerifyProof(proof);
  }

  /**
   * Verify a proof via the API
   *
   * @param proof - The Merkle proof to verify
   * @returns Verification result
   */
  async verifyProof(proof: MerkleProof): Promise<VerifyProofResult> {
    return this.request<VerifyProofResult>('POST', '/v1/verify', { proof });
  }

  // ============================================================
  // Public (Unauthenticated) Operations
  // ============================================================

  /**
   * Get the current root hash of a ledger (public, no auth required)
   *
   * This endpoint can be used by anyone to verify the current state
   * of a ledger without authentication.
   *
   * @param ledgerId - The ledger ID
   * @returns The current root information
   */
  async getPublicRoot(ledgerId: string): Promise<PublicRoot> {
    return this.request<PublicRoot>('GET', `/v1/public/ledgers/${ledgerId}/root`, undefined, { skipAuth: true });
  }

  /**
   * Get historical root hashes (public, no auth required)
   *
   * @param ledgerId - The ledger ID
   * @param options - Pagination options
   * @returns Paginated list of historical roots
   */
  async getPublicRoots(
    ledgerId: string,
    options?: { offset?: number; limit?: number }
  ): Promise<{ ledgerId: string; roots: HistoricalRoot[]; total: number; offset: number; limit: number }> {
    const params = new URLSearchParams();
    if (options?.offset) params.set('offset', options.offset.toString());
    if (options?.limit) params.set('limit', options.limit.toString());

    const query = params.toString();
    return this.request('GET', `/v1/public/ledgers/${ledgerId}/roots${query ? `?${query}` : ''}`, undefined, { skipAuth: true });
  }

  /**
   * Verify a proof via the public API (no auth required)
   *
   * @param proof - The Merkle proof to verify
   * @returns Verification result
   */
  async verifyPublic(proof: MerkleProof): Promise<VerifyProofResult> {
    return this.request<VerifyProofResult>('POST', '/v1/public/verify', { proof }, { skipAuth: true });
  }

  // ============================================================
  // Utility Methods
  // ============================================================

  /**
   * Get the current root hash of a ledger
   *
   * @param ledgerId - The ledger ID
   * @returns The current root hash and entry count
   */
  async getCurrentRoot(ledgerId: string): Promise<{ rootHash: string; entryCount: string }> {
    const response = await this.request<{ rootHash: string; entryCount: string }>('GET', `/v1/ledgers/${ledgerId}/root`);
    return response;
  }

  /**
   * Health check
   *
   * @returns API health status
   */
  async health(): Promise<{ status: string; version: string }> {
    return this.request<{ status: string; version: string }>('GET', '/health', undefined, { skipAuth: true });
  }

  /**
   * Update authentication token
   *
   * @param token - New JWT token
   */
  setToken(token: string): void {
    this.config.token = token;
  }

  /**
   * Update API key
   *
   * @param apiKey - New API key
   */
  setApiKey(apiKey: string): void {
    this.config.apiKey = apiKey;
  }
}
