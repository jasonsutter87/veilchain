/**
 * VeilChain HTTP Client
 *
 * Provides a complete client for interacting with the VeilChain API.
 * Features:
 * - Automatic retry with exponential backoff
 * - Request/response type safety
 * - Error handling with custom error classes
 * - Works in both browser and Node.js
 */

import type {
  VeilChainClientConfig,
  RequestOptions,
  ApiResponse,
  CreateLedgerResponse,
  ListLedgersResponse,
  AppendEntryResponse,
  GetProofResponse,
  ListEntriesResponse,
  PaginationOptions,
  GetProofOptions,
  HealthCheckResponse,
  BatchAppendRequest,
  BatchAppendResponse
} from './types.js';
import type {
  LedgerMetadata,
  LedgerEntry,
  MerkleProof,
  AppendResult,
  CreateLedgerOptions,
  AppendOptions
} from '../types.js';
import {
  VeilChainError,
  NetworkError,
  parseErrorResponse,
  isRetryableError
} from './errors.js';

/**
 * VeilChain API Client
 *
 * @example
 * ```typescript
 * const client = new VeilChainClient({
 *   apiKey: 'your-api-key',
 *   baseUrl: 'https://api.veilchain.com'
 * });
 *
 * const ledger = await client.createLedger({ name: 'audit-log' });
 * const entry = await client.append(ledger.id, { event: 'login' });
 * const proof = await client.getProof(ledger.id, entry.id);
 * ```
 */
export class VeilChainClient {
  private readonly config: Required<VeilChainClientConfig>;

  constructor(config: VeilChainClientConfig) {
    // Validate configuration
    if (!config.baseUrl) {
      throw new VeilChainError('baseUrl is required');
    }
    if (!config.apiKey) {
      throw new VeilChainError('apiKey is required');
    }

    // Set defaults
    this.config = {
      baseUrl: config.baseUrl.replace(/\/$/, ''), // Remove trailing slash
      apiKey: config.apiKey,
      timeout: config.timeout ?? 30000,
      maxRetries: config.maxRetries ?? 3,
      retryDelay: config.retryDelay ?? 1000,
      headers: config.headers ?? {}
    };
  }

  /**
   * Create a new ledger
   */
  async createLedger(options: CreateLedgerOptions): Promise<LedgerMetadata> {
    const response = await this.request<CreateLedgerResponse>({
      method: 'POST',
      path: '/ledgers',
      body: options
    });
    return response.ledger;
  }

  /**
   * Get a ledger by ID
   */
  async getLedger(ledgerId: string): Promise<LedgerMetadata> {
    return this.request<LedgerMetadata>({
      method: 'GET',
      path: `/ledgers/${ledgerId}`
    });
  }

  /**
   * List all ledgers with pagination
   */
  async listLedgers(options?: PaginationOptions): Promise<ListLedgersResponse> {
    return this.request<ListLedgersResponse>({
      method: 'GET',
      path: '/ledgers',
      query: {
        offset: options?.offset,
        limit: options?.limit
      }
    });
  }

  /**
   * Delete a ledger
   */
  async deleteLedger(ledgerId: string): Promise<void> {
    await this.request<void>({
      method: 'DELETE',
      path: `/ledgers/${ledgerId}`
    });
  }

  /**
   * Append an entry to a ledger
   */
  async append<T = unknown>(
    ledgerId: string,
    data: T,
    options?: AppendOptions
  ): Promise<AppendResult<T>> {
    const response = await this.request<AppendEntryResponse<T>>({
      method: 'POST',
      path: `/ledgers/${ledgerId}/entries`,
      body: {
        data,
        ...options
      }
    });
    return response.result;
  }

  /**
   * Batch append multiple entries
   */
  async batchAppend<T = unknown>(
    ledgerId: string,
    entries: Array<{ data: T; idempotencyKey?: string }>
  ): Promise<BatchAppendResponse<T>> {
    const request: BatchAppendRequest = { entries };
    return this.request<BatchAppendResponse<T>>({
      method: 'POST',
      path: `/ledgers/${ledgerId}/entries/batch`,
      body: request
    });
  }

  /**
   * Get an entry by ID
   */
  async getEntry<T = unknown>(
    ledgerId: string,
    entryId: string
  ): Promise<LedgerEntry<T>> {
    return this.request<LedgerEntry<T>>({
      method: 'GET',
      path: `/ledgers/${ledgerId}/entries/${entryId}`
    });
  }

  /**
   * Get an entry by position
   */
  async getEntryByPosition<T = unknown>(
    ledgerId: string,
    position: number | bigint
  ): Promise<LedgerEntry<T>> {
    return this.request<LedgerEntry<T>>({
      method: 'GET',
      path: `/ledgers/${ledgerId}/entries/position/${position}`
    });
  }

  /**
   * List entries with pagination
   */
  async listEntries<T = unknown>(
    ledgerId: string,
    options?: PaginationOptions
  ): Promise<ListEntriesResponse<T>> {
    return this.request<ListEntriesResponse<T>>({
      method: 'GET',
      path: `/ledgers/${ledgerId}/entries`,
      query: {
        offset: options?.offset,
        limit: options?.limit
      }
    });
  }

  /**
   * Get a Merkle proof for an entry
   */
  async getProof(
    ledgerId: string,
    entryId: string,
    options?: GetProofOptions
  ): Promise<MerkleProof> {
    const response = await this.request<GetProofResponse>({
      method: 'GET',
      path: `/ledgers/${ledgerId}/entries/${entryId}/proof`,
      query: {
        includeEntry: options?.includeEntry,
        serialize: options?.serialize
      }
    });
    return response.proof;
  }

  /**
   * Get current root hash of a ledger
   */
  async getRootHash(ledgerId: string): Promise<string> {
    const ledger = await this.getLedger(ledgerId);
    return ledger.rootHash;
  }

  /**
   * Health check endpoint
   */
  async health(): Promise<HealthCheckResponse> {
    return this.request<HealthCheckResponse>({
      method: 'GET',
      path: '/health',
      skipRetry: true
    });
  }

  /**
   * Internal request method with retry logic
   */
  private async request<T>(options: RequestOptions): Promise<T> {
    const { method, path, body, query, headers = {}, timeout, skipRetry } = options;

    // Build URL with query parameters
    const url = new URL(path, this.config.baseUrl);
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    // Build request headers
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey}`,
      'User-Agent': 'VeilChain-SDK/0.1.0',
      ...this.config.headers,
      ...headers
    };

    // Execute with retry logic
    let lastError: Error | undefined;
    const maxAttempts = skipRetry ? 1 : this.config.maxRetries + 1;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        // Add delay for retries
        if (attempt > 0) {
          const delay = this.config.retryDelay * Math.pow(2, attempt - 1);
          await this.sleep(delay);
        }

        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          timeout ?? this.config.timeout
        );

        try {
          // Execute fetch request
          const response = await fetch(url.toString(), {
            method,
            headers: requestHeaders,
            body: body ? JSON.stringify(body) : undefined,
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          // Handle non-2xx responses
          if (!response.ok) {
            let errorBody: any;
            try {
              errorBody = await response.json();
            } catch {
              errorBody = { message: await response.text() };
            }

            const error = parseErrorResponse(
              response.status,
              errorBody
            );

            // Check if we should retry
            if (!skipRetry && attempt < maxAttempts - 1 && isRetryableError(error)) {
              lastError = error;
              continue;
            }

            throw error;
          }

          // Parse successful response
          const contentType = response.headers.get('content-type');
          if (contentType?.includes('application/json')) {
            const data = await response.json();

            // Handle wrapped API responses
            if (data && typeof data === 'object' && 'success' in data) {
              const apiResponse = data as ApiResponse<T>;
              if (!apiResponse.success && apiResponse.error) {
                throw new VeilChainError(
                  apiResponse.error.message,
                  apiResponse.error.code
                );
              }
              return apiResponse.data as T;
            }

            return data as T;
          }

          // No content responses
          if (response.status === 204) {
            return undefined as T;
          }

          throw new VeilChainError('Unexpected response format');

        } catch (error) {
          clearTimeout(timeoutId);

          // Handle abort/timeout
          if (error instanceof Error && error.name === 'AbortError') {
            const timeoutError = new NetworkError('Request timeout', 408);
            if (!skipRetry && attempt < maxAttempts - 1) {
              lastError = timeoutError;
              continue;
            }
            throw timeoutError;
          }

          throw error;
        }

      } catch (error) {
        // Convert unknown errors to NetworkError for retry logic
        if (!(error instanceof VeilChainError)) {
          const networkError = new NetworkError(
            error instanceof Error ? error.message : 'Unknown error'
          );

          if (!skipRetry && attempt < maxAttempts - 1 && isRetryableError(networkError)) {
            lastError = networkError;
            continue;
          }

          throw networkError;
        }

        // Check if VeilChainError is retryable
        if (!skipRetry && attempt < maxAttempts - 1 && isRetryableError(error)) {
          lastError = error;
          continue;
        }

        throw error;
      }
    }

    // If we exhausted all retries, throw the last error
    throw lastError || new NetworkError('Max retries exceeded');
  }

  /**
   * Sleep helper for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
