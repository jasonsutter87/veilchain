/**
 * VeilChain Cached Storage Backend
 *
 * A storage wrapper that adds Redis caching on top of PostgreSQL storage.
 * Provides sub-millisecond access for frequently accessed data.
 */

import type {
  StorageBackend,
  LedgerEntry,
  LedgerMetadata,
  MerkleProof,
} from '../types.js';
import { RedisCache } from './redis.js';

/**
 * Cached storage configuration
 */
export interface CachedStorageConfig {
  /** Enable caching for entries */
  cacheEntries?: boolean;
  /** Enable caching for ledger metadata */
  cacheLedgerMetadata?: boolean;
  /** Enable caching for root hashes */
  cacheRootHash?: boolean;
  /** Enable caching for proofs */
  cacheProofs?: boolean;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<CachedStorageConfig> = {
  cacheEntries: true,
  cacheLedgerMetadata: true,
  cacheRootHash: true,
  cacheProofs: true,
};

/**
 * Cached Storage Backend
 *
 * Wraps a primary storage backend (PostgreSQL) with Redis caching
 * for improved read performance.
 *
 * Cache invalidation strategy:
 * - Root hash: Invalidated on every write
 * - Entries: Cached on read, never invalidated (entries are immutable)
 * - Proofs: Invalidated on write (tree structure changes)
 * - Metadata: Invalidated on write
 */
export class CachedStorage implements StorageBackend {
  private readonly primary: StorageBackend;
  private readonly cache: RedisCache;
  private readonly config: Required<CachedStorageConfig>;

  constructor(
    primary: StorageBackend,
    cache: RedisCache,
    config?: CachedStorageConfig
  ) {
    this.primary = primary;
    this.cache = cache;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Store an entry (writes to primary, invalidates cache)
   */
  async put(ledgerId: string, entry: LedgerEntry): Promise<void> {
    // Write to primary storage
    await this.primary.put(ledgerId, entry);

    // Cache the new entry
    if (this.config.cacheEntries) {
      await this.cache.setEntry(ledgerId, entry).catch(() => {});
    }

    // Invalidate affected caches
    await Promise.all([
      this.config.cacheRootHash
        ? this.cache.invalidateRootHash(ledgerId).catch(() => {})
        : Promise.resolve(),
      this.config.cacheProofs
        ? this.cache.invalidateProofs(ledgerId).catch(() => {})
        : Promise.resolve(),
      this.config.cacheLedgerMetadata
        ? this.cache.invalidateLedgerMetadata(ledgerId).catch(() => {})
        : Promise.resolve(),
    ]);
  }

  /**
   * Get an entry by ID (cache-first)
   */
  async get(ledgerId: string, entryId: string): Promise<LedgerEntry | null> {
    // Try cache first
    if (this.config.cacheEntries) {
      const cached = await this.cache.getEntry(ledgerId, entryId).catch(() => null);
      if (cached) return cached;
    }

    // Fall back to primary
    const entry = await this.primary.get(ledgerId, entryId);

    // Cache the result
    if (entry && this.config.cacheEntries) {
      await this.cache.setEntry(ledgerId, entry).catch(() => {});
    }

    return entry;
  }

  /**
   * Get entry by position (cache-first)
   */
  async getByPosition(ledgerId: string, position: bigint): Promise<LedgerEntry | null> {
    // Try cache first
    if (this.config.cacheEntries) {
      const cached = await this.cache.getEntryByPosition(ledgerId, position).catch(() => null);
      if (cached) return cached;
    }

    // Fall back to primary
    const entry = await this.primary.getByPosition(ledgerId, position);

    // Cache the result
    if (entry && this.config.cacheEntries) {
      await this.cache.setEntry(ledgerId, entry).catch(() => {});
    }

    return entry;
  }

  /**
   * List entries with pagination
   */
  async list(
    ledgerId: string,
    options: { offset?: bigint; limit?: number }
  ): Promise<LedgerEntry[]> {
    // Always fetch from primary for list operations
    const entries = await this.primary.list(ledgerId, options);

    // Warm the cache with returned entries
    if (this.config.cacheEntries && entries.length > 0) {
      await this.cache.setEntries(ledgerId, entries).catch(() => {});
    }

    return entries;
  }

  /**
   * Create ledger metadata
   */
  async createLedgerMetadata(metadata: LedgerMetadata): Promise<void> {
    await this.primary.createLedgerMetadata(metadata);

    // Cache the new metadata
    if (this.config.cacheLedgerMetadata) {
      await this.cache.setLedgerMetadata(metadata).catch(() => {});
    }
  }

  /**
   * Get ledger metadata (cache-first)
   */
  async getLedgerMetadata(ledgerId: string): Promise<LedgerMetadata | null> {
    // Try cache first
    if (this.config.cacheLedgerMetadata) {
      const cached = await this.cache.getLedgerMetadata(ledgerId).catch(() => null);
      if (cached) return cached;
    }

    // Fall back to primary
    const metadata = await this.primary.getLedgerMetadata(ledgerId);

    // Cache the result
    if (metadata && this.config.cacheLedgerMetadata) {
      await this.cache.setLedgerMetadata(metadata).catch(() => {});
    }

    return metadata;
  }

  /**
   * Update ledger metadata
   */
  async updateLedgerMetadata(
    ledgerId: string,
    metadata: Partial<LedgerMetadata>
  ): Promise<void> {
    await this.primary.updateLedgerMetadata(ledgerId, metadata);

    // Invalidate cache
    if (this.config.cacheLedgerMetadata) {
      await this.cache.invalidateLedgerMetadata(ledgerId).catch(() => {});
    }

    // Update root hash cache if provided
    if (metadata.rootHash && metadata.entryCount !== undefined && this.config.cacheRootHash) {
      await this.cache.setRootHash(ledgerId, metadata.rootHash, metadata.entryCount).catch(() => {});
    }
  }

  /**
   * List all ledgers with pagination
   */
  async listLedgers(options?: {
    offset?: number;
    limit?: number;
  }): Promise<LedgerMetadata[]> {
    // Always fetch from primary for list operations
    const ledgers = await this.primary.listLedgers(options);

    // Warm cache with results
    if (this.config.cacheLedgerMetadata) {
      for (const ledger of ledgers) {
        await this.cache.setLedgerMetadata(ledger).catch(() => {});
      }
    }

    return ledgers;
  }

  /**
   * Get all leaf hashes for tree reconstruction
   */
  async getAllLeafHashes(ledgerId: string): Promise<string[]> {
    // Always fetch from primary (not cached)
    return this.primary.getAllLeafHashes(ledgerId);
  }

  // ============================================
  // Additional cached methods
  // ============================================

  /**
   * Get root hash with caching
   */
  async getRootHash(ledgerId: string): Promise<{ rootHash: string; entryCount: bigint } | null> {
    // Try cache first
    if (this.config.cacheRootHash) {
      const cached = await this.cache.getRootHash(ledgerId).catch(() => null);
      if (cached) return cached;
    }

    // Fall back to primary
    const metadata = await this.primary.getLedgerMetadata(ledgerId);
    if (!metadata) return null;

    const result = {
      rootHash: metadata.rootHash,
      entryCount: metadata.entryCount,
    };

    // Cache the result
    if (this.config.cacheRootHash) {
      await this.cache.setRootHash(ledgerId, result.rootHash, result.entryCount).catch(() => {});
    }

    return result;
  }

  /**
   * Get proof with caching
   */
  async getProof(ledgerId: string, entryId: string): Promise<MerkleProof | null> {
    if (this.config.cacheProofs) {
      return this.cache.getProof(ledgerId, entryId).catch(() => null);
    }
    return null;
  }

  /**
   * Cache a proof
   */
  async setProof(ledgerId: string, entryId: string, proof: MerkleProof): Promise<void> {
    if (this.config.cacheProofs) {
      await this.cache.setProof(ledgerId, entryId, proof).catch(() => {});
    }
  }

  // ============================================
  // Cache management
  // ============================================

  /**
   * Get the underlying cache
   */
  getCache(): RedisCache {
    return this.cache;
  }

  /**
   * Get the underlying primary storage
   */
  getPrimary(): StorageBackend {
    return this.primary;
  }

  /**
   * Warm the cache for a ledger
   */
  async warmCache(ledgerId: string, options?: {
    entries?: number;
    includeMetadata?: boolean;
    includeRootHash?: boolean;
  }): Promise<void> {
    const { entries = 100, includeMetadata = true, includeRootHash = true } = options ?? {};

    // Warm metadata cache
    if (includeMetadata && this.config.cacheLedgerMetadata) {
      const metadata = await this.primary.getLedgerMetadata(ledgerId);
      if (metadata) {
        await this.cache.setLedgerMetadata(metadata).catch(() => {});

        // Also warm root hash cache
        if (includeRootHash && this.config.cacheRootHash) {
          await this.cache.setRootHash(ledgerId, metadata.rootHash, metadata.entryCount).catch(() => {});
        }
      }
    }

    // Warm entry cache with recent entries
    if (this.config.cacheEntries && entries > 0) {
      const recentEntries = await this.primary.list(ledgerId, { limit: entries });
      if (recentEntries.length > 0) {
        await this.cache.setEntries(ledgerId, recentEntries).catch(() => {});
      }
    }
  }

  /**
   * Invalidate all cache for a ledger
   */
  async invalidateLedgerCache(ledgerId: string): Promise<void> {
    await Promise.all([
      this.cache.invalidateRootHash(ledgerId).catch(() => {}),
      this.cache.invalidateProofs(ledgerId).catch(() => {}),
      this.cache.invalidateLedgerMetadata(ledgerId).catch(() => {}),
    ]);
  }
}
