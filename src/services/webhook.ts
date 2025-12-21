/**
 * VeilChain Webhook Service
 *
 * Manages webhook subscriptions and delivery for real-time notifications.
 */

import { Pool } from 'pg';
import { createHmac } from 'crypto';
import { generateId } from './crypto.js';

/**
 * Webhook event types
 */
export type WebhookEventType =
  | 'root_change'
  | 'entry_append'
  | 'ledger_create'
  | 'ledger_delete';

/**
 * Webhook status
 */
export type WebhookDeliveryStatus = 'pending' | 'success' | 'failed' | 'retrying';

/**
 * Webhook configuration
 */
export interface Webhook {
  id: string;
  userId: string;
  name: string;
  url: string;
  secret?: string;
  events: WebhookEventType[];
  ledgerIds?: string[];
  isActive: boolean;
  headers?: Record<string, string>;
  retryConfig?: {
    maxRetries: number;
    initialDelayMs: number;
    maxDelayMs: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Webhook delivery record
 */
export interface WebhookDelivery {
  id: string;
  webhookId: string;
  eventType: WebhookEventType;
  payload: Record<string, unknown>;
  status: WebhookDeliveryStatus;
  httpStatus?: number;
  responseBody?: string;
  attemptCount: number;
  nextRetryAt?: Date;
  createdAt: Date;
  completedAt?: Date;
}

/**
 * Webhook payload for root change events
 */
export interface RootChangePayload {
  eventType: 'root_change';
  ledgerId: string;
  previousRoot: string;
  newRoot: string;
  entryCount: string;
  timestamp: string;
}

/**
 * Webhook payload for entry append events
 */
export interface EntryAppendPayload {
  eventType: 'entry_append';
  ledgerId: string;
  entryId: string;
  position: string;
  hash: string;
  newRoot: string;
  timestamp: string;
}

/**
 * Create webhook options
 */
export interface CreateWebhookOptions {
  userId: string;
  name: string;
  url: string;
  secret?: string;
  events: WebhookEventType[];
  ledgerIds?: string[];
  headers?: Record<string, string>;
  retryConfig?: {
    maxRetries: number;
    initialDelayMs: number;
    maxDelayMs: number;
  };
}

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG = {
  maxRetries: 5,
  initialDelayMs: 1000,
  maxDelayMs: 300000, // 5 minutes
};

/**
 * Webhook service
 */
export class WebhookService {
  constructor(private readonly pool: Pool) {}

  /**
   * Create a new webhook
   */
  async create(options: CreateWebhookOptions): Promise<Webhook> {
    const id = generateId();
    const now = new Date();

    const result = await this.pool.query(
      `INSERT INTO webhooks (
        id, user_id, name, url, secret, events, ledger_ids,
        headers, retry_config, is_active, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, $10, $10)
      RETURNING *`,
      [
        id,
        options.userId,
        options.name,
        options.url,
        options.secret || null,
        options.events,
        options.ledgerIds || null,
        options.headers ? JSON.stringify(options.headers) : null,
        options.retryConfig ? JSON.stringify(options.retryConfig) : null,
        now,
      ]
    );

    return this.mapRowToWebhook(result.rows[0]);
  }

  /**
   * List webhooks for a user
   */
  async list(userId: string): Promise<Webhook[]> {
    const result = await this.pool.query(
      `SELECT * FROM webhooks WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );

    return result.rows.map(row => this.mapRowToWebhook(row));
  }

  /**
   * Get a webhook by ID
   */
  async get(userId: string, webhookId: string): Promise<Webhook | null> {
    const result = await this.pool.query(
      `SELECT * FROM webhooks WHERE id = $1 AND user_id = $2`,
      [webhookId, userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToWebhook(result.rows[0]);
  }

  /**
   * Update a webhook
   */
  async update(
    userId: string,
    webhookId: string,
    updates: Partial<CreateWebhookOptions>
  ): Promise<Webhook | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (updates.name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(updates.name);
    }

    if (updates.url !== undefined) {
      fields.push(`url = $${idx++}`);
      values.push(updates.url);
    }

    if (updates.secret !== undefined) {
      fields.push(`secret = $${idx++}`);
      values.push(updates.secret);
    }

    if (updates.events !== undefined) {
      fields.push(`events = $${idx++}`);
      values.push(updates.events);
    }

    if (updates.ledgerIds !== undefined) {
      fields.push(`ledger_ids = $${idx++}`);
      values.push(updates.ledgerIds);
    }

    if (updates.headers !== undefined) {
      fields.push(`headers = $${idx++}`);
      values.push(JSON.stringify(updates.headers));
    }

    if (fields.length === 0) {
      return this.get(userId, webhookId);
    }

    values.push(webhookId, userId);

    const result = await this.pool.query(
      `UPDATE webhooks SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${idx++} AND user_id = $${idx++}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToWebhook(result.rows[0]);
  }

  /**
   * Delete a webhook
   */
  async delete(userId: string, webhookId: string): Promise<boolean> {
    const result = await this.pool.query(
      `DELETE FROM webhooks WHERE id = $1 AND user_id = $2`,
      [webhookId, userId]
    );

    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Toggle webhook active state
   */
  async setActive(userId: string, webhookId: string, isActive: boolean): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE webhooks SET is_active = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3`,
      [isActive, webhookId, userId]
    );

    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Get all active webhooks for an event
   */
  async getWebhooksForEvent(
    eventType: WebhookEventType,
    ledgerId: string
  ): Promise<Webhook[]> {
    const result = await this.pool.query(
      `SELECT * FROM webhooks
       WHERE is_active = TRUE
       AND $1 = ANY(events)
       AND (ledger_ids IS NULL OR $2 = ANY(ledger_ids))`,
      [eventType, ledgerId]
    );

    return result.rows.map(row => this.mapRowToWebhook(row));
  }

  /**
   * Queue a webhook delivery
   */
  async queueDelivery(
    webhookId: string,
    eventType: WebhookEventType,
    payload: Record<string, unknown>
  ): Promise<string> {
    const id = generateId();

    await this.pool.query(
      `INSERT INTO webhook_deliveries (
        id, webhook_id, event_type, payload, status, attempt_count, created_at
      ) VALUES ($1, $2, $3, $4, 'pending', 0, NOW())`,
      [id, webhookId, eventType, JSON.stringify(payload)]
    );

    return id;
  }

  /**
   * Get pending deliveries for processing
   */
  async getPendingDeliveries(limit: number = 100): Promise<Array<{
    delivery: WebhookDelivery;
    webhook: Webhook;
  }>> {
    const result = await this.pool.query(
      `SELECT d.*, w.url, w.secret, w.headers, w.retry_config
       FROM webhook_deliveries d
       JOIN webhooks w ON d.webhook_id = w.id
       WHERE w.is_active = TRUE
       AND (d.status = 'pending' OR (d.status = 'retrying' AND d.next_retry_at <= NOW()))
       ORDER BY d.created_at ASC
       LIMIT $1`,
      [limit]
    );

    return result.rows.map(row => ({
      delivery: this.mapRowToDelivery(row),
      webhook: {
        id: row.webhook_id,
        userId: '',
        name: '',
        url: row.url,
        secret: row.secret,
        events: [],
        isActive: true,
        headers: row.headers as Record<string, string> | undefined,
        retryConfig: row.retry_config as Webhook['retryConfig'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }));
  }

  /**
   * Mark delivery as successful
   */
  async markDeliverySuccess(
    deliveryId: string,
    httpStatus: number,
    responseBody?: string
  ): Promise<void> {
    await this.pool.query(
      `UPDATE webhook_deliveries
       SET status = 'success', http_status = $2, response_body = $3,
           completed_at = NOW(), attempt_count = attempt_count + 1
       WHERE id = $1`,
      [deliveryId, httpStatus, responseBody?.substring(0, 10000)]
    );
  }

  /**
   * Mark delivery as failed (will retry if attempts remaining)
   */
  async markDeliveryFailed(
    deliveryId: string,
    httpStatus: number | null,
    responseBody: string | null,
    retryConfig = DEFAULT_RETRY_CONFIG
  ): Promise<void> {
    // Get current attempt count
    const result = await this.pool.query(
      `SELECT attempt_count FROM webhook_deliveries WHERE id = $1`,
      [deliveryId]
    );

    const attemptCount = (result.rows[0]?.attempt_count || 0) + 1;

    if (attemptCount >= retryConfig.maxRetries) {
      // Max retries reached, mark as failed
      await this.pool.query(
        `UPDATE webhook_deliveries
         SET status = 'failed', http_status = $2, response_body = $3,
             completed_at = NOW(), attempt_count = $4
         WHERE id = $1`,
        [deliveryId, httpStatus, responseBody?.substring(0, 10000), attemptCount]
      );
    } else {
      // Schedule retry with exponential backoff
      const delay = Math.min(
        retryConfig.initialDelayMs * Math.pow(2, attemptCount - 1),
        retryConfig.maxDelayMs
      );
      const nextRetry = new Date(Date.now() + delay);

      await this.pool.query(
        `UPDATE webhook_deliveries
         SET status = 'retrying', http_status = $2, response_body = $3,
             attempt_count = $4, next_retry_at = $5
         WHERE id = $1`,
        [deliveryId, httpStatus, responseBody?.substring(0, 10000), attemptCount, nextRetry]
      );
    }
  }

  /**
   * Trigger webhooks for a root change event
   */
  async triggerRootChange(
    ledgerId: string,
    previousRoot: string,
    newRoot: string,
    entryCount: bigint
  ): Promise<number> {
    const webhooks = await this.getWebhooksForEvent('root_change', ledgerId);

    const payload = {
      eventType: 'root_change',
      ledgerId,
      previousRoot,
      newRoot,
      entryCount: entryCount.toString(),
      timestamp: new Date().toISOString(),
    } as Record<string, unknown>;

    for (const webhook of webhooks) {
      await this.queueDelivery(webhook.id, 'root_change', payload);
    }

    return webhooks.length;
  }

  /**
   * Trigger webhooks for an entry append event
   */
  async triggerEntryAppend(
    ledgerId: string,
    entryId: string,
    position: bigint,
    hash: string,
    newRoot: string
  ): Promise<number> {
    const webhooks = await this.getWebhooksForEvent('entry_append', ledgerId);

    const payload = {
      eventType: 'entry_append',
      ledgerId,
      entryId,
      position: position.toString(),
      hash,
      newRoot,
      timestamp: new Date().toISOString(),
    } as Record<string, unknown>;

    for (const webhook of webhooks) {
      await this.queueDelivery(webhook.id, 'entry_append', payload);
    }

    return webhooks.length;
  }

  /**
   * Sign a webhook payload
   */
  signPayload(payload: string, secret: string): string {
    return createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
  }

  /**
   * Get delivery statistics for a webhook
   */
  async getDeliveryStats(webhookId: string): Promise<{
    total: number;
    success: number;
    failed: number;
    pending: number;
  }> {
    const result = await this.pool.query(
      `SELECT status, COUNT(*) as count
       FROM webhook_deliveries
       WHERE webhook_id = $1
       GROUP BY status`,
      [webhookId]
    );

    const stats = { total: 0, success: 0, failed: 0, pending: 0 };
    for (const row of result.rows) {
      const count = parseInt(row.count, 10);
      stats.total += count;
      switch (row.status) {
        case 'success':
          stats.success = count;
          break;
        case 'failed':
          stats.failed = count;
          break;
        case 'pending':
        case 'retrying':
          stats.pending += count;
          break;
      }
    }

    return stats;
  }

  /**
   * Map database row to Webhook
   */
  private mapRowToWebhook(row: Record<string, unknown>): Webhook {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      name: row.name as string,
      url: row.url as string,
      secret: row.secret as string | undefined,
      events: row.events as WebhookEventType[],
      ledgerIds: row.ledger_ids as string[] | undefined,
      isActive: row.is_active as boolean,
      headers: row.headers as Record<string, string> | undefined,
      retryConfig: row.retry_config as Webhook['retryConfig'],
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  /**
   * Map database row to WebhookDelivery
   */
  private mapRowToDelivery(row: Record<string, unknown>): WebhookDelivery {
    return {
      id: row.id as string,
      webhookId: row.webhook_id as string,
      eventType: row.event_type as WebhookEventType,
      payload: row.payload as Record<string, unknown>,
      status: row.status as WebhookDeliveryStatus,
      httpStatus: row.http_status as number | undefined,
      responseBody: row.response_body as string | undefined,
      attemptCount: row.attempt_count as number,
      nextRetryAt: row.next_retry_at ? new Date(row.next_retry_at as string) : undefined,
      createdAt: new Date(row.created_at as string),
      completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
    };
  }
}

/**
 * Create webhook service
 */
export function createWebhookService(pool: Pool): WebhookService {
  return new WebhookService(pool);
}
