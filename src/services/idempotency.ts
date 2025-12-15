/**
 * VeilChain Idempotency Service
 *
 * Manages idempotency keys to prevent duplicate operations.
 * Keys expire after 24 hours to prevent unbounded memory growth.
 */

import type { Pool } from 'pg';

/**
 * Stored idempotency record
 */
interface IdempotencyRecord {
  /** The key used for this operation */
  key: string;
  /** Result of the operation */
  result: unknown;
  /** When this key was created */
  createdAt: Date;
  /** When this key expires (24 hours from creation) */
  expiresAt: Date;
}

/**
 * Storage backend for idempotency keys
 */
export interface IdempotencyStorage {
  get(ledgerId: string, key: string): Promise<unknown | null>;
  set(ledgerId: string, key: string, result: unknown, expiresAt: Date): Promise<void>;
  delete(ledgerId: string, key: string): Promise<void>;
  cleanup(): Promise<void>;
}

/**
 * PostgreSQL-backed idempotency storage
 */
export class PostgresIdempotencyStorage implements IdempotencyStorage {
  constructor(private readonly pool: Pool) {}

  async get(ledgerId: string, key: string): Promise<unknown | null> {
    const result = await this.pool.query(
      `SELECT response
       FROM idempotency_keys
       WHERE ledger_id = $1 AND key = $2 AND expires_at > NOW()`,
      [ledgerId, key]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0].response;
  }

  async set(ledgerId: string, key: string, result: unknown, expiresAt: Date): Promise<void> {
    await this.pool.query(
      `INSERT INTO idempotency_keys (key, ledger_id, response, expires_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (key) DO UPDATE SET response = EXCLUDED.response`,
      [key, ledgerId, JSON.stringify(result), expiresAt]
    );
  }

  async delete(ledgerId: string, key: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM idempotency_keys WHERE ledger_id = $1 AND key = $2`,
      [ledgerId, key]
    );
  }

  async cleanup(): Promise<void> {
    await this.pool.query(`DELETE FROM idempotency_keys WHERE expires_at < NOW()`);
  }
}

/**
 * In-memory idempotency storage
 */
export class MemoryIdempotencyStorage implements IdempotencyStorage {
  private records: Map<string, IdempotencyRecord> = new Map();

  async get(ledgerId: string, key: string): Promise<unknown | null> {
    const fullKey = this.makeKey(ledgerId, key);
    const record = this.records.get(fullKey);

    if (!record) {
      return null;
    }

    // Check if expired
    if (new Date() > record.expiresAt) {
      this.records.delete(fullKey);
      return null;
    }

    return record.result;
  }

  async set(ledgerId: string, key: string, result: unknown, expiresAt: Date): Promise<void> {
    const fullKey = this.makeKey(ledgerId, key);
    this.records.set(fullKey, {
      key: fullKey,
      result,
      createdAt: new Date(),
      expiresAt
    });
  }

  async delete(ledgerId: string, key: string): Promise<void> {
    const fullKey = this.makeKey(ledgerId, key);
    this.records.delete(fullKey);
  }

  async cleanup(): Promise<void> {
    const now = new Date();
    const keysToDelete: string[] = [];

    for (const [key, record] of this.records.entries()) {
      if (now > record.expiresAt) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.records.delete(key);
    }
  }

  clearLedger(ledgerId: string): void {
    const prefix = `${ledgerId}:`;
    for (const key of this.records.keys()) {
      if (key.startsWith(prefix)) {
        this.records.delete(key);
      }
    }
  }

  clear(): void {
    this.records.clear();
  }

  private makeKey(ledgerId: string, key: string): string {
    return `${ledgerId}:${key}`;
  }
}

/**
 * Idempotency key manager
 *
 * Prevents duplicate operations by tracking completed operations
 * with their results. If the same idempotency key is used again
 * within 24 hours, the cached result is returned.
 */
export class IdempotencyService {
  private cleanupInterval?: NodeJS.Timeout;

  constructor(
    private readonly storage: IdempotencyStorage,
    private readonly ttlMs: number = 24 * 60 * 60 * 1000
  ) {
    // Start cleanup job to remove expired keys
    this.startCleanup();
  }

  /**
   * Check if a key exists and is not expired
   * @param ledgerId - The ledger ID
   * @param key - The idempotency key
   * @returns The cached result if found, null otherwise
   */
  async get<T>(ledgerId: string, key: string): Promise<T | null> {
    const result = await this.storage.get(ledgerId, key);
    return result as T | null;
  }

  /**
   * Store a result with an idempotency key
   * @param ledgerId - The ledger ID
   * @param key - The idempotency key
   * @param result - The operation result to cache
   */
  async set(ledgerId: string, key: string, result: unknown): Promise<void> {
    const expiresAt = new Date(Date.now() + this.ttlMs);
    await this.storage.set(ledgerId, key, result, expiresAt);
  }

  /**
   * Remove a specific key
   * @param ledgerId - The ledger ID
   * @param key - The idempotency key
   */
  async delete(ledgerId: string, key: string): Promise<void> {
    await this.storage.delete(ledgerId, key);
  }

  /**
   * Clear all keys for a ledger (only works with memory storage)
   * @param ledgerId - The ledger ID
   */
  clearLedger(ledgerId: string): void {
    if (this.storage instanceof MemoryIdempotencyStorage) {
      this.storage.clearLedger(ledgerId);
    }
  }

  /**
   * Clear all keys (only works with memory storage, for testing)
   */
  clear(): void {
    if (this.storage instanceof MemoryIdempotencyStorage) {
      this.storage.clear();
    }
  }

  /**
   * Start periodic cleanup of expired keys
   * Runs every hour
   */
  private startCleanup(): void {
    // Run cleanup every hour
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60 * 60 * 1000);

    // Don't prevent process from exiting
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Remove expired keys from storage
   */
  private async cleanup(): Promise<void> {
    await this.storage.cleanup();
  }

  /**
   * Stop the cleanup interval
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }
}
