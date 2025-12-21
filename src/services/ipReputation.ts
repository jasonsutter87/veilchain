/**
 * VeilChain IP Reputation Service
 *
 * Tracks and manages IP reputation scores based on behavior,
 * failed authentications, rate limit violations, and abuse patterns.
 */

import { Pool } from 'pg';

/**
 * Risk levels
 */
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

/**
 * IP information
 */
export interface IpInfo {
  ipAddress: string;
  reputationScore: number;
  riskLevel: RiskLevel;
  isBlocked: boolean;
  isVpn?: boolean;
  isProxy?: boolean;
  isTor?: boolean;
  isDatacenter?: boolean;
  countryCode?: string;
  asn?: string;
  asnOrg?: string;
  failedAuthCount: number;
  rateLimitHits: number;
  suspiciousActivityCount: number;
  abuseReports: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  blockedAt?: Date;
  blockedReason?: string;
  blockedUntil?: Date;
}

/**
 * Block options
 */
export interface BlockOptions {
  reason: string;
  blockedBy?: string;  // User ID who initiated block (null for automatic)
  duration?: number;   // Duration in seconds (null for permanent)
  blockType: 'manual' | 'auto_brute_force' | 'auto_rate_limit' | 'auto_abuse';
}

/**
 * Reputation update options
 */
export interface ReputationUpdate {
  failedAuth?: boolean;
  rateLimitHit?: boolean;
  suspiciousActivity?: boolean;
  abuseReport?: boolean;
  successfulRequest?: boolean;  // Can improve reputation
}

/**
 * IP reputation service
 */
export class IpReputationService {
  constructor(private readonly pool: Pool) {}

  /**
   * Get IP information
   */
  async getIpInfo(ipAddress: string): Promise<IpInfo | null> {
    const result = await this.pool.query(
      `SELECT * FROM ip_reputation WHERE ip_address = $1`,
      [ipAddress]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToIpInfo(result.rows[0]);
  }

  /**
   * Get or create IP record
   */
  async getOrCreate(ipAddress: string): Promise<IpInfo> {
    // Try to get existing
    const existing = await this.getIpInfo(ipAddress);
    if (existing) {
      return existing;
    }

    // Create new record
    await this.pool.query(
      `INSERT INTO ip_reputation (ip_address, reputation_score, risk_level)
       VALUES ($1, 100, 'low')
       ON CONFLICT (ip_address) DO NOTHING`,
      [ipAddress]
    );

    // Return the record (might have been created by another request)
    return (await this.getIpInfo(ipAddress))!;
  }

  /**
   * Update IP reputation based on behavior
   */
  async updateReputation(
    ipAddress: string,
    update: ReputationUpdate
  ): Promise<IpInfo> {
    // Ensure record exists
    await this.getOrCreate(ipAddress);

    // Build update query
    const updates: string[] = ['last_seen_at = NOW()'];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (update.failedAuth) {
      updates.push(`failed_auth_count = failed_auth_count + 1`);
    }

    if (update.rateLimitHit) {
      updates.push(`rate_limit_hits = rate_limit_hits + 1`);
    }

    if (update.suspiciousActivity) {
      updates.push(`suspicious_activity_count = suspicious_activity_count + 1`);
    }

    if (update.abuseReport) {
      updates.push(`abuse_reports = abuse_reports + 1`);
    }

    // Execute update
    params.push(ipAddress);
    await this.pool.query(
      `UPDATE ip_reputation SET ${updates.join(', ')} WHERE ip_address = $${paramIdx}`,
      params
    );

    // Recalculate reputation score
    await this.recalculateScore(ipAddress);

    // Check if should auto-block
    if (update.failedAuth || update.suspiciousActivity) {
      await this.checkAutoBlock(ipAddress);
    }

    return (await this.getIpInfo(ipAddress))!;
  }

  /**
   * Recalculate reputation score
   */
  async recalculateScore(ipAddress: string): Promise<number> {
    const result = await this.pool.query(
      `UPDATE ip_reputation
       SET reputation_score = calculate_ip_reputation(ip_address),
           risk_level = CASE
             WHEN calculate_ip_reputation(ip_address) >= 80 THEN 'low'
             WHEN calculate_ip_reputation(ip_address) >= 50 THEN 'medium'
             WHEN calculate_ip_reputation(ip_address) >= 20 THEN 'high'
             ELSE 'critical'
           END
       WHERE ip_address = $1
       RETURNING reputation_score`,
      [ipAddress]
    );

    return result.rows[0]?.reputation_score || 0;
  }

  /**
   * Check if IP should be auto-blocked
   */
  async checkAutoBlock(ipAddress: string): Promise<boolean> {
    const info = await this.getIpInfo(ipAddress);
    if (!info || info.isBlocked) {
      return false;
    }

    // Auto-block criteria
    if (info.failedAuthCount >= 10) {
      await this.blockIp(ipAddress, {
        reason: 'Excessive failed authentication attempts',
        blockType: 'auto_brute_force',
        duration: 3600, // 1 hour
      });
      return true;
    }

    if (info.rateLimitHits >= 100) {
      await this.blockIp(ipAddress, {
        reason: 'Excessive rate limit violations',
        blockType: 'auto_rate_limit',
        duration: 1800, // 30 minutes
      });
      return true;
    }

    if (info.reputationScore <= 10) {
      await this.blockIp(ipAddress, {
        reason: 'Critical reputation score',
        blockType: 'auto_abuse',
        duration: 86400, // 24 hours
      });
      return true;
    }

    return false;
  }

  /**
   * Block an IP address
   */
  async blockIp(ipAddress: string, options: BlockOptions): Promise<void> {
    // Update ip_reputation
    const expiresAt = options.duration
      ? new Date(Date.now() + options.duration * 1000)
      : null;

    await this.pool.query(
      `UPDATE ip_reputation
       SET is_blocked = TRUE,
           blocked_at = NOW(),
           blocked_reason = $2,
           blocked_until = $3
       WHERE ip_address = $1`,
      [ipAddress, options.reason, expiresAt]
    );

    // Add to blocklist
    await this.pool.query(
      `INSERT INTO ip_blocklist (ip_address, block_type, reason, blocked_by, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (ip_address) DO UPDATE
       SET block_type = $2, reason = $3, blocked_by = $4, blocked_at = NOW(), expires_at = $5`,
      [ipAddress, options.blockType, options.reason, options.blockedBy || null, expiresAt]
    );
  }

  /**
   * Unblock an IP address
   */
  async unblockIp(ipAddress: string, unblockReason?: string): Promise<void> {
    await this.pool.query(
      `UPDATE ip_reputation
       SET is_blocked = FALSE,
           blocked_at = NULL,
           blocked_reason = NULL,
           blocked_until = NULL,
           notes = COALESCE(notes, '') || E'\n' || 'Unblocked: ' || $2 || ' at ' || NOW()::TEXT
       WHERE ip_address = $1`,
      [ipAddress, unblockReason || 'Manual unblock']
    );

    await this.pool.query(
      `DELETE FROM ip_blocklist WHERE ip_address = $1`,
      [ipAddress]
    );
  }

  /**
   * Check if IP is blocked
   */
  async isBlocked(ipAddress: string): Promise<{
    blocked: boolean;
    reason?: string;
    expiresAt?: Date;
  }> {
    // Check reputation table (faster for frequent checks)
    const result = await this.pool.query(
      `SELECT is_blocked, blocked_reason, blocked_until
       FROM ip_reputation
       WHERE ip_address = $1`,
      [ipAddress]
    );

    if (result.rows.length === 0) {
      return { blocked: false };
    }

    const row = result.rows[0];

    // Check if block has expired
    if (row.is_blocked && row.blocked_until) {
      const expiresAt = new Date(row.blocked_until);
      if (expiresAt < new Date()) {
        // Block expired, unblock
        await this.unblockIp(ipAddress, 'Block expired');
        return { blocked: false };
      }
      return {
        blocked: true,
        reason: row.blocked_reason,
        expiresAt,
      };
    }

    return {
      blocked: row.is_blocked,
      reason: row.blocked_reason,
    };
  }

  /**
   * Get IPs by risk level
   */
  async getByRiskLevel(riskLevel: RiskLevel, limit: number = 100): Promise<IpInfo[]> {
    const result = await this.pool.query(
      `SELECT * FROM ip_reputation
       WHERE risk_level = $1
       ORDER BY reputation_score ASC, last_seen_at DESC
       LIMIT $2`,
      [riskLevel, limit]
    );

    return result.rows.map(row => this.mapRowToIpInfo(row));
  }

  /**
   * Get blocked IPs
   */
  async getBlockedIps(limit: number = 100): Promise<IpInfo[]> {
    const result = await this.pool.query(
      `SELECT * FROM ip_reputation
       WHERE is_blocked = TRUE
       ORDER BY blocked_at DESC
       LIMIT $1`,
      [limit]
    );

    return result.rows.map(row => this.mapRowToIpInfo(row));
  }

  /**
   * Record failed authentication
   */
  async recordFailedAuth(
    ipAddress: string,
    email?: string,
    userId?: string,
    attemptType: string = 'login',
    failureReason?: string,
    userAgent?: string
  ): Promise<void> {
    const id = this.generateId();

    // Record the attempt
    await this.pool.query(
      `INSERT INTO failed_auth_attempts (id, ip_address, email, user_id, attempt_type, failure_reason, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, ipAddress, email, userId, attemptType, failureReason, userAgent]
    );

    // Update reputation
    await this.updateReputation(ipAddress, { failedAuth: true });
  }

  /**
   * Get recent failed attempts for IP
   */
  async getRecentFailedAttempts(
    ipAddress: string,
    minutes: number = 15
  ): Promise<number> {
    const result = await this.pool.query(
      `SELECT COUNT(*) as count
       FROM failed_auth_attempts
       WHERE ip_address = $1
       AND created_at > NOW() - INTERVAL '1 minute' * $2`,
      [ipAddress, minutes]
    );

    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Decay reputation scores (run periodically)
   * Gradually improves reputation for IPs that haven't had recent issues
   */
  async decayReputationScores(): Promise<number> {
    const result = await this.pool.query(
      `UPDATE ip_reputation
       SET reputation_score = LEAST(100, reputation_score + 1),
           failed_auth_count = GREATEST(0, failed_auth_count - 1),
           rate_limit_hits = GREATEST(0, rate_limit_hits - 1)
       WHERE last_seen_at < NOW() - INTERVAL '24 hours'
       AND reputation_score < 100
       AND is_blocked = FALSE
       RETURNING ip_address`
    );

    return result.rowCount || 0;
  }

  /**
   * Map database row to IpInfo
   */
  private mapRowToIpInfo(row: Record<string, unknown>): IpInfo {
    return {
      ipAddress: (row.ip_address as { toString(): string }).toString(),
      reputationScore: row.reputation_score as number,
      riskLevel: row.risk_level as RiskLevel,
      isBlocked: row.is_blocked as boolean,
      isVpn: row.is_vpn as boolean | undefined,
      isProxy: row.is_proxy as boolean | undefined,
      isTor: row.is_tor as boolean | undefined,
      isDatacenter: row.is_datacenter as boolean | undefined,
      countryCode: row.country_code as string | undefined,
      asn: row.asn as string | undefined,
      asnOrg: row.asn_org as string | undefined,
      failedAuthCount: row.failed_auth_count as number,
      rateLimitHits: row.rate_limit_hits as number,
      suspiciousActivityCount: row.suspicious_activity_count as number,
      abuseReports: row.abuse_reports as number,
      firstSeenAt: new Date(row.first_seen_at as string),
      lastSeenAt: new Date(row.last_seen_at as string),
      blockedAt: row.blocked_at ? new Date(row.blocked_at as string) : undefined,
      blockedReason: row.blocked_reason as string | undefined,
      blockedUntil: row.blocked_until ? new Date(row.blocked_until as string) : undefined,
    };
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `fail_${timestamp}_${random}`;
  }
}

/**
 * Create IP reputation service
 */
export function createIpReputationService(pool: Pool): IpReputationService {
  return new IpReputationService(pool);
}
