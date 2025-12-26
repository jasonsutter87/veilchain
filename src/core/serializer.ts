/**
 * VeilChain Canonical Serializer
 *
 * Provides consistent, deterministic serialization for:
 * - Entry data hashing
 * - Proof export
 * - Cross-platform verification
 *
 * Supports both JSON and CBOR formats with guaranteed determinism.
 */

import { encode as cborEncode, decode as cborDecode } from 'cbor-x';
import { sha256 } from './hash.js';
import type { MerkleProof, SerializedProof, BatchProof, ConsistencyProof, SparseMerkleProof } from '../types.js';

/**
 * Serialization format
 */
export type SerializationFormat = 'json' | 'cbor';

/**
 * Canonical JSON serializer
 *
 * Produces deterministic JSON by:
 * - Sorting object keys alphabetically
 * - Using consistent number formatting
 * - Removing undefined values
 * - Consistent whitespace handling
 */
export function canonicalJsonStringify(data: unknown): string {
  return JSON.stringify(data, (key, value) => {
    // Handle BigInt
    if (typeof value === 'bigint') {
      return value.toString();
    }

    // Handle Date
    if (value instanceof Date) {
      return value.toISOString();
    }

    // Handle undefined (remove)
    if (value === undefined) {
      return undefined;
    }

    // Sort object keys for determinism
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const sorted: Record<string, unknown> = {};
      const keys = Object.keys(value).sort();
      for (const k of keys) {
        sorted[k] = value[k];
      }
      return sorted;
    }

    return value;
  });
}

/**
 * Parse canonical JSON
 */
export function canonicalJsonParse<T = unknown>(json: string): T {
  return JSON.parse(json, (key, value) => {
    // Optionally restore BigInt from string
    // (caller must handle this explicitly if needed)
    return value;
  });
}

/**
 * Canonical CBOR encoder
 *
 * Produces deterministic CBOR by:
 * - Using canonical CBOR encoding (sorted map keys)
 * - Consistent type handling
 */
export function canonicalCborEncode(data: unknown): Buffer {
  // Transform data for CBOR compatibility
  const transformed = transformForCbor(data);
  return Buffer.from(cborEncode(transformed));
}

/**
 * CBOR decoder
 */
export function canonicalCborDecode<T = unknown>(buffer: Buffer): T {
  return cborDecode(buffer) as T;
}

/**
 * Transform data for CBOR encoding
 */
function transformForCbor(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'bigint') {
    return data.toString();
  }

  if (data instanceof Date) {
    return data.toISOString();
  }

  if (Array.isArray(data)) {
    return data.map(transformForCbor);
  }

  if (typeof data === 'object') {
    const sorted: Record<string, unknown> = {};
    const keys = Object.keys(data).sort();
    for (const key of keys) {
      sorted[key] = transformForCbor((data as Record<string, unknown>)[key]);
    }
    return sorted;
  }

  return data;
}

/**
 * Serialize data to specified format
 */
export function serialize(data: unknown, format: SerializationFormat = 'json'): Buffer {
  if (format === 'cbor') {
    return canonicalCborEncode(data);
  }
  return Buffer.from(canonicalJsonStringify(data), 'utf8');
}

/**
 * Deserialize data from specified format
 */
export function deserialize<T = unknown>(buffer: Buffer, format: SerializationFormat = 'json'): T {
  if (format === 'cbor') {
    return canonicalCborDecode(buffer);
  }
  return canonicalJsonParse(buffer.toString('utf8'));
}

/**
 * Hash data using canonical serialization
 */
export function hashCanonical(data: unknown, format: SerializationFormat = 'json'): string {
  const serialized = serialize(data, format);
  return sha256(serialized);
}

/**
 * Proof serialization options
 */
export interface ProofSerializeOptions {
  /** Serialization format */
  format?: SerializationFormat;
  /** Include metadata */
  includeMetadata?: boolean;
  /** Version number */
  version?: number;
}

/**
 * Serialize a Merkle proof
 */
export function serializeMerkleProof(
  proof: MerkleProof,
  options: ProofSerializeOptions = {}
): Buffer {
  const { format = 'json', includeMetadata = true, version = 1 } = options;

  const serialized: SerializedProof = {
    v: version,
    l: proof.leaf,
    i: proof.index,
    p: proof.proof,
    d: proof.directions.map((d) => (d === 'left' ? 0 : 1)),
    r: proof.root,
  };

  if (includeMetadata) {
    (serialized as any).t = Date.now();
    (serialized as any).f = format;
  }

  return serialize(serialized, format);
}

/**
 * Deserialize a Merkle proof
 */
export function deserializeMerkleProof(
  buffer: Buffer,
  format: SerializationFormat = 'json'
): MerkleProof {
  const data = deserialize<SerializedProof>(buffer, format);

  return {
    leaf: data.l,
    index: data.i,
    proof: data.p,
    directions: data.d.map((d) => (d === 0 ? 'left' : 'right')),
    root: data.r,
  };
}

/**
 * Serialize a batch proof
 */
export function serializeBatchProof(
  proof: BatchProof,
  options: ProofSerializeOptions = {}
): Buffer {
  const { format = 'json', includeMetadata = true, version = 1 } = options;

  const serialized = {
    v: version,
    l: proof.leaves,
    i: proof.indices,
    p: proof.proof,
    m: proof.proofMap,
    d: proof.directions.map((dirs) => dirs.map((d) => (d === 'left' ? 0 : 1))),
    r: proof.root,
    ...(includeMetadata ? { t: Date.now(), f: format } : {}),
  };

  return serialize(serialized, format);
}

/**
 * Deserialize a batch proof
 */
export function deserializeBatchProof(
  buffer: Buffer,
  format: SerializationFormat = 'json'
): BatchProof {
  const data = deserialize<any>(buffer, format);

  return {
    leaves: data.l,
    indices: data.i,
    proof: data.p,
    proofMap: data.m,
    directions: data.d.map((dirs: number[]) =>
      dirs.map((d: number) => (d === 0 ? 'left' : 'right'))
    ),
    root: data.r,
  };
}

/**
 * Serialize a consistency proof
 */
export function serializeConsistencyProof(
  proof: ConsistencyProof,
  options: ProofSerializeOptions = {}
): Buffer {
  const { format = 'json', includeMetadata = true, version = 1 } = options;

  const serialized = {
    v: version,
    or: proof.oldRoot,
    os: proof.oldSize,
    nr: proof.newRoot,
    ns: proof.newSize,
    p: proof.proof,
    ts: proof.timestamp,
    ...(includeMetadata ? { t: Date.now(), f: format } : {}),
  };

  return serialize(serialized, format);
}

/**
 * Deserialize a consistency proof
 */
export function deserializeConsistencyProof(
  buffer: Buffer,
  format: SerializationFormat = 'json'
): ConsistencyProof {
  const data = deserialize<any>(buffer, format);

  return {
    oldRoot: data.or,
    oldSize: data.os,
    newRoot: data.nr,
    newSize: data.ns,
    proof: data.p,
    timestamp: data.ts,
  };
}

/**
 * Serialize a sparse Merkle proof
 */
export function serializeSparseMerkleProof(
  proof: SparseMerkleProof,
  options: ProofSerializeOptions = {}
): Buffer {
  const { format = 'json', includeMetadata = true, version = 1 } = options;

  const serialized = {
    v: version,
    k: proof.key,
    val: proof.value,
    s: proof.siblings,
    r: proof.root,
    inc: proof.included,
    ...(includeMetadata ? { t: Date.now(), f: format } : {}),
  };

  return serialize(serialized, format);
}

/**
 * Deserialize a sparse Merkle proof
 */
export function deserializeSparseMerkleProof(
  buffer: Buffer,
  format: SerializationFormat = 'json'
): SparseMerkleProof {
  const data = deserialize<any>(buffer, format);

  return {
    key: data.k,
    value: data.val,
    siblings: data.s,
    root: data.r,
    included: data.inc,
  };
}

/**
 * Create a QR-friendly compact proof string
 *
 * Encodes the proof in a compact format suitable for QR codes:
 * - Base64 encoded CBOR
 * - Prefixed with format identifier
 */
export function createCompactProof(proof: MerkleProof): string {
  const buffer = serializeMerkleProof(proof, { format: 'cbor', includeMetadata: false });
  return `VP1:${buffer.toString('base64')}`;
}

/**
 * Parse a compact proof string
 */
export function parseCompactProof(compact: string): MerkleProof {
  const [prefix, data] = compact.split(':');

  if (prefix !== 'VP1') {
    throw new Error(`Unknown proof format: ${prefix}`);
  }

  const buffer = Buffer.from(data, 'base64');
  return deserializeMerkleProof(buffer, 'cbor');
}

/**
 * Calculate proof size in bytes
 */
export function getProofSize(proof: MerkleProof, format: SerializationFormat = 'cbor'): number {
  return serializeMerkleProof(proof, { format, includeMetadata: false }).length;
}

/**
 * Compare serialization sizes
 */
export function compareSerializationSizes(data: unknown): {
  json: number;
  cbor: number;
  savings: number;
  savingsPercent: number;
} {
  const jsonSize = serialize(data, 'json').length;
  const cborSize = serialize(data, 'cbor').length;
  const savings = jsonSize - cborSize;

  return {
    json: jsonSize,
    cbor: cborSize,
    savings,
    savingsPercent: (savings / jsonSize) * 100,
  };
}
