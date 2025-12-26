/**
 * VeilChain Redis Cache Layer
 *
 * Provides caching for:
 * - Root hash (sub-millisecond access)
 * - Entry proofs (hot entries)
 * - Ledger metadata
 * - Rate limit counters
 */

import { Redis, RedisOptions } from 'ioredis';
import type { LedgerMetadata, LedgerEntry, MerkleProof } from '../types.js';

/**
 * Cache TTL configuration (in seconds)
 */
export interface CacheTTLConfig {
  /** Root hash TTL (default: 60 seconds) */
  rootHash?: number;
  /** Entry TTL (default: 300 seconds / 5 minutes) */
  entry?: number;
  /** Proof TTL (default: 300 seconds / 5 minutes) */
  proof?: number;
  /** Ledger metadata TTL (default: 60 seconds) */
  ledgerMetadata?: number;
  /** Rate limit counter TTL (default: 86400 seconds / 24 hours) */
  rateLimit?: number;
}

/**
 * Default TTL configuration
 */
const DEFAULT_TTL: Required<CacheTTLConfig> = {
  rootHash: 60,
  entry: 300,
  proof: 300,
  ledgerMetadata: 60,
  rateLimit: 86400,
};

/**
 * Cache key prefixes
 */
const CACHE_KEYS = {
  ROOT_HASH: 'root:',
  ENTRY: 'entry:',
  ENTRY_BY_POSITION: 'entry_pos:',
  PROOF: 'proof:',
  LEDGER_METADATA: 'ledger:',
  RATE_LIMIT_DAILY: 'rl_daily:',
  RATE_LIMIT_SECOND: 'rl_sec:',
} as const;

/**
 * Redis cache configuration
 */
export interface RedisCacheConfig {
  /** Redis connection URL or options */
  connection: string | RedisOptions;
  /** TTL configuration */
  ttl?: CacheTTLConfig;
  /** Key prefix for namespacing (default: 'vc:') */
  keyPrefix?: string;
  /** Enable connection retry (default: true) */
  enableRetry?: boolean;
  /** Maximum retry attempts (default: 10) */
  maxRetries?: number;
}

/**
 * Redis Cache Implementation
 *
 * Features:
 * - Sub-millisecond root hash access
 * - Proof caching for frequently accessed entries
 * - Rate limit counter persistence
 * - Connection pooling and automatic reconnection
 */
export class RedisCache {
  private client: Redis;
  private readonly ttl: Required<CacheTTLConfig>;
  private readonly prefix: string;
  private isConnected: boolean = false;

  constructor(config: RedisCacheConfig) {
    this.ttl = { ...DEFAULT_TTL, ...config.ttl };
    this.prefix = config.keyPrefix ?? 'vc:';

    // Configure Redis client
    const redisOptions: RedisOptions = typeof config.connection === 'string'
      ? {
          lazyConnect: true,
          maxRetriesPerRequest: config.maxRetries ?? 10,
          enableReadyCheck: true,
          retryStrategy: config.enableRetry !== false
            ? (times) => Math.min(times * 50, 2000)
            : undefined,
        }
      : {
          ...config.connection,
          lazyConnect: true,
          maxRetriesPerRequest: config.maxRetries ?? 10,
        };

    this.client = typeof config.connection === 'string'
      ? new Redis(config.connection, redisOptions)
      : new Redis(redisOptions);

    // Handle connection events
    this.client.on('connect', () => {
      this.isConnected = true;
      console.log('Redis cache connected');
    });

    this.client.on('error', (err: Error) => {
      console.error('Redis cache error:', err.message);
    });

    this.client.on('close', () => {
      this.isConnected = false;
      console.log('Redis cache disconnected');
    });
  }

  /**
   * Connect to Redis
   */
  async connect(): Promise<void> {
    if (!this.isConnected) {
      await this.client.connect();
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    await this.client.quit();
    this.isConnected = false;
  }

  /**
   * Check if connected
   */
  get connected(): boolean {
    return this.isConnected;
  }

  /**
   * Build a cache key with prefix
   */
  private key(parts: string[]): string {
    return this.prefix + parts.join(':');
  }

  // ============================================
  // Root Hash Caching
  // ============================================

  /**
   * Cache a ledger's root hash
   */
  async setRootHash(ledgerId: string, rootHash: string, entryCount: bigint): Promise<void> {
    const key = this.key([CACHE_KEYS.ROOT_HASH, ledgerId]);
    const value = JSON.stringify({ rootHash, entryCount: entryCount.toString() });
    await this.client.setex(key, this.ttl.rootHash, value);
  }

  /**
   * Get a ledger's cached root hash
   */
  async getRootHash(ledgerId: string): Promise<{ rootHash: string; entryCount: bigint } | null> {
    const key = this.key([CACHE_KEYS.ROOT_HASH, ledgerId]);
    const value = await this.client.get(key);
    if (!value) return null;

    try {
      const parsed = JSON.parse(value);
      return {
        rootHash: parsed.rootHash,
        entryCount: BigInt(parsed.entryCount),
      };
    } catch {
      return null;
    }
  }

  /**
   * Invalidate a ledger's root hash cache
   */
  async invalidateRootHash(ledgerId: string): Promise<void> {
    const key = this.key([CACHE_KEYS.ROOT_HASH, ledgerId]);
    await this.client.del(key);
  }

  // ============================================
  // Entry Caching
  // ============================================

  /**
   * Cache an entry
   */
  async setEntry(ledgerId: string, entry: LedgerEntry): Promise<void> {
    const keyById = this.key([CACHE_KEYS.ENTRY, ledgerId, entry.id]);
    const keyByPos = this.key([CACHE_KEYS.ENTRY_BY_POSITION, ledgerId, entry.position.toString()]);

    const value = JSON.stringify({
      ...entry,
      position: entry.position.toString(),
      createdAt: entry.createdAt.toISOString(),
    });

    const pipeline = this.client.pipeline();
    pipeline.setex(keyById, this.ttl.entry, value);
    pipeline.setex(keyByPos, this.ttl.entry, value);
    await pipeline.exec();
  }

  /**
   * Get a cached entry by ID
   */
  async getEntry(ledgerId: string, entryId: string): Promise<LedgerEntry | null> {
    const key = this.key([CACHE_KEYS.ENTRY, ledgerId, entryId]);
    return this.parseEntry(await this.client.get(key));
  }

  /**
   * Get a cached entry by position
   */
  async getEntryByPosition(ledgerId: string, position: bigint): Promise<LedgerEntry | null> {
    const key = this.key([CACHE_KEYS.ENTRY_BY_POSITION, ledgerId, position.toString()]);
    return this.parseEntry(await this.client.get(key));
  }

  /**
   * Parse a cached entry
   */
  private parseEntry(value: string | null): LedgerEntry | null {
    if (!value) return null;
    try {
      const parsed = JSON.parse(value);
      return {
        ...parsed,
        position: BigInt(parsed.position),
        createdAt: new Date(parsed.createdAt),
      };
    } catch {
      return null;
    }
  }

  /**
   * Cache multiple entries
   */
  async setEntries(ledgerId: string, entries: LedgerEntry[]): Promise<void> {
    if (entries.length === 0) return;

    const pipeline = this.client.pipeline();
    for (const entry of entries) {
      const keyById = this.key([CACHE_KEYS.ENTRY, ledgerId, entry.id]);
      const keyByPos = this.key([CACHE_KEYS.ENTRY_BY_POSITION, ledgerId, entry.position.toString()]);
      const value = JSON.stringify({
        ...entry,
        position: entry.position.toString(),
        createdAt: entry.createdAt.toISOString(),
      });
      pipeline.setex(keyById, this.ttl.entry, value);
      pipeline.setex(keyByPos, this.ttl.entry, value);
    }
    await pipeline.exec();
  }

  // ============================================
  // Proof Caching
  // ============================================

  /**
   * Cache a proof
   */
  async setProof(ledgerId: string, entryId: string, proof: MerkleProof): Promise<void> {
    const key = this.key([CACHE_KEYS.PROOF, ledgerId, entryId]);
    await this.client.setex(key, this.ttl.proof, JSON.stringify(proof));
  }

  /**
   * Get a cached proof
   */
  async getProof(ledgerId: string, entryId: string): Promise<MerkleProof | null> {
    const key = this.key([CACHE_KEYS.PROOF, ledgerId, entryId]);
    const value = await this.client.get(key);
    if (!value) return null;

    try {
      return JSON.parse(value) as MerkleProof;
    } catch {
      return null;
    }
  }

  /**
   * Invalidate proofs for a ledger (after new entries are added)
   * Note: Only invalidates proofs, not entries, as entries are immutable
   */
  async invalidateProofs(ledgerId: string): Promise<void> {
    const pattern = this.key([CACHE_KEYS.PROOF, ledgerId, '*']);
    const keys = await this.client.keys(pattern);
    if (keys.length > 0) {
      await this.client.del(...keys);
    }
  }

  // ============================================
  // Ledger Metadata Caching
  // ============================================

  /**
   * Cache ledger metadata
   */
  async setLedgerMetadata(metadata: LedgerMetadata): Promise<void> {
    const key = this.key([CACHE_KEYS.LEDGER_METADATA, metadata.id]);
    const value = JSON.stringify({
      ...metadata,
      entryCount: metadata.entryCount.toString(),
      createdAt: metadata.createdAt.toISOString(),
      lastEntryAt: metadata.lastEntryAt?.toISOString(),
    });
    await this.client.setex(key, this.ttl.ledgerMetadata, value);
  }

  /**
   * Get cached ledger metadata
   */
  async getLedgerMetadata(ledgerId: string): Promise<LedgerMetadata | null> {
    const key = this.key([CACHE_KEYS.LEDGER_METADATA, ledgerId]);
    const value = await this.client.get(key);
    if (!value) return null;

    try {
      const parsed = JSON.parse(value);
      return {
        ...parsed,
        entryCount: BigInt(parsed.entryCount),
        createdAt: new Date(parsed.createdAt),
        lastEntryAt: parsed.lastEntryAt ? new Date(parsed.lastEntryAt) : undefined,
      };
    } catch {
      return null;
    }
  }

  /**
   * Invalidate ledger metadata cache
   */
  async invalidateLedgerMetadata(ledgerId: string): Promise<void> {
    const key = this.key([CACHE_KEYS.LEDGER_METADATA, ledgerId]);
    await this.client.del(key);
  }

  // ============================================
  // Rate Limiting
  // ============================================

  /**
   * Increment daily rate limit counter
   * Returns current count and whether the limit was exceeded
   */
  async incrementDailyLimit(
    identifier: string,
    limit: number
  ): Promise<{ count: number; allowed: boolean; ttl: number }> {
    const key = this.key([CACHE_KEYS.RATE_LIMIT_DAILY, identifier]);

    // Calculate seconds until midnight
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const ttl = Math.ceil((midnight.getTime() - now.getTime()) / 1000);

    // Atomic increment with expiry
    const pipeline = this.client.pipeline();
    pipeline.incr(key);
    pipeline.ttl(key);
    const results = await pipeline.exec();

    const count = results?.[0]?.[1] as number ?? 1;
    const existingTtl = results?.[1]?.[1] as number ?? -1;

    // Set expiry if not already set
    if (existingTtl === -1) {
      await this.client.expire(key, ttl);
    }

    return {
      count,
      allowed: count <= limit,
      ttl: existingTtl > 0 ? existingTtl : ttl,
    };
  }

  /**
   * Increment per-second rate limit counter using sliding window
   * Returns current count and whether the limit was exceeded
   */
  async incrementSecondLimit(
    identifier: string,
    limit: number
  ): Promise<{ count: number; allowed: boolean }> {
    const key = this.key([CACHE_KEYS.RATE_LIMIT_SECOND, identifier]);
    const now = Date.now();
    const windowStart = now - 1000; // 1 second window

    // Use sorted set for sliding window
    const pipeline = this.client.pipeline();
    pipeline.zremrangebyscore(key, 0, windowStart); // Remove old entries
    pipeline.zadd(key, now.toString(), `${now}-${Math.random()}`); // Add current request
    pipeline.zcard(key); // Count requests in window
    pipeline.expire(key, 2); // Expire key after 2 seconds
    const results = await pipeline.exec();

    const count = results?.[2]?.[1] as number ?? 1;

    return {
      count,
      allowed: count <= limit,
    };
  }

  /**
   * Get current daily limit count
   */
  async getDailyLimitCount(identifier: string): Promise<number> {
    const key = this.key([CACHE_KEYS.RATE_LIMIT_DAILY, identifier]);
    const value = await this.client.get(key);
    return value ? parseInt(value, 10) : 0;
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  /**
   * Flush all cache entries (for testing)
   */
  async flushAll(): Promise<void> {
    const pattern = this.prefix + '*';
    const keys = await this.client.keys(pattern);
    if (keys.length > 0) {
      await this.client.del(...keys);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    connected: boolean;
    keys: number;
    usedMemory: string;
  }> {
    const info = await this.client.info('memory');
    const memoryMatch = info.match(/used_memory_human:(\S+)/);
    const keysCount = await this.client.dbsize();

    return {
      connected: this.isConnected,
      keys: keysCount,
      usedMemory: memoryMatch?.[1] ?? 'unknown',
    };
  }

  /**
   * Get the underlying Redis client (for advanced usage)
   */
  getClient(): Redis {
    return this.client;
  }
}

/**
 * Create a Redis cache instance from environment variables
 *
 * Expected environment variables:
 * - REDIS_URL: Redis connection URL (e.g., redis://localhost:6379)
 * - REDIS_HOST: Redis host (if not using URL)
 * - REDIS_PORT: Redis port (if not using URL)
 * - REDIS_PASSWORD: Redis password (optional)
 * - REDIS_DB: Redis database number (optional)
 */
export function createRedisCache(): RedisCache {
  const url = process.env.REDIS_URL;

  if (url) {
    return new RedisCache({ connection: url });
  }

  const options: RedisOptions = {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB ?? '0', 10),
  };

  return new RedisCache({ connection: options });
}
