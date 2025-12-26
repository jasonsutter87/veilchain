/**
 * VeilChain Storage Module
 *
 * Provides various storage backends for the ledger:
 * - MemoryStorage: In-memory storage for testing
 * - PostgresStorage: Persistent PostgreSQL storage
 * - RedisCache: Redis caching layer
 * - BlobStorage: S3/MinIO blob storage for large entries
 * - CachedStorage: Combines PostgreSQL with Redis caching
 * - TieredStorage: Automatic tiering between PostgreSQL and blob storage
 */

// Core storage backends
export { MemoryStorage } from './memory.js';
export {
  PostgresStorage,
  createPostgresStorage,
  type PostgresConfig,
} from './postgres.js';

// Caching layer
export {
  RedisCache,
  createRedisCache,
  type RedisCacheConfig,
  type CacheTTLConfig,
} from './redis.js';

// Blob storage
export {
  BlobStorage,
  createBlobStorage,
  type BlobStorageConfig,
  type BlobMetadata,
  type BlobResult,
} from './blob.js';

// Composite storage backends
export {
  CachedStorage,
  type CachedStorageConfig,
} from './cached.js';

export {
  TieredStorage,
  createTieredStorage,
  type TieredStorageConfig,
} from './tiered.js';

// Re-export types
export type { StorageBackend, LedgerEntry, LedgerMetadata } from '../types.js';
