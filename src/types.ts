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
 * Batch proof for verifying multiple entries efficiently
 */
export interface BatchProof {
  /** Array of leaf hashes being proven */
  leaves: string[];
  /** Array of indices for each leaf */
  indices: number[];
  /** Optimized proof path with shared nodes */
  proof: string[];
  /** Mapping of which proof nodes apply to which leaves */
  proofMap: number[][];
  /** Directions for each proof step */
  directions: ('left' | 'right')[][];
  /** Root hash at time of proof generation */
  root: string;
}

/**
 * Consistency proof showing old tree is prefix of new tree
 */
export interface ConsistencyProof {
  /** Old root hash */
  oldRoot: string;
  /** Size of old tree */
  oldSize: number;
  /** New root hash */
  newRoot: string;
  /** Size of new tree */
  newSize: number;
  /** Proof path showing consistency */
  proof: string[];
  /** Timestamp of proof generation */
  timestamp: string;
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
  /** Hash of the previous entry (cryptographic chaining) */
  parentHash: string;
  /** Timestamp when entry was added */
  createdAt: Date;
  /** Merkle proof of inclusion */
  proof?: MerkleProof;
}

/**
 * Genesis hash constant - SHA256 of empty string
 * Used as parent_hash for the first entry in a ledger
 */
export const GENESIS_HASH = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

/**
 * Result of ledger integrity verification
 */
export interface IntegrityCheckResult {
  /** Whether the ledger is valid */
  isValid: boolean;
  /** Total number of entries checked */
  entryCount: bigint;
  /** Whether the cryptographic chain is intact */
  chainValid: boolean;
  /** Whether sequence numbers are correct */
  sequenceValid: boolean;
  /** Whether Merkle tree root matches */
  merkleValid: boolean;
  /** List of any errors found */
  errors: string[];
  /** Timestamp of verification */
  verifiedAt: Date;
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
  /** Optional JSON schema for entry validation */
  schema?: Record<string, unknown>;
  /** When the ledger was archived (soft deleted), null if active */
  archivedAt?: Date;
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

  /** Create ledger metadata */
  createLedgerMetadata(metadata: LedgerMetadata): Promise<void>;

  /** Get ledger metadata */
  getLedgerMetadata(ledgerId: string): Promise<LedgerMetadata | null>;

  /** Update ledger metadata */
  updateLedgerMetadata(ledgerId: string, metadata: Partial<LedgerMetadata>): Promise<void>;

  /** List all ledgers with pagination */
  listLedgers(options?: {
    offset?: number;
    limit?: number;
    includeArchived?: boolean;
  }): Promise<LedgerMetadata[]>;

  /** Get all leaf hashes for tree reconstruction */
  getAllLeafHashes(ledgerId: string): Promise<string[]>;

  /** Archive (soft delete) a ledger */
  archiveLedger?(ledgerId: string): Promise<void>;

  /** Unarchive (restore) a ledger */
  unarchiveLedger?(ledgerId: string): Promise<void>;
}

/**
 * Sparse Merkle Tree proof for inclusion or non-inclusion
 */
export interface SparseMerkleProof {
  /** The key being proven */
  key: string;
  /** The value at the key (null for non-inclusion proof) */
  value: string | null;
  /** Array of sibling hashes along the path to root */
  siblings: string[];
  /** Root hash at time of proof generation */
  root: string;
  /** Whether this is an inclusion proof (true) or non-inclusion proof (false) */
  included: boolean;
}

/**
 * Serialized Sparse Merkle Tree state
 */
export interface SparseMerkleTreeState {
  /** Map of key hashes to values */
  nodes: Record<string, string>;
  /** Current root hash */
  root: string;
  /** Tree depth (default 256 for 256-bit key space) */
  depth: number;
}

// ============================================
// Phase 4: Authentication Types
// ============================================

/**
 * User tier for rate limiting and features
 */
export type UserTier = 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';

/**
 * OAuth provider
 */
export type OAuthProvider = 'github' | 'google';

/**
 * User account
 */
export interface User {
  id: string;
  email: string;
  name?: string;
  passwordHash?: string;
  emailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  oauthProvider?: OAuthProvider;
  oauthProviderId?: string;
  avatarUrl?: string;
  tier: UserTier;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

/**
 * User without sensitive fields (for API responses)
 */
export interface UserPublic {
  id: string;
  email: string;
  name?: string;
  emailVerified: boolean;
  avatarUrl?: string;
  tier: UserTier;
  createdAt: Date;
  lastLoginAt?: Date;
}

/**
 * API key type
 */
export type ApiKeyType = 'admin' | 'write' | 'read' | 'scoped';

/**
 * API key record
 */
export interface ApiKey {
  id: string;
  userId: string;
  name: string;
  keyPrefix: string;
  keyHash: string;
  keyType: ApiKeyType;
  scopedLedgers?: string[];
  permissions?: Record<string, unknown>;
  expiresAt?: Date;
  lastUsedAt?: Date;
  usageCount: bigint;
  rateLimitOverride?: Record<string, unknown>;
  createdAt: Date;
  revokedAt?: Date;
  revokedReason?: string;
}

/**
 * API key summary (without hash, for listing)
 */
export interface ApiKeySummary {
  id: string;
  name: string;
  keyPrefix: string;
  keyType: ApiKeyType;
  scopedLedgers?: string[];
  expiresAt?: Date;
  lastUsedAt?: Date;
  usageCount: bigint;
  createdAt: Date;
  revokedAt?: Date;
}

/**
 * Refresh token record
 */
export interface RefreshToken {
  id: string;
  userId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
  issuedAt: Date;
  revokedAt?: Date;
  revokedReason?: string;
  userAgent?: string;
  ipAddress?: string;
}

/**
 * Ledger permission role
 */
export type LedgerRole = 'owner' | 'admin' | 'write' | 'read';

/**
 * Ledger permission record
 */
export interface LedgerPermission {
  id: string;
  ledgerId: string;
  userId: string;
  role: LedgerRole;
  grantedBy?: string;
  grantedAt: Date;
  expiresAt?: Date;
}

/**
 * Audit log action types
 */
export type AuditAction =
  | 'login'
  | 'logout'
  | 'register'
  | 'password_change'
  | 'password_reset'
  | 'email_verify'
  | 'create_ledger'
  | 'delete_ledger'
  | 'append_entry'
  | 'batch_append_entries'
  | 'create_api_key'
  | 'revoke_api_key'
  | 'grant_permission'
  | 'revoke_permission';

/**
 * Audit log resource types
 */
export type AuditResourceType = 'user' | 'ledger' | 'entry' | 'api_key' | 'permission';

/**
 * Audit log record
 */
export interface AuditLog {
  id: string;
  userId?: string;
  apiKeyId?: string;
  action: AuditAction;
  resourceType?: AuditResourceType;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

/**
 * Token blocklist entry
 */
export interface TokenBlocklistEntry {
  jti: string;
  userId: string;
  expiresAt: Date;
  revokedAt: Date;
  reason?: string;
}

/**
 * OAuth state for CSRF protection
 */
export interface OAuthState {
  state: string;
  redirectUrl?: string;
  createdAt: Date;
  expiresAt: Date;
}

/**
 * Authentication context attached to requests
 */
export interface AuthContext {
  userId: string;
  email: string;
  tier: UserTier;
  authMethod: 'jwt' | 'api_key';
  apiKeyId?: string;
  apiKeyType?: ApiKeyType;
  jti?: string;
}

