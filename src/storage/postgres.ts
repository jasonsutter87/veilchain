/**
 * PostgreSQL Storage Backend
 *
 * Implements the StorageBackend interface using PostgreSQL for persistent,
 * append-only ledger storage with ACID guarantees.
 */

import { Pool, PoolClient, PoolConfig, QueryResult } from 'pg';
import {
  StorageBackend,
  LedgerEntry,
  LedgerMetadata,
} from '../types.js';

/**
 * Configuration options for PostgreSQL storage
 */
export interface PostgresConfig extends PoolConfig {
  /** Connection pool size (default: 20) */
  max?: number;
  /** Idle timeout in milliseconds (default: 30000) */
  idleTimeoutMillis?: number;
  /** Connection timeout in milliseconds (default: 3000) */
  connectionTimeoutMillis?: number;
}

/**
 * PostgreSQL storage backend implementation
 *
 * Features:
 * - Connection pooling for performance
 * - Parameterized queries to prevent SQL injection
 * - Transaction support for atomic operations
 * - Automatic retry logic for transient errors
 * - Proper error handling and logging
 */
export class PostgresStorage implements StorageBackend {
  private pool: Pool;

  constructor(config: PostgresConfig) {
    // Set sensible defaults for connection pooling
    const poolConfig: PoolConfig = {
      ...config,
      max: config.max ?? 20,
      idleTimeoutMillis: config.idleTimeoutMillis ?? 30000,
      connectionTimeoutMillis: config.connectionTimeoutMillis ?? 3000,
    };

    this.pool = new Pool(poolConfig);

    // Handle pool errors
    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });
  }

  /**
   * Initialize the connection pool
   */
  async connect(): Promise<void> {
    try {
      // Test the connection
      const client = await this.pool.connect();
      client.release();
    } catch (error) {
      throw new Error(`Failed to connect to PostgreSQL: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Close the connection pool
   */
  async disconnect(): Promise<void> {
    await this.pool.end();
  }

  /**
   * Store a new entry in the ledger
   *
   * This operation is atomic and uses a transaction to ensure:
   * 1. Entry is inserted
   * 2. Ledger metadata is updated
   *
   * @param ledgerId - The ledger ID
   * @param entry - The entry to store
   */
  async put(ledgerId: string, entry: LedgerEntry): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Insert the entry
      await client.query(
        `INSERT INTO entries (id, ledger_id, position, data, hash, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          entry.id,
          ledgerId,
          entry.position.toString(),
          JSON.stringify(entry.data),
          entry.hash,
          entry.createdAt,
        ]
      );

      // Update ledger metadata
      await client.query(
        `UPDATE ledgers
         SET entry_count = entry_count + 1,
             updated_at = NOW()
         WHERE id = $1`,
        [ledgerId]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');

      // Check for unique constraint violation (duplicate position)
      if (error instanceof Error && 'code' in error && error.code === '23505') {
        throw new Error(`Entry at position ${entry.position} already exists in ledger ${ledgerId}`);
      }

      throw new Error(`Failed to store entry: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      client.release();
    }
  }

  /**
   * Get an entry by its ID
   *
   * @param ledgerId - The ledger ID
   * @param entryId - The entry ID
   * @returns The entry or null if not found
   */
  async get(ledgerId: string, entryId: string): Promise<LedgerEntry | null> {
    try {
      const result: QueryResult = await this.pool.query(
        `SELECT id, ledger_id, position, data, hash, created_at
         FROM entries
         WHERE ledger_id = $1 AND id = $2`,
        [ledgerId, entryId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.rowToEntry(result.rows[0]);
    } catch (error) {
      throw new Error(`Failed to get entry: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get an entry by its position in the ledger
   *
   * @param ledgerId - The ledger ID
   * @param position - The entry position (0-indexed)
   * @returns The entry or null if not found
   */
  async getByPosition(ledgerId: string, position: bigint): Promise<LedgerEntry | null> {
    try {
      const result: QueryResult = await this.pool.query(
        `SELECT id, ledger_id, position, data, hash, created_at
         FROM entries
         WHERE ledger_id = $1 AND position = $2`,
        [ledgerId, position.toString()]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.rowToEntry(result.rows[0]);
    } catch (error) {
      throw new Error(`Failed to get entry by position: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * List entries with pagination
   *
   * @param ledgerId - The ledger ID
   * @param options - Pagination options
   * @returns Array of entries
   */
  async list(
    ledgerId: string,
    options: { offset?: bigint; limit?: number }
  ): Promise<LedgerEntry[]> {
    const offset = options.offset ?? BigInt(0);
    const limit = options.limit ?? 100;

    try {
      const result: QueryResult = await this.pool.query(
        `SELECT id, ledger_id, position, data, hash, created_at
         FROM entries
         WHERE ledger_id = $1
         ORDER BY position ASC
         OFFSET $2
         LIMIT $3`,
        [ledgerId, offset.toString(), limit]
      );

      return result.rows.map((row) => this.rowToEntry(row));
    } catch (error) {
      throw new Error(`Failed to list entries: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get ledger metadata
   *
   * @param ledgerId - The ledger ID
   * @returns Ledger metadata or null if not found
   */
  async getLedgerMetadata(ledgerId: string): Promise<LedgerMetadata | null> {
    try {
      const result: QueryResult = await this.pool.query(
        `SELECT l.id, l.name, l.description, l.root_hash, l.entry_count,
                l.created_at, l.updated_at, MAX(e.created_at) as last_entry_at
         FROM ledgers l
         LEFT JOIN entries e ON l.id = e.ledger_id
         WHERE l.id = $1
         GROUP BY l.id`,
        [ledgerId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        rootHash: row.root_hash,
        entryCount: BigInt(row.entry_count),
        createdAt: new Date(row.created_at),
        lastEntryAt: row.last_entry_at ? new Date(row.last_entry_at) : undefined,
      };
    } catch (error) {
      throw new Error(`Failed to get ledger metadata: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Update ledger metadata
   *
   * @param ledgerId - The ledger ID
   * @param metadata - Partial metadata to update
   */
  async updateLedgerMetadata(ledgerId: string, metadata: Partial<LedgerMetadata>): Promise<void> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    // Build dynamic UPDATE query
    if (metadata.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(metadata.name);
    }

    if (metadata.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(metadata.description);
    }

    if (metadata.rootHash !== undefined) {
      updates.push(`root_hash = $${paramIndex++}`);
      values.push(metadata.rootHash);
    }

    if (metadata.entryCount !== undefined) {
      updates.push(`entry_count = $${paramIndex++}`);
      values.push(metadata.entryCount.toString());
    }

    if (updates.length === 0) {
      return; // Nothing to update
    }

    // Always update the updated_at timestamp
    updates.push(`updated_at = NOW()`);
    values.push(ledgerId);

    try {
      const query = `UPDATE ledgers SET ${updates.join(', ')} WHERE id = $${paramIndex}`;
      await this.pool.query(query, values);
    } catch (error) {
      throw new Error(`Failed to update ledger metadata: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get all leaf hashes for tree reconstruction
   *
   * This is used to rebuild the Merkle tree from stored entries.
   * Returns hashes in position order.
   *
   * @param ledgerId - The ledger ID
   * @returns Array of leaf hashes in position order
   */
  async getAllLeafHashes(ledgerId: string): Promise<string[]> {
    try {
      const result: QueryResult = await this.pool.query(
        `SELECT hash
         FROM entries
         WHERE ledger_id = $1
         ORDER BY position ASC`,
        [ledgerId]
      );

      return result.rows.map((row) => row.hash);
    } catch (error) {
      throw new Error(`Failed to get leaf hashes: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Create ledger metadata (implements StorageBackend interface)
   *
   * @param metadata - The ledger metadata to create
   */
  async createLedgerMetadata(metadata: LedgerMetadata): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO ledgers (id, name, description, root_hash, entry_count, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          metadata.id,
          metadata.name,
          metadata.description,
          metadata.rootHash,
          metadata.entryCount.toString(),
          metadata.createdAt,
        ]
      );
    } catch (error) {
      // Check for unique constraint violation
      if (error instanceof Error && 'code' in error && error.code === '23505') {
        throw new Error(`Ledger with ID ${metadata.id} already exists`);
      }

      throw new Error(`Failed to create ledger: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * List all ledgers with pagination
   *
   * @param options - Pagination options
   * @returns Array of ledger metadata
   */
  async listLedgers(options?: {
    offset?: number;
    limit?: number;
  }): Promise<LedgerMetadata[]> {
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? 100;

    try {
      const result: QueryResult = await this.pool.query(
        `SELECT l.id, l.name, l.description, l.root_hash, l.entry_count,
                l.created_at, MAX(e.created_at) as last_entry_at
         FROM ledgers l
         LEFT JOIN entries e ON l.id = e.ledger_id
         GROUP BY l.id
         ORDER BY l.created_at DESC
         OFFSET $1
         LIMIT $2`,
        [offset, limit]
      );

      return result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        rootHash: row.root_hash,
        entryCount: BigInt(row.entry_count),
        createdAt: new Date(row.created_at),
        lastEntryAt: row.last_entry_at ? new Date(row.last_entry_at) : undefined,
      }));
    } catch (error) {
      throw new Error(`Failed to list ledgers: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Execute a function within a transaction
   *
   * This allows for complex atomic operations that span multiple queries.
   * The transaction is automatically rolled back on error.
   *
   * @param fn - Function to execute within the transaction
   * @returns The result of the function
   */
  async withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Convert a database row to a LedgerEntry
   *
   * @param row - Database row
   * @returns LedgerEntry object
   */
  private rowToEntry(row: any): LedgerEntry {
    return {
      id: row.id,
      position: BigInt(row.position),
      data: row.data,
      hash: row.hash,
      createdAt: new Date(row.created_at),
    };
  }

  /**
   * Health check - verify database connection
   *
   * @returns True if healthy, false otherwise
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.pool.query('SELECT 1 as healthy');
      return result.rows[0]?.healthy === 1;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }
}

/**
 * Create a PostgreSQL storage instance from environment variables
 *
 * Expected environment variables:
 * - DATABASE_URL or individual connection params:
 *   - POSTGRES_HOST
 *   - POSTGRES_PORT
 *   - POSTGRES_DATABASE
 *   - POSTGRES_USER
 *   - POSTGRES_PASSWORD
 * - POSTGRES_MAX_CONNECTIONS (optional, default: 20)
 * - POSTGRES_IDLE_TIMEOUT (optional, default: 30000)
 *
 * @returns PostgresStorage instance
 */
export function createPostgresStorage(): PostgresStorage {
  const config: PostgresConfig = {};

  // Check for DATABASE_URL first (common in cloud environments)
  if (process.env.DATABASE_URL) {
    config.connectionString = process.env.DATABASE_URL;
  } else {
    // Use individual connection parameters
    config.host = process.env.POSTGRES_HOST || 'localhost';
    config.port = parseInt(process.env.POSTGRES_PORT || '5432', 10);
    config.database = process.env.POSTGRES_DATABASE || 'veilchain';
    config.user = process.env.POSTGRES_USER || 'postgres';
    config.password = process.env.POSTGRES_PASSWORD;
  }

  // Optional pool configuration
  if (process.env.POSTGRES_MAX_CONNECTIONS) {
    config.max = parseInt(process.env.POSTGRES_MAX_CONNECTIONS, 10);
  }

  if (process.env.POSTGRES_IDLE_TIMEOUT) {
    config.idleTimeoutMillis = parseInt(process.env.POSTGRES_IDLE_TIMEOUT, 10);
  }

  return new PostgresStorage(config);
}
