/**
 * VeilChain Ledger Service
 *
 * Combines Merkle tree with storage backend to provide a complete
 * append-only ledger service with proofs and event emission.
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { MerkleTree } from '../core/merkle.js';
import { hashEntry, hashToEntryId } from '../core/hash.js';
import { IdempotencyService } from './idempotency.js';
import type {
  StorageBackend,
  LedgerEntry,
  LedgerMetadata,
  CreateLedgerOptions,
  AppendOptions,
  AppendResult,
  MerkleProof
} from '../types.js';
import { GENESIS_HASH } from '../types.js';

/**
 * Events emitted by the ledger service
 */
export interface LedgerEvents {
  /** Emitted when a ledger is created */
  'ledger:created': (metadata: LedgerMetadata) => void;
  /** Emitted when an entry is appended */
  'entry:appended': (ledgerId: string, entry: LedgerEntry, proof: MerkleProof) => void;
  /** Emitted when the Merkle root changes */
  'root:updated': (ledgerId: string, previousRoot: string, newRoot: string) => void;
  /** Emitted on errors */
  'error': (error: Error) => void;
}

/**
 * Type-safe event emitter for ledger events
 */
export interface LedgerEventEmitter extends EventEmitter {
  on<K extends keyof LedgerEvents>(event: K, listener: LedgerEvents[K]): this;
  emit<K extends keyof LedgerEvents>(event: K, ...args: Parameters<LedgerEvents[K]>): boolean;
}

/**
 * Main ledger service
 *
 * Coordinates between:
 * - MerkleTree: for proof generation and verification
 * - StorageBackend: for persistent entry storage
 * - IdempotencyService: for preventing duplicate appends
 * - EventEmitter: for webhook notifications
 */
export class LedgerService {
  private trees: Map<string, MerkleTree> = new Map();
  private events: LedgerEventEmitter;
  private idempotency: IdempotencyService;

  constructor(
    private readonly storage: StorageBackend,
    idempotencyService: IdempotencyService,
    options: {
      /** Event emitter for webhooks */
      eventEmitter?: EventEmitter;
    } = {}
  ) {
    this.events = (options.eventEmitter as LedgerEventEmitter) || new EventEmitter();
    this.idempotency = idempotencyService;
  }

  /**
   * Create a new ledger
   * @param options - Ledger creation options
   * @returns Created ledger metadata
   */
  async createLedger(options: CreateLedgerOptions): Promise<LedgerMetadata> {
    const ledgerId = `ledger_${randomUUID()}`;
    const now = new Date();

    // Initialize empty Merkle tree
    const tree = new MerkleTree();
    this.trees.set(ledgerId, tree);

    // Create metadata
    const metadata: LedgerMetadata = {
      id: ledgerId,
      name: options.name,
      description: options.description,
      createdAt: now,
      rootHash: tree.root,
      entryCount: 0n,
      lastEntryAt: undefined
    };

    // Persist metadata
    await this.storage.updateLedgerMetadata(ledgerId, metadata);

    // Emit event
    this.events.emit('ledger:created', metadata);

    return metadata;
  }

  /**
   * Get ledger metadata
   * @param ledgerId - The ledger ID
   * @returns Ledger metadata or null if not found
   */
  async getLedger(ledgerId: string): Promise<LedgerMetadata | null> {
    return this.storage.getLedgerMetadata(ledgerId);
  }

  /**
   * Append an entry to the ledger
   *
   * This is an atomic operation:
   * 1. Check idempotency key (if provided)
   * 2. Create entry with hash
   * 3. Update Merkle tree
   * 4. Persist entry to storage
   * 5. Update ledger metadata
   * 6. Cache idempotency result
   * 7. Emit events
   *
   * @param ledgerId - The ledger ID
   * @param data - The entry data
   * @param options - Append options (idempotency, metadata)
   * @returns Append result with entry and proof
   */
  async append<T = unknown>(
    ledgerId: string,
    data: T,
    options: AppendOptions = {}
  ): Promise<AppendResult<T>> {
    try {
      // Check idempotency key
      if (options.idempotencyKey) {
        const cached = await this.idempotency.get<AppendResult<T>>(
          ledgerId,
          options.idempotencyKey
        );
        if (cached) {
          return cached;
        }
      }

      // Get or initialize tree
      let tree = this.trees.get(ledgerId);
      if (!tree) {
        tree = await this.reconstructTree(ledgerId);
        this.trees.set(ledgerId, tree);
      }

      // Get current metadata
      const metadata = await this.storage.getLedgerMetadata(ledgerId);
      if (!metadata) {
        throw new Error(`Ledger ${ledgerId} not found`);
      }

      const previousRoot = tree.root;
      const position = metadata.entryCount;

      // Get parent hash for cryptographic chaining
      // For position 0 (first entry), use genesis hash
      // Otherwise, get hash of previous entry
      let parentHash: string;
      if (position === 0n) {
        parentHash = GENESIS_HASH;
      } else {
        const prevEntry = await this.storage.getByPosition(ledgerId, position - 1n);
        if (!prevEntry) {
          throw new Error(`Chain integrity error: previous entry at position ${position - 1n} not found`);
        }
        parentHash = prevEntry.hash;
      }

      // Hash the entry data
      const hash = hashEntry(data, position);
      const entryId = hashToEntryId(hash);

      // Create the entry with cryptographic chaining
      const entry: LedgerEntry<T> = {
        id: entryId,
        position,
        data,
        hash,
        parentHash,
        createdAt: new Date()
      };

      // Append to Merkle tree (updates root)
      const index = tree.append(hash);
      const newRoot = tree.root;

      // Generate proof
      const proof = tree.getProof(index);

      // Add proof to entry
      entry.proof = proof;

      // Persist entry
      await this.storage.put(ledgerId, entry);

      // Update metadata
      await this.storage.updateLedgerMetadata(ledgerId, {
        rootHash: newRoot,
        entryCount: position + 1n,
        lastEntryAt: entry.createdAt
      });

      // Create result
      const result: AppendResult<T> = {
        entry,
        proof,
        previousRoot,
        newRoot
      };

      // Cache for idempotency
      if (options.idempotencyKey) {
        await this.idempotency.set(ledgerId, options.idempotencyKey, result);
      }

      // Emit events
      this.events.emit('entry:appended', ledgerId, entry, proof);
      this.events.emit('root:updated', ledgerId, previousRoot, newRoot);

      return result;
    } catch (error) {
      // Rollback tree on error if we've modified it
      const tree = this.trees.get(ledgerId);
      if (tree && tree.size > 0) {
        const rolledBack = MerkleTree.import({ leaves: tree.getLeaves().slice(0, -1) });
        this.trees.set(ledgerId, rolledBack);
      }

      const err = error instanceof Error ? error : new Error(String(error));
      this.events.emit('error', err);
      throw err;
    }
  }

  /**
   * Get an entry by ID
   * @param ledgerId - The ledger ID
   * @param entryId - The entry ID
   * @returns Entry or null if not found
   */
  async getEntry(ledgerId: string, entryId: string): Promise<LedgerEntry | null> {
    return this.storage.get(ledgerId, entryId);
  }

  /**
   * Get an entry by position
   * @param ledgerId - The ledger ID
   * @param position - The entry position (0-indexed)
   * @returns Entry or null if not found
   */
  async getEntryByPosition(
    ledgerId: string,
    position: bigint
  ): Promise<LedgerEntry | null> {
    return this.storage.getByPosition(ledgerId, position);
  }

  /**
   * List entries with pagination
   * @param ledgerId - The ledger ID
   * @param options - Pagination options
   * @returns Array of entries
   */
  async listEntries(
    ledgerId: string,
    options: { offset?: bigint; limit?: number } = {}
  ): Promise<LedgerEntry[]> {
    return this.storage.list(ledgerId, options);
  }

  /**
   * Generate a proof for an entry
   * @param ledgerId - The ledger ID
   * @param position - The entry position
   * @returns Merkle proof
   */
  async getProof(ledgerId: string, position: bigint): Promise<MerkleProof | null> {
    // Get or reconstruct tree
    let tree = this.trees.get(ledgerId);
    if (!tree) {
      tree = await this.reconstructTree(ledgerId);
      this.trees.set(ledgerId, tree);
    }

    const index = Number(position);
    if (index < 0 || index >= tree.size) {
      return null;
    }

    return tree.getProof(index);
  }

  /**
   * Verify a proof against current tree state
   * @param ledgerId - The ledger ID
   * @param proof - The proof to verify
   * @returns True if proof is valid
   */
  async verifyProof(ledgerId: string, proof: MerkleProof): Promise<boolean> {
    const tree = this.trees.get(ledgerId);
    if (!tree) {
      return false;
    }

    // Verify proof root matches current tree root
    if (proof.root !== tree.root) {
      return false;
    }

    return MerkleTree.verify(proof);
  }

  /**
   * Reconstruct Merkle tree from storage
   *
   * Used on service startup or when tree is not in memory
   * @param ledgerId - The ledger ID
   * @returns Reconstructed Merkle tree
   */
  async reconstructTree(ledgerId: string): Promise<MerkleTree> {
    const metadata = await this.storage.getLedgerMetadata(ledgerId);
    if (!metadata) {
      throw new Error(`Ledger ${ledgerId} not found`);
    }

    // Get all leaf hashes in order
    const leaves = await this.storage.getAllLeafHashes(ledgerId);

    // Import into new tree
    const tree = MerkleTree.import({ leaves });

    // Verify root matches metadata
    if (tree.root !== metadata.rootHash) {
      throw new Error(
        `Tree reconstruction failed: root mismatch (expected ${metadata.rootHash}, got ${tree.root})`
      );
    }

    return tree;
  }

  /**
   * Get current root hash for a ledger
   * @param ledgerId - The ledger ID
   * @returns Current root hash
   */
  async getRootHash(ledgerId: string): Promise<string | null> {
    const tree = this.trees.get(ledgerId);
    if (tree) {
      return tree.root;
    }

    const metadata = await this.storage.getLedgerMetadata(ledgerId);
    return metadata?.rootHash ?? null;
  }

  /**
   * Get statistics for a ledger
   * @param ledgerId - The ledger ID
   * @returns Ledger statistics
   */
  async getStats(ledgerId: string): Promise<{
    entryCount: bigint;
    rootHash: string;
    treeSize: number;
    createdAt: Date;
    lastEntryAt?: Date;
  } | null> {
    const metadata = await this.storage.getLedgerMetadata(ledgerId);
    if (!metadata) {
      return null;
    }

    const tree = this.trees.get(ledgerId);
    const treeSize = tree?.size ?? 0;

    return {
      entryCount: metadata.entryCount,
      rootHash: metadata.rootHash,
      treeSize,
      createdAt: metadata.createdAt,
      lastEntryAt: metadata.lastEntryAt
    };
  }

  /**
   * Get the event emitter for webhook subscriptions
   */
  getEventEmitter(): LedgerEventEmitter {
    return this.events;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.trees.clear();
    this.idempotency.destroy();
    this.events.removeAllListeners();
  }
}
