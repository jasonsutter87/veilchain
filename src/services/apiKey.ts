/**
 * VeilChain API Key Service
 *
 * Manages API key creation, validation, and revocation.
 */

import { Pool } from 'pg';
import type { ApiKeySummary, ApiKeyType, UserTier } from '../types.js';
import { generateId, generateApiKey, hashApiKey, verifyApiKey } from './crypto.js';
import { AuditService } from './audit.js';

/**
 * API key creation options
 */
export interface CreateApiKeyOptions {
  userId: string;
  name: string;
  keyType: ApiKeyType;
  scopedLedgers?: string[];
  permissions?: Record<string, unknown>;
  expiresInDays?: number;
  rateLimitOverride?: Record<string, unknown>;
}

/**
 * API key creation result
 */
export interface CreateApiKeyResult {
  /** Full API key (only returned once!) */
  key: string;
  /** Key ID for reference */
  keyId: string;
  /** Key prefix for display */
  keyPrefix: string;
  /** Key name */
  name: string;
  /** Key type */
  keyType: ApiKeyType;
  /** Scoped ledgers (for scoped keys) */
  scopedLedgers?: string[];
  /** Creation timestamp */
  createdAt: Date;
  /** Expiration timestamp */
  expiresAt?: Date;
}

/**
 * API key validation result
 */
export interface ApiKeyValidation {
  keyId: string;
  userId: string;
  email: string;
  tier: UserTier;
  keyType: ApiKeyType;
  scopedLedgers?: string[];
  permissions?: Record<string, unknown>;
  rateLimitOverride?: Record<string, unknown>;
}

/**
 * API key service
 */
export class ApiKeyService {
  constructor(
    private readonly pool: Pool,
    private readonly auditService: AuditService
  ) {}

  /**
   * Create a new API key
   */
  async create(options: CreateApiKeyOptions): Promise<CreateApiKeyResult> {
    const id = generateId();
    const { key, prefix } = generateApiKey();
    const keyHash = await hashApiKey(key);
    const now = new Date();

    let expiresAt: Date | null = null;
    if (options.expiresInDays) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + options.expiresInDays);
    }

    await this.pool.query(
      `INSERT INTO api_keys (
        id, user_id, name, key_prefix, key_hash, key_type,
        scoped_ledgers, permissions, expires_at, rate_limit_override, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        id,
        options.userId,
        options.name,
        prefix,
        keyHash,
        options.keyType,
        options.scopedLedgers || null,
        options.permissions ? JSON.stringify(options.permissions) : null,
        expiresAt,
        options.rateLimitOverride ? JSON.stringify(options.rateLimitOverride) : null,
        now,
      ]
    );

    // Audit log
    await this.auditService.log({
      userId: options.userId,
      action: 'create_api_key',
      resourceType: 'api_key',
      resourceId: id,
      details: {
        name: options.name,
        keyType: options.keyType,
        keyPrefix: prefix,
      },
    });

    return {
      key,
      keyId: id,
      keyPrefix: prefix,
      name: options.name,
      keyType: options.keyType,
      scopedLedgers: options.scopedLedgers,
      createdAt: now,
      expiresAt: expiresAt || undefined,
    };
  }

  /**
   * Validate an API key and return validation info
   */
  async validate(keyString: string): Promise<ApiKeyValidation | null> {
    // Extract prefix for lookup
    if (!keyString.startsWith('vc_live_')) {
      return null;
    }

    const prefix = keyString.substring(0, 12);

    // Find keys with matching prefix
    const result = await this.pool.query(
      `SELECT ak.*, u.email, u.tier
       FROM api_keys ak
       JOIN users u ON ak.user_id = u.id
       WHERE ak.key_prefix = $1
       AND ak.revoked_at IS NULL
       AND (ak.expires_at IS NULL OR ak.expires_at > NOW())`,
      [prefix]
    );

    // Check each potential match
    for (const row of result.rows) {
      const isValid = await verifyApiKey(keyString, row.key_hash);
      if (isValid) {
        return {
          keyId: row.id,
          userId: row.user_id,
          email: row.email,
          tier: row.tier as UserTier,
          keyType: row.key_type as ApiKeyType,
          scopedLedgers: row.scoped_ledgers as string[] | undefined,
          permissions: row.permissions as Record<string, unknown> | undefined,
          rateLimitOverride: row.rate_limit_override as Record<string, unknown> | undefined,
        };
      }
    }

    return null;
  }

  /**
   * List API keys for a user
   */
  async list(userId: string): Promise<ApiKeySummary[]> {
    const result = await this.pool.query(
      `SELECT id, name, key_prefix, key_type, scoped_ledgers,
              expires_at, last_used_at, usage_count, created_at, revoked_at
       FROM api_keys
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    return result.rows.map(row => this.mapRowToSummary(row));
  }

  /**
   * Get a specific API key by ID
   */
  async get(userId: string, keyId: string): Promise<ApiKeySummary | null> {
    const result = await this.pool.query(
      `SELECT id, name, key_prefix, key_type, scoped_ledgers,
              expires_at, last_used_at, usage_count, created_at, revoked_at
       FROM api_keys
       WHERE id = $1 AND user_id = $2`,
      [keyId, userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToSummary(result.rows[0]);
  }

  /**
   * Revoke an API key
   */
  async revoke(userId: string, keyId: string, reason?: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE api_keys
       SET revoked_at = NOW(), revoked_reason = $1
       WHERE id = $2 AND user_id = $3 AND revoked_at IS NULL
       RETURNING key_prefix`,
      [reason || 'user_revoked', keyId, userId]
    );

    if ((result.rowCount ?? 0) > 0) {
      await this.auditService.log({
        userId,
        action: 'revoke_api_key',
        resourceType: 'api_key',
        resourceId: keyId,
        details: { reason, keyPrefix: result.rows[0].key_prefix },
      });
      return true;
    }

    return false;
  }

  /**
   * Update usage statistics for an API key
   */
  async updateUsage(keyId: string): Promise<void> {
    await this.pool.query(
      `UPDATE api_keys
       SET last_used_at = NOW(), usage_count = usage_count + 1
       WHERE id = $1`,
      [keyId]
    );
  }

  /**
   * Check if an API key can access a ledger
   */
  async canAccessLedger(
    keyId: string,
    ledgerId: string,
    action: 'read' | 'write' | 'admin'
  ): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT key_type, scoped_ledgers FROM api_keys WHERE id = $1`,
      [keyId]
    );

    if (result.rows.length === 0) {
      return false;
    }

    const { key_type, scoped_ledgers } = result.rows[0];

    // Admin keys have full access
    if (key_type === 'admin') {
      return true;
    }

    // Check action permissions
    if (action === 'admin') {
      return false; // Only admin keys can do admin actions
    }

    if (action === 'write' && key_type === 'read') {
      return false; // Read keys can't write
    }

    // Check scoped access
    if (key_type === 'scoped') {
      if (!scoped_ledgers || !scoped_ledgers.includes(ledgerId)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get usage statistics for an API key
   */
  async getUsageStats(userId: string, keyId: string): Promise<{
    usageCount: bigint;
    lastUsedAt?: Date;
    createdAt: Date;
    expiresAt?: Date;
  } | null> {
    const result = await this.pool.query(
      `SELECT usage_count, last_used_at, created_at, expires_at
       FROM api_keys
       WHERE id = $1 AND user_id = $2`,
      [keyId, userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      usageCount: BigInt(row.usage_count),
      lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : undefined,
      createdAt: new Date(row.created_at),
      expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
    };
  }

  /**
   * Map database row to ApiKeySummary
   */
  private mapRowToSummary(row: Record<string, unknown>): ApiKeySummary {
    return {
      id: row.id as string,
      name: row.name as string,
      keyPrefix: row.key_prefix as string,
      keyType: row.key_type as ApiKeyType,
      scopedLedgers: row.scoped_ledgers as string[] | undefined,
      expiresAt: row.expires_at ? new Date(row.expires_at as string) : undefined,
      lastUsedAt: row.last_used_at ? new Date(row.last_used_at as string) : undefined,
      usageCount: BigInt(row.usage_count as string),
      createdAt: new Date(row.created_at as string),
      revokedAt: row.revoked_at ? new Date(row.revoked_at as string) : undefined,
    };
  }
}
