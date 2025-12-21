/**
 * VeilChain Services
 *
 * High-level service layer that combines core components
 * with storage, event handling, and idempotency.
 */

export { LedgerService } from './ledger.js';
export {
  IdempotencyService,
  PostgresIdempotencyStorage,
  MemoryIdempotencyStorage
} from './idempotency.js';
export type { IdempotencyStorage } from './idempotency.js';
export type { LedgerEvents, LedgerEventEmitter } from './ledger.js';

// Phase 4: Authentication Services
export { UserService } from './user.js';
export type { CreateUserOptions, UpdateUserOptions } from './user.js';

export { AuditService } from './audit.js';
export type { AuditEvent, AuditQueryFilters } from './audit.js';

export { AuthService, AuthError } from './auth.js';
export type {
  AuthConfig,
  AuthResult,
  RegisterInput,
  LoginInput,
  OAuthCallbackData,
  OAuthUserInfo,
  AuthErrorCode
} from './auth.js';

export { ApiKeyService } from './apiKey.js';
export type {
  CreateApiKeyOptions,
  CreateApiKeyResult,
  ApiKeyValidation
} from './apiKey.js';

export { PermissionService } from './permission.js';
export type {
  PermissionCheck,
  LedgerAccess,
  UserAccess
} from './permission.js';

// Crypto utilities
export {
  generateSecureToken,
  generateId,
  generateApiKey,
  hashPassword,
  verifyPassword,
  hashApiKey,
  verifyApiKey,
  hashToken,
  createJwtService,
  generatePasswordResetToken,
  generateEmailVerificationToken,
  generateOAuthState,
  secureCompare
} from './crypto.js';
export type { CryptoConfig, JwtPayload, RefreshTokenData, JwtService } from './crypto.js';
