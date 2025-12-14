/**
 * VeilChain Idempotency Service
 *
 * Manages idempotency keys to prevent duplicate operations.
 * Keys expire after 24 hours to prevent unbounded memory growth.
 */

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
 * Idempotency key manager
 *
 * Prevents duplicate operations by tracking completed operations
 * with their results. If the same idempotency key is used again
 * within 24 hours, the cached result is returned.
 */
export class IdempotencyService {
  private records: Map<string, IdempotencyRecord> = new Map();
  private cleanupInterval?: NodeJS.Timeout;

  constructor(private readonly ttlMs: number = 24 * 60 * 60 * 1000) {
    // Start cleanup job to remove expired keys
    this.startCleanup();
  }

  /**
   * Check if a key exists and is not expired
   * @param ledgerId - The ledger ID
   * @param key - The idempotency key
   * @returns The cached result if found, null otherwise
   */
  get<T>(ledgerId: string, key: string): T | null {
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

    return record.result as T;
  }

  /**
   * Store a result with an idempotency key
   * @param ledgerId - The ledger ID
   * @param key - The idempotency key
   * @param result - The operation result to cache
   */
  set(ledgerId: string, key: string, result: unknown): void {
    const fullKey = this.makeKey(ledgerId, key);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.ttlMs);

    this.records.set(fullKey, {
      key: fullKey,
      result,
      createdAt: now,
      expiresAt
    });
  }

  /**
   * Remove a specific key
   * @param ledgerId - The ledger ID
   * @param key - The idempotency key
   */
  delete(ledgerId: string, key: string): void {
    const fullKey = this.makeKey(ledgerId, key);
    this.records.delete(fullKey);
  }

  /**
   * Clear all keys for a ledger
   * @param ledgerId - The ledger ID
   */
  clearLedger(ledgerId: string): void {
    const prefix = `${ledgerId}:`;
    for (const key of this.records.keys()) {
      if (key.startsWith(prefix)) {
        this.records.delete(key);
      }
    }
  }

  /**
   * Clear all keys (for testing)
   */
  clear(): void {
    this.records.clear();
  }

  /**
   * Get statistics about stored keys
   */
  getStats(): {
    totalKeys: number;
    expiredKeys: number;
    activeKeys: number;
  } {
    const now = new Date();
    let expiredKeys = 0;
    let activeKeys = 0;

    for (const record of this.records.values()) {
      if (now > record.expiresAt) {
        expiredKeys++;
      } else {
        activeKeys++;
      }
    }

    return {
      totalKeys: this.records.size,
      expiredKeys,
      activeKeys
    };
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
  private cleanup(): void {
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

  /**
   * Stop the cleanup interval
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }

  /**
   * Create a composite key from ledgerId and idempotency key
   */
  private makeKey(ledgerId: string, key: string): string {
    return `${ledgerId}:${key}`;
  }
}
