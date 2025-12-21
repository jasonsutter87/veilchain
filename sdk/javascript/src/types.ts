/**
 * VeilChain SDK Type Definitions
 */

/**
 * Merkle proof for inclusion verification
 */
export interface MerkleProof {
  /** The hash of the leaf (entry) being proven */
  leaf: string;
  /** The position/index of the entry in the tree */
  index: number;
  /** Array of sibling hashes for the proof path */
  proof: string[];
  /** Direction of each sibling ('left' or 'right') */
  directions: Array<'left' | 'right'>;
  /** The root hash of the Merkle tree */
  root: string;
}

/**
 * Compact proof format for efficient storage/transmission
 */
export interface CompactProof {
  /** Version number */
  v: number;
  /** Leaf hash */
  l: string;
  /** Root hash */
  r: string;
  /** Index */
  i: number;
  /** Concatenated proof hashes */
  p: string;
  /** Direction bits as string ('0' = left, '1' = right) */
  d: string;
}

/**
 * Ledger metadata
 */
export interface Ledger {
  /** Unique ledger identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Optional description */
  description?: string;
  /** Current Merkle root hash */
  rootHash: string;
  /** Total number of entries */
  entryCount: string;
  /** Creation timestamp (ISO 8601) */
  createdAt: string;
  /** Last entry timestamp (ISO 8601) */
  lastEntryAt?: string;
  /** Optional JSON Schema for entry validation */
  schema?: Record<string, unknown>;
}

/**
 * Ledger entry
 */
export interface LedgerEntry<T = unknown> {
  /** Unique entry identifier */
  id: string;
  /** Position in the ledger (0-indexed) */
  position: string;
  /** Entry data */
  data: T;
  /** SHA-256 hash of the entry */
  hash: string;
  /** Creation timestamp (ISO 8601) */
  createdAt: string;
  /** Inclusion proof (if requested) */
  proof?: MerkleProof;
}

/**
 * Options for creating a ledger
 */
export interface CreateLedgerOptions {
  /** Ledger name */
  name: string;
  /** Optional description */
  description?: string;
  /** Optional JSON Schema for entry validation */
  schema?: Record<string, unknown>;
}

/**
 * Options for appending an entry
 */
export interface AppendEntryOptions {
  /** Idempotency key to prevent duplicate entries */
  idempotencyKey?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Result of appending an entry
 */
export interface AppendEntryResult<T = unknown> {
  /** The created entry */
  entry: LedgerEntry<T>;
  /** Inclusion proof for the entry */
  proof: MerkleProof;
  /** Root hash before append */
  previousRoot: string;
  /** Root hash after append */
  newRoot: string;
}

/**
 * Options for listing entries
 */
export interface ListEntriesOptions {
  /** Number of entries to skip */
  offset?: number;
  /** Maximum entries to return */
  limit?: number;
}

/**
 * Paginated list of entries
 */
export interface ListEntriesResult<T = unknown> {
  /** Array of entries */
  entries: LedgerEntry<T>[];
  /** Total number of entries */
  total: string;
  /** Current offset */
  offset: string;
  /** Page size limit */
  limit: number;
}

/**
 * Options for listing ledgers
 */
export interface ListLedgersOptions {
  /** Number of ledgers to skip */
  offset?: number;
  /** Maximum ledgers to return */
  limit?: number;
}

/**
 * Paginated list of ledgers
 */
export interface ListLedgersResult {
  /** Array of ledgers */
  ledgers: Ledger[];
  /** Total number of ledgers */
  total: number;
  /** Current offset */
  offset: number;
  /** Page size limit */
  limit: number;
}

/**
 * Proof verification result
 */
export interface VerifyProofResult {
  /** Whether the proof is valid */
  valid: boolean;
  /** Leaf hash that was verified */
  leaf: string;
  /** Root hash that was verified against */
  root: string;
  /** Entry index */
  index: number;
  /** Number of proof hashes */
  proofLength: number;
  /** Error message if verification failed */
  error?: string;
}

/**
 * Public root information
 */
export interface PublicRoot {
  /** Ledger ID */
  ledgerId: string;
  /** Current root hash */
  rootHash: string;
  /** Entry count */
  entryCount: string;
  /** Timestamp */
  timestamp: string;
  /** Optional signature */
  signature?: string;
}

/**
 * Historical root entry
 */
export interface HistoricalRoot {
  /** Root hash at this point */
  rootHash: string;
  /** Entry count at this point */
  entryCount: string;
  /** Timestamp */
  timestamp: string;
  /** Optional signature */
  signature?: string;
}

/**
 * SDK configuration options
 */
export interface VeilChainConfig {
  /** Base URL of the VeilChain API */
  baseUrl: string;
  /** API key for authentication */
  apiKey?: string;
  /** JWT token for authentication */
  token?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Number of retry attempts for failed requests */
  retries?: number;
  /** Custom fetch implementation (for Node.js or testing) */
  fetch?: typeof fetch;
}

/**
 * API error response
 */
export interface ApiError {
  /** Error code */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Additional error details */
  details?: unknown;
}

/**
 * VeilChain SDK error
 */
export class VeilChainError extends Error {
  /** HTTP status code (if applicable) */
  public readonly status?: number;
  /** Error code from API */
  public readonly code?: string;
  /** Additional details */
  public readonly details?: unknown;

  constructor(message: string, options?: { status?: number; code?: string; details?: unknown }) {
    super(message);
    this.name = 'VeilChainError';
    this.status = options?.status;
    this.code = options?.code;
    this.details = options?.details;
  }
}
