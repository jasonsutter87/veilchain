/**
 * VeilChain Anomaly Detection Service
 *
 * Detects unusual patterns in API usage that may indicate
 * abuse, attacks, or compromised credentials.
 */

import { Pool } from 'pg';

/**
 * Anomaly types
 */
export type AnomalyType =
  | 'spike_requests'        // Sudden spike in request volume
  | 'unusual_hours'         // Activity at unusual times
  | 'geographic_anomaly'    // Access from new/unusual location
  | 'endpoint_scanning'     // Systematic hitting of endpoints
  | 'error_spike'           // Sudden increase in errors
  | 'credential_stuffing'   // Multiple failed logins
  | 'api_key_abuse'         // API key used abnormally
  | 'data_exfiltration';    // Large data access patterns

/**
 * Anomaly severity levels
 */
export type AnomalySeverity = 'info' | 'warning' | 'high' | 'critical';

/**
 * Detected anomaly
 */
export interface DetectedAnomaly {
  type: AnomalyType;
  severity: AnomalySeverity;
  userId?: string;
  apiKeyId?: string;
  ipAddress?: string;
  description: string;
  details: Record<string, unknown>;
  detectedAt: Date;
  score: number; // 0-100, higher is more anomalous
}

/**
 * Detection thresholds
 */
export interface AnomalyThresholds {
  /** Requests per minute that triggers spike detection */
  requestSpikeThreshold: number;
  /** Error rate (%) that triggers alert */
  errorRateThreshold: number;
  /** Failed logins before credential stuffing alert */
  failedLoginThreshold: number;
  /** Unique endpoints per minute for scanning detection */
  endpointScanThreshold: number;
  /** Hours considered "unusual" (UTC) */
  unusualHoursStart: number;
  unusualHoursEnd: number;
  /** Minimum requests to establish baseline */
  minRequestsForBaseline: number;
}

/**
 * Default thresholds
 */
const DEFAULT_THRESHOLDS: AnomalyThresholds = {
  requestSpikeThreshold: 100, // 100 req/min
  errorRateThreshold: 25,     // 25% error rate
  failedLoginThreshold: 5,    // 5 failed logins
  endpointScanThreshold: 20,  // 20 unique endpoints/min
  unusualHoursStart: 2,       // 2 AM UTC
  unusualHoursEnd: 6,         // 6 AM UTC
  minRequestsForBaseline: 50,
};

/**
 * Anomaly detection service
 */
export class AnomalyDetectionService {
  private thresholds: AnomalyThresholds;

  constructor(
    private readonly pool: Pool,
    thresholds: Partial<AnomalyThresholds> = {}
  ) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
  }

  /**
   * Check for request spike anomaly
   */
  async checkRequestSpike(
    identifier: { userId?: string; apiKeyId?: string; ipAddress?: string }
  ): Promise<DetectedAnomaly | null> {
    const { userId, apiKeyId, ipAddress } = identifier;

    // Get current minute's request count
    const currentResult = await this.pool.query(
      `SELECT COUNT(*) as count
       FROM usage_metrics
       WHERE created_at > NOW() - INTERVAL '1 minute'
       AND (
         ($1::VARCHAR IS NOT NULL AND user_id = $1) OR
         ($2::VARCHAR IS NOT NULL AND api_key_id = $2) OR
         ($3::INET IS NOT NULL AND ip_address = $3)
       )`,
      [userId, apiKeyId, ipAddress]
    );

    const currentCount = parseInt(currentResult.rows[0].count, 10);

    if (currentCount < this.thresholds.requestSpikeThreshold) {
      return null;
    }

    // Get historical average
    const historyResult = await this.pool.query(
      `SELECT AVG(request_count) as avg_count
       FROM usage_stats_hourly
       WHERE hour_bucket > NOW() - INTERVAL '7 days'
       AND (
         ($1::VARCHAR IS NOT NULL AND user_id = $1) OR
         ($2::VARCHAR IS NOT NULL AND api_key_id = $2)
       )`,
      [userId, apiKeyId]
    );

    const avgCount = parseFloat(historyResult.rows[0].avg_count) || 0;
    const ratio = avgCount > 0 ? currentCount / (avgCount / 60) : currentCount;

    if (ratio < 3) {
      return null; // Less than 3x average, not anomalous
    }

    const severity = this.calculateSpikeSeverity(ratio);

    return {
      type: 'spike_requests',
      severity,
      userId,
      apiKeyId,
      ipAddress,
      description: `Request volume is ${ratio.toFixed(1)}x higher than normal`,
      details: {
        currentCount,
        averagePerMinute: avgCount / 60,
        ratio,
      },
      detectedAt: new Date(),
      score: Math.min(100, ratio * 10),
    };
  }

  /**
   * Check for error rate anomaly
   */
  async checkErrorSpike(
    identifier: { userId?: string; apiKeyId?: string }
  ): Promise<DetectedAnomaly | null> {
    const { userId, apiKeyId } = identifier;

    const result = await this.pool.query(
      `SELECT
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE status_code >= 400) as errors
       FROM usage_metrics
       WHERE created_at > NOW() - INTERVAL '5 minutes'
       AND (
         ($1::VARCHAR IS NOT NULL AND user_id = $1) OR
         ($2::VARCHAR IS NOT NULL AND api_key_id = $2)
       )`,
      [userId, apiKeyId]
    );

    const total = parseInt(result.rows[0].total, 10);
    const errors = parseInt(result.rows[0].errors, 10);

    if (total < 10) {
      return null; // Not enough data
    }

    const errorRate = (errors / total) * 100;

    if (errorRate < this.thresholds.errorRateThreshold) {
      return null;
    }

    return {
      type: 'error_spike',
      severity: errorRate > 50 ? 'high' : 'warning',
      userId,
      apiKeyId,
      description: `Error rate is ${errorRate.toFixed(1)}%`,
      details: {
        totalRequests: total,
        errorCount: errors,
        errorRate,
      },
      detectedAt: new Date(),
      score: Math.min(100, errorRate),
    };
  }

  /**
   * Check for credential stuffing (multiple failed logins)
   */
  async checkCredentialStuffing(ipAddress: string): Promise<DetectedAnomaly | null> {
    const result = await this.pool.query(
      `SELECT COUNT(*) as count, COUNT(DISTINCT email) as unique_emails
       FROM failed_auth_attempts
       WHERE ip_address = $1
       AND created_at > NOW() - INTERVAL '15 minutes'`,
      [ipAddress]
    );

    const count = parseInt(result.rows[0].count, 10);
    const uniqueEmails = parseInt(result.rows[0].unique_emails, 10);

    if (count < this.thresholds.failedLoginThreshold) {
      return null;
    }

    // Multiple unique emails from same IP is highly suspicious
    const isSuspicious = uniqueEmails > 3;

    return {
      type: 'credential_stuffing',
      severity: isSuspicious ? 'critical' : 'high',
      ipAddress,
      description: `${count} failed login attempts${isSuspicious ? ` for ${uniqueEmails} different emails` : ''}`,
      details: {
        failedAttempts: count,
        uniqueEmails,
        timeWindow: '15 minutes',
      },
      detectedAt: new Date(),
      score: Math.min(100, count * 10 + (isSuspicious ? 30 : 0)),
    };
  }

  /**
   * Check for endpoint scanning behavior
   */
  async checkEndpointScanning(ipAddress: string): Promise<DetectedAnomaly | null> {
    const result = await this.pool.query(
      `SELECT COUNT(DISTINCT endpoint) as unique_endpoints
       FROM usage_metrics
       WHERE ip_address = $1
       AND created_at > NOW() - INTERVAL '1 minute'`,
      [ipAddress]
    );

    const uniqueEndpoints = parseInt(result.rows[0].unique_endpoints, 10);

    if (uniqueEndpoints < this.thresholds.endpointScanThreshold) {
      return null;
    }

    return {
      type: 'endpoint_scanning',
      severity: 'high',
      ipAddress,
      description: `Hit ${uniqueEndpoints} unique endpoints in 1 minute`,
      details: {
        uniqueEndpoints,
        threshold: this.thresholds.endpointScanThreshold,
      },
      detectedAt: new Date(),
      score: Math.min(100, uniqueEndpoints * 3),
    };
  }

  /**
   * Check for unusual hour access
   */
  async checkUnusualHours(
    identifier: { userId?: string; apiKeyId?: string },
    requestHourUtc: number
  ): Promise<DetectedAnomaly | null> {
    const { userId, apiKeyId } = identifier;

    // Check if this is within unusual hours
    const { unusualHoursStart, unusualHoursEnd } = this.thresholds;
    const isUnusualHour = requestHourUtc >= unusualHoursStart && requestHourUtc < unusualHoursEnd;

    if (!isUnusualHour) {
      return null;
    }

    // Check if user/key has historical activity at this hour
    const result = await this.pool.query(
      `SELECT COUNT(*) as count
       FROM usage_stats_hourly
       WHERE EXTRACT(HOUR FROM hour_bucket) = $1
       AND hour_bucket > NOW() - INTERVAL '30 days'
       AND (
         ($2::VARCHAR IS NOT NULL AND user_id = $2) OR
         ($3::VARCHAR IS NOT NULL AND api_key_id = $3)
       )`,
      [requestHourUtc, userId, apiKeyId]
    );

    const historicalCount = parseInt(result.rows[0].count, 10);

    if (historicalCount > 0) {
      return null; // Has historical activity at this hour
    }

    return {
      type: 'unusual_hours',
      severity: 'info',
      userId,
      apiKeyId,
      description: `Activity at unusual hour (${requestHourUtc}:00 UTC)`,
      details: {
        hour: requestHourUtc,
        historicalActivityAtHour: historicalCount,
      },
      detectedAt: new Date(),
      score: 20,
    };
  }

  /**
   * Run all anomaly checks for a request
   */
  async checkRequest(context: {
    userId?: string;
    apiKeyId?: string;
    ipAddress: string;
  }): Promise<DetectedAnomaly[]> {
    const anomalies: DetectedAnomaly[] = [];
    const currentHour = new Date().getUTCHours();

    // Run checks in parallel
    const results = await Promise.allSettled([
      this.checkRequestSpike(context),
      this.checkErrorSpike(context),
      this.checkEndpointScanning(context.ipAddress),
      this.checkUnusualHours(context, currentHour),
    ]);

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        anomalies.push(result.value);
      }
    }

    return anomalies;
  }

  /**
   * Record a security event
   */
  async recordSecurityEvent(
    anomaly: DetectedAnomaly
  ): Promise<string> {
    const id = this.generateId();

    await this.pool.query(
      `INSERT INTO security_events (
        id, event_type, severity, user_id, api_key_id, ip_address,
        description, details, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        id,
        anomaly.type,
        anomaly.severity,
        anomaly.userId || null,
        anomaly.apiKeyId || null,
        anomaly.ipAddress || null,
        anomaly.description,
        JSON.stringify(anomaly.details),
        anomaly.detectedAt,
      ]
    );

    return id;
  }

  /**
   * Get recent security events
   */
  async getRecentEvents(options: {
    severity?: AnomalySeverity;
    unresolved?: boolean;
    limit?: number;
  } = {}): Promise<Array<{
    id: string;
    eventType: string;
    severity: AnomalySeverity;
    userId?: string;
    ipAddress?: string;
    description: string;
    createdAt: Date;
    resolved: boolean;
  }>> {
    const conditions: string[] = ['1=1'];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (options.severity) {
      conditions.push(`severity = $${paramIdx++}`);
      params.push(options.severity);
    }

    if (options.unresolved !== undefined) {
      conditions.push(`resolved = $${paramIdx++}`);
      params.push(!options.unresolved);
    }

    const limit = options.limit || 100;

    const result = await this.pool.query(
      `SELECT id, event_type, severity, user_id, ip_address, description, created_at, resolved
       FROM security_events
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT $${paramIdx}`,
      [...params, limit]
    );

    return result.rows.map(row => ({
      id: row.id,
      eventType: row.event_type,
      severity: row.severity as AnomalySeverity,
      userId: row.user_id,
      ipAddress: row.ip_address?.toString(),
      description: row.description,
      createdAt: new Date(row.created_at),
      resolved: row.resolved,
    }));
  }

  /**
   * Calculate severity based on spike ratio
   */
  private calculateSpikeSeverity(ratio: number): AnomalySeverity {
    if (ratio >= 10) return 'critical';
    if (ratio >= 5) return 'high';
    if (ratio >= 3) return 'warning';
    return 'info';
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `evt_${timestamp}_${random}`;
  }
}

/**
 * Create anomaly detection service
 */
export function createAnomalyDetectionService(
  pool: Pool,
  thresholds?: Partial<AnomalyThresholds>
): AnomalyDetectionService {
  return new AnomalyDetectionService(pool, thresholds);
}
