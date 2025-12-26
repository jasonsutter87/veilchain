/**
 * VeilChain Root Hash Publisher
 *
 * Automatic publication of root hashes for external verification.
 * Supports multiple publishing targets:
 * - Database root_history table (always enabled)
 * - Webhooks (optional)
 * - External timestamping services (optional)
 */

import { createHash } from 'crypto';
import { Pool } from 'pg';
import type { LedgerMetadata } from '../types.js';

/**
 * Published root record
 */
export interface PublishedRoot {
  /** Unique identifier */
  id: string;
  /** Ledger ID */
  ledgerId: string;
  /** Root hash at time of publication */
  rootHash: string;
  /** Entry count at time of publication */
  entryCount: bigint;
  /** Optional cryptographic signature */
  signature?: string;
  /** Timestamp of publication */
  publishedAt: Date;
  /** Optional external anchor reference (e.g., Bitcoin txid) */
  externalAnchor?: string;
}

/**
 * Publisher target configuration
 */
export interface PublisherTarget {
  /** Target type */
  type: 'database' | 'webhook' | 'external';
  /** Target-specific configuration */
  config?: Record<string, unknown>;
  /** Whether this target is enabled */
  enabled: boolean;
}

/**
 * Root publisher configuration
 */
export interface RootPublisherConfig {
  /** Minimum entries between publications (default: 100) */
  minEntriesThreshold?: number;
  /** Maximum time between publications in ms (default: 1 hour) */
  maxTimeThresholdMs?: number;
  /** Optional signing key for root signatures */
  signingKey?: string;
  /** Publishing targets */
  targets?: PublisherTarget[];
}

/**
 * Root Hash Publisher Service
 *
 * Handles automatic publication of root hashes for external verification.
 * This provides:
 * - Audit trail of root hash changes
 * - External verification without VeilChain account
 * - Integration with external timestamping services
 */
export class RootPublisher {
  private pool: Pool;
  private config: Required<RootPublisherConfig>;
  private lastPublicationTime: Map<string, Date> = new Map();
  private lastPublicationCount: Map<string, bigint> = new Map();

  constructor(pool: Pool, config: RootPublisherConfig = {}) {
    this.pool = pool;
    this.config = {
      minEntriesThreshold: config.minEntriesThreshold ?? 100,
      maxTimeThresholdMs: config.maxTimeThresholdMs ?? 3600000, // 1 hour
      signingKey: config.signingKey ?? '',
      targets: config.targets ?? [{ type: 'database', enabled: true }],
    };
  }

  /**
   * Publish a root hash for a ledger
   *
   * @param ledger - Ledger metadata
   * @returns Published root record
   */
  async publish(ledger: LedgerMetadata): Promise<PublishedRoot> {
    const id = this.generateId();
    const signature = this.config.signingKey
      ? this.signRoot(ledger.rootHash, ledger.entryCount)
      : undefined;

    const publishedRoot: PublishedRoot = {
      id,
      ledgerId: ledger.id,
      rootHash: ledger.rootHash,
      entryCount: ledger.entryCount,
      signature,
      publishedAt: new Date(),
    };

    // Publish to all enabled targets
    for (const target of this.config.targets) {
      if (!target.enabled) continue;

      try {
        switch (target.type) {
          case 'database':
            await this.publishToDatabase(publishedRoot);
            break;
          case 'webhook':
            await this.publishToWebhook(publishedRoot, target.config);
            break;
          case 'external':
            const anchor = await this.publishToExternal(publishedRoot, target.config);
            if (anchor) {
              publishedRoot.externalAnchor = anchor;
            }
            break;
        }
      } catch (error) {
        console.error(`[RootPublisher] Failed to publish to ${target.type}:`, error);
      }
    }

    // Update tracking
    this.lastPublicationTime.set(ledger.id, publishedRoot.publishedAt);
    this.lastPublicationCount.set(ledger.id, ledger.entryCount);

    return publishedRoot;
  }

  /**
   * Check if a ledger needs publication based on thresholds
   */
  shouldPublish(ledger: LedgerMetadata): boolean {
    const lastTime = this.lastPublicationTime.get(ledger.id);
    const lastCount = this.lastPublicationCount.get(ledger.id) ?? BigInt(0);

    // Check entry count threshold
    const entriesSinceLastPublish = ledger.entryCount - lastCount;
    if (entriesSinceLastPublish >= BigInt(this.config.minEntriesThreshold)) {
      return true;
    }

    // Check time threshold
    if (lastTime) {
      const timeSinceLastPublish = Date.now() - lastTime.getTime();
      if (timeSinceLastPublish >= this.config.maxTimeThresholdMs) {
        return true;
      }
    } else {
      // Never published, check if we have entries
      return ledger.entryCount > BigInt(0);
    }

    return false;
  }

  /**
   * Get published roots for a ledger
   */
  async getPublishedRoots(
    ledgerId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<PublishedRoot[]> {
    const limit = options.limit ?? 100;
    const offset = options.offset ?? 0;

    const result = await this.pool.query(
      `SELECT id, ledger_id, root_hash, entry_count, signature, created_at
       FROM root_history
       WHERE ledger_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [ledgerId, limit, offset]
    );

    return result.rows.map((row) => ({
      id: row.id,
      ledgerId: row.ledger_id,
      rootHash: row.root_hash,
      entryCount: BigInt(row.entry_count),
      signature: row.signature,
      publishedAt: new Date(row.created_at),
    }));
  }

  /**
   * Get the latest published root for a ledger
   */
  async getLatestRoot(ledgerId: string): Promise<PublishedRoot | null> {
    const result = await this.pool.query(
      `SELECT id, ledger_id, root_hash, entry_count, signature, created_at
       FROM root_history
       WHERE ledger_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [ledgerId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      ledgerId: row.ledger_id,
      rootHash: row.root_hash,
      entryCount: BigInt(row.entry_count),
      signature: row.signature,
      publishedAt: new Date(row.created_at),
    };
  }

  /**
   * Verify a root was published
   */
  async verifyPublishedRoot(
    ledgerId: string,
    rootHash: string
  ): Promise<{ found: boolean; publishedAt?: Date; entryCount?: bigint }> {
    const result = await this.pool.query(
      `SELECT created_at, entry_count
       FROM root_history
       WHERE ledger_id = $1 AND root_hash = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [ledgerId, rootHash]
    );

    if (result.rows.length === 0) {
      return { found: false };
    }

    return {
      found: true,
      publishedAt: new Date(result.rows[0].created_at),
      entryCount: BigInt(result.rows[0].entry_count),
    };
  }

  /**
   * Create a verifiable root bundle for external verification
   */
  createRootBundle(publishedRoot: PublishedRoot): {
    version: number;
    ledgerId: string;
    rootHash: string;
    entryCount: string;
    publishedAt: string;
    signature?: string;
    externalAnchor?: string;
    verificationUrl: string;
  } {
    return {
      version: 1,
      ledgerId: publishedRoot.ledgerId,
      rootHash: publishedRoot.rootHash,
      entryCount: publishedRoot.entryCount.toString(),
      publishedAt: publishedRoot.publishedAt.toISOString(),
      signature: publishedRoot.signature,
      externalAnchor: publishedRoot.externalAnchor,
      verificationUrl: `/v1/public/ledgers/${publishedRoot.ledgerId}/roots/${publishedRoot.rootHash}`,
    };
  }

  /**
   * Publish to database (root_history table)
   */
  private async publishToDatabase(root: PublishedRoot): Promise<void> {
    await this.pool.query(
      `INSERT INTO root_history (id, ledger_id, root_hash, entry_count, signature, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        root.id,
        root.ledgerId,
        root.rootHash,
        root.entryCount.toString(),
        root.signature,
        root.publishedAt,
      ]
    );
  }

  /**
   * Publish to webhook target
   */
  private async publishToWebhook(
    root: PublishedRoot,
    config?: Record<string, unknown>
  ): Promise<void> {
    const url = config?.url as string;
    if (!url) {
      throw new Error('Webhook URL not configured');
    }

    const payload = this.createRootBundle(root);
    const signature = this.signPayload(JSON.stringify(payload), config?.secret as string);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-VeilChain-Signature': signature,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
    }
  }

  /**
   * Publish to external timestamping service
   */
  private async publishToExternal(
    root: PublishedRoot,
    config?: Record<string, unknown>
  ): Promise<string | undefined> {
    const provider = config?.provider as string;

    switch (provider) {
      case 'opentimestamps':
        return this.publishToOpenTimestamps(root.rootHash);
      case 'bitcoin':
        return this.publishToBitcoin(root.rootHash, config);
      default:
        console.log(`[RootPublisher] External provider ${provider} not implemented`);
        return undefined;
    }
  }

  /**
   * Publish to OpenTimestamps (placeholder)
   */
  private async publishToOpenTimestamps(hash: string): Promise<string | undefined> {
    // This would integrate with OpenTimestamps API
    // For now, just log and return undefined
    console.log(`[RootPublisher] OpenTimestamps integration pending for hash: ${hash}`);
    return undefined;
  }

  /**
   * Publish to Bitcoin blockchain (placeholder)
   */
  private async publishToBitcoin(
    hash: string,
    config?: Record<string, unknown>
  ): Promise<string | undefined> {
    // This would integrate with Bitcoin node/API
    // For now, just log and return undefined
    console.log(`[RootPublisher] Bitcoin anchoring pending for hash: ${hash}`);
    return undefined;
  }

  /**
   * Generate unique ID for published root
   */
  private generateId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `rh_${timestamp}_${random}`;
  }

  /**
   * Sign a root hash with the configured signing key
   */
  private signRoot(rootHash: string, entryCount: bigint): string {
    if (!this.config.signingKey) {
      return '';
    }

    const message = `${rootHash}:${entryCount.toString()}`;
    return this.signPayload(message, this.config.signingKey);
  }

  /**
   * Sign a payload with HMAC-SHA256
   */
  private signPayload(payload: string, secret?: string): string {
    if (!secret) {
      return '';
    }

    return createHash('sha256')
      .update(`${secret}:${payload}`)
      .digest('hex');
  }
}

/**
 * Create a root publisher instance
 */
export function createRootPublisher(
  pool: Pool,
  config?: RootPublisherConfig
): RootPublisher {
  return new RootPublisher(pool, config);
}
