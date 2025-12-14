/**
 * VeilChain In-Memory Storage Backend
 *
 * Simple in-memory storage for development and testing.
 * Data is lost when process exits.
 */

import type {
  StorageBackend,
  LedgerEntry,
  LedgerMetadata
} from '../types.js';

/**
 * In-memory storage implementation
 * Useful for development, testing, and single-instance deployments
 */
export class MemoryStorage implements StorageBackend {
  private entries: Map<string, Map<string, LedgerEntry>> = new Map();
  private entriesByPosition: Map<string, Map<string, LedgerEntry>> = new Map();
  private metadata: Map<string, LedgerMetadata> = new Map();

  /**
   * Store an entry
   */
  async put(ledgerId: string, entry: LedgerEntry): Promise<void> {
    if (!this.entries.has(ledgerId)) {
      this.entries.set(ledgerId, new Map());
      this.entriesByPosition.set(ledgerId, new Map());
    }

    const ledgerEntries = this.entries.get(ledgerId)!;
    const positionIndex = this.entriesByPosition.get(ledgerId)!;

    // Check for duplicate position (append-only violation)
    const posKey = entry.position.toString();
    if (positionIndex.has(posKey)) {
      throw new Error(`Position ${entry.position} already exists - append-only violation`);
    }

    ledgerEntries.set(entry.id, entry);
    positionIndex.set(posKey, entry);
  }

  /**
   * Get an entry by ID
   */
  async get(ledgerId: string, entryId: string): Promise<LedgerEntry | null> {
    const ledgerEntries = this.entries.get(ledgerId);
    if (!ledgerEntries) return null;
    return ledgerEntries.get(entryId) ?? null;
  }

  /**
   * Get entry by position
   */
  async getByPosition(ledgerId: string, position: bigint): Promise<LedgerEntry | null> {
    const positionIndex = this.entriesByPosition.get(ledgerId);
    if (!positionIndex) return null;
    return positionIndex.get(position.toString()) ?? null;
  }

  /**
   * List entries with pagination
   */
  async list(
    ledgerId: string,
    options: { offset?: bigint; limit?: number } = {}
  ): Promise<LedgerEntry[]> {
    const { offset = 0n, limit = 100 } = options;
    const ledgerEntries = this.entries.get(ledgerId);

    if (!ledgerEntries) return [];

    const entries = Array.from(ledgerEntries.values())
      .sort((a, b) => Number(a.position - b.position))
      .filter(e => e.position >= offset)
      .slice(0, limit);

    return entries;
  }

  /**
   * Get ledger metadata
   */
  async getLedgerMetadata(ledgerId: string): Promise<LedgerMetadata | null> {
    return this.metadata.get(ledgerId) ?? null;
  }

  /**
   * List all ledgers with pagination
   */
  async listLedgers(options?: {
    offset?: number;
    limit?: number;
  }): Promise<LedgerMetadata[]> {
    const { offset = 0, limit = 100 } = options ?? {};
    return Array.from(this.metadata.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(offset, offset + limit);
  }

  /**
   * Create ledger metadata
   */
  async createLedgerMetadata(metadata: LedgerMetadata): Promise<void> {
    if (this.metadata.has(metadata.id)) {
      throw new Error(`Ledger ${metadata.id} already exists`);
    }
    this.metadata.set(metadata.id, metadata);
    this.entries.set(metadata.id, new Map());
    this.entriesByPosition.set(metadata.id, new Map());
  }

  /**
   * Update ledger metadata
   * Creates the ledger if it doesn't exist (for initial creation)
   */
  async updateLedgerMetadata(
    ledgerId: string,
    updates: Partial<LedgerMetadata>
  ): Promise<void> {
    const existing = this.metadata.get(ledgerId);

    if (!existing) {
      // If ledger doesn't exist and we have a full metadata object, create it
      if ('id' in updates && 'name' in updates && 'createdAt' in updates) {
        this.metadata.set(ledgerId, updates as LedgerMetadata);
        this.entries.set(ledgerId, new Map());
        this.entriesByPosition.set(ledgerId, new Map());
        return;
      }
      throw new Error(`Ledger ${ledgerId} not found`);
    }

    this.metadata.set(ledgerId, { ...existing, ...updates });
  }

  /**
   * Get all leaf hashes for tree reconstruction
   */
  async getAllLeafHashes(ledgerId: string): Promise<string[]> {
    const ledgerEntries = this.entries.get(ledgerId);
    if (!ledgerEntries) return [];

    return Array.from(ledgerEntries.values())
      .sort((a, b) => Number(a.position - b.position))
      .map(e => e.hash);
  }

  /**
   * Delete all data (for testing)
   */
  async clear(): Promise<void> {
    this.entries.clear();
    this.entriesByPosition.clear();
    this.metadata.clear();
  }

  /**
   * Delete a specific ledger (for testing)
   */
  async deleteLedger(ledgerId: string): Promise<void> {
    this.entries.delete(ledgerId);
    this.entriesByPosition.delete(ledgerId);
    this.metadata.delete(ledgerId);
  }

  /**
   * Get statistics (for debugging)
   */
  getStats(): { ledgers: number; totalEntries: number } {
    let totalEntries = 0;
    for (const ledger of this.entries.values()) {
      totalEntries += ledger.size;
    }
    return {
      ledgers: this.metadata.size,
      totalEntries
    };
  }
}
