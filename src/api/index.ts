/**
 * VeilChain REST API
 *
 * Export all API components for use in applications.
 *
 * @packageDocumentation
 */

// Server exports
export { createServer, startServer } from './server.js';

// Middleware exports
export {
  createAuthMiddleware,
  getApiKey,
  isValidApiKeyFormat,
  generateApiKey
} from './middleware/auth.js';

export {
  registerRateLimit,
  createEndpointRateLimit,
  RateLimitTiers
} from './middleware/rateLimit.js';

// Route exports
export { registerLedgerRoutes } from './routes/ledgers.js';
export { registerEntryRoutes } from './routes/entries.js';
export { registerProofRoutes } from './routes/proofs.js';

// Type exports
export type {
  ApiConfig,
  CreateLedgerRequest,
  CreateLedgerResponse,
  GetLedgerResponse,
  AppendEntryRequest,
  AppendEntryResponse,
  GetEntryResponse,
  GetRootResponse,
  GetProofResponse,
  VerifyProofRequest,
  VerifyProofResponse,
  HealthResponse,
  ErrorResponse,
  AuthenticatedRequest,
  LedgerService
} from './types.js';

export type { AuthConfig } from './middleware/auth.js';
export type { RateLimitConfig } from './middleware/rateLimit.js';
