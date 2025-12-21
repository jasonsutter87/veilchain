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
import {
  IdempotencyService,
  PostgresIdempotencyStorage,
  MemoryIdempotencyStorage
} from '../services/idempotency.js';
import { UserService } from '../services/user.js';
import { AuditService } from '../services/audit.js';
import { AuthService } from '../services/auth.js';
import { ApiKeyService } from '../services/apiKey.js';
import { PermissionService } from '../services/permission.js';
import { createAuthMiddleware } from './middleware/auth.js';
import { createJwtMiddleware } from './middleware/jwt.js';
import { registerRateLimit } from './middleware/rateLimit.js';
import { registerLedgerRoutes } from './routes/ledgers.js';
import { registerEntryRoutes } from './routes/entries.js';
import { registerProofRoutes } from './routes/proofs.js';
import { registerPublicRoutes } from './routes/public.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerApiKeyRoutes } from './routes/apiKeys.js';
import { registerUserRoutes } from './routes/users.js';
import { registerPermissionRoutes } from './routes/permissions.js';
import { DEFAULT_VALIDATION_CONFIG, type ValidationConfig } from './middleware/validation.js';
import { VERSION } from '../index.js';
import type {
  ApiConfig,
  LedgerService,
  HealthResponse
} from './types.js';
import type { LedgerMetadata, LedgerEntry, MerkleProof, StorageBackend, AppendResult } from '../types.js';

/**
 * Default API configuration
 */
const DEFAULT_CONFIG: ApiConfig = {
  port: 3000,
  host: '0.0.0.0',
  cors: true,
  logging: true,
  rateLimit: {
    tier: 'STARTER', // Default to STARTER tier (100 req/sec, 50k/day)
    enableEndpointLimits: true // Enable stricter limits for write operations
  },
  storage: 'memory' // 'memory' | 'postgres'
};

/**
 * Ledger service implementation - works with any storage backend
 */
class VeilChainService implements LedgerService {
  private storage: StorageBackend;
  private trees: Map<string, MerkleTree>;
  private idempotency: IdempotencyService;

  constructor(storage: StorageBackend, idempotency: IdempotencyService) {
    this.storage = storage;
    this.idempotency = idempotency;
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
      entryCount: 0n,
      schema: options.schema
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
    options?: {
      idempotencyKey?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<{
    entry: LedgerEntry<T>;
    proof: MerkleProof;
    previousRoot: string;
    newRoot: string;
  }> {
    // Check idempotency key
    if (options?.idempotencyKey) {
      const cached = await this.idempotency.get<AppendResult<T>>(
        ledgerId,
        options.idempotencyKey
      );
      if (cached) {
        return cached;
      }
    }

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

    const result = {
      entry,
      proof,
      previousRoot,
      newRoot
    };

    // Cache for idempotency
    if (options?.idempotencyKey) {
      await this.idempotency.set(ledgerId, options.idempotencyKey, result);
    }

    return result;
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

  // Register rate limiting (applies to all routes including public ones)
  if (finalConfig.rateLimit) {
    await registerRateLimit(fastify, {
      ...finalConfig.rateLimit,
      skipRoutes: ['/health']
    });
  }

  // Initialize storage backend
  let storage: StorageBackend;
  let storageType = 'memory';
  let pgStorage: PostgresStorage | null = null;

  if (finalConfig.storage === 'postgres' || process.env.DATABASE_URL) {
    try {
      pgStorage = createPostgresStorage();
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

  // Initialize idempotency service
  let idempotencyService: IdempotencyService;
  if (storageType === 'postgres' && pgStorage) {
    const idempotencyStorage = new PostgresIdempotencyStorage(pgStorage.pool);
    idempotencyService = new IdempotencyService(idempotencyStorage);
  } else {
    const idempotencyStorage = new MemoryIdempotencyStorage();
    idempotencyService = new IdempotencyService(idempotencyStorage);
  }

  const service = new VeilChainService(storage, idempotencyService);

  // Initialize auth services (only for PostgreSQL storage)
  let userService: UserService | undefined;
  let auditService: AuditService | undefined;
  let authService: AuthService | undefined;
  let apiKeyService: ApiKeyService | undefined;
  let permissionService: PermissionService | undefined;

  if (storageType === 'postgres' && pgStorage) {
    userService = new UserService(pgStorage.pool);
    auditService = new AuditService(pgStorage.pool);
    apiKeyService = new ApiKeyService(pgStorage.pool, auditService);
    permissionService = new PermissionService(pgStorage.pool, auditService);

    // Only create AuthService if JWT keys are configured
    if (process.env.JWT_PRIVATE_KEY && process.env.JWT_PUBLIC_KEY) {
      authService = new AuthService(pgStorage.pool, userService, auditService, {
        jwt: {
          privateKey: process.env.JWT_PRIVATE_KEY,
          publicKey: process.env.JWT_PUBLIC_KEY,
          issuer: process.env.JWT_ISSUER || 'veilchain',
          audience: process.env.JWT_AUDIENCE || 'veilchain-api',
        },
        bcryptCostFactor: parseInt(process.env.BCRYPT_COST_FACTOR || '12', 10),
        baseUrl: process.env.BASE_URL || `http://localhost:${finalConfig.port}`,
        oauth: {
          github: process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
            ? {
                clientId: process.env.GITHUB_CLIENT_ID,
                clientSecret: process.env.GITHUB_CLIENT_SECRET,
              }
            : undefined,
          google: process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
            ? {
                clientId: process.env.GOOGLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
              }
            : undefined,
        },
      });
    }
  }

  // Register public routes first (before authentication)
  await registerPublicRoutes(fastify, service);

  // Register auth routes (before authentication middleware)
  if (authService && userService) {
    await registerAuthRoutes(fastify, authService, userService);
  }

  // Register authentication middleware
  if (authService && apiKeyService) {
    // Use JWT + API key authentication
    fastify.addHook('onRequest', createJwtMiddleware({
      authService,
      apiKeyService,
      skipRoutes: [
        '/health',
        '/v1/public/*',
        '/v1/auth/register',
        '/v1/auth/login',
        '/v1/auth/refresh',
        '/v1/auth/forgot-password',
        '/v1/auth/reset-password',
        '/v1/auth/verify-email',
        '/v1/auth/github',
        '/v1/auth/github/callback',
        '/v1/auth/google',
        '/v1/auth/google/callback',
      ],
      optional: false,
    }));
  } else if (finalConfig.apiKey) {
    // Fallback to simple API key authentication
    fastify.addHook('onRequest', createAuthMiddleware({
      apiKey: finalConfig.apiKey,
      allowHealthCheck: true,
      skipPublicRoutes: true
    }));
  }

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

  // Prepare validation config
  const validationConfig: ValidationConfig = {
    ...DEFAULT_VALIDATION_CONFIG,
    ...finalConfig.validation
  };

  // Register API routes
  await registerLedgerRoutes(fastify, service, validationConfig);
  await registerEntryRoutes(fastify, service, validationConfig);
  await registerProofRoutes(fastify, service);

  // Register auth-related routes (only if auth services are available)
  if (apiKeyService) {
    await registerApiKeyRoutes(fastify, apiKeyService);
  }

  if (permissionService) {
    await registerPermissionRoutes(fastify, permissionService);
  }

  if (userService && auditService && permissionService && pgStorage) {
    await registerUserRoutes(fastify, userService, auditService, permissionService, pgStorage.pool);
  }

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
