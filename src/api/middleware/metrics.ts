/**
 * VeilChain Prometheus Metrics Middleware
 *
 * Exposes metrics for monitoring API performance, health, and business metrics.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  Registry,
  Counter,
  Histogram,
  Gauge,
  collectDefaultMetrics,
} from 'prom-client';

/**
 * Metrics registry
 */
const register = new Registry();

// Collect default Node.js metrics (CPU, memory, event loop, etc.)
collectDefaultMetrics({ register });

/**
 * HTTP request metrics
 */
const httpRequestsTotal = new Counter({
  name: 'veilchain_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

const httpRequestDuration = new Histogram({
  name: 'veilchain_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

const httpRequestSize = new Histogram({
  name: 'veilchain_http_request_size_bytes',
  help: 'HTTP request size in bytes',
  labelNames: ['method', 'route'],
  buckets: [100, 1000, 10000, 100000, 1000000, 10000000],
  registers: [register],
});

const httpResponseSize = new Histogram({
  name: 'veilchain_http_response_size_bytes',
  help: 'HTTP response size in bytes',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [100, 1000, 10000, 100000, 1000000, 10000000],
  registers: [register],
});

/**
 * Business metrics
 */
const ledgersTotal = new Gauge({
  name: 'veilchain_ledgers_total',
  help: 'Total number of ledgers',
  registers: [register],
});

const entriesTotal = new Gauge({
  name: 'veilchain_entries_total',
  help: 'Total number of entries across all ledgers',
  registers: [register],
});

const entriesAppended = new Counter({
  name: 'veilchain_entries_appended_total',
  help: 'Total number of entries appended',
  labelNames: ['ledger_id'],
  registers: [register],
});

const proofsGenerated = new Counter({
  name: 'veilchain_proofs_generated_total',
  help: 'Total number of proofs generated',
  registers: [register],
});

const proofsVerified = new Counter({
  name: 'veilchain_proofs_verified_total',
  help: 'Total number of proofs verified',
  labelNames: ['result'],
  registers: [register],
});

/**
 * Authentication metrics
 */
const authAttempts = new Counter({
  name: 'veilchain_auth_attempts_total',
  help: 'Total authentication attempts',
  labelNames: ['method', 'result'],
  registers: [register],
});

const activeUsers = new Gauge({
  name: 'veilchain_active_users',
  help: 'Number of active users (with valid sessions)',
  registers: [register],
});

/**
 * Webhook metrics
 */
const webhookDeliveriesTotal = new Counter({
  name: 'veilchain_webhook_deliveries_total',
  help: 'Total webhook deliveries',
  labelNames: ['status', 'event_type'],
  registers: [register],
});

const webhookDeliveryDuration = new Histogram({
  name: 'veilchain_webhook_delivery_duration_seconds',
  help: 'Webhook delivery duration in seconds',
  labelNames: ['event_type'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [register],
});

/**
 * Database metrics
 */
const dbQueryDuration = new Histogram({
  name: 'veilchain_db_query_duration_seconds',
  help: 'Database query duration in seconds',
  labelNames: ['operation'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
  registers: [register],
});

const dbConnectionsActive = new Gauge({
  name: 'veilchain_db_connections_active',
  help: 'Number of active database connections',
  registers: [register],
});

const dbConnectionsIdle = new Gauge({
  name: 'veilchain_db_connections_idle',
  help: 'Number of idle database connections',
  registers: [register],
});

/**
 * Security metrics
 */
const rateLimitHits = new Counter({
  name: 'veilchain_rate_limit_hits_total',
  help: 'Total rate limit hits',
  labelNames: ['endpoint'],
  registers: [register],
});

const blockedIps = new Gauge({
  name: 'veilchain_blocked_ips_total',
  help: 'Number of currently blocked IPs',
  registers: [register],
});

const securityEvents = new Counter({
  name: 'veilchain_security_events_total',
  help: 'Total security events',
  labelNames: ['type', 'severity'],
  registers: [register],
});

/**
 * Merkle tree metrics
 */
const merkleTreeDepth = new Gauge({
  name: 'veilchain_merkle_tree_depth',
  help: 'Current Merkle tree depth',
  labelNames: ['ledger_id'],
  registers: [register],
});

const merkleProofSize = new Histogram({
  name: 'veilchain_merkle_proof_size_bytes',
  help: 'Merkle proof size in bytes',
  buckets: [100, 500, 1000, 2000, 5000, 10000],
  registers: [register],
});

/**
 * Get normalized route for metrics (remove IDs)
 */
function normalizeRoute(url: string): string {
  return url
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/[0-9a-f]{24,}/gi, '/:id')
    .replace(/\/\d+/g, '/:id')
    .split('?')[0];
}

/**
 * Register metrics middleware
 */
export function registerMetricsMiddleware(fastify: FastifyInstance): void {
  // Request timing hook
  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    (request as any).startTime = process.hrtime.bigint();
  });

  // Response hook for metrics
  fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const startTime = (request as any).startTime as bigint;
    if (!startTime) return;

    const duration = Number(process.hrtime.bigint() - startTime) / 1e9;
    const route = normalizeRoute(request.url);
    const method = request.method;
    const statusCode = reply.statusCode.toString();

    // Record request metrics
    httpRequestsTotal.inc({ method, route, status_code: statusCode });
    httpRequestDuration.observe({ method, route, status_code: statusCode }, duration);

    // Record request size
    const contentLength = request.headers['content-length'];
    if (contentLength) {
      httpRequestSize.observe({ method, route }, parseInt(contentLength, 10));
    }

    // Record response size (approximate)
    const responseLength = reply.getHeader('content-length');
    if (responseLength) {
      httpResponseSize.observe(
        { method, route, status_code: statusCode },
        typeof responseLength === 'string' ? parseInt(responseLength, 10) : responseLength as number
      );
    }
  });

  // Metrics endpoint
  fastify.get('/metrics', async (_request, reply) => {
    reply.header('Content-Type', register.contentType);
    return register.metrics();
  });
}

/**
 * Export metrics for use in other parts of the application
 */
export const metrics = {
  // Business
  ledgersTotal,
  entriesTotal,
  entriesAppended,
  proofsGenerated,
  proofsVerified,

  // Auth
  authAttempts,
  activeUsers,

  // Webhooks
  webhookDeliveriesTotal,
  webhookDeliveryDuration,

  // Database
  dbQueryDuration,
  dbConnectionsActive,
  dbConnectionsIdle,

  // Security
  rateLimitHits,
  blockedIps,
  securityEvents,

  // Merkle
  merkleTreeDepth,
  merkleProofSize,

  // Registry for custom metrics
  register,
};

/**
 * Update database pool metrics
 */
export function updateDbPoolMetrics(pool: { totalCount: number; idleCount: number; waitingCount: number }): void {
  dbConnectionsActive.set(pool.totalCount - pool.idleCount);
  dbConnectionsIdle.set(pool.idleCount);
}

/**
 * Update storage metrics
 */
export function updateStorageMetrics(ledgerCount: number, entryCount: number): void {
  ledgersTotal.set(ledgerCount);
  entriesTotal.set(entryCount);
}

/**
 * Record entry append
 */
export function recordEntryAppend(ledgerId: string): void {
  entriesAppended.inc({ ledger_id: ledgerId });
}

/**
 * Record proof generation
 */
export function recordProofGenerated(): void {
  proofsGenerated.inc();
}

/**
 * Record proof verification
 */
export function recordProofVerified(valid: boolean): void {
  proofsVerified.inc({ result: valid ? 'valid' : 'invalid' });
}

/**
 * Record authentication attempt
 */
export function recordAuthAttempt(method: 'api_key' | 'jwt' | 'oauth', success: boolean): void {
  authAttempts.inc({ method, result: success ? 'success' : 'failure' });
}

/**
 * Record webhook delivery
 */
export function recordWebhookDelivery(
  eventType: string,
  status: 'success' | 'failed',
  durationSeconds: number
): void {
  webhookDeliveriesTotal.inc({ status, event_type: eventType });
  webhookDeliveryDuration.observe({ event_type: eventType }, durationSeconds);
}

/**
 * Record rate limit hit
 */
export function recordRateLimitHit(endpoint: string): void {
  rateLimitHits.inc({ endpoint });
}

/**
 * Record security event
 */
export function recordSecurityEvent(type: string, severity: 'low' | 'medium' | 'high' | 'critical'): void {
  securityEvents.inc({ type, severity });
}

/**
 * Update blocked IPs count
 */
export function updateBlockedIpsCount(count: number): void {
  blockedIps.set(count);
}

/**
 * Record database query
 */
export function recordDbQuery(operation: string, durationSeconds: number): void {
  dbQueryDuration.observe({ operation }, durationSeconds);
}

/**
 * Record Merkle proof size
 */
export function recordMerkleProofSize(sizeBytes: number): void {
  merkleProofSize.observe(sizeBytes);
}
