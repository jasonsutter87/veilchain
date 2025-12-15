/**
 * VeilChain REST API Server
 *
 * Production-ready Fastify server with security, monitoring, and error handling.
 */

import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { MerkleTree } from '../core/merkle.js';
import { hashEntry } from '../core/hash.js';
import { MemoryStorage } from '../storage/memory.js';
import { PostgresStorage, createPostgresStorage } from '../storage/postgres.js';
import { createAuthMiddleware } from './middleware/auth.js';
import { registerRateLimit, RateLimitTiers } from './middleware/rateLimit.js';
import { registerLedgerRoutes } from './routes/ledgers.js';
import { registerEntryRoutes } from './routes/entries.js';
import { registerProofRoutes } from './routes/proofs.js';
import { VERSION } from '../index.js';
import type {
  ApiConfig,
  LedgerService,
  HealthResponse
} from './types.js';
import type { LedgerMetadata, LedgerEntry, MerkleProof, StorageBackend } from '../types.js';

/**
 * Default API configuration
 */
const DEFAULT_CONFIG: ApiConfig = {
  port: 3000,
  host: '0.0.0.0',
  cors: true,
  logging: true,
  rateLimit: RateLimitTiers.STANDARD,
  storage: 'memory' // 'memory' | 'postgres'
};

/**
 * Ledger service implementation - works with any storage backend
 */
class VeilChainService implements LedgerService {
  private storage: StorageBackend;
  private trees: Map<string, MerkleTree>;

  constructor(storage: StorageBackend) {
    this.storage = storage;
    this.trees = new Map();
  }

  /**
   * Create a new ledger
   */
  async createLedger(options: {
    name: string;
    description?: string;
    schema?: Record<string, unknown>;
  }): Promise<LedgerMetadata> {
    const id = this.generateLedgerId();
    const now = new Date();
    const tree = new MerkleTree();

    const metadata: LedgerMetadata = {
      id,
      name: options.name,
      description: options.description,
      createdAt: now,
      rootHash: tree.root,
      entryCount: 0n
    };

    await this.storage.createLedgerMetadata(metadata);
    this.trees.set(id, tree);

    return metadata;
  }

  /**
   * Get ledger metadata
   */
  async getLedger(ledgerId: string): Promise<LedgerMetadata | null> {
    return await this.storage.getLedgerMetadata(ledgerId);
  }

  /**
   * List all ledgers with pagination
   */
  async listLedgers(options?: {
    offset?: number;
    limit?: number;
  }): Promise<{
    ledgers: LedgerMetadata[];
    total: number;
  }> {
    const ledgers = await this.storage.listLedgers(options);
    return {
      ledgers,
      total: ledgers.length
    };
  }

  /**
   * Append an entry to a ledger
   */
  async appendEntry<T = unknown>(
    ledgerId: string,
    data: T,
    _options?: {
      idempotencyKey?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<{
    entry: LedgerEntry<T>;
    proof: MerkleProof;
    previousRoot: string;
    newRoot: string;
  }> {
    // Get or load tree
    let tree = this.trees.get(ledgerId);
    if (!tree) {
      const hashes = await this.storage.getAllLeafHashes(ledgerId);
      tree = MerkleTree.import({ leaves: hashes });
      this.trees.set(ledgerId, tree);
    }

    const previousRoot = tree.root;

    // Create entry
    const position = BigInt(tree.size);
    const hash = hashEntry(data, position);
    const id = `${ledgerId}-${position}`;
    const now = new Date();

    const entry: LedgerEntry<T> = {
      id,
      position,
      data,
      hash,
      createdAt: now
    };

    // Append to tree
    const index = tree.append(hash);
    const newRoot = tree.root;

    // Generate proof
    const proof = tree.getProof(index);

    // Store entry
    await this.storage.put(ledgerId, entry);

    // Update metadata
    await this.storage.updateLedgerMetadata(ledgerId, {
      rootHash: newRoot,
      entryCount: BigInt(tree.size),
      lastEntryAt: now
    });

    return {
      entry,
      proof,
      previousRoot,
      newRoot
    };
  }

  /**
   * Get an entry
   */
  async getEntry<T = unknown>(
    ledgerId: string,
    entryId: string,
    includeProof = false
  ): Promise<LedgerEntry<T> | null> {
    const entry = await this.storage.get(ledgerId, entryId);
    if (!entry) return null;

    if (includeProof) {
      const proof = await this.getProof(ledgerId, entryId);
      if (proof) {
        entry.proof = proof;
      }
    }

    return entry as LedgerEntry<T>;
  }

  /**
   * List entries with pagination
   */
  async listEntries<T = unknown>(
    ledgerId: string,
    options?: {
      offset?: bigint;
      limit?: number;
    }
  ): Promise<{
    entries: LedgerEntry<T>[];
    total: bigint;
  }> {
    const entries = await this.storage.list(ledgerId, {
      offset: options?.offset,
      limit: options?.limit
    });

    const metadata = await this.storage.getLedgerMetadata(ledgerId);
    const total = metadata?.entryCount ?? 0n;

    return {
      entries: entries as LedgerEntry<T>[],
      total
    };
  }

  /**
   * Get a proof for an entry
   */
  async getProof(ledgerId: string, entryId: string): Promise<MerkleProof | null> {
    const entry = await this.storage.get(ledgerId, entryId);
    if (!entry) return null;

    // Get or load tree
    let tree = this.trees.get(ledgerId);
    if (!tree) {
      const hashes = await this.storage.getAllLeafHashes(ledgerId);
      tree = MerkleTree.import({ leaves: hashes });
      this.trees.set(ledgerId, tree);
    }

    const index = Number(entry.position);
    return tree.getProof(index);
  }

  /**
   * Get current root hash
   */
  async getCurrentRoot(ledgerId: string): Promise<{
    rootHash: string;
    entryCount: bigint;
    lastEntryAt?: Date;
  } | null> {
    const metadata = await this.storage.getLedgerMetadata(ledgerId);
    if (!metadata) return null;

    return {
      rootHash: metadata.rootHash,
      entryCount: metadata.entryCount,
      lastEntryAt: metadata.lastEntryAt
    };
  }

  /**
   * Generate a unique ledger ID
   */
  private generateLedgerId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 15);
    return `ledger_${timestamp}_${random}`;
  }
}

/**
 * Create and configure the Fastify server
 */
export async function createServer(config: Partial<ApiConfig> = {}): Promise<FastifyInstance> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  // Create Fastify instance
  const fastify = Fastify({
    logger: finalConfig.logging
      ? {
          level: 'info',
          serializers: {
            req(request) {
              return {
                method: request.method,
                url: request.url,
                headers: request.headers,
                remoteAddress: request.ip
              };
            },
            res(reply) {
              return {
                statusCode: reply.statusCode
              };
            }
          }
        }
      : false,
    disableRequestLogging: false,
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'reqId'
  });

  // Register security plugins
  await fastify.register(helmet, {
    contentSecurityPolicy: false // Allow JSON API
  });

  // Register CORS
  if (finalConfig.cors) {
    await fastify.register(cors, {
      origin: true, // Allow all origins (configure for production)
      credentials: true
    });
  }

  // Register rate limiting
  if (finalConfig.rateLimit) {
    await registerRateLimit(fastify, {
      ...finalConfig.rateLimit,
      skipRoutes: ['/health']
    });
  }

  // Register authentication
  if (finalConfig.apiKey) {
    fastify.addHook('onRequest', createAuthMiddleware({
      apiKey: finalConfig.apiKey,
      allowHealthCheck: true
    }));
  }

  // Initialize storage backend
  let storage: StorageBackend;
  let storageType = 'memory';

  if (finalConfig.storage === 'postgres' || process.env.DATABASE_URL) {
    try {
      const pgStorage = createPostgresStorage();
      await pgStorage.connect();
      storage = pgStorage;
      storageType = 'postgres';
    } catch (error) {
      console.warn('Failed to connect to PostgreSQL, falling back to memory storage:', error);
      storage = new MemoryStorage();
    }
  } else {
    storage = new MemoryStorage();
  }

  const service = new VeilChainService(storage);

  // Health check endpoint
  fastify.get('/health', async (_request, reply) => {
    const uptime = process.uptime();

    // Get stats based on storage type
    let stats = { ledgers: 0, totalEntries: 0 };
    let storageStatus = 'ok';

    if (storageType === 'postgres') {
      try {
        const healthy = await (storage as PostgresStorage).healthCheck();
        storageStatus = healthy ? 'ok' : 'degraded';
      } catch {
        storageStatus = 'error';
      }
    } else if ('getStats' in storage) {
      stats = (storage as MemoryStorage).getStats();
    }

    const response: HealthResponse = {
      status: storageStatus === 'ok' ? 'ok' : 'degraded',
      version: VERSION,
      uptime,
      timestamp: new Date().toISOString(),
      storage: {
        status: storageStatus,
        type: storageType,
        ledgers: stats.ledgers,
        totalEntries: stats.totalEntries
      }
    };

    return reply.send(response);
  });

  // Register API routes
  await registerLedgerRoutes(fastify, service);
  await registerEntryRoutes(fastify, service);
  await registerProofRoutes(fastify, service);

  // 404 handler
  fastify.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      error: {
        code: 'NOT_FOUND',
        message: `Route ${request.method} ${request.url} not found`
      }
    });
  });

  // Error handler
  fastify.setErrorHandler((error, _request, reply) => {
    fastify.log.error(error);

    // Handle validation errors
    if (error.validation) {
      return reply.code(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: error.validation
        }
      });
    }

    // Generic error response
    return reply.code(error.statusCode || 500).send({
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message: error.message || 'An unexpected error occurred'
      }
    });
  });

  return fastify;
}

/**
 * Start the API server
 */
export async function startServer(config: Partial<ApiConfig> = {}): Promise<FastifyInstance> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const fastify = await createServer(finalConfig);

  try {
    await fastify.listen({
      port: finalConfig.port,
      host: finalConfig.host
    });

    console.log(`
╔════════════════════════════════════════════════════════════╗
║  VeilChain API Server                                      ║
║  Version: ${VERSION.padEnd(48)}║
║                                                            ║
║  Server running at: http://${finalConfig.host}:${finalConfig.port.toString().padEnd(23)}║
║  Environment: ${(process.env.NODE_ENV || 'development').padEnd(44)}║
║                                                            ║
║  Health Check: GET /health                                 ║
║  API Docs: https://github.com/jasonsutter87/veilchain      ║
╚════════════════════════════════════════════════════════════╝
    `);

    return fastify;
  } catch (error) {
    fastify.log.error(error);
    throw error;
  }
}

/**
 * Main entry point
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const config: Partial<ApiConfig> = {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0',
    apiKey: process.env.API_KEY,
    cors: process.env.CORS !== 'false',
    logging: process.env.LOGGING !== 'false'
  };

  startServer(config).catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\nShutting down gracefully...');
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
