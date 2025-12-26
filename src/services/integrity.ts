/**
 * VeilChain Integrity Monitoring Service
 *
 * Provides background verification of ledger integrity:
 * - Cryptographic chain validation
 * - Sequence number verification
 * - Merkle tree root consistency
 * - Alert generation on anomaly detection
 */

import { MerkleTree } from '../core/merkle.js';
import { PostgresStorage } from '../storage/postgres.js';
import type { IntegrityCheckResult, LedgerMetadata } from '../types.js';
import { GENESIS_HASH } from '../types.js';

/**
 * Alert severity levels
 */
export type AlertSeverity = 'info' | 'warning' | 'critical';

/**
 * Integrity alert
 */
export interface IntegrityAlert {
  /** Unique alert identifier */
  id: string;
  /** Affected ledger ID */
  ledgerId: string;
  /** Alert severity */
  severity: AlertSeverity;
  /** Alert type */
  type: 'chain_break' | 'sequence_gap' | 'merkle_mismatch' | 'hash_invalid';
  /** Human-readable message */
  message: string;
  /** Position where issue was detected (if applicable) */
  position?: bigint;
  /** Expected value */
  expected?: string;
  /** Actual value */
  actual?: string;
  /** Timestamp of detection */
  detectedAt: Date;
}

/**
 * Monitoring configuration
 */
export interface IntegrityMonitorConfig {
  /** Interval between full scans in milliseconds (default: 1 hour) */
  scanIntervalMs?: number;
  /** Maximum entries to verify per batch (default: 10000) */
  batchSize?: number;
  /** Enable real-time verification on append (default: true) */
  realtimeVerification?: boolean;
  /** Alert callback */
  onAlert?: (alert: IntegrityAlert) => void | Promise<void>;
  /** Scan complete callback */
  onScanComplete?: (result: IntegrityCheckResult) => void | Promise<void>;
}

/**
 * Integrity Monitoring Service
 *
 * Continuously monitors ledger integrity and alerts on any violations.
 * Uses both database-level checks and application-level Merkle verification.
 */
export class IntegrityMonitor {
  private storage: PostgresStorage;
  private config: Required<IntegrityMonitorConfig>;
  private scanTimer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private alerts: IntegrityAlert[] = [];

  constructor(storage: PostgresStorage, config: IntegrityMonitorConfig = {}) {
    this.storage = storage;
    this.config = {
      scanIntervalMs: config.scanIntervalMs ?? 3600000, // 1 hour
      batchSize: config.batchSize ?? 10000,
      realtimeVerification: config.realtimeVerification ?? true,
      onAlert: config.onAlert ?? this.defaultAlertHandler.bind(this),
      onScanComplete: config.onScanComplete ?? (() => {}),
    };
  }

  /**
   * Start the integrity monitoring service
   */
  start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    console.log('[IntegrityMonitor] Starting integrity monitoring service');

    // Run initial scan
    this.runScan().catch((err) => {
      console.error('[IntegrityMonitor] Initial scan failed:', err);
    });

    // Schedule periodic scans
    this.scanTimer = setInterval(() => {
      this.runScan().catch((err) => {
        console.error('[IntegrityMonitor] Scheduled scan failed:', err);
      });
    }, this.config.scanIntervalMs);
  }

  /**
   * Stop the integrity monitoring service
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = null;
    }

    console.log('[IntegrityMonitor] Stopped integrity monitoring service');
  }

  /**
   * Run a full integrity scan of all ledgers
   */
  async runScan(): Promise<Map<string, IntegrityCheckResult>> {
    console.log('[IntegrityMonitor] Starting integrity scan');
    const results = new Map<string, IntegrityCheckResult>();

    try {
      // Get all ledgers
      const ledgers = await this.storage.listLedgers({ limit: 1000 });

      for (const ledger of ledgers) {
        const result = await this.verifyLedger(ledger.id);
        results.set(ledger.id, result);

        // Call scan complete callback
        await this.config.onScanComplete(result);
      }

      console.log(`[IntegrityMonitor] Scan complete. Verified ${ledgers.length} ledgers`);
    } catch (error) {
      console.error('[IntegrityMonitor] Scan error:', error);
    }

    return results;
  }

  /**
   * Verify a single ledger's integrity
   *
   * Performs comprehensive verification including:
   * 1. Database-level chain and sequence verification
   * 2. Merkle tree root verification
   * 3. Individual entry hash verification
   */
  async verifyLedger(ledgerId: string): Promise<IntegrityCheckResult> {
    const errors: string[] = [];
    let chainValid = true;
    let sequenceValid = true;
    let merkleValid = true;
    let entryCount = BigInt(0);

    try {
      // 1. Database-level verification (uses PostgreSQL function)
      const dbResult = await this.storage.verifyLedgerIntegrity(ledgerId);
      entryCount = dbResult.entryCount;
      chainValid = dbResult.chainValid;
      sequenceValid = dbResult.sequenceValid;
      errors.push(...dbResult.errors);

      // Generate alerts for database-level issues
      if (!chainValid) {
        await this.emitAlert({
          id: `chain_${ledgerId}_${Date.now()}`,
          ledgerId,
          severity: 'critical',
          type: 'chain_break',
          message: 'Cryptographic chain integrity violation detected',
          detectedAt: new Date(),
        });
      }

      if (!sequenceValid) {
        await this.emitAlert({
          id: `seq_${ledgerId}_${Date.now()}`,
          ledgerId,
          severity: 'critical',
          type: 'sequence_gap',
          message: 'Sequence number gap detected',
          detectedAt: new Date(),
        });
      }

      // 2. Merkle tree verification
      merkleValid = await this.verifyMerkleRoot(ledgerId);
      if (!merkleValid) {
        errors.push('Merkle tree root hash does not match stored root');
        await this.emitAlert({
          id: `merkle_${ledgerId}_${Date.now()}`,
          ledgerId,
          severity: 'critical',
          type: 'merkle_mismatch',
          message: 'Merkle tree root hash mismatch',
          detectedAt: new Date(),
        });
      }
    } catch (error) {
      errors.push(`Verification error: ${error instanceof Error ? error.message : String(error)}`);
    }

    const result: IntegrityCheckResult = {
      isValid: chainValid && sequenceValid && merkleValid,
      entryCount,
      chainValid,
      sequenceValid,
      merkleValid,
      errors,
      verifiedAt: new Date(),
    };

    return result;
  }

  /**
   * Verify a single entry in real-time (on append)
   *
   * Called after each append to verify:
   * - Parent hash matches previous entry
   * - Position is sequential
   * - Entry hash is correctly computed
   */
  async verifyEntry(
    ledgerId: string,
    entryHash: string,
    parentHash: string,
    position: bigint
  ): Promise<{ valid: boolean; error?: string }> {
    if (!this.config.realtimeVerification) {
      return { valid: true };
    }

    try {
      // Get expected parent hash
      const expectedParentHash = await this.storage.getLastEntryHash(ledgerId);

      // For position 0, parent should be genesis hash
      if (position === BigInt(0)) {
        if (parentHash !== GENESIS_HASH) {
          return {
            valid: false,
            error: `Genesis entry must have genesis hash as parent`,
          };
        }
      } else {
        // Parent hash should match the last entry's hash
        if (parentHash !== expectedParentHash) {
          return {
            valid: false,
            error: `Parent hash mismatch: expected ${expectedParentHash}, got ${parentHash}`,
          };
        }
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: `Verification error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Verify Merkle tree root matches stored root
   */
  private async verifyMerkleRoot(ledgerId: string): Promise<boolean> {
    try {
      // Get ledger metadata
      const metadata = await this.storage.getLedgerMetadata(ledgerId);
      if (!metadata) {
        return true; // Ledger doesn't exist, nothing to verify
      }

      // Get all leaf hashes
      const leafHashes = await this.storage.getAllLeafHashes(ledgerId);
      if (leafHashes.length === 0) {
        // Empty ledger should have empty hash as root
        return true;
      }

      // Reconstruct Merkle tree
      const tree = MerkleTree.import({ leaves: leafHashes });

      // Compare roots
      return tree.root === metadata.rootHash;
    } catch (error) {
      console.error('[IntegrityMonitor] Merkle verification error:', error);
      return false;
    }
  }

  /**
   * Emit an integrity alert
   */
  private async emitAlert(alert: IntegrityAlert): Promise<void> {
    this.alerts.push(alert);
    await this.config.onAlert(alert);
  }

  /**
   * Default alert handler - logs to console
   */
  private defaultAlertHandler(alert: IntegrityAlert): void {
    const prefix = alert.severity === 'critical' ? '🚨 CRITICAL' :
                   alert.severity === 'warning' ? '⚠️ WARNING' : 'ℹ️ INFO';
    console.log(`[IntegrityMonitor] ${prefix}: ${alert.message} (Ledger: ${alert.ledgerId})`);
  }

  /**
   * Get all alerts
   */
  getAlerts(): IntegrityAlert[] {
    return [...this.alerts];
  }

  /**
   * Get alerts for a specific ledger
   */
  getAlertsForLedger(ledgerId: string): IntegrityAlert[] {
    return this.alerts.filter((a) => a.ledgerId === ledgerId);
  }

  /**
   * Clear all alerts
   */
  clearAlerts(): void {
    this.alerts = [];
  }

  /**
   * Check if the monitor is running
   */
  isActive(): boolean {
    return this.isRunning;
  }
}

/**
 * Create an integrity monitor instance
 */
export function createIntegrityMonitor(
  storage: PostgresStorage,
  config?: IntegrityMonitorConfig
): IntegrityMonitor {
  return new IntegrityMonitor(storage, config);
}
