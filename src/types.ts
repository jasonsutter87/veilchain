/**
 * VeilChain Type Definitions
 */

/**
 * Merkle proof for verifying entry inclusion
 */
export interface MerkleProof {
  /** The hash of the entry being proven */
  leaf: string;
  /** Position of the entry in the ledger */
  index: number;
  /** Array of sibling hashes along the path to root */
  proof: string[];
  /** Direction of each sibling (left or right) */
  directions: ('left' | 'right')[];
  /** Root hash at time of proof generation */
  root: string;
}

/**
 * Serialized proof format for storage/transmission
 */
export interface SerializedProof {
  /** Version number */
  v: number;
  /** Leaf hash */
  l: string;
  /** Index */
  i: number;
  /** Proof path */
  p: string[];
  /** Directions (0=left, 1=right) */
  d: number[];
  /** Root hash */
  r: string;
}

/**
 * Result of proof verification
 */
export interface ProofVerificationResult {
  valid: boolean;
  error?: string;
  leaf?: string;
  root?: string;
  index?: number;
  proofLength?: number;
}

/**
 * A single entry in the ledger
 */
export interface LedgerEntry<T = unknown> {
  /** Unique entry identifier */
  id: string;
  /** Position in the ledger (0-indexed) */
  position: bigint;
  /** The entry data */
  data: T;
  /** SHA-256 hash of the entry */
  hash: string;
  /** Timestamp when entry was added */
  createdAt: Date;
  /** Merkle proof of inclusion */
  proof?: MerkleProof;
}

/**
 * Ledger metadata
 */
export interface LedgerMetadata {
  /** Unique ledger identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Optional description */
  description?: string;
  /** When the ledger was created */
  createdAt: Date;
  /** Current root hash */
  rootHash: string;
  /** Number of entries */
  entryCount: bigint;
  /** Last entry timestamp */
  lastEntryAt?: Date;
}

/**
 * Options for creating a new ledger
 */
export interface CreateLedgerOptions {
  name: string;
  description?: string;
  /** Optional JSON schema for entry validation */
  schema?: Record<string, unknown>;
}

/**
 * Options for appending an entry
 */
export interface AppendOptions {
  /** Idempotency key to prevent duplicates */
  idempotencyKey?: string;
  /** Custom metadata for the entry */
  metadata?: Record<string, unknown>;
}

/**
 * Result of an append operation
 */
export interface AppendResult<T = unknown> {
  entry: LedgerEntry<T>;
  proof: MerkleProof;
  previousRoot: string;
  newRoot: string;
}

/**
 * Merkle tree node representation
 */
export interface MerkleNode {
  hash: string;
  left?: MerkleNode;
  right?: MerkleNode;
  isLeaf: boolean;
}

/**
 * Storage backend interface
 */
export interface StorageBackend {
  /** Store an entry */
  put(ledgerId: string, entry: LedgerEntry): Promise<void>;

  /** Get an entry by ID */
  get(ledgerId: string, entryId: string): Promise<LedgerEntry | null>;

  /** Get entry by position */
  getByPosition(ledgerId: string, position: bigint): Promise<LedgerEntry | null>;

  /** List entries with pagination */
  list(ledgerId: string, options: {
    offset?: bigint;
    limit?: number;
  }): Promise<LedgerEntry[]>;

  /** Get ledger metadata */
  getLedgerMetadata(ledgerId: string): Promise<LedgerMetadata | null>;

  /** Update ledger metadata */
  updateLedgerMetadata(ledgerId: string, metadata: Partial<LedgerMetadata>): Promise<void>;

  /** Get all leaf hashes for tree reconstruction */
  getAllLeafHashes(ledgerId: string): Promise<string[]>;
}

/**
 * Anchor record for external timestamping
 */
export interface AnchorRecord {
  /** Root hash that was anchored */
  rootHash: string;
  /** Tree size at anchoring */
  treeSize: bigint;
  /** Anchor destination (bitcoin, ethereum, etc.) */
  destination: string;
  /** Transaction ID or proof */
  transactionId?: string;
  /** Timestamp of anchoring */
  anchoredAt: Date;
  /** Status of the anchor */
  status: 'pending' | 'confirmed' | 'failed';
}
