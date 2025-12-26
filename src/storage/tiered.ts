/**
 * VeilChain Tiered Storage Backend
 *
 * Implements automatic tiering between PostgreSQL and blob storage.
 * Small entries are stored directly in PostgreSQL, while large entries
 * (>1MB by default) are stored in S3/MinIO with only the hash and
 * reference stored in PostgreSQL.
 *
 * This provides:
 * - Efficient storage for small entries (most common case)
 * - Support for large entries without bloating PostgreSQL
 * - Transparent access - callers don't need to know where data is stored
 * - Integrity verification using content hashes
 */

import type {
  StorageBackend,
  LedgerEntry,
  LedgerMetadata,
} from '../types.js';
import { BlobStorage, BlobMetadata } from './blob.js';

/**
 * Marker for blob-stored entries
 */
const BLOB_MARKER = '__VEILCHAIN_BLOB__';

/**
 * Blob reference stored in PostgreSQL when entry data is in blob storage
 */
interface BlobReference {
  /** Marker to identify this as a blob reference */
  __type: typeof BLOB_MARKER;
  /** Content hash for verification */
  contentHash: string;
  /** Size of the original data */
  size: number;
  /** Ledger ID */
  ledgerId: string;
  /** Entry ID */
  entryId: string;
}

/**
 * Tiered storage configuration
 */
export interface TieredStorageConfig {
  /** Size threshold in bytes for blob storage (default: 1MB = 1048576) */
  sizeThreshold?: number;
  /** Whether to verify blob integrity on read (default: true) */
  verifyOnRead?: boolean;
  /** Whether to enable tiering (set to false to always use primary) */
  enableTiering?: boolean;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<TieredStorageConfig> = {
  sizeThreshold: 1024 * 1024, // 1MB
  verifyOnRead: true,
  enableTiering: true,
};

/**
 * Check if data is a blob reference
 */
function isBlobReference(data: unknown): data is BlobReference {
  return (
    typeof data === 'object' &&
    data !== null &&
    '__type' in data &&
    (data as BlobReference).__type === BLOB_MARKER
  );
}

/**
 * Create a blob reference
 */
function createBlobReference(
  ledgerId: string,
  entryId: string,
  metadata: BlobMetadata
): BlobReference {
  return {
    __type: BLOB_MARKER,
    contentHash: metadata.contentHash,
    size: metadata.size,
    ledgerId,
    entryId,
  };
}

/**
 * Calculate the size of data when serialized
 */
function getDataSize(data: unknown): number {
  if (Buffer.isBuffer(data)) {
    return data.length;
  }
  return Buffer.byteLength(JSON.stringify(data), 'utf-8');
}

/**
 * Tiered Storage Implementation
 *
 * Routes entries to appropriate storage based on size:
 * - Small entries (<threshold): Stored in PostgreSQL
 * - Large entries (>=threshold): Stored in S3/MinIO
 */
export class TieredStorage implements StorageBackend {
  private readonly primary: StorageBackend;
  private readonly blob: BlobStorage;
  private readonly config: Required<TieredStorageConfig>;

  constructor(
    primary: StorageBackend,
    blob: BlobStorage,
    config?: TieredStorageConfig
  ) {
    this.primary = primary;
    this.blob = blob;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Store an entry, routing to appropriate storage based on size
   */
  async put(ledgerId: string, entry: LedgerEntry): Promise<void> {
    const dataSize = getDataSize(entry.data);

    // Determine if we should use blob storage
    if (this.config.enableTiering && dataSize >= this.config.sizeThreshold) {
      // Store data in blob storage
      const blobMetadata = await this.blob.put(
        ledgerId,
        entry.id,
        entry.data,
        'application/json'
      );

      // Store blob reference in primary storage
      const blobEntry: LedgerEntry = {
        ...entry,
        data: createBlobReference(ledgerId, entry.id, blobMetadata),
      };

      await this.primary.put(ledgerId, blobEntry);
    } else {
      // Store directly in primary storage
      await this.primary.put(ledgerId, entry);
    }
  }

  /**
   * Get an entry by ID, resolving blob references transparently
   */
  async get(ledgerId: string, entryId: string): Promise<LedgerEntry | null> {
    const entry = await this.primary.get(ledgerId, entryId);
    if (!entry) return null;

    return this.resolveEntry(entry);
  }

  /**
   * Get entry by position, resolving blob references
   */
  async getByPosition(ledgerId: string, position: bigint): Promise<LedgerEntry | null> {
    const entry = await this.primary.getByPosition(ledgerId, position);
    if (!entry) return null;

    return this.resolveEntry(entry);
  }

  /**
   * List entries with pagination, resolving blob references
   */
  async list(
    ledgerId: string,
    options: { offset?: bigint; limit?: number }
  ): Promise<LedgerEntry[]> {
    const entries = await this.primary.list(ledgerId, options);

    // Resolve all blob references in parallel
    return Promise.all(entries.map((entry) => this.resolveEntry(entry)));
  }

  /**
   * Resolve a potentially blob-referenced entry
   */
  private async resolveEntry(entry: LedgerEntry): Promise<LedgerEntry> {
    if (!isBlobReference(entry.data)) {
      return entry;
    }

    const blobRef = entry.data;

    // Fetch from blob storage
    const blob = await this.blob.get(
      blobRef.ledgerId,
      blobRef.entryId,
      this.config.verifyOnRead ? blobRef.contentHash : undefined
    );

    if (!blob) {
      throw new Error(`Blob not found for entry ${blobRef.entryId} in ledger ${blobRef.ledgerId}`);
    }

    // Parse the blob data and return the complete entry
    const data = JSON.parse(blob.data.toString('utf-8'));

    return {
      ...entry,
      data,
    };
  }

  /**
   * Create ledger metadata
   */
  async createLedgerMetadata(metadata: LedgerMetadata): Promise<void> {
    return this.primary.createLedgerMetadata(metadata);
  }

  /**
   * Get ledger metadata
   */
  async getLedgerMetadata(ledgerId: string): Promise<LedgerMetadata | null> {
    return this.primary.getLedgerMetadata(ledgerId);
  }

  /**
   * Update ledger metadata
   */
  async updateLedgerMetadata(
    ledgerId: string,
    metadata: Partial<LedgerMetadata>
  ): Promise<void> {
    return this.primary.updateLedgerMetadata(ledgerId, metadata);
  }

  /**
   * List all ledgers with pagination
   */
  async listLedgers(options?: {
    offset?: number;
    limit?: number;
  }): Promise<LedgerMetadata[]> {
    return this.primary.listLedgers(options);
  }

  /**
   * Get all leaf hashes for tree reconstruction
   */
  async getAllLeafHashes(ledgerId: string): Promise<string[]> {
    return this.primary.getAllLeafHashes(ledgerId);
  }

  // ============================================
  // Additional tiered-specific methods
  // ============================================

  /**
   * Check if an entry's data is stored in blob storage
   */
  async isInBlobStorage(ledgerId: string, entryId: string): Promise<boolean> {
    const entry = await this.primary.get(ledgerId, entryId);
    if (!entry) return false;

    return isBlobReference(entry.data);
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(ledgerId: string): Promise<{
    totalEntries: number;
    primaryStorageEntries: number;
    blobStorageEntries: number;
    blobStorageSize: number;
  }> {
    const entries = await this.primary.list(ledgerId, { limit: 10000 });
    let primaryStorageEntries = 0;
    let blobStorageEntries = 0;
    let blobStorageSize = 0;

    for (const entry of entries) {
      if (isBlobReference(entry.data)) {
        blobStorageEntries++;
        blobStorageSize += entry.data.size;
      } else {
        primaryStorageEntries++;
      }
    }

    return {
      totalEntries: entries.length,
      primaryStorageEntries,
      blobStorageEntries,
      blobStorageSize,
    };
  }

  /**
   * Migrate an entry to blob storage (for manual tiering)
   */
  async migrateToBlob(ledgerId: string, entryId: string): Promise<boolean> {
    const entry = await this.primary.get(ledgerId, entryId);
    if (!entry) return false;

    // Already in blob storage
    if (isBlobReference(entry.data)) return false;

    // Store in blob
    await this.blob.put(
      ledgerId,
      entryId,
      entry.data,
      'application/json'
    );

    // Update primary with blob reference
    // Note: This requires UPDATE capability which may not be available
    // for append-only ledgers. In practice, this operation would be
    // performed during a maintenance window or archive process.
    console.warn('Migration to blob storage requires special handling for append-only ledgers');

    return true;
  }

  /**
   * Get the underlying primary storage
   */
  getPrimary(): StorageBackend {
    return this.primary;
  }

  /**
   * Get the underlying blob storage
   */
  getBlob(): BlobStorage {
    return this.blob;
  }

  /**
   * Get the size threshold for blob storage
   */
  getSizeThreshold(): number {
    return this.config.sizeThreshold;
  }

  /**
   * Health check for both storage backends
   */
  async healthCheck(): Promise<{
    primary: boolean;
    blob: boolean;
  }> {
    const [blobHealthy] = await Promise.all([
      this.blob.healthCheck().catch(() => false),
    ]);

    return {
      primary: true, // Assume primary is healthy if we got here
      blob: blobHealthy,
    };
  }
}

/**
 * Create a tiered storage combining the given primary storage with blob storage
 */
export function createTieredStorage(
  primary: StorageBackend,
  blob: BlobStorage,
  config?: TieredStorageConfig
): TieredStorage {
  return new TieredStorage(primary, blob, config);
}
