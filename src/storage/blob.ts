/**
 * VeilChain Blob Storage Backend
 *
 * S3-compatible blob storage for large entry data.
 * Supports both AWS S3 and MinIO for on-premise deployments.
 *
 * Features:
 * - Large entry support (>1MB stored in blob storage)
 * - Hash stored in PostgreSQL, data in blobs
 * - Automatic tiering based on size
 * - Integrity verification on read
 */

import {
  S3Client,
  S3ClientConfig,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  CreateBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { createHash } from 'crypto';

/**
 * Blob storage configuration
 */
export interface BlobStorageConfig {
  /** S3 endpoint URL (e.g., http://localhost:9000 for MinIO) */
  endpoint?: string;
  /** AWS region (default: us-east-1) */
  region?: string;
  /** S3 bucket name */
  bucket: string;
  /** Access key ID */
  accessKeyId: string;
  /** Secret access key */
  secretAccessKey: string;
  /** Force path-style access (required for MinIO, default: true) */
  forcePathStyle?: boolean;
  /** Key prefix for all objects (default: 'entries/') */
  keyPrefix?: string;
  /** Whether to auto-create bucket if it doesn't exist (default: true) */
  autoCreateBucket?: boolean;
}

/**
 * Blob metadata stored alongside the data
 */
export interface BlobMetadata {
  /** Entry ID */
  entryId: string;
  /** Ledger ID */
  ledgerId: string;
  /** SHA-256 hash of the content */
  contentHash: string;
  /** Original size in bytes */
  size: number;
  /** Content type */
  contentType: string;
  /** When the blob was created */
  createdAt: string;
}

/**
 * Result of a blob retrieval
 */
export interface BlobResult {
  /** The blob data */
  data: Buffer;
  /** Blob metadata */
  metadata: BlobMetadata;
}

/**
 * S3/MinIO Blob Storage Implementation
 *
 * Used for storing large entry data that exceeds the size threshold.
 * The entry hash is stored in PostgreSQL, while the actual data
 * is stored in S3-compatible blob storage.
 */
export class BlobStorage {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly keyPrefix: string;
  private readonly autoCreateBucket: boolean;
  private bucketVerified: boolean = false;

  constructor(config: BlobStorageConfig) {
    this.bucket = config.bucket;
    this.keyPrefix = config.keyPrefix ?? 'entries/';
    this.autoCreateBucket = config.autoCreateBucket ?? true;

    const clientConfig: S3ClientConfig = {
      region: config.region ?? 'us-east-1',
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: config.forcePathStyle ?? true,
    };

    if (config.endpoint) {
      clientConfig.endpoint = config.endpoint;
    }

    this.client = new S3Client(clientConfig);
  }

  /**
   * Initialize storage (create bucket if needed)
   */
  async initialize(): Promise<void> {
    if (this.bucketVerified) return;

    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.bucketVerified = true;
    } catch (error: unknown) {
      if (this.autoCreateBucket) {
        try {
          await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
          this.bucketVerified = true;
          console.log(`Created blob storage bucket: ${this.bucket}`);
        } catch (createError: unknown) {
          // Bucket might have been created by another process
          if (createError instanceof Error && createError.name === 'BucketAlreadyOwnedByYou') {
            this.bucketVerified = true;
          } else {
            throw new Error(`Failed to create bucket: ${createError instanceof Error ? createError.message : String(createError)}`);
          }
        }
      } else {
        throw new Error(`Bucket ${this.bucket} does not exist`);
      }
    }
  }

  /**
   * Generate a storage key for an entry
   */
  private getKey(ledgerId: string, entryId: string): string {
    return `${this.keyPrefix}${ledgerId}/${entryId}`;
  }

  /**
   * Calculate SHA-256 hash of data
   */
  private calculateHash(data: Buffer): string {
    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * Store entry data in blob storage
   *
   * @param ledgerId - Ledger ID
   * @param entryId - Entry ID
   * @param data - Entry data (will be JSON stringified if not a Buffer)
   * @param contentType - Content type (default: application/json)
   * @returns The stored blob metadata including content hash
   */
  async put(
    ledgerId: string,
    entryId: string,
    data: unknown,
    contentType: string = 'application/json'
  ): Promise<BlobMetadata> {
    await this.initialize();

    const key = this.getKey(ledgerId, entryId);
    const buffer = Buffer.isBuffer(data)
      ? data
      : Buffer.from(JSON.stringify(data), 'utf-8');
    const contentHash = this.calculateHash(buffer);

    const metadata: BlobMetadata = {
      entryId,
      ledgerId,
      contentHash,
      size: buffer.length,
      contentType,
      createdAt: new Date().toISOString(),
    };

    // Use multipart upload for large files (>5MB)
    if (buffer.length > 5 * 1024 * 1024) {
      const upload = new Upload({
        client: this.client,
        params: {
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType,
          Metadata: {
            'x-veilchain-entry-id': entryId,
            'x-veilchain-ledger-id': ledgerId,
            'x-veilchain-content-hash': contentHash,
            'x-veilchain-created-at': metadata.createdAt,
          },
        },
      });

      await upload.done();
    } else {
      await this.client.send(new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        Metadata: {
          'x-veilchain-entry-id': entryId,
          'x-veilchain-ledger-id': ledgerId,
          'x-veilchain-content-hash': contentHash,
          'x-veilchain-created-at': metadata.createdAt,
        },
      }));
    }

    return metadata;
  }

  /**
   * Retrieve entry data from blob storage
   *
   * @param ledgerId - Ledger ID
   * @param entryId - Entry ID
   * @param expectedHash - Expected content hash for verification (optional)
   * @returns The blob data and metadata, or null if not found
   */
  async get(
    ledgerId: string,
    entryId: string,
    expectedHash?: string
  ): Promise<BlobResult | null> {
    await this.initialize();

    const key = this.getKey(ledgerId, entryId);

    try {
      const response = await this.client.send(new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }));

      if (!response.Body) {
        return null;
      }

      // Read the stream into a buffer
      const chunks: Uint8Array[] = [];
      const stream = response.Body as AsyncIterable<Uint8Array>;
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      const data = Buffer.concat(chunks);

      // Extract metadata
      const metadata: BlobMetadata = {
        entryId: response.Metadata?.['x-veilchain-entry-id'] ?? entryId,
        ledgerId: response.Metadata?.['x-veilchain-ledger-id'] ?? ledgerId,
        contentHash: response.Metadata?.['x-veilchain-content-hash'] ?? this.calculateHash(data),
        size: data.length,
        contentType: response.ContentType ?? 'application/json',
        createdAt: response.Metadata?.['x-veilchain-created-at'] ?? new Date().toISOString(),
      };

      // Verify integrity if expected hash provided
      if (expectedHash) {
        const actualHash = this.calculateHash(data);
        if (actualHash !== expectedHash) {
          throw new Error(`Blob integrity check failed: expected ${expectedHash}, got ${actualHash}`);
        }
      }

      return { data, metadata };
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'NoSuchKey') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Check if a blob exists
   */
  async exists(ledgerId: string, entryId: string): Promise<boolean> {
    await this.initialize();

    const key = this.getKey(ledgerId, entryId);

    try {
      await this.client.send(new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }));
      return true;
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Delete a blob
   */
  async delete(ledgerId: string, entryId: string): Promise<boolean> {
    await this.initialize();

    const key = this.getKey(ledgerId, entryId);

    try {
      await this.client.send(new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }));
      return true;
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'NoSuchKey') {
        return false;
      }
      throw error;
    }
  }

  /**
   * List all blobs for a ledger
   */
  async listByLedger(
    ledgerId: string,
    options?: { maxKeys?: number; continuationToken?: string }
  ): Promise<{
    entries: Array<{ entryId: string; size: number; lastModified: Date }>;
    nextToken?: string;
    isTruncated: boolean;
  }> {
    await this.initialize();

    const prefix = `${this.keyPrefix}${ledgerId}/`;

    const response = await this.client.send(new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: prefix,
      MaxKeys: options?.maxKeys ?? 1000,
      ContinuationToken: options?.continuationToken,
    }));

    const entries = (response.Contents ?? []).map((obj) => {
      const key = obj.Key ?? '';
      const entryId = key.substring(prefix.length);
      return {
        entryId,
        size: obj.Size ?? 0,
        lastModified: obj.LastModified ?? new Date(),
      };
    });

    return {
      entries,
      nextToken: response.NextContinuationToken,
      isTruncated: response.IsTruncated ?? false,
    };
  }

  /**
   * Get blob metadata without downloading the content
   */
  async getMetadata(ledgerId: string, entryId: string): Promise<BlobMetadata | null> {
    await this.initialize();

    const key = this.getKey(ledgerId, entryId);

    try {
      const response = await this.client.send(new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }));

      return {
        entryId: response.Metadata?.['x-veilchain-entry-id'] ?? entryId,
        ledgerId: response.Metadata?.['x-veilchain-ledger-id'] ?? ledgerId,
        contentHash: response.Metadata?.['x-veilchain-content-hash'] ?? '',
        size: response.ContentLength ?? 0,
        contentType: response.ContentType ?? 'application/json',
        createdAt: response.Metadata?.['x-veilchain-created-at'] ?? new Date().toISOString(),
      };
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'NotFound') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<{
    objectCount: number;
    totalSize: number;
  }> {
    await this.initialize();

    let objectCount = 0;
    let totalSize = 0;
    let continuationToken: string | undefined;

    do {
      const response = await this.client.send(new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: this.keyPrefix,
        ContinuationToken: continuationToken,
      }));

      for (const obj of response.Contents ?? []) {
        objectCount++;
        totalSize += obj.Size ?? 0;
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    return { objectCount, totalSize };
  }
}

/**
 * Create a blob storage instance from environment variables
 *
 * Expected environment variables:
 * - S3_ENDPOINT: S3/MinIO endpoint URL
 * - S3_REGION: AWS region (default: us-east-1)
 * - S3_BUCKET: Bucket name
 * - S3_ACCESS_KEY_ID: Access key
 * - S3_SECRET_ACCESS_KEY: Secret key
 * - S3_FORCE_PATH_STYLE: Use path-style URLs (default: true)
 */
export function createBlobStorage(): BlobStorage {
  const config: BlobStorageConfig = {
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? 'us-east-1',
    bucket: process.env.S3_BUCKET ?? 'veilchain',
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? process.env.AWS_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? process.env.AWS_SECRET_ACCESS_KEY ?? '',
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
  };

  if (!config.accessKeyId || !config.secretAccessKey) {
    throw new Error('S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY are required');
  }

  return new BlobStorage(config);
}
