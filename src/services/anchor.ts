/**
 * VeilChain Anchor Service
 *
 * Provides external timestamping/anchoring of ledger root hashes to
 * external chains and services (Bitcoin, Ethereum, OpenTimestamps, RFC3161).
 */

import type { Pool } from 'pg';

/**
 * Anchor type - the external service used for timestamping
 */
export type AnchorType = 'bitcoin' | 'ethereum' | 'opentimestamps' | 'rfc3161';

/**
 * Anchor status
 */
export type AnchorStatus = 'pending' | 'confirmed' | 'failed';

/**
 * Anchor record
 */
export interface Anchor {
  id: string;
  ledgerId: string;
  rootHash: string;
  entryCount: bigint;
  anchorType: AnchorType;
  status: AnchorStatus;
  externalTxId?: string;
  externalBlockHeight?: number;
  externalBlockHash?: string;
  externalTimestamp?: Date;
  proofData?: Record<string, unknown>;
  createdAt: Date;
  confirmedAt?: Date;
  errorMessage?: string;
}

/**
 * Options for creating an anchor
 */
export interface CreateAnchorOptions {
  ledgerId: string;
  rootHash: string;
  entryCount: bigint;
  anchorType: AnchorType;
}

/**
 * Anchor service interface
 */
export interface AnchorService {
  /** Create a new anchor request */
  createAnchor(options: CreateAnchorOptions): Promise<Anchor>;

  /** Get an anchor by ID */
  getAnchor(anchorId: string): Promise<Anchor | null>;

  /** List anchors for a ledger */
  listAnchors(ledgerId: string, options?: {
    status?: AnchorStatus;
    anchorType?: AnchorType;
    limit?: number;
    offset?: number;
  }): Promise<{ anchors: Anchor[]; total: number }>;

  /** Update anchor status (for background processing) */
  updateAnchorStatus(anchorId: string, update: {
    status: AnchorStatus;
    externalTxId?: string;
    externalBlockHeight?: number;
    externalBlockHash?: string;
    externalTimestamp?: Date;
    proofData?: Record<string, unknown>;
    errorMessage?: string;
  }): Promise<void>;

  /** Get pending anchors for processing */
  getPendingAnchors(limit?: number): Promise<Anchor[]>;
}

/**
 * Generate a unique anchor ID
 */
function generateAnchorId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `anchor_${timestamp}_${random}`;
}

/**
 * PostgreSQL implementation of anchor service
 */
class PostgresAnchorService implements AnchorService {
  constructor(private pool: Pool) {}

  async createAnchor(options: CreateAnchorOptions): Promise<Anchor> {
    const id = generateAnchorId();
    const now = new Date();

    const result = await this.pool.query(
      `INSERT INTO anchors (id, ledger_id, root_hash, entry_count, anchor_type, status, created_at)
       VALUES ($1, $2, $3, $4, $5, 'pending', $6)
       RETURNING *`,
      [id, options.ledgerId, options.rootHash, options.entryCount.toString(), options.anchorType, now]
    );

    return this.rowToAnchor(result.rows[0]);
  }

  async getAnchor(anchorId: string): Promise<Anchor | null> {
    const result = await this.pool.query(
      'SELECT * FROM anchors WHERE id = $1',
      [anchorId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.rowToAnchor(result.rows[0]);
  }

  async listAnchors(ledgerId: string, options?: {
    status?: AnchorStatus;
    anchorType?: AnchorType;
    limit?: number;
    offset?: number;
  }): Promise<{ anchors: Anchor[]; total: number }> {
    const conditions: string[] = ['ledger_id = $1'];
    const params: unknown[] = [ledgerId];
    let paramIndex = 2;

    if (options?.status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(options.status);
    }

    if (options?.anchorType) {
      conditions.push(`anchor_type = $${paramIndex++}`);
      params.push(options.anchorType);
    }

    const whereClause = conditions.join(' AND ');
    const limit = options?.limit ?? 100;
    const offset = options?.offset ?? 0;

    // Get total count
    const countResult = await this.pool.query(
      `SELECT COUNT(*) FROM anchors WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get anchors
    const result = await this.pool.query(
      `SELECT * FROM anchors
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, limit, offset]
    );

    return {
      anchors: result.rows.map(row => this.rowToAnchor(row)),
      total
    };
  }

  async updateAnchorStatus(anchorId: string, update: {
    status: AnchorStatus;
    externalTxId?: string;
    externalBlockHeight?: number;
    externalBlockHash?: string;
    externalTimestamp?: Date;
    proofData?: Record<string, unknown>;
    errorMessage?: string;
  }): Promise<void> {
    const updates: string[] = ['status = $2'];
    const params: unknown[] = [anchorId, update.status];
    let paramIndex = 3;

    if (update.externalTxId !== undefined) {
      updates.push(`external_tx_id = $${paramIndex++}`);
      params.push(update.externalTxId);
    }

    if (update.externalBlockHeight !== undefined) {
      updates.push(`external_block_height = $${paramIndex++}`);
      params.push(update.externalBlockHeight);
    }

    if (update.externalBlockHash !== undefined) {
      updates.push(`external_block_hash = $${paramIndex++}`);
      params.push(update.externalBlockHash);
    }

    if (update.externalTimestamp !== undefined) {
      updates.push(`external_timestamp = $${paramIndex++}`);
      params.push(update.externalTimestamp);
    }

    if (update.proofData !== undefined) {
      updates.push(`proof_data = $${paramIndex++}`);
      params.push(JSON.stringify(update.proofData));
    }

    if (update.errorMessage !== undefined) {
      updates.push(`error_message = $${paramIndex++}`);
      params.push(update.errorMessage);
    }

    if (update.status === 'confirmed') {
      updates.push(`confirmed_at = $${paramIndex++}`);
      params.push(new Date());
    }

    await this.pool.query(
      `UPDATE anchors SET ${updates.join(', ')} WHERE id = $1`,
      params
    );
  }

  async getPendingAnchors(limit = 100): Promise<Anchor[]> {
    const result = await this.pool.query(
      `SELECT * FROM anchors
       WHERE status = 'pending'
       ORDER BY created_at ASC
       LIMIT $1`,
      [limit]
    );

    return result.rows.map(row => this.rowToAnchor(row));
  }

  private rowToAnchor(row: Record<string, unknown>): Anchor {
    return {
      id: row.id as string,
      ledgerId: row.ledger_id as string,
      rootHash: row.root_hash as string,
      entryCount: BigInt(row.entry_count as string),
      anchorType: row.anchor_type as AnchorType,
      status: row.status as AnchorStatus,
      externalTxId: row.external_tx_id as string | undefined,
      externalBlockHeight: row.external_block_height ? Number(row.external_block_height) : undefined,
      externalBlockHash: row.external_block_hash as string | undefined,
      externalTimestamp: row.external_timestamp ? new Date(row.external_timestamp as string) : undefined,
      proofData: row.proof_data as Record<string, unknown> | undefined,
      createdAt: new Date(row.created_at as string),
      confirmedAt: row.confirmed_at ? new Date(row.confirmed_at as string) : undefined,
      errorMessage: row.error_message as string | undefined,
    };
  }
}

/**
 * In-memory implementation for testing
 */
class MemoryAnchorService implements AnchorService {
  private anchors: Map<string, Anchor> = new Map();

  async createAnchor(options: CreateAnchorOptions): Promise<Anchor> {
    const id = generateAnchorId();
    const anchor: Anchor = {
      id,
      ledgerId: options.ledgerId,
      rootHash: options.rootHash,
      entryCount: options.entryCount,
      anchorType: options.anchorType,
      status: 'pending',
      createdAt: new Date(),
    };

    this.anchors.set(id, anchor);
    return anchor;
  }

  async getAnchor(anchorId: string): Promise<Anchor | null> {
    return this.anchors.get(anchorId) ?? null;
  }

  async listAnchors(ledgerId: string, options?: {
    status?: AnchorStatus;
    anchorType?: AnchorType;
    limit?: number;
    offset?: number;
  }): Promise<{ anchors: Anchor[]; total: number }> {
    let anchors = Array.from(this.anchors.values())
      .filter(a => a.ledgerId === ledgerId);

    if (options?.status) {
      anchors = anchors.filter(a => a.status === options.status);
    }

    if (options?.anchorType) {
      anchors = anchors.filter(a => a.anchorType === options.anchorType);
    }

    anchors.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = anchors.length;
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? 100;

    return {
      anchors: anchors.slice(offset, offset + limit),
      total
    };
  }

  async updateAnchorStatus(anchorId: string, update: {
    status: AnchorStatus;
    externalTxId?: string;
    externalBlockHeight?: number;
    externalBlockHash?: string;
    externalTimestamp?: Date;
    proofData?: Record<string, unknown>;
    errorMessage?: string;
  }): Promise<void> {
    const anchor = this.anchors.get(anchorId);
    if (!anchor) {
      throw new Error(`Anchor ${anchorId} not found`);
    }

    this.anchors.set(anchorId, {
      ...anchor,
      status: update.status,
      externalTxId: update.externalTxId ?? anchor.externalTxId,
      externalBlockHeight: update.externalBlockHeight ?? anchor.externalBlockHeight,
      externalBlockHash: update.externalBlockHash ?? anchor.externalBlockHash,
      externalTimestamp: update.externalTimestamp ?? anchor.externalTimestamp,
      proofData: update.proofData ?? anchor.proofData,
      errorMessage: update.errorMessage ?? anchor.errorMessage,
      confirmedAt: update.status === 'confirmed' ? new Date() : anchor.confirmedAt,
    });
  }

  async getPendingAnchors(limit = 100): Promise<Anchor[]> {
    return Array.from(this.anchors.values())
      .filter(a => a.status === 'pending')
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(0, limit);
  }
}

/**
 * Create anchor service from pool (PostgreSQL) or memory
 */
export function createAnchorService(pool?: Pool): AnchorService {
  if (pool) {
    return new PostgresAnchorService(pool);
  }
  return new MemoryAnchorService();
}

export { PostgresAnchorService, MemoryAnchorService };
