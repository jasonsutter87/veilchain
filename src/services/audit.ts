/**
 * VeilChain Audit Service
 *
 * Provides append-only audit logging for security and compliance.
 */

import { Pool } from 'pg';
import type { AuditLog, AuditAction, AuditResourceType } from '../types.js';
import { generateId } from './crypto.js';

/**
 * Audit event input
 */
export interface AuditEvent {
  userId?: string;
  apiKeyId?: string;
  action: AuditAction;
  resourceType?: AuditResourceType;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Query filters for audit logs
 */
export interface AuditQueryFilters {
  userId?: string;
  apiKeyId?: string;
  action?: AuditAction;
  resourceType?: AuditResourceType;
  resourceId?: string;
  startDate?: Date;
  endDate?: Date;
  offset?: number;
  limit?: number;
}

/**
 * Audit service for logging activity
 */
export class AuditService {
  constructor(private readonly pool: Pool) {}

  /**
   * Log an audit event
   */
  async log(event: AuditEvent): Promise<AuditLog> {
    const id = generateId();
    const now = new Date();

    const result = await this.pool.query(
      `INSERT INTO audit_logs (
        id, user_id, api_key_id, action, resource_type,
        resource_id, details, ip_address, user_agent, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        id,
        event.userId || null,
        event.apiKeyId || null,
        event.action,
        event.resourceType || null,
        event.resourceId || null,
        event.details ? JSON.stringify(event.details) : null,
        event.ipAddress || null,
        event.userAgent || null,
        now,
      ]
    );

    return this.mapRowToAuditLog(result.rows[0]);
  }

  /**
   * Query audit logs with filters
   */
  async query(filters: AuditQueryFilters = {}): Promise<{
    logs: AuditLog[];
    total: number;
  }> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (filters.userId) {
      conditions.push(`user_id = $${paramIndex++}`);
      values.push(filters.userId);
    }

    if (filters.apiKeyId) {
      conditions.push(`api_key_id = $${paramIndex++}`);
      values.push(filters.apiKeyId);
    }

    if (filters.action) {
      conditions.push(`action = $${paramIndex++}`);
      values.push(filters.action);
    }

    if (filters.resourceType) {
      conditions.push(`resource_type = $${paramIndex++}`);
      values.push(filters.resourceType);
    }

    if (filters.resourceId) {
      conditions.push(`resource_id = $${paramIndex++}`);
      values.push(filters.resourceId);
    }

    if (filters.startDate) {
      conditions.push(`created_at >= $${paramIndex++}`);
      values.push(filters.startDate);
    }

    if (filters.endDate) {
      conditions.push(`created_at <= $${paramIndex++}`);
      values.push(filters.endDate);
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    // Get total count
    const countResult = await this.pool.query(
      `SELECT COUNT(*) as total FROM audit_logs ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].total, 10);

    // Get paginated results
    const offset = filters.offset ?? 0;
    const limit = filters.limit ?? 50;

    const result = await this.pool.query(
      `SELECT * FROM audit_logs
       ${whereClause}
       ORDER BY created_at DESC
       OFFSET $${paramIndex++} LIMIT $${paramIndex}`,
      [...values, offset, limit]
    );

    return {
      logs: result.rows.map(row => this.mapRowToAuditLog(row)),
      total,
    };
  }

  /**
   * Get user activity log
   */
  async getUserActivity(
    userId: string,
    options: { offset?: number; limit?: number } = {}
  ): Promise<{ logs: AuditLog[]; total: number }> {
    return this.query({
      userId,
      offset: options.offset,
      limit: options.limit,
    });
  }

  /**
   * Get resource history
   */
  async getResourceHistory(
    resourceType: AuditResourceType,
    resourceId: string,
    options: { offset?: number; limit?: number } = {}
  ): Promise<{ logs: AuditLog[]; total: number }> {
    return this.query({
      resourceType,
      resourceId,
      offset: options.offset,
      limit: options.limit,
    });
  }

  /**
   * Get recent login attempts for a user
   */
  async getLoginAttempts(
    userId: string,
    since: Date
  ): Promise<AuditLog[]> {
    const result = await this.pool.query(
      `SELECT * FROM audit_logs
       WHERE user_id = $1
       AND action = 'login'
       AND created_at >= $2
       ORDER BY created_at DESC`,
      [userId, since]
    );

    return result.rows.map(row => this.mapRowToAuditLog(row));
  }

  /**
   * Get failed login attempts by IP
   */
  async getFailedLoginsByIp(
    ipAddress: string,
    since: Date
  ): Promise<number> {
    const result = await this.pool.query(
      `SELECT COUNT(*) as count FROM audit_logs
       WHERE ip_address = $1
       AND action = 'login'
       AND details->>'success' = 'false'
       AND created_at >= $2`,
      [ipAddress, since]
    );

    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Map database row to AuditLog object
   */
  private mapRowToAuditLog(row: Record<string, unknown>): AuditLog {
    return {
      id: row.id as string,
      userId: row.user_id as string | undefined,
      apiKeyId: row.api_key_id as string | undefined,
      action: row.action as AuditAction,
      resourceType: row.resource_type as AuditResourceType | undefined,
      resourceId: row.resource_id as string | undefined,
      details: row.details as Record<string, unknown> | undefined,
      ipAddress: row.ip_address as string | undefined,
      userAgent: row.user_agent as string | undefined,
      createdAt: new Date(row.created_at as string),
    };
  }
}
