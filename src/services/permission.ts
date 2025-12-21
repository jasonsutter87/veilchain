/**
 * VeilChain Permission Service
 *
 * Manages ledger-level access control for multi-tenancy.
 */

import { Pool } from 'pg';
import type { LedgerPermission, LedgerRole } from '../types.js';
import { generateId } from './crypto.js';
import { AuditService } from './audit.js';

/**
 * Permission check result
 */
export interface PermissionCheck {
  allowed: boolean;
  role?: LedgerRole;
  reason?: string;
}

/**
 * User access to a ledger
 */
export interface LedgerAccess {
  ledgerId: string;
  ledgerName: string;
  role: LedgerRole;
  grantedAt: Date;
  expiresAt?: Date;
}

/**
 * User with access to a ledger
 */
export interface UserAccess {
  userId: string;
  userEmail: string;
  userName?: string;
  role: LedgerRole;
  grantedAt: Date;
  grantedBy?: string;
  expiresAt?: Date;
}

/**
 * Permission service for ledger access control
 */
export class PermissionService {
  constructor(
    private readonly pool: Pool,
    private readonly auditService: AuditService
  ) {}

  /**
   * Grant access to a ledger
   */
  async grantAccess(
    ledgerId: string,
    userId: string,
    role: LedgerRole,
    grantedBy: string,
    expiresAt?: Date
  ): Promise<LedgerPermission> {
    const id = generateId();
    const now = new Date();

    // Use upsert to handle existing permissions
    const result = await this.pool.query(
      `INSERT INTO ledger_permissions (
        id, ledger_id, user_id, role, granted_by, granted_at, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (ledger_id, user_id)
      DO UPDATE SET role = $4, granted_by = $5, granted_at = $6, expires_at = $7
      RETURNING *`,
      [id, ledgerId, userId, role, grantedBy, now, expiresAt || null]
    );

    await this.auditService.log({
      userId: grantedBy,
      action: 'grant_permission',
      resourceType: 'permission',
      resourceId: result.rows[0].id,
      details: {
        ledgerId,
        targetUserId: userId,
        role,
      },
    });

    return this.mapRowToPermission(result.rows[0]);
  }

  /**
   * Revoke access to a ledger
   */
  async revokeAccess(
    ledgerId: string,
    userId: string,
    revokedBy: string
  ): Promise<boolean> {
    const result = await this.pool.query(
      `DELETE FROM ledger_permissions
       WHERE ledger_id = $1 AND user_id = $2
       RETURNING id`,
      [ledgerId, userId]
    );

    if ((result.rowCount ?? 0) > 0) {
      await this.auditService.log({
        userId: revokedBy,
        action: 'revoke_permission',
        resourceType: 'permission',
        resourceId: result.rows[0].id,
        details: {
          ledgerId,
          targetUserId: userId,
        },
      });
      return true;
    }

    return false;
  }

  /**
   * Get user's access to a ledger
   */
  async getAccess(ledgerId: string, userId: string): Promise<LedgerPermission | null> {
    const result = await this.pool.query(
      `SELECT * FROM ledger_permissions
       WHERE ledger_id = $1 AND user_id = $2
       AND (expires_at IS NULL OR expires_at > NOW())`,
      [ledgerId, userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToPermission(result.rows[0]);
  }

  /**
   * List all ledgers a user has access to
   */
  async listUserLedgers(userId: string): Promise<LedgerAccess[]> {
    const result = await this.pool.query(
      `SELECT lp.*, l.name as ledger_name
       FROM ledger_permissions lp
       JOIN ledgers l ON lp.ledger_id = l.id
       WHERE lp.user_id = $1
       AND (lp.expires_at IS NULL OR lp.expires_at > NOW())
       ORDER BY lp.granted_at DESC`,
      [userId]
    );

    return result.rows.map(row => ({
      ledgerId: row.ledger_id,
      ledgerName: row.ledger_name,
      role: row.role as LedgerRole,
      grantedAt: new Date(row.granted_at),
      expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
    }));
  }

  /**
   * List all users with access to a ledger
   */
  async listLedgerUsers(ledgerId: string): Promise<UserAccess[]> {
    const result = await this.pool.query(
      `SELECT lp.*, u.email as user_email, u.name as user_name
       FROM ledger_permissions lp
       JOIN users u ON lp.user_id = u.id
       WHERE lp.ledger_id = $1
       AND (lp.expires_at IS NULL OR lp.expires_at > NOW())
       ORDER BY lp.granted_at DESC`,
      [ledgerId]
    );

    return result.rows.map(row => ({
      userId: row.user_id,
      userEmail: row.user_email,
      userName: row.user_name || undefined,
      role: row.role as LedgerRole,
      grantedAt: new Date(row.granted_at),
      grantedBy: row.granted_by || undefined,
      expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
    }));
  }

  /**
   * Check if user can read a ledger
   */
  async canRead(userId: string, ledgerId: string): Promise<boolean> {
    const check = await this.checkPermission(userId, ledgerId, ['owner', 'admin', 'write', 'read']);
    return check.allowed;
  }

  /**
   * Check if user can write to a ledger
   */
  async canWrite(userId: string, ledgerId: string): Promise<boolean> {
    const check = await this.checkPermission(userId, ledgerId, ['owner', 'admin', 'write']);
    return check.allowed;
  }

  /**
   * Check if user can administer a ledger
   */
  async canAdmin(userId: string, ledgerId: string): Promise<boolean> {
    const check = await this.checkPermission(userId, ledgerId, ['owner', 'admin']);
    return check.allowed;
  }

  /**
   * Check if user is the owner of a ledger
   */
  async isOwner(userId: string, ledgerId: string): Promise<boolean> {
    // Check both permission table and ledger owner_id
    const result = await this.pool.query(
      `SELECT 1 FROM ledgers WHERE id = $1 AND owner_id = $2
       UNION
       SELECT 1 FROM ledger_permissions
       WHERE ledger_id = $1 AND user_id = $2 AND role = 'owner'
       AND (expires_at IS NULL OR expires_at > NOW())`,
      [ledgerId, userId]
    );

    return result.rows.length > 0;
  }

  /**
   * Check permission with detailed result
   */
  async checkPermission(
    userId: string,
    ledgerId: string,
    allowedRoles: LedgerRole[]
  ): Promise<PermissionCheck> {
    // First check if user is the ledger owner
    const ownerCheck = await this.pool.query(
      `SELECT 1 FROM ledgers WHERE id = $1 AND owner_id = $2`,
      [ledgerId, userId]
    );

    if (ownerCheck.rows.length > 0) {
      return { allowed: true, role: 'owner' };
    }

    // Check permission table
    const result = await this.pool.query(
      `SELECT role FROM ledger_permissions
       WHERE ledger_id = $1 AND user_id = $2
       AND (expires_at IS NULL OR expires_at > NOW())`,
      [ledgerId, userId]
    );

    if (result.rows.length === 0) {
      return { allowed: false, reason: 'No permission granted' };
    }

    const role = result.rows[0].role as LedgerRole;
    if (allowedRoles.includes(role)) {
      return { allowed: true, role };
    }

    return {
      allowed: false,
      role,
      reason: `Role '${role}' is not sufficient. Required: ${allowedRoles.join(', ')}`,
    };
  }

  /**
   * Map database row to LedgerPermission
   */
  private mapRowToPermission(row: Record<string, unknown>): LedgerPermission {
    return {
      id: row.id as string,
      ledgerId: row.ledger_id as string,
      userId: row.user_id as string,
      role: row.role as LedgerRole,
      grantedBy: row.granted_by as string | undefined,
      grantedAt: new Date(row.granted_at as string),
      expiresAt: row.expires_at ? new Date(row.expires_at as string) : undefined,
    };
  }
}
